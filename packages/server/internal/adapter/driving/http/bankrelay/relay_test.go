package bankrelay

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

const testTarget = "bank.test:443"

// echoServer accepts TCP connections and echoes every byte back.
func echoServer(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				defer func() { _ = conn.Close() }()
				_, _ = io.Copy(conn, conn)
			}()
		}
	}()
	return ln.Addr().String()
}

func newTestRelay(t *testing.T, opts *Options) (relay *Relay, dialed *[]string) {
	t.Helper()
	echo := echoServer(t)
	dialed = &[]string{}
	opts.AllowedTargets = []string{testTarget}
	opts.Dial = func(ctx context.Context, network, address string) (net.Conn, error) {
		*dialed = append(*dialed, address)
		return (&net.Dialer{}).DialContext(ctx, network, echo)
	}
	return New(opts), dialed
}

func relayServer(t *testing.T, relay *Relay) string {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		release, err := relay.Acquire(strings.Trim(strings.TrimPrefix(r.URL.Path, "/relay/"), "/"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		defer release()
		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		relay.Serve(r.Context(), ws)
	}))
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http")
}

func dialRelay(t *testing.T, relay *Relay, base string) *websocket.Conn {
	t.Helper()
	ticket, _, err := relay.IssueTicket("user-1")
	if err != nil {
		t.Fatal(err)
	}
	ws, resp, err := websocket.DefaultDialer.Dial(base+"/relay/"+ticket+"/", nil)
	if resp != nil {
		_ = resp.Body.Close()
	}
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ws.Close() })
	return ws
}

func readPacket(t *testing.T, ws *websocket.Conn) packet {
	t.Helper()
	_ = ws.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, raw, err := ws.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	p, err := parsePacket(raw)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func connectFrame(streamID uint32, streamType byte, host string, port uint16) []byte {
	payload := make([]byte, 3, 3+len(host))
	payload[0] = streamType
	binary.LittleEndian.PutUint16(payload[1:3], port)
	return encodePacket(packetConnect, streamID, append(payload, host...))
}

func send(t *testing.T, ws *websocket.Conn, frame []byte) {
	t.Helper()
	if err := ws.WriteMessage(websocket.BinaryMessage, frame); err != nil {
		t.Fatal(err)
	}
}

func TestRelayPipesAllowedTarget(t *testing.T) {
	relay, dialed := newTestRelay(t, &Options{BufferSize: 16})
	ws := dialRelay(t, relay, relayServer(t, relay))

	initial := readPacket(t, ws)
	if initial.kind != packetContinue || initial.streamID != 0 || binary.LittleEndian.Uint32(initial.payload) != 16 {
		t.Fatalf("expected initial CONTINUE(16) on stream 0, got %+v", initial)
	}

	// Data may follow CONNECT before the dial finishes.
	send(t, ws, connectFrame(1, streamTCP, "Bank.test", 443))
	send(t, ws, encodePacket(packetData, 1, []byte("hello ")))
	send(t, ws, encodePacket(packetData, 1, []byte("bank")))

	var got []byte
	for len(got) < len("hello bank") {
		p := readPacket(t, ws)
		if p.kind == packetData && p.streamID == 1 {
			got = append(got, p.payload...)
		}
	}
	if string(got) != "hello bank" {
		t.Fatalf("echo = %q", got)
	}
	if len(*dialed) != 1 || (*dialed)[0] != testTarget {
		t.Fatalf("dialed %v", *dialed)
	}

	stats := relay.Stats()
	if stats.Streams != 1 || stats.BytesUp != 10 || stats.BytesDown != 10 {
		t.Fatalf("stats = %+v", stats)
	}
}

func TestRelayRefusesOtherTargets(t *testing.T) {
	relay, dialed := newTestRelay(t, &Options{})
	ws := dialRelay(t, relay, relayServer(t, relay))
	readPacket(t, ws) // initial CONTINUE

	cases := []struct {
		id         uint32
		streamType byte
		host       string
		port       uint16
	}{
		{1, streamTCP, "example.com", 443},
		{2, streamTCP, "bank.test", 80},
		{3, 0x02, "bank.test", 443}, // UDP
		{4, streamTCP, "127.0.0.1", 443},
	}
	for _, tc := range cases {
		send(t, ws, connectFrame(tc.id, tc.streamType, tc.host, tc.port))
		p := readPacket(t, ws)
		if p.kind != packetClose || p.streamID != tc.id || p.payload[0] != closeBlocked {
			t.Fatalf("%s:%d type %d: expected CLOSE blocked, got %+v", tc.host, tc.port, tc.streamType, p)
		}
	}
	if len(*dialed) != 0 {
		t.Fatalf("relay dialed %v", *dialed)
	}
	if relay.Stats().RejectedConnects != int64(len(cases)) {
		t.Fatalf("rejected = %d", relay.Stats().RejectedConnects)
	}
}

// A client that honors Wisp flow control must never stall, and the relay must
// never advertise more than it can queue.
func TestRelayFlowControlNeverStallsAnHonestClient(t *testing.T) {
	const window, total = 4, 300
	relay, _ := newTestRelay(t, &Options{BufferSize: window})
	ws := dialRelay(t, relay, relayServer(t, relay))
	readPacket(t, ws)

	continues := make(chan uint32, total)
	echoed := make(chan int, total)
	go func() {
		for {
			_ = ws.SetReadDeadline(time.Now().Add(10 * time.Second))
			_, raw, err := ws.ReadMessage()
			if err != nil {
				close(continues)
				return
			}
			p, _ := parsePacket(raw)
			switch p.kind {
			case packetContinue:
				continues <- binary.LittleEndian.Uint32(p.payload)
			case packetData:
				echoed <- len(p.payload)
			}
		}
	}()

	send(t, ws, connectFrame(9, streamTCP, "bank.test", 443))
	allowance := uint32(window)
	for sent := 0; sent < total; {
		if allowance == 0 {
			select {
			case value, ok := <-continues:
				if !ok {
					t.Fatal("relay closed the socket")
				}
				if value > window {
					t.Fatalf("CONTINUE advertised %d, more than the %d window", value, window)
				}
				allowance = value
			case <-time.After(5 * time.Second):
				t.Fatalf("stalled after %d packets", sent)
			}
			continue
		}
		send(t, ws, encodePacket(packetData, 9, []byte("x")))
		allowance--
		sent++
	}
	got := 0
	for got < total {
		select {
		case n := <-echoed:
			got += n
		case <-time.After(5 * time.Second):
			t.Fatalf("only %d of %d bytes came back", got, total)
		}
	}
}

// slowBank answers each connection only after delay, like a bank fetching history.
func slowBank(t *testing.T, delay time.Duration) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				defer func() { _ = conn.Close() }()
				buf := make([]byte, 16)
				n, _ := conn.Read(buf)
				time.Sleep(delay)
				_, _ = conn.Write(buf[:n])
			}()
		}
	}()
	return ln.Addr().String()
}

func TestRelayWaitsForASlowBankButClosesIdleSessions(t *testing.T) {
	bank := slowBank(t, 600*time.Millisecond)
	relay := New(&Options{
		AllowedTargets: []string{testTarget},
		IdleTimeout:    200 * time.Millisecond,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, network, bank)
		},
	})
	ws := dialRelay(t, relay, relayServer(t, relay))
	readPacket(t, ws)

	// Nothing moves for three idle timeouts while the bank thinks.
	send(t, ws, connectFrame(1, streamTCP, "bank.test", 443))
	send(t, ws, encodePacket(packetData, 1, []byte("history")))
	for {
		p := readPacket(t, ws)
		if p.kind == packetData {
			if string(p.payload) != "history" {
				t.Fatalf("got %q", p.payload)
			}
			break
		}
		if p.kind == packetClose {
			t.Fatalf("stream closed while waiting for the bank: %+v", p)
		}
	}

	// The bank hangs up; with no streams left, the idle session ends.
	for {
		_ = ws.SetReadDeadline(time.Now().Add(3 * time.Second))
		if _, _, err := ws.ReadMessage(); err != nil {
			var closeErr *websocket.CloseError
			if errors.As(err, &closeErr) || strings.Contains(err.Error(), "EOF") ||
				strings.Contains(err.Error(), "reset") {
				return
			}
			var netErr net.Error
			if errors.As(err, &netErr) && netErr.Timeout() {
				t.Fatal("idle session was not closed")
			}
			return
		}
	}
}

func TestRelayClientCloseEndsStream(t *testing.T) {
	relay, _ := newTestRelay(t, &Options{})
	ws := dialRelay(t, relay, relayServer(t, relay))
	readPacket(t, ws)

	send(t, ws, connectFrame(1, streamTCP, "bank.test", 443))
	send(t, ws, encodePacket(packetData, 1, []byte("ping")))
	for {
		if p := readPacket(t, ws); p.kind == packetData {
			break
		}
	}
	send(t, ws, closePacket(1, closeVoluntary))
	// The stream id can be reused once the close is processed.
	time.Sleep(50 * time.Millisecond)
	send(t, ws, connectFrame(1, streamTCP, "bank.test", 443))
	send(t, ws, encodePacket(packetData, 1, []byte("again")))
	for {
		p := readPacket(t, ws)
		if p.kind == packetData && bytes.Equal(p.payload, []byte("again")) {
			return
		}
		if p.kind == packetClose {
			t.Fatalf("unexpected CLOSE %+v", p)
		}
	}
}

func TestRelayRejectsBadTickets(t *testing.T) {
	relay, _ := newTestRelay(t, &Options{})
	base := relayServer(t, relay)
	ticket, _, _ := relay.IssueTicket("user-1")

	for _, bad := range []string{"", "nope", ticket + "x", strings.Replace(ticket, ".", "x.", 1)} {
		_, resp, err := websocket.DefaultDialer.Dial(base+"/relay/"+bad+"/", nil)
		if err == nil {
			t.Fatalf("ticket %q accepted", bad)
		}
		if resp == nil || resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("ticket %q: expected 401, got %v", bad, resp)
		}
		_ = resp.Body.Close()
	}
}

func TestTicketExpires(t *testing.T) {
	signer := newTicketSigner(time.Minute)
	ticket, _ := signer.issue("user-1")
	if user, err := signer.verify(ticket); err != nil || user != "user-1" {
		t.Fatalf("verify = %q, %v", user, err)
	}
	signer.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, err := signer.verify(ticket); err == nil {
		t.Fatal("expired ticket accepted")
	}
}

func TestRelayLimitsSessionsAndTickets(t *testing.T) {
	relay := New(&Options{SessionsPerUser: 1, UserRate: rate.Every(time.Hour), UserBurst: 2})
	ticket, _, err := relay.IssueTicket("u")
	if err != nil {
		t.Fatal(err)
	}
	release, err := relay.Acquire(ticket)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := relay.Acquire(ticket); !errors.Is(err, ErrThrottled) {
		t.Fatalf("second session: %v", err)
	}
	release()
	if _, err := relay.Acquire(ticket); err != nil {
		t.Fatalf("after release: %v", err)
	}
	if _, _, err := relay.IssueTicket("u"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := relay.IssueTicket("u"); !errors.Is(err, ErrThrottled) {
		t.Fatalf("third ticket: %v", err)
	}
}
