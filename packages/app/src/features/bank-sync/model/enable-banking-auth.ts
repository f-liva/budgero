import { t } from '@lingui/core/macro';
import {
  parseEnableBankingConfig,
  type BankConnection,
  type EnableBankingSession,
} from '@budgero/core/browser';
import type { AppRuntime } from '@shared/runtime/app-runtime';
import { executeSpaceMutation } from '@shared/runtime/mutation-router';
import { createSession, startAuthorization, type Aspsp } from '../lib/enable-banking/client';

const PENDING_KEY = 'budgero.bankSync.pendingAuth';
const PENDING_TTL_MS = 60 * 60 * 1000;

export const BANK_CALLBACK_PATH = '/bank-sync/callback';

export interface PendingAuthorization {
  state: string;
  budgetId: number;
  aspsp: { name: string; country: string };
  createdAt: number;
}

export function bankRedirectUrl(origin = window.location.origin): string {
  return `${origin}${BANK_CALLBACK_PATH}`;
}

function readPending(): PendingAuthorization | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingAuthorization;
    return Date.now() - pending.createdAt < PENDING_TTL_MS ? pending : null;
  } catch {
    return null;
  }
}

function writePending(pending: PendingAuthorization | null): void {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: the callback will report a missing request */
  }
}

function credentialsOf(connection: BankConnection | null) {
  const config = parseEnableBankingConfig(connection);
  if (!config) throw new Error(t`Enable Banking credentials are missing. Set them up again.`);
  return { appId: config.appId, privateKeyPem: config.privateKeyPem };
}

/**
 * Asks Enable Banking for the bank's login URL. The state ties the callback
 * to this request (and to the budget it was started from); the caller then
 * navigates to the returned URL.
 */
export async function beginAuthorization(
  connection: BankConnection,
  aspsp: Aspsp
): Promise<string> {
  const state = crypto.randomUUID();
  const { url } = await startAuthorization(credentialsOf(connection), {
    aspsp,
    redirectUrl: bankRedirectUrl(),
    state,
  });
  writePending({
    state,
    budgetId: connection.BudgetID,
    aspsp: { name: aspsp.name, country: aspsp.country },
    createdAt: Date.now(),
  });
  return url;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** Turns the bank's redirect (`?code=&state=`) into a stored session. */
export async function completeAuthorization(
  runtime: AppRuntime,
  params: URLSearchParams
): Promise<{ budgetId: number; session: EnableBankingSession }> {
  const pending = readPending();
  const error = params.get('error');
  if (error) {
    writePending(null);
    const description = params.get('error_description') || error;
    throw new AuthorizationError(t`The bank didn't authorize access: ${description}`);
  }
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) throw new AuthorizationError(t`The bank's reply is missing its code.`);
  if (!pending || pending.state !== state) {
    throw new AuthorizationError(
      t`This bank authorization wasn't started here, or it expired. Start it again from Settings › Bank sync.`
    );
  }
  const connection = runtime.services().bankSync.getConnection(pending.budgetId, 'enablebanking');
  const session = await createSession(credentialsOf(connection), code);
  await executeSpaceMutation(runtime, {
    op: 'bankSync.saveEnableBankingSession',
    payload: { budgetId: pending.budgetId, session },
    meta: { label: 'bank-sync', skipUndo: true },
  });
  writePending(null);
  return { budgetId: pending.budgetId, session };
}
