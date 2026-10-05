import { t } from '@lingui/core/macro';
import type { SimpleFINAccount, SimpleFINAccountSet } from '@budgero/core/browser';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 45;

export const SIMPLEFIN_BRIDGE_URL = 'https://beta-bridge.simplefin.org/';

export class SimpleFINError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'SimpleFINError';
  }
}

function decodeSetupToken(setupToken: string): string {
  let decoded: string;
  try {
    decoded = atob(setupToken.trim());
  } catch {
    throw new SimpleFINError(t`That doesn't look like a SimpleFIN setup token.`);
  }
  if (!/^https:\/\//.test(decoded)) {
    throw new SimpleFINError(t`That doesn't look like a SimpleFIN setup token.`);
  }
  return decoded;
}

/** Setup tokens are single-use: claiming one twice fails, so callers must persist the result. */
export async function claimSetupToken(setupToken: string): Promise<string> {
  const response = await fetch(decodeSetupToken(setupToken), { method: 'POST' });
  if (response.status === 403) {
    throw new SimpleFINError(
      t`This setup token was already used or revoked. Create a new one in SimpleFIN Bridge.`,
      403
    );
  }
  if (!response.ok) {
    throw new SimpleFINError(t`SimpleFIN rejected the setup token (${response.status}).`);
  }
  const accessUrl = (await response.text()).trim();
  if (!/^https:\/\//.test(accessUrl)) {
    throw new SimpleFINError(t`SimpleFIN returned an invalid access URL.`);
  }
  return accessUrl;
}

async function requestAccounts(accessUrl: string, params: URLSearchParams) {
  const url = new URL(accessUrl);
  const credentials = btoa(
    `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
  );
  url.username = '';
  url.password = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/accounts`;
  url.search = params.toString();
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
  } catch {
    throw new SimpleFINError(t`Couldn't reach SimpleFIN. Check your connection and try again.`);
  }
  if (response.status === 403) {
    throw new SimpleFINError(
      t`SimpleFIN denied access. The connection may have been revoked; reconnect with a new setup token.`,
      403
    );
  }
  if (response.status === 402) {
    throw new SimpleFINError(t`Your SimpleFIN Bridge subscription needs attention.`, 402);
  }
  if (!response.ok) {
    throw new SimpleFINError(t`SimpleFIN request failed (${response.status}).`, response.status);
  }
  return (await response.json()) as SimpleFINAccountSet;
}

export function fetchBalances(accessUrl: string): Promise<SimpleFINAccountSet> {
  return requestAccounts(accessUrl, new URLSearchParams({ 'balances-only': '1' }));
}

/**
 * Fetches transactions in windows the Bridge accepts, merged per account.
 * Pass `accountIds` to ask only about linked accounts.
 */
export async function fetchTransactions(
  accessUrl: string,
  start: Date,
  end = new Date(),
  accountIds?: string[]
): Promise<SimpleFINAccountSet> {
  const accounts = new Map<string, SimpleFINAccount>();
  const errors = new Set<string>();
  for (let from = start.getTime(); from < end.getTime(); from += MAX_WINDOW_DAYS * DAY_MS) {
    const to = Math.min(from + MAX_WINDOW_DAYS * DAY_MS, end.getTime());
    const params = new URLSearchParams({
      'start-date': String(Math.floor(from / 1000)),
      'end-date': String(Math.ceil(to / 1000)),
      pending: '1',
    });
    for (const id of accountIds ?? []) params.append('account', id);
    const set = await requestAccounts(accessUrl, params);
    set.errors?.forEach((error) => errors.add(error));
    for (const account of set.accounts ?? []) {
      const previous = accounts.get(account.id);
      const transactions = [
        ...new Map(
          [...(previous?.transactions ?? []), ...(account.transactions ?? [])].map((tx) => [
            tx.id,
            tx,
          ])
        ).values(),
      ];
      const latest =
        previous && previous['balance-date'] > account['balance-date'] ? previous : account;
      accounts.set(account.id, { ...latest, transactions });
    }
  }
  return { errors: [...errors], accounts: [...accounts.values()] };
}

export function describeAccessUrl(accessUrl: string): string {
  try {
    return new URL(accessUrl).host;
  } catch {
    return '';
  }
}
