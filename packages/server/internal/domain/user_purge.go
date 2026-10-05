package domain

import "time"

// UserPurgeReport describes what a permanent user purge removed.
type UserPurgeReport struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	// SpacesDeleted are the budget spaces the user owned. Spaces owned by
	// others that the user was a member of are left in place.
	SpacesDeleted []string `json:"spaces_deleted"`
	// MutationsDeleted counts mutation log rows of the deleted spaces.
	MutationsDeleted int64 `json:"mutations_deleted"`
	// MutationsAnonymized counts the user's rows in other people's shared
	// spaces: the encrypted ops stay (the space needs them) but lose the user ID.
	MutationsAnonymized int64 `json:"mutations_anonymized"`
	SnapshotsDeleted    int64 `json:"snapshots_deleted"`
	ActivityDaysDeleted int64 `json:"activity_days_deleted"`
	EmailsDeleted       int64 `json:"emails_deleted"`
	InvitesDeleted      int64 `json:"invites_deleted"`
	FilesRemoved        int   `json:"files_removed"`
}

// UserActivitySummary is one user's account and activity data, used to find
// inactive accounts.
type UserActivitySummary struct {
	ID                 string     `json:"id"`
	Email              string     `json:"email"`
	Name               string     `json:"name"`
	CreatedAt          *time.Time `json:"created_at,omitempty"`
	LastHeartbeatDay   string     `json:"last_heartbeat_day,omitempty"` // YYYY-MM-DD, empty if never seen
	SubscriptionStatus string     `json:"subscription_status"`
	HasSubscription    bool       `json:"has_subscription"`
	TrialEndsAt        *time.Time `json:"trial_ends_at,omitempty"`
	IsFoundingMember   bool       `json:"is_founding_member"`
	IsBlocked          bool       `json:"is_blocked"`
	OwnedSpaces        int        `json:"owned_spaces"`
	SharedSpaces       int        `json:"shared_spaces"`
	StoredBytes        int64      `json:"stored_bytes"`
}
