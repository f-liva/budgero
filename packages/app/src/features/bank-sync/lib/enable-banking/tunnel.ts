import type { Libcurl } from 'libcurl.js';
import { apiClient } from '@shared/api/api-client';
import { getGlobalToken } from '@shared/lib/clerk-token-manager';

/**
 * Opaque relay to Enable Banking.
 *
 * Enable Banking sends no CORS headers, so the browser can't call it. Instead
 * libcurl.js (TLS 1.3 compiled to WASM) runs the HTTPS session itself and
 * tunnels raw bytes over a WebSocket to Budgero's relay, which can only pipe
 * them to api.enablebanking.com:443. The relay sees ciphertext, never the JWT
 * or bank data, and a swapped certificate fails the in-browser handshake.
 */

interface RelayTicket {
  ticket: string;
  expires_at: string;
  client_ip: string;
}

export interface Tunnel {
  fetch: Libcurl['fetch'];
  /** The caller's public IP as the relay saw it, or null when private. */
  clientIp: string | null;
}

const TICKET_MARGIN_MS = 60_000;

interface CachedTicket {
  ticket: RelayTicket;
  expiresAt: number;
  userId: string | null;
}

let libcurlPromise: Promise<Libcurl> | null = null;
let current: CachedTicket | null = null;
let pending: Promise<CachedTicket> | null = null;

/** Lazy, so the ~550 KB WASM only loads once someone uses EU bank sync. */
function loadLibcurl(): Promise<Libcurl> {
  libcurlPromise ??= (async () => {
    const [{ libcurl }, { default: wasmUrl }] = await Promise.all([
      import('libcurl.js'),
      import('libcurl.js/libcurl.wasm?url'),
    ]);
    libcurl.logger = (type, text) => {
      if (type === 'error') console.warn('[BankRelay]', text);
    };
    libcurl.stderr = () => {};
    await libcurl.load_wasm(wasmUrl);
    return libcurl;
  })().catch((error: unknown) => {
    libcurlPromise = null;
    throw error;
  });
  return libcurlPromise;
}

export function relayUrl(ticket: string, location: Pick<Location, 'href'> = window.location) {
  const base = new URL(import.meta.env.VITE_API_BASE_URL || '/api/v1', location.href);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/bank-relay/${ticket}/`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

const PRIVATE_IP =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;

export function isPublicIp(ip: string | undefined | null): ip is string {
  return Boolean(ip) && /^[0-9a-f:.]+$/i.test(ip!) && !PRIVATE_IP.test(ip!);
}

/** The signed-in user, from the session token, so a ticket never outlives a logout. */
async function currentUserId(): Promise<string | null> {
  try {
    const token = await getGlobalToken();
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

async function ensureTicket(libcurl: Libcurl): Promise<CachedTicket> {
  const userId = await currentUserId();
  if (current && current.userId === userId && current.expiresAt - TICKET_MARGIN_MS > Date.now()) {
    return current;
  }
  // Parallel callers share one ticket request instead of each opening a socket.
  pending ??= (async () => {
    const ticket = await apiClient.post<RelayTicket>('/bank-relay/ticket');
    libcurl.set_websocket(relayUrl(ticket.ticket));
    current = { ticket, userId, expiresAt: new Date(ticket.expires_at).getTime() };
    return current;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * Forgets the cached ticket. Called when a request through the relay fails:
 * a restarted server no longer accepts tickets it issued before.
 */
export function resetTunnel(): void {
  current = null;
}

export async function openTunnel(): Promise<Tunnel> {
  const libcurl = await loadLibcurl();
  const { ticket } = await ensureTicket(libcurl);
  return {
    fetch: (url, init) => libcurl.fetch(url, init),
    clientIp: isPublicIp(ticket.client_ip) ? ticket.client_ip : null,
  };
}
