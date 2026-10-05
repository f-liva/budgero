package shared

import "testing"

func TestRedactURIHidesRelayTickets(t *testing.T) {
	cases := map[string]string{
		"/api/v1/bank-relay/dXNlcg.1790969784.sig/": "/api/v1/bank-relay/[redacted]",
		"/api/v1/bank-relay/ticket-lookalike.1.sig": "/api/v1/bank-relay/[redacted]",
		"/api/v1/bank-relay/ticket":                 "/api/v1/bank-relay/ticket",
		"/api/v1/ws/sync?token=x":                   "/api/v1/ws/sync?token=x",
	}
	for in, want := range cases {
		if got := redactURI(in); got != want {
			t.Errorf("redactURI(%q) = %q, want %q", in, got, want)
		}
	}
}
