package handler

import "testing"

func TestResolveClientIP(t *testing.T) {
	cases := []struct {
		override, realIP, want string
	}{
		{"", "203.0.113.5", "203.0.113.5"},
		{"203.0.113.9", "172.28.3.3", "203.0.113.9"},
		{"", "", ""},
	}
	for _, tc := range cases {
		if got := resolveClientIP(tc.override, tc.realIP); got != tc.want {
			t.Errorf("resolveClientIP(%q, %q) = %q, want %q", tc.override, tc.realIP, got, tc.want)
		}
	}
}
