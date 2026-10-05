package handler

import (
	"context"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"budgero-server/internal/adapter/driving/http/middleware"
	"budgero-server/internal/domain"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

const (
	defaultInactiveDays = 180
	minInactiveDays     = 30
	maxPurgeBatch       = 200
	purgeConfirmation   = "DELETE"
)

// protectedSubscriptionStatuses are paid subscriptions that must never be purged.
var protectedSubscriptionStatuses = map[string]bool{
	"active": true, "trialing": true, "paused": true, "past_due": true,
}

// InactiveUser is one row of the admin inactive-users list.
type InactiveUser struct {
	domain.UserActivitySummary
	// LastActiveAt is the latest of sign-up, heartbeats and Clerk activity.
	LastActiveAt      time.Time  `json:"last_active_at"`
	ClerkLastActiveAt *time.Time `json:"clerk_last_active_at,omitempty"`
	ClerkLastSignInAt *time.Time `json:"clerk_last_sign_in_at,omitempty"`
	// InClerk is nil when Clerk wasn't checked (self-host, or Clerk unreachable).
	InClerk *bool `json:"in_clerk,omitempty"`
	// ProtectedReason, when set, explains why the user can't be purged.
	ProtectedReason string `json:"protected_reason,omitempty"`
}

// protectedReason returns why a user must not be purged, or "".
func (h *Handlers) protectedReason(u *domain.UserActivitySummary, requesterID string) string {
	switch {
	case u.ID == requesterID:
		return "you"
	case h.cfg != nil && h.cfg.IsAdmin(u.Email):
		return "admin"
	case u.HasSubscription && protectedSubscriptionStatuses[u.SubscriptionStatus]:
		return "paying subscriber"
	case u.IsFoundingMember:
		return "founding member"
	}
	return ""
}

type clerkActivity struct {
	lastActive *time.Time
	lastSignIn *time.Time
}

func millisToTime(ms *int64) *time.Time {
	if ms == nil || *ms <= 0 {
		return nil
	}
	t := time.UnixMilli(*ms).UTC()
	return &t
}

// clerkActivityFor fetches Clerk's last-active and last-sign-in times. ok is
// false when Clerk isn't configured or couldn't be reached; then nothing can be
// concluded about which users exist in Clerk.
func (h *Handlers) clerkActivityFor(ctx context.Context, ids []string) (map[string]clerkActivity, bool) {
	if h.selfHostMode || h.cfg == nil || h.cfg.Auth.ClerkSecretKey == "" {
		return nil, false
	}
	clerk.SetKey(h.cfg.Auth.ClerkSecretKey)
	out := make(map[string]clerkActivity, len(ids))
	for start := 0; start < len(ids); start += 100 {
		batch := ids[start:min(start+100, len(ids))]
		params := &clerkuser.ListParams{UserIDs: batch}
		params.Limit = clerk.Int64(100)
		list, err := clerkuser.List(ctx, params)
		if err != nil {
			log.Warn().Err(err).Msg("failed to fetch Clerk activity for inactive users")
			return nil, false
		}
		for _, cu := range list.Users {
			out[cu.ID] = clerkActivity{
				lastActive: millisToTime(cu.LastActiveAt),
				lastSignIn: millisToTime(cu.LastSignInAt),
			}
		}
	}
	return out, true
}

// lastActiveAt is the latest sign of life: sign-up, heartbeat days, Clerk activity.
func lastActiveAt(u *domain.UserActivitySummary, ca clerkActivity) time.Time {
	var latest time.Time
	consider := func(t *time.Time) {
		if t != nil && t.After(latest) {
			latest = *t
		}
	}
	consider(u.CreatedAt)
	if day, err := time.Parse(time.DateOnly, u.LastHeartbeatDay); err == nil {
		end := day.Add(24*time.Hour - time.Second)
		consider(&end)
	}
	consider(ca.lastActive)
	consider(ca.lastSignIn)
	return latest
}

// GetInactiveUsers lists users with no sign of life for `days` days (default
// 180): no heartbeat, no Clerk activity and no sign-up in that window.
func (h *Handlers) GetInactiveUsers(c echo.Context) error {
	days := defaultInactiveDays
	if raw := c.QueryParam("days"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < minInactiveDays {
			return echo.NewHTTPError(http.StatusBadRequest, "days must be a number of at least 30")
		}
		days = parsed
	}
	ctx := c.Request().Context()
	users, err := h.services.UserPurge.ListActivity(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list users")
	}
	ids := make([]string, 0, len(users))
	for i := range users {
		ids = append(ids, users[i].ID)
	}
	clerkData, clerkChecked := h.clerkActivityFor(ctx, ids)

	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	requester := middleware.GetUserIDFromContext(c)
	result := []InactiveUser{}
	for i := range users {
		u := users[i]
		ca := clerkData[u.ID]
		row := InactiveUser{
			UserActivitySummary: u,
			LastActiveAt:        lastActiveAt(&u, ca),
			ClerkLastActiveAt:   ca.lastActive,
			ClerkLastSignInAt:   ca.lastSignIn,
			ProtectedReason:     h.protectedReason(&u, requester),
		}
		if clerkChecked && strings.HasPrefix(u.ID, "user_") {
			_, found := clerkData[u.ID]
			row.InClerk = &found
		}
		if row.LastActiveAt.Before(cutoff) {
			result = append(result, row)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].LastActiveAt.Before(result[j].LastActiveAt) })

	return c.JSON(http.StatusOK, map[string]any{
		"days":          days,
		"cutoff":        cutoff,
		"clerk_checked": clerkChecked,
		"users":         result,
	})
}

type purgeUsersRequest struct {
	UserIDs         []string `json:"user_ids"`
	DeleteFromClerk bool     `json:"delete_from_clerk"`
	Confirm         string   `json:"confirm"`
}

// PurgeUserResult is the outcome for one user in a purge request.
type PurgeUserResult struct {
	UserID string                  `json:"user_id"`
	Status string                  `json:"status"` // purged | skipped | failed
	Reason string                  `json:"reason,omitempty"`
	Report *domain.UserPurgeReport `json:"report,omitempty"`
}

// PurgeUsers permanently deletes the given users and all of their data, and,
// unless told otherwise, their Clerk accounts. Admins, paying subscribers,
// founding members and the requesting admin are always skipped.
func (h *Handlers) PurgeUsers(c echo.Context) error {
	var req purgeUsersRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}
	if req.Confirm != purgeConfirmation {
		return echo.NewHTTPError(http.StatusBadRequest, `confirm must be "DELETE"`)
	}
	if len(req.UserIDs) == 0 || len(req.UserIDs) > maxPurgeBatch {
		return echo.NewHTTPError(http.StatusBadRequest, "send between 1 and 200 user ids")
	}

	ctx := c.Request().Context()
	users, err := h.services.UserPurge.ListActivity(ctx)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list users")
	}
	byID := make(map[string]*domain.UserActivitySummary, len(users))
	for i := range users {
		byID[users[i].ID] = &users[i]
	}
	requester := middleware.GetUserIDFromContext(c)
	useClerk := req.DeleteFromClerk && !h.selfHostMode && h.cfg != nil && h.cfg.Auth.ClerkSecretKey != ""
	if useClerk {
		clerk.SetKey(h.cfg.Auth.ClerkSecretKey)
	}

	results := make([]PurgeUserResult, 0, len(req.UserIDs))
	seen := map[string]bool{}
	for _, id := range req.UserIDs {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		u, ok := byID[id]
		if !ok {
			results = append(results, PurgeUserResult{UserID: id, Status: "skipped", Reason: "user not found"})
			continue
		}
		if reason := h.protectedReason(u, requester); reason != "" {
			results = append(results, PurgeUserResult{UserID: id, Status: "skipped", Reason: "protected: " + reason})
			continue
		}
		// Clerk first: if that fails, keep the local data so nothing is half-deleted
		// and the admin can retry. A user already gone from Clerk is fine.
		if useClerk && strings.HasPrefix(id, "user_") {
			if _, cerr := clerkuser.Delete(ctx, id); cerr != nil && !isClerkNotFound(cerr) {
				log.Warn().Err(cerr).Str("user_id", id).Msg("failed to delete Clerk user during purge")
				results = append(results, PurgeUserResult{UserID: id, Status: "failed", Reason: "Clerk deletion failed"})
				continue
			}
		}
		report, perr := h.purgeUser(ctx, id)
		if perr != nil {
			results = append(results, PurgeUserResult{UserID: id, Status: "failed", Reason: "purge failed"})
			continue
		}
		results = append(results, PurgeUserResult{UserID: id, Status: "purged", Report: report})
	}

	return c.JSON(http.StatusOK, map[string]any{"results": results})
}

// purgeUser deletes a user's data and drops the in-memory sync state of the
// spaces that went with them.
func (h *Handlers) purgeUser(ctx context.Context, userID string) (*domain.UserPurgeReport, error) {
	report, err := h.services.UserPurge.Purge(ctx, userID)
	if err != nil {
		if !errors.Is(err, domain.ErrUserNotFound) {
			log.Error().Err(err).Str("user_id", userID).Msg("user purge failed")
		}
		return nil, err
	}
	if h.syncHub != nil {
		for _, spaceID := range report.SpacesDeleted {
			if rerr := h.syncHub.ResetSpace(spaceID); rerr != nil {
				log.Error().Err(rerr).Str("space_id", spaceID).Msg("failed to reset sync state after purge")
			}
		}
	}
	// Counts only: the report is the audit trail without personal data.
	log.Info().
		Str("user_id", userID).
		Int("spaces", len(report.SpacesDeleted)).
		Int64("mutations", report.MutationsDeleted).
		Int64("mutations_anonymized", report.MutationsAnonymized).
		Int("files", report.FilesRemoved).
		Msg("user purged")
	return report, nil
}

func isClerkNotFound(err error) bool {
	var apiErr *clerk.APIErrorResponse
	return errors.As(err, &apiErr) && apiErr.HTTPStatusCode == http.StatusNotFound
}
