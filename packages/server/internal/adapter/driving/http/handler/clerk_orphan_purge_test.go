package handler_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"budgero-server/internal/adapter/driving/http/handler"
	"budgero-server/internal/testkit"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/labstack/echo/v4"
)

// fakeClerk serves GET /users (one page of `listed` users), /users/count and GET /users/{id}
// (404 for `gone`, 500 for anything else not listed).
func fakeClerk(t *testing.T, listed []string, gone map[string]bool) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/users/count" {
			_, _ = w.Write([]byte(`{"object":"total_count","total_count":` + strconv.Itoa(len(listed)) + `}`))
			return
		}
		if r.URL.Path == "/users" {
			if r.URL.Query().Get("offset") != "0" {
				_, _ = w.Write([]byte(`[]`))
				return
			}
			users := make([]string, 0, len(listed))
			for _, id := range listed {
				users = append(users, `{"id":"`+id+`","primary_email_address_id":"e","email_addresses":[{"id":"e","email_address":"`+id+`@example.com"}]}`)
			}
			_, _ = w.Write([]byte(`[` + strings.Join(users, ",") + `]`))
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/users/")
		if gone[id] {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"errors":[{"code":"resource_not_found","message":"not found"}]}`))
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"errors":[{"code":"internal","message":"boom"}]}`))
	}))
	t.Cleanup(srv.Close)
	clerk.SetBackend(clerk.NewBackend(&clerk.BackendConfig{URL: clerk.String(srv.URL)}))
	t.Cleanup(func() { clerk.SetBackend(clerk.NewBackend(&clerk.BackendConfig{})) })
}

func clerkSyncHandler(t *testing.T) (*handler.Handlers, *echo.Echo, *testkit.TestContext) {
	t.Helper()
	sqlDB, queries, services, cfg := testkit.NewTestServices(t, false)
	cfg.Auth.ClerkSecretKey = "sk_test_fake"
	h := handler.NewHandlers(services, nil, handler.Options{SelfHost: false, Config: cfg})
	return h, echo.New(), &testkit.TestContext{DB: sqlDB, Queries: queries}
}

func runClerkSync(t *testing.T, h *handler.Handlers, e *echo.Echo) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sync/clerk", http.NoBody)
	if err := h.SyncClerkUsers(e.NewContext(req, httptest.NewRecorder())); err != nil {
		t.Fatal(err)
	}
}

func seedUserWithID(t *testing.T, tc *testkit.TestContext, id string) {
	t.Helper()
	mustExec(t, tc, `INSERT INTO users (id, name, email, db_path, created_at) VALUES (?, ?, ?, '', datetime('now'))`,
		id, id, id+"@example.com")
}

func TestClerkSyncPurgesOnlyConfirmedDeletions(t *testing.T) {
	h, e, tc := clerkSyncHandler(t)
	for _, id := range []string{"user_keep", "user_gone", "user_flaky", "local_account"} {
		seedUserWithID(t, tc, id)
	}
	space := testkit.SeedSpace(t, tc.DB, tc.Queries, "user_gone", "Gone's budget")
	testkit.SeedMutation(t, tc.Queries, space, "user_gone", 1, "payload")
	fakeClerk(t, []string{"user_keep"}, map[string]bool{"user_gone": true})

	runClerkSync(t, h, e)

	for id, want := range map[string]int{"user_keep": 1, "user_gone": 0, "user_flaky": 1, "local_account": 1} {
		if got := countRows(t, tc, `SELECT COUNT(*) FROM users WHERE id = ?`, id); got != want {
			t.Errorf("%s: %d rows, want %d", id, got, want)
		}
	}
	if n := countRows(t, tc, `SELECT COUNT(*) FROM mutation_log WHERE space_id = ?`, space); n != 0 {
		t.Errorf("deleted Clerk user's mutation log kept %d rows", n)
	}
}

func TestClerkSyncSkipsCleanupWhenClerkListsNobody(t *testing.T) {
	h, e, tc := clerkSyncHandler(t)
	seedUserWithID(t, tc, "user_a")
	fakeClerk(t, nil, map[string]bool{"user_a": true})

	runClerkSync(t, h, e)

	if n := countRows(t, tc, `SELECT COUNT(*) FROM users WHERE id = 'user_a'`); n != 1 {
		t.Error("user purged although Clerk returned an empty list")
	}
}
