package bankrelay

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"
)

// ErrInvalidTicket is returned for malformed, forged or expired tickets.
var ErrInvalidTicket = errors.New("invalid relay ticket")

// ticketSigner issues short-lived relay tickets. Browsers can't set headers on
// a WebSocket, so the session JWT is exchanged over normal HTTPS for a ticket
// that goes in the relay URL instead. The key lives in memory only: a restart
// just makes clients fetch a new ticket.
type ticketSigner struct {
	key []byte
	ttl time.Duration
	now func() time.Time
}

func newTicketSigner(ttl time.Duration) *ticketSigner {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic("bankrelay: no randomness for ticket key: " + err.Error())
	}
	return &ticketSigner{key: key, ttl: ttl, now: time.Now}
}

func (s *ticketSigner) issue(userID string) (string, time.Time) {
	expires := s.now().Add(s.ttl)
	body := base64.RawURLEncoding.EncodeToString([]byte(userID)) + "." + strconv.FormatInt(expires.Unix(), 10)
	return body + "." + s.sign(body), expires
}

func (s *ticketSigner) verify(ticket string) (string, error) {
	idx := strings.LastIndexByte(ticket, '.')
	if idx < 0 {
		return "", ErrInvalidTicket
	}
	body, mac := ticket[:idx], ticket[idx+1:]
	if !hmac.Equal([]byte(mac), []byte(s.sign(body))) {
		return "", ErrInvalidTicket
	}
	user, expiry, ok := strings.Cut(body, ".")
	if !ok {
		return "", ErrInvalidTicket
	}
	unix, err := strconv.ParseInt(expiry, 10, 64)
	if err != nil || s.now().Unix() > unix {
		return "", ErrInvalidTicket
	}
	userID, err := base64.RawURLEncoding.DecodeString(user)
	if err != nil || len(userID) == 0 {
		return "", ErrInvalidTicket
	}
	return string(userID), nil
}

func (s *ticketSigner) sign(body string) string {
	h := hmac.New(sha256.New, s.key)
	h.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
