// Package bankrelay is a blind Wisp relay for browser-side bank sync.
//
// The browser runs its own TLS client (libcurl.js, compiled to WASM) and
// tunnels raw TCP bytes over one WebSocket using the Wisp v1 protocol
// (https://github.com/MercuryWorkshop/wisp-protocol). The relay only pipes
// those bytes to a hardcoded allowlist of hosts. It sees the destination and
// traffic volume, never the plaintext: TLS runs end to end between the browser
// and the bank aggregator.
package bankrelay

import (
	"encoding/binary"
	"errors"
)

// Wisp packet types.
const (
	packetConnect  byte = 0x01
	packetData     byte = 0x02
	packetContinue byte = 0x03
	packetClose    byte = 0x04
)

// Wisp stream types.
const streamTCP byte = 0x01

// Wisp close reasons.
const (
	closeVoluntary    byte = 0x02
	closeNetworkError byte = 0x03
	closeInvalidInfo  byte = 0x41
	closeUnreachable  byte = 0x42
	closeBlocked      byte = 0x48
	closeThrottled    byte = 0x49
)

const headerSize = 5

var errShortPacket = errors.New("wisp packet too short")

type packet struct {
	kind     byte
	streamID uint32
	payload  []byte
}

func parsePacket(raw []byte) (packet, error) {
	if len(raw) < headerSize {
		return packet{}, errShortPacket
	}
	return packet{
		kind:     raw[0],
		streamID: binary.LittleEndian.Uint32(raw[1:5]),
		payload:  raw[headerSize:],
	}, nil
}

func encodePacket(kind byte, streamID uint32, payload []byte) []byte {
	out := make([]byte, headerSize+len(payload))
	out[0] = kind
	binary.LittleEndian.PutUint32(out[1:5], streamID)
	copy(out[headerSize:], payload)
	return out
}

func continuePacket(streamID, bufferRemaining uint32) []byte {
	payload := make([]byte, 4)
	binary.LittleEndian.PutUint32(payload, bufferRemaining)
	return encodePacket(packetContinue, streamID, payload)
}

func closePacket(streamID uint32, reason byte) []byte {
	return encodePacket(packetClose, streamID, []byte{reason})
}

type connectRequest struct {
	streamType byte
	port       uint16
	host       string
}

func parseConnect(payload []byte) (connectRequest, error) {
	if len(payload) < 4 {
		return connectRequest{}, errShortPacket
	}
	return connectRequest{
		streamType: payload[0],
		port:       binary.LittleEndian.Uint16(payload[1:3]),
		host:       string(payload[3:]),
	}, nil
}
