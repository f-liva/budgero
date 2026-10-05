import { t } from '@lingui/core/macro';
import { BANK_CALLBACK_PATH, readPending } from './enable-banking-auth';

const CHANNEL = 'budgero-bank-auth';
const CALLBACK_KEY = 'budgero.bankSync.callback';
const WAIT_LIMIT_MS = 15 * 60 * 1000;
/** After the popup closes, wait this long for a message that may still be in flight. */
const CLOSE_GRACE_MS = 3000;

interface CallbackMessage {
  state: string;
  search: string;
}

export class AuthorizationCancelled extends Error {
  constructor() {
    super(t`The bank login was closed before it finished.`);
    this.name = 'AuthorizationCancelled';
  }
}

/** Installed apps open popups outside their storage, so they use a full redirect. */
function isStandaloneApp(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function writeStatus(target: Window, text: string): void {
  try {
    target.document.title = 'Budgero';
    target.document.body.style.cssText =
      'margin:0;display:grid;place-items:center;height:100vh;font:15px system-ui,sans-serif;color:#555';
    target.document.body.textContent = text;
  } catch {
    /* not ours to write to */
  }
}

/**
 * Opens the bank login popup. Call it synchronously from the click handler,
 * or the browser blocks it. Returns null when popups are blocked or Budgero
 * runs as an installed app; callers then fall back to a full-page redirect.
 */
export function openBankLoginPopup(): Window | null {
  if (typeof window === 'undefined' || isStandaloneApp()) return null;
  const width = 520;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    '',
    'budgero-bank-login',
    `popup,width=${width},height=${height},left=${left},top=${top}`
  );
  if (!popup) return null;
  writeStatus(popup, t`Opening your bank…`);
  return popup;
}

/**
 * Points the popup at the bank. The opener is cut first, so the bank's pages
 * can't navigate the Budgero window; the answer comes back over a
 * same-origin BroadcastChannel instead.
 */
export function navigatePopup(popup: Window, url: string): void {
  try {
    popup.opener = null;
  } catch {
    /* already cross-origin */
  }
  popup.location.href = url;
}

/**
 * Runs in the popup when the bank sends it back to Budgero: hands the answer
 * to the window that started the login and closes, without starting the app.
 * Returns false when this page load isn't a popup callback.
 */
export function relayBankCallbackFromPopup(): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== BANK_CALLBACK_PATH) {
    return false;
  }
  const state = new URLSearchParams(window.location.search).get('state');
  const pending = readPending();
  if (!state || !pending || pending.state !== state || pending.mode !== 'popup') return false;
  const message: CallbackMessage = { state, search: window.location.search };
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* fall back to the storage event below */
  }
  try {
    localStorage.setItem(CALLBACK_KEY, JSON.stringify(message));
  } catch {
    /* storage unavailable */
  }
  writeStatus(window, t`Bank connected. You can close this window.`);
  setTimeout(() => window.close(), 400);
  return true;
}

/** Resolves with the bank's callback parameters for `state`. */
export function waitForBankCallback(
  state: string,
  popup: Window,
  signal?: AbortSignal
): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let channel: BroadcastChannel | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const done = (fn: () => void) => {
      cleanup();
      fn();
    };
    const accept = (message: CallbackMessage | null) => {
      if (message?.state !== state) return;
      try {
        localStorage.removeItem(CALLBACK_KEY);
      } catch {
        /* storage unavailable */
      }
      done(() => resolve(new URLSearchParams(message.search)));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CALLBACK_KEY || !event.newValue) return;
      try {
        accept(JSON.parse(event.newValue) as CallbackMessage);
      } catch {
        /* ignore malformed */
      }
    };
    // A bank page may sever our handle to the popup, so "closed" is only
    // trusted once the user is back in this window.
    const onFocus = () => {
      if (!popup.closed || closeTimer) return;
      closeTimer = setTimeout(
        () => done(() => reject(new AuthorizationCancelled())),
        CLOSE_GRACE_MS
      );
    };
    const onAbort = () => {
      try {
        popup.close();
      } catch {
        /* already gone */
      }
      done(() => reject(new AuthorizationCancelled()));
    };
    const limit = setTimeout(() => done(() => reject(new AuthorizationCancelled())), WAIT_LIMIT_MS);
    function cleanup() {
      clearTimeout(limit);
      if (closeTimer) clearTimeout(closeTimer);
      channel?.close();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      signal?.removeEventListener('abort', onAbort);
    }
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event: MessageEvent<CallbackMessage>) => accept(event.data);
    } catch {
      channel = null;
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    signal?.addEventListener('abort', onAbort);
  });
}
