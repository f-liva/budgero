package application_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"budgero-server/internal/domain"
	"budgero-server/internal/testkit"
)

func count(t *testing.T, db *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return n
}

func exec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatalf("%s: %v", query, err)
	}
}

func TestUserPurgeRemovesEverythingTiedToTheUser(t *testing.T) {
	// Production enables foreign keys; the purge must work, and clean up the
	// same rows, either way.
	for _, foreignKeys := range []bool{false, true} {
		name := "foreign keys off"
		if foreignKeys {
			name = "foreign keys on"
		}
		t.Run(name, func(t *testing.T) { testUserPurge(t, foreignKeys) })
	}
}

func testUserPurge(t *testing.T, foreignKeys bool) {
	db, queries, services, _ := testkit.NewTestServices(t, false)
	ctx := context.Background()
	if foreignKeys {
		db.SetMaxOpenConns(1) // the pragma is per connection
		exec(t, db, `PRAGMA foreign_keys = ON`)
	}

	gone := testkit.SeedUser(t, queries, "gone@example.com")
	stays := testkit.SeedUser(t, queries, "stays@example.com")

	// The user's own space, shared with the other user.
	own := testkit.SeedSpace(t, db, queries, gone, "Mine")
	testkit.SeedMembership(t, queries, own, stays, "member")
	var blobPath string
	if err := db.QueryRow(`SELECT blob_path FROM budget_space_blobs WHERE space_id = ?`, own).Scan(&blobPath); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(blobPath, []byte("encrypted"), 0o600); err != nil {
		t.Fatal(err)
	}
	exec(t, db, `UPDATE users SET primary_space_id = ? WHERE id = ?`, own, stays)

	// The other user's space, which the purged user was a member of.
	theirs := testkit.SeedSpace(t, db, queries, stays, "Theirs")
	testkit.SeedMembership(t, queries, theirs, gone, "member")

	testkit.SeedMutation(t, queries, own, gone, 1, "a")
	testkit.SeedMutation(t, queries, own, stays, 2, "b")
	testkit.SeedMutation(t, queries, theirs, gone, 1, "c")
	testkit.SeedMutation(t, queries, theirs, stays, 2, "d")
	testkit.SeedPushToken(t, queries, stays, own)
	testkit.SeedInvite(t, queries, theirs, stays, "GONE@example.com")
	testkit.SeedInvite(t, queries, theirs, stays, "someone@example.com")

	exec(t, db, `INSERT INTO user_daily_activity (user_id, day, first_seen_at, last_seen_at, hit_count)
		VALUES (?, '2026-01-02', ?, ?, 3)`, gone, time.Now(), time.Now())
	exec(t, db, `INSERT INTO sent_emails (user_id, template, sent_at) VALUES (?, 'welcome', ?)`, gone, time.Now())
	exec(t, db, `INSERT INTO beta_invites (code, created_by, expires_at) VALUES ('made', ?, ?)`, gone, time.Now())
	exec(t, db, `INSERT INTO beta_invites (code, created_by, used_by, expires_at) VALUES ('used', ?, ?, ?)`,
		stays, gone, time.Now())

	report, err := services.UserPurge.Purge(ctx, gone)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}

	if report.Email != "gone@example.com" || len(report.SpacesDeleted) != 1 || report.SpacesDeleted[0] != own {
		t.Fatalf("report = %+v", report)
	}
	if report.MutationsDeleted != 2 || report.MutationsAnonymized != 1 || report.ActivityDaysDeleted != 1 ||
		report.EmailsDeleted != 1 || report.InvitesDeleted != 1 || report.FilesRemoved != 1 {
		t.Fatalf("report counts = %+v", report)
	}

	checks := []struct {
		name  string
		query string
		args  []any
		want  int
	}{
		{"user row", `SELECT COUNT(*) FROM users WHERE id = ?`, []any{gone}, 0},
		{"owned space", `SELECT COUNT(*) FROM budget_spaces WHERE space_id = ?`, []any{own}, 0},
		{"owned space blob row", `SELECT COUNT(*) FROM budget_space_blobs WHERE space_id = ?`, []any{own}, 0},
		{"owned space members", `SELECT COUNT(*) FROM budget_space_members WHERE space_id = ?`, []any{own}, 0},
		{"owned space mutation log", `SELECT COUNT(*) FROM mutation_log WHERE space_id = ?`, []any{own}, 0},
		{"user id anywhere in mutation log", `SELECT COUNT(*) FROM mutation_log WHERE user_id = ?`, []any{gone}, 0},
		{"shared space keeps its history", `SELECT COUNT(*) FROM mutation_log WHERE space_id = ?`, []any{theirs}, 2},
		{"other user's push token for the deleted space", `SELECT COUNT(*) FROM push_api_tokens WHERE space_id = ?`, []any{own}, 0},
		{"memberships of the user", `SELECT COUNT(*) FROM budget_space_members WHERE user_id = ?`, []any{gone}, 0},
		{"heartbeats", `SELECT COUNT(*) FROM user_daily_activity WHERE user_id = ?`, []any{gone}, 0},
		{"sent emails", `SELECT COUNT(*) FROM sent_emails WHERE user_id = ?`, []any{gone}, 0},
		{"beta invites created by the user", `SELECT COUNT(*) FROM beta_invites WHERE created_by = ?`, []any{gone}, 0},
		{"beta invites used by the user", `SELECT COUNT(*) FROM beta_invites WHERE used_by = ?`, []any{gone}, 0},
		{"invites to the user's email", `SELECT COUNT(*) FROM budget_space_invites WHERE lower(invitee_email) = 'gone@example.com'`, nil, 0},
		{"other invites", `SELECT COUNT(*) FROM budget_space_invites WHERE invitee_email = 'someone@example.com'`, nil, 1},
		{"other user", `SELECT COUNT(*) FROM users WHERE id = ?`, []any{stays}, 1},
		{"other user's space", `SELECT COUNT(*) FROM budget_spaces WHERE space_id = ?`, []any{theirs}, 1},
		{"dangling primary space", `SELECT COUNT(*) FROM users WHERE primary_space_id = ?`, []any{own}, 0},
	}
	for _, c := range checks {
		if got := count(t, db, c.query, c.args...); got != c.want {
			t.Errorf("%s: got %d rows, want %d", c.name, got, c.want)
		}
	}
	if _, err := os.Stat(blobPath); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("blob file still exists: %v", err)
	}

	if _, err := services.UserPurge.Purge(ctx, gone); !errors.Is(err, domain.ErrUserNotFound) {
		t.Fatalf("second purge: %v", err)
	}
}

func TestUserActivityListsSpacesAndHeartbeats(t *testing.T) {
	db, queries, services, _ := testkit.NewTestServices(t, false)
	user := testkit.SeedUser(t, queries, "a@example.com")
	other := testkit.SeedUser(t, queries, "b@example.com")
	testkit.SeedSpace(t, db, queries, user, "Mine")
	theirs := testkit.SeedSpace(t, db, queries, other, "Theirs")
	testkit.SeedMembership(t, queries, theirs, user, "member")
	exec(t, db, `UPDATE budget_space_blobs SET size_bytes = 4096 WHERE space_id IN
		(SELECT space_id FROM budget_spaces WHERE owner_user_id = ?)`, user)
	for _, day := range []string{"2026-01-02", "2026-03-04"} {
		exec(t, db, `INSERT INTO user_daily_activity (user_id, day, first_seen_at, last_seen_at, hit_count)
			VALUES (?, ?, ?, ?, 1)`, user, day, time.Now(), time.Now())
	}

	users, err := services.UserPurge.ListActivity(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var got *domain.UserActivitySummary
	for i := range users {
		if users[i].ID == user {
			got = &users[i]
		}
	}
	if got == nil {
		t.Fatal("user missing from activity list")
	}
	if got.LastHeartbeatDay != "2026-03-04" || got.OwnedSpaces != 1 || got.SharedSpaces != 1 ||
		got.StoredBytes != 4096 || got.CreatedAt == nil {
		t.Fatalf("summary = %+v", got)
	}
}
