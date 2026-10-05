package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"budgero-server/internal/adapter/driving/http/handler"
	"budgero-server/internal/testkit"

	"github.com/labstack/echo/v4"
)

func setupPurgeHandler(t *testing.T) (*handler.Handlers, *echo.Echo, *testkit.TestContext) {
	t.Helper()
	sqlDB, queries, services, cfg := testkit.NewTestServices(t, false)
	cfg.Auth.AdminEmails = []string{"admin@example.com"}
	cfg.Auth.ClerkSecretKey = "" // never call Clerk from tests
	h := handler.NewHandlers(services, nil, handler.Options{SelfHost: false, Config: cfg})
	return h, echo.New(), &testkit.TestContext{DB: sqlDB, Queries: queries}
}

func purgeRequest(t *testing.T, h *handler.Handlers, e *echo.Echo, requester, body string) (*httptest.ResponseRecorder, error) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/purge", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setUserContext(c, requester)
	return rec, h.PurgeUsers(c)
}

func TestPurgeUsersRequiresConfirmation(t *testing.T) {
	h, e, tc := setupPurgeHandler(t)
	admin := testkit.SeedUser(t, tc.Queries, "admin@example.com")
	victim := testkit.SeedUser(t, tc.Queries, "victim@example.com")

	_, err := purgeRequest(t, h, e, admin, `{"user_ids":["`+victim+`"]}`)
	var httpErr *echo.HTTPError
	if !asHTTPError(err, &httpErr) || httpErr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 without confirmation, got %v", err)
	}
}

func asHTTPError(err error, target **echo.HTTPError) bool {
	he, ok := err.(*echo.HTTPError) //nolint:errorlint // echo returns it unwrapped
	if ok {
		*target = he
	}
	return ok
}

func TestPurgeUsersNeverTouchesProtectedAccounts(t *testing.T) {
	h, e, tc := setupPurgeHandler(t)
	admin := testkit.SeedUser(t, tc.Queries, "admin@example.com")
	otherAdmin := testkit.SeedUser(t, tc.Queries, "ADMIN@example.com.au")
	paying := testkit.SeedUser(t, tc.Queries, "paying@example.com")
	founder := testkit.SeedUser(t, tc.Queries, "founder@example.com")
	trial := testkit.SeedUser(t, tc.Queries, "trial@example.com")
	victim := testkit.SeedUser(t, tc.Queries, "victim@example.com")
	mustExec(t, tc, `UPDATE users SET subscription_status = 'active', subscription_id = 'sub_1' WHERE id = ?`, paying)
	mustExec(t, tc, `UPDATE users SET is_founding_member = 1 WHERE id = ?`, founder)
	// A self-managed trial has no subscription id: not protected.
	mustExec(t, tc, `UPDATE users SET subscription_status = 'trialing' WHERE id = ?`, trial)

	body := `{"confirm":"DELETE","user_ids":["` + strings.Join(
		[]string{admin, otherAdmin, paying, founder, trial, victim, "missing"}, `","`) + `"]}`
	rec, err := purgeRequest(t, h, e, admin, body)
	if err != nil {
		t.Fatal(err)
	}
	var resp struct {
		Results []handler.PurgeUserResult `json:"results"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, r := range resp.Results {
		got[r.UserID] = r.Status + ":" + r.Reason
	}
	want := map[string]string{
		admin:      "skipped:protected: you",
		otherAdmin: "purged:", // only exact admin emails are protected
		paying:     "skipped:protected: paying subscriber",
		founder:    "skipped:protected: founding member",
		trial:      "purged:",
		victim:     "purged:",
		"missing":  "skipped:user not found",
	}
	for id, w := range want {
		if got[id] != w {
			t.Errorf("%s: got %q, want %q", id, got[id], w)
		}
	}
	for _, id := range []string{admin, paying, founder} {
		if n := countRows(t, tc, `SELECT COUNT(*) FROM users WHERE id = ?`, id); n != 1 {
			t.Errorf("protected user %s was deleted", id)
		}
	}
	for _, id := range []string{trial, victim} {
		if n := countRows(t, tc, `SELECT COUNT(*) FROM users WHERE id = ?`, id); n != 0 {
			t.Errorf("user %s was not purged", id)
		}
	}
}

func TestGetInactiveUsersUsesHeartbeatsAndSignUp(t *testing.T) {
	h, e, tc := setupPurgeHandler(t)
	admin := testkit.SeedUser(t, tc.Queries, "admin@example.com")
	dormant := testkit.SeedUser(t, tc.Queries, "dormant@example.com")
	active := testkit.SeedUser(t, tc.Queries, "active@example.com")
	newbie := testkit.SeedUser(t, tc.Queries, "new@example.com")
	longAgo := time.Now().AddDate(-1, 0, 0)
	for _, id := range []string{admin, dormant, active} {
		mustExec(t, tc, `UPDATE users SET created_at = ? WHERE id = ?`, longAgo, id)
	}
	mustExec(t, tc, `INSERT INTO user_daily_activity (user_id, day, first_seen_at, last_seen_at, hit_count)
		VALUES (?, ?, ?, ?, 1)`, dormant, longAgo.Format(time.DateOnly), longAgo, longAgo)
	recent := time.Now().AddDate(0, 0, -3)
	mustExec(t, tc, `INSERT INTO user_daily_activity (user_id, day, first_seen_at, last_seen_at, hit_count)
		VALUES (?, ?, ?, ?, 1)`, active, recent.Format(time.DateOnly), recent, recent)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/inactive?days=90", http.NoBody)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setUserContext(c, admin)
	if err := h.GetInactiveUsers(c); err != nil {
		t.Fatal(err)
	}
	var resp struct {
		Users []handler.InactiveUser `json:"users"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	listed := map[string]string{}
	for _, u := range resp.Users {
		listed[u.ID] = u.ProtectedReason
	}
	if _, ok := listed[dormant]; !ok {
		t.Error("dormant user missing")
	}
	if reason, ok := listed[admin]; !ok || reason != "you" {
		t.Errorf("admin should be listed as protected, got %q (listed %v)", reason, ok)
	}
	if _, ok := listed[active]; ok {
		t.Error("recently active user listed")
	}
	if _, ok := listed[newbie]; ok {
		t.Error("newly created user listed")
	}

	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/inactive?days=7", http.NoBody)
	c = e.NewContext(req, httptest.NewRecorder())
	if err := h.GetInactiveUsers(c); err == nil {
		t.Error("expected an error for days < 30")
	}
}

func mustExec(t *testing.T, tc *testkit.TestContext, query string, args ...any) {
	t.Helper()
	if _, err := tc.DB.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func countRows(t *testing.T, tc *testkit.TestContext, query string, args ...any) int {
	t.Helper()
	var n int
	if err := tc.DB.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
