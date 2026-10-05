package handler

import (
	"errors"
	"net/http"

	"budgero-server/internal/adapter/driving/http/bankrelay"
	"budgero-server/internal/adapter/driving/http/middleware"

	"github.com/labstack/echo/v4"
)

// IssueBankRelayTicket exchanges the session JWT for a short-lived ticket
// that opens the bank relay WebSocket. It also echoes the caller's IP, which
// the client forwards (inside the TLS tunnel) as the PSU IP header so banks
// treat syncs as user-present fetches.
func (h *Handlers) IssueBankRelayTicket(c echo.Context) error {
	userID := middleware.GetUserIDFromContext(c)
	if userID == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "user not authenticated")
	}
	ticket, expires, err := h.bankRelay.IssueTicket(userID)
	if errors.Is(err, bankrelay.ErrThrottled) {
		return echo.NewHTTPError(http.StatusTooManyRequests, "bank relay rate limit exceeded")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to issue relay ticket")
	}
	return c.JSON(http.StatusOK, map[string]any{
		"ticket":     ticket,
		"expires_at": expires.UTC(),
		"client_ip":  c.RealIP(),
	})
}

// BankRelay upgrades to a Wisp WebSocket that only reaches the bank
// aggregator. The ticket sits in the path because libcurl.js appends nothing
// to the proxy URL and browsers can't set WebSocket headers.
func (h *Handlers) BankRelay(c echo.Context) error {
	release, err := h.bankRelay.Acquire(c.Param("ticket"))
	if errors.Is(err, bankrelay.ErrThrottled) {
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many bank relay sessions")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid relay ticket")
	}
	defer release()

	upgrader := getUpgrader(h.cfg)
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return nil //nolint:nilerr // Upgrade already wrote the error response.
	}
	h.bankRelay.Serve(c.Request().Context(), ws)
	return nil
}
