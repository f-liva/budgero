# EU bank sync: the opaque relay

European bank sync goes through [Enable Banking](https://enablebanking.com). Their API
sends no CORS headers, so the browser can't call it directly. A normal proxy would
decrypt every request and response on the way, including the JWT, the account list
and every transaction.

So TLS runs inside the browser instead. [libcurl.js](https://github.com/ading2210/libcurl.js)
is curl compiled to WebAssembly, with [Mbed TLS](https://www.trustedfirmware.org/projects/mbed-tls/)
as its TLS library. It encrypts straight to `api.enablebanking.com`, then tunnels the
encrypted bytes over a WebSocket, using the [Wisp](https://github.com/MercuryWorkshop/wisp-protocol)
protocol, to a relay built into the Budgero server. The relay pipes those bytes to
port 443 and can't read them.

There are two layers of TLS:

```
browser ──[ outer TLS: wss:// to the Budgero server ]──► relay ──[ plain TCP ]──► api.enablebanking.com:443
   └──────────────[ inner TLS 1.3: Mbed TLS in the browser ↔ Enable Banking ]─────────────────┘
```

- **Outer layer:** the browser's normal connection to our server. The server
  decrypts it and finds Wisp frames whose payloads are inner-TLS ciphertext.
- **Inner layer:** from Mbed TLS in the browser to Enable Banking. The server
  has no keys for it.

## How one request travels

Taking `GET /accounts/{uid}/transactions` as an example:

| Step | What happens | Where |
| --- | --- | --- |
| 1 | Sign a short-lived RS256 JWT with the app's private key (WebCrypto). | Ours: `client.ts` → `jwt.ts` |
| 2 | Get a relay ticket over normal HTTPS and point libcurl.js at the relay. | Ours: `tunnel.ts` (`ensureTicket`, `set_websocket`) |
| 3 | Call `libcurl.fetch(url, { headers: { Authorization: 'Bearer <JWT>' } })`. | Ours: `client.ts` → `tunnel.ts` `fetch` |
| 4 | libcurl opens a Wisp stream: a CONNECT frame naming `api.enablebanking.com:443`. | libcurl.js (`WispConnection`, `WispStream` in `libcurl.mjs`) |
| 5 | TLS 1.3 handshake. An ephemeral key exchange (ECDHE) gives both ends the session keys; the keys themselves never cross the wire. | Mbed TLS inside `libcurl.wasm` |
| 6 | Mbed TLS checks the server certificate against the bundled Mozilla CA list and the hostname. A substituted certificate fails here (curl error 60). | Mbed TLS inside `libcurl.wasm` |
| 7 | curl writes the HTTP/2 request; Mbed TLS encrypts it into TLS records with an authenticated cipher. | curl and Mbed TLS inside `libcurl.wasm` |
| 8 | The encrypted records go out as Wisp DATA frames over the WebSocket. | libcurl.js (`libcurl.mjs`) |
| 9 | The relay strips the Wisp header and writes the payload, unchanged, to the TCP socket. Responses flow back the same way. | Ours: `bankrelay/relay.go` (`run`, `pumpDown`) |
| 10 | Mbed TLS decrypts the response; `libcurl.fetch` resolves with a normal `Response`. | Mbed TLS inside `libcurl.wasm` |
| 11 | Parse the JSON and turn it into Budgero transactions. | Ours: `client.ts` (`toBankTransactions`), `provider.ts` |

Steps 5–7 and 10 (key exchange, certificate check, encryption, decryption) are not
our code. They run in the third-party `libcurl.wasm`. Our code hands over a URL,
headers and a body, the same as `fetch`.

## Wisp in brief

Wisp carries many TCP streams over one WebSocket. Every WebSocket message is one
packet:

```
| type: 1 byte | stream id: 4 bytes, little-endian | payload |
```

| Type | Meaning | Payload |
| --- | --- | --- |
| `0x01` CONNECT | Open a stream | stream type (`0x01` TCP), port (2 bytes, little-endian), hostname |
| `0x02` DATA | Bytes for a stream | raw bytes; here, always TLS records |
| `0x03` CONTINUE | Flow control: how many more DATA packets the client may send | remaining buffer (4 bytes); stream 0 carries the initial window |
| `0x04` CLOSE | Close a stream | reason code |

The relay speaks Wisp v1, which is what libcurl.js uses. It sends the close
reasons `0x02` (normal close), `0x03` (network error), `0x41` (invalid packet),
`0x42` (unreachable), `0x48` (blocked destination) and `0x49` (throttled). The
relay reads only the header and CONNECT payload; DATA payloads are copied as-is.

## What does the encryption

libcurl.js 0.7.4, pinned in `packages/app/package.json`, reports these components
(`libcurl.version`):

| Component | Version | Role |
| --- | --- | --- |
| curl | 8.17.0 | HTTP client: builds requests, HTTP/2 framing |
| Mbed TLS | 3.6.5 | TLS 1.3 and 1.2: key exchange, certificate checks, encryption |
| nghttp2 | 1.68.0 | HTTP/2 |
| Wisp client | 1.1.1 | Wisp framing over the browser's WebSocket |

The CA bundle is curl's extract of Mozilla's trusted roots, compiled in
(`libcurl.get_cacert()` returns it). The cipher suite is negotiated per connection.
Against `api.enablebanking.com` on 2026-10-03 the handshake was:

```
* mbedTLS: Connecting to api.enablebanking.com:443
* ALPN: curl offers h2,http/1.1
* Server certificate:
*  issuer name       : C=US, O=Google Trust Services, CN=WR3
*  subject name      : CN=api.enablebanking.com
* mbedTLS: TLSv1.3 Handshake complete, cipher is TLS_CHACHA20_POLY1305_SHA256
* ALPN: server accepted h2
```

## Code map

| Piece | Where | Notes |
| --- | --- | --- |
| Relay | `packages/server/internal/adapter/driving/http/bankrelay/relay.go` | Wisp server, destination allowlist, limits, flow control |
| Wisp framing | `.../bankrelay/wisp.go` | Packet encode/decode |
| Tickets | `.../bankrelay/ticket.go` | HMAC-signed, 10-minute tickets; key in memory |
| HTTP routes | `.../handler/bank_relay.go`, `.../routes/routes.go` | `POST /api/v1/bank-relay/ticket` (JWT and subscription required); `GET /api/v1/bank-relay/<ticket>/` (the socket; ticket in the path because libcurl.js can't add headers) |
| Log redaction | `packages/server/cmd/shared/server.go` (`redactURI`) | Keeps tickets out of failed-request logs |
| Tunnel client | `packages/app/src/features/bank-sync/lib/enable-banking/tunnel.ts` | Loads libcurl.js lazily, manages tickets, retries once after a server restart |
| API client | `.../enable-banking/client.ts`, `jwt.ts` | Enable Banking calls and row mapping; RS256 JWT via WebCrypto |
| TLS and HTTP | `node_modules/libcurl.js` (`libcurl.mjs`, `libcurl.wasm`) | Third party (LGPL-3.0); Vite copies the WASM to `dist/assets` |

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
  traffic and 15 minutes in total. A socket with no open streams closes after
  90 seconds of silence. An open stream may wait up to 5 minutes for the bank
  to answer, because history fetches can be slow.
- Flow control only advertises free queue space, so one stalled stream can't
  block the socket's other streams.
- Nothing is logged except counters (`Relay.Stats()`). Failed-request logs
  redact the ticket.
- WebSocket origin checks are the same as `/api/v1/ws/sync`.

Self-hosted servers include the same relay, and the client always uses its own
server's relay.

## Verify it yourself

- **See the handshake.** Pass `_libcurl_verbose: 1` in a fetch's options (for
  example temporarily in `enableBankingRequest` in `client.ts`) and set
  `libcurl.stderr` to a logger. You get curl's `-v` output, including the TLS
  version, cipher and certificate shown above.
- **See what the relay sees.** In browser DevTools, open the Network tab, filter
  by WS and select the `bank-relay/…` socket. The CONNECT frame contains the
  hostname in plain text; every DATA frame after it is binary noise.
- **Relay tests.** `go test -race ./internal/adapter/driving/http/bankrelay/`
  (in `packages/server`) covers allowed and blocked destinations, flow control,
  slow responses, tickets and limits.
- **Certificate substitution.** The original spike ran a relay that diverted
  `api.enablebanking.com` to a self-signed server. The browser refused the
  handshake (curl error 60), and the impostor never received a byte of plaintext.

## Updating libcurl.js

The version is pinned. Before bumping it:

- Read its changelog for TLS backend changes. It moved from OpenSSL to wolfSSL
  in an early release, and to Mbed TLS in 0.7.0.
- Check that the bundled Wisp client still speaks v1, or update the relay.
- Run the verbose check above against Enable Banking's sandbox, and the bank
  sync tests in `packages/app`.
