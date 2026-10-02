# EU bank sync: the opaque relay

European bank sync goes through [Enable Banking](https://enablebanking.com). Their API
sends no CORS headers, so the browser can't call it directly. A normal proxy would
decrypt every request and response on the way, including the JWT, the account list
and every transaction.

So TLS runs inside the browser instead. [libcurl.js](https://github.com/ading2210/libcurl.js)
(libcurl and a TLS 1.3 stack compiled to WASM) encrypts straight to
`api.enablebanking.com`. It tunnels the raw bytes over a WebSocket, using the
[Wisp](https://github.com/MercuryWorkshop/wisp-protocol) protocol, to a relay built
into the Budgero server. The relay pipes those bytes to port 443 and can't read them.

```
browser ── wss:// (Wisp) ──► Budgero relay ── TCP ──► api.enablebanking.com:443
   └──────────── TLS 1.3, end to end, validated against Mozilla's CA list ────────┘
```

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Relay | `packages/server/internal/adapter/driving/http/bankrelay` | Wisp v1 server, about 400 lines |
| Ticket endpoint | `POST /api/v1/bank-relay/ticket` | JWT and subscription required; returns a 10-minute ticket and the caller's IP |
| Relay socket | `GET /api/v1/bank-relay/<ticket>/` | Ticket in the path, because libcurl.js can't add headers to the proxy socket |
| Tunnel client | `packages/app/src/features/bank-sync/lib/enable-banking/tunnel.ts` | Loads libcurl.js lazily, only when EU sync is used |
| API client | `.../enable-banking/client.ts`, `jwt.ts` | RS256 JWT signed with WebCrypto; the key never leaves the budget |

The user's Enable Banking app ID, private key and authorized sessions are stored in
`bank_connections.ConfigJSON`, encrypted with the rest of the budget like the
SimpleFIN access URL. Links use the account's `identification_hash`, which stays
the same across re-authorizations, so imports dedupe across the 180-day consent cycle.

## What the relay can and can't see

| Data | Visible to the relay? |
| --- | --- |
| Transactions, balances, account names, JWT, private key | No: inside TLS, or never sent |
| Destination (`api.enablebanking.com:443`, SNI) | Yes |
| Caller IP, timing, traffic volume | Yes |
| Which user is syncing | Yes: the ticket names the user, for rate limiting |

A relay that swaps in its own certificate fails the in-browser handshake
(curl error 60). It never receives plaintext.

## Guard rails

- Only `api.enablebanking.com:443` over TCP can be dialed. Every other Wisp
  CONNECT gets `CLOSE 0x48` (blocked).
- Tickets are HMAC-signed with a key kept in memory and expire after 10 minutes.
  Each user gets 20 tickets, then one per minute, and 3 concurrent sockets.
- Each socket allows 8 concurrent streams, 64 over its lifetime, 64 MiB of
  traffic, 90 seconds idle and 15 minutes total.
- Nothing is logged except counters (`Relay.Stats()`). Failed-request logs
  redact the ticket.
- WebSocket origin checks are the same as `/api/v1/ws/sync`.

Self-hosted servers include the same relay, and the client always uses its own
server's relay.
