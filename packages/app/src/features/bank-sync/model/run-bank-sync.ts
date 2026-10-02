import { t } from '@lingui/core/macro';
import {
  bankOperationId,
  type BankConnection,
  type BankLink,
  type BankProvider,
  type BankSyncRecordInput,
  type ImportIdentity,
} from '@budgero/core/browser';
import type { AppRuntime } from '@shared/runtime/app-runtime';
import { executeSpaceMutation } from '@shared/runtime/mutation-router';
import { getErrorMessage } from '@shared/lib/errors';
import {
  fetchRemoteTransactions,
  linkedExternalIds,
  providerName,
  type RemoteAccountSet,
} from '../lib/provider';

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERLAP_DAYS = 7;

export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface BankSyncResult {
  imported: number;
  reviews: number;
  errors: string[];
}

function localMidnight(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function syncStart(link: Pick<BankLink, 'ImportFrom' | 'LastSyncAt'>): Date {
  const from = localMidnight(link.ImportFrom);
  if (!link.LastSyncAt) return from;
  const overlap = new Date(new Date(link.LastSyncAt).getTime() - OVERLAP_DAYS * DAY_MS);
  return overlap > from ? overlap : from;
}

export function isSyncDue(lastSyncAt: string | null | undefined, now = Date.now()): boolean {
  return !lastSyncAt || now - new Date(lastSyncAt).getTime() >= AUTO_SYNC_INTERVAL_MS;
}

/** Stable across devices and retries, so the mutation log drops concurrent duplicates. */
export async function bankIdempotencyKey(operationId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(operationId));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `bank_${hex.slice(0, 32)}`;
}

/** Data a caller already fetched for one provider, so it isn't fetched twice. */
export interface PrefetchedSet {
  provider: BankProvider;
  set: RemoteAccountSet;
}

export interface RunBankSyncOptions {
  /** Only these providers; every connected one when omitted. Each sync spends provider quota. */
  providers?: BankProvider[];
  prefetched?: PrefetchedSet;
}

const inFlight = new Map<number, { scope: string; promise: Promise<BankSyncResult> }>();

/**
 * Runs one sync per budget at a time. A request for the same scope joins the
 * running one; anything else waits for it, so two runs never import the
 * same rows concurrently.
 */
export function runBankSync(
  runtime: AppRuntime,
  budgetId: number,
  options: RunBankSyncOptions = {}
): Promise<BankSyncResult> {
  const scope = options.providers ? [...options.providers].sort().join(',') : '*';
  const running = inFlight.get(budgetId);
  if (running && running.scope === scope && !options.prefetched) return running.promise;
  const previous = running?.promise.catch(() => undefined) ?? Promise.resolve();
  const promise: Promise<BankSyncResult> = previous
    .then(() => syncBudget(runtime, budgetId, options))
    .finally(() => {
      if (inFlight.get(budgetId)?.promise === promise) inFlight.delete(budgetId);
    });
  inFlight.set(budgetId, { scope, promise });
  return promise;
}

/** Syncs the requested providers; one failing provider doesn't stop the others. */
async function syncBudget(
  runtime: AppRuntime,
  budgetId: number,
  { providers, prefetched }: RunBankSyncOptions
): Promise<BankSyncResult> {
  const result: BankSyncResult = { imported: 0, reviews: 0, errors: [] };
  const failures: unknown[] = [];
  let attempted = 0;
  const connections = runtime
    .services()
    .bankSync.listConnections(budgetId)
    .filter((connection) => !providers || providers.includes(connection.Provider));
  for (const connection of connections) {
    const links = runtime.services().bankSync.listLinks(budgetId, connection.Provider);
    if (!links.length) continue;
    attempted++;
    try {
      const part = await syncConnection(
        runtime,
        connection,
        links,
        prefetched?.provider === connection.Provider ? prefetched.set : undefined
      );
      result.imported += part.imported;
      result.reviews += part.reviews;
      result.errors.push(...part.errors);
    } catch (error) {
      failures.push(error);
      result.errors.push(getErrorMessage(error, t`Bank sync failed`));
    }
  }
  if (attempted && failures.length === attempted) throw failures[0];
  if (attempted) {
    try {
      await runtime.save();
    } catch (error) {
      console.warn('[BankSync] Failed to push synced changes', error);
    }
  }
  return result;
}

async function syncConnection(
  runtime: AppRuntime,
  connection: BankConnection,
  links: BankLink[],
  prefetched?: RemoteAccountSet
): Promise<BankSyncResult> {
  const services = runtime.services();
  const budgetId = connection.BudgetID;
  const provider = connection.Provider;
  const result: BankSyncResult = { imported: 0, reviews: 0, errors: [] };

  const record = (error: string | null, balances: BankSyncRecordInput['links']) =>
    executeSpaceMutation(runtime, {
      op: 'bankSync.recordSync',
      payload: {
        budgetId,
        input: { budgetId, provider, at: new Date().toISOString(), error, links: balances },
      },
      meta: { label: 'bank-sync', skipUndo: true },
    });

  let set: RemoteAccountSet;
  try {
    const start = new Date(Math.min(...links.map((link) => syncStart(link).getTime())));
    const firstSync = new Set(links.filter((l) => !l.LastSyncAt).map((l) => l.ExternalAccountID));
    set =
      prefetched ??
      (await fetchRemoteTransactions(connection, start, linkedExternalIds(links), firstSync));
  } catch (error) {
    const message = getErrorMessage(error, t`Bank sync failed`);
    await record(message, []);
    throw error;
  }

  result.errors.push(...(set.errors ?? []));
  const accounts = new Map(services.accounts.listAccounts(budgetId).map((a) => [a.ID, a]));
  const balances: BankSyncRecordInput['links'] = [];

  for (const link of links) {
    const account = accounts.get(link.AccountID);
    const remote = set.accounts.find((candidate) => candidate.id === link.ExternalAccountID);
    if (!account) continue;
    if (!remote) {
      const provider = providerName(connection);
      result.errors.push(t`${link.ExternalName} wasn't returned by ${provider}.`);
      continue;
    }
    try {
      const transactions = remote.transactions ?? [];
      const keys = new Map<string, string>();
      for (const transaction of transactions) {
        const operationId = bankOperationId(
          budgetId,
          account.ID,
          link.ExternalAccountID,
          transaction.id,
          connection.Provider
        );
        keys.set(operationId, await bankIdempotencyKey(operationId));
      }
      const plan = services.bankSync.planImport({
        budgetId,
        accountId: account.ID,
        currency: account.Currency,
        link,
        provider: connection.Provider,
        transactions,
        wasImported: (row: ImportIdentity) =>
          runtime.isMutationApplied(keys.get(row.operationId) ?? ''),
      });
      for (const { identity, transactionId } of plan.rekeys) {
        await executeSpaceMutation(runtime, {
          op: 'importHistory.match',
          payload: { budgetId, accountId: account.ID, transactionId, identity },
          idempotencyKey: keys.get(identity.operationId),
          meta: { label: 'bank-sync', skipUndo: true },
        });
      }
      for (const identity of plan.imports) {
        await executeSpaceMutation(runtime, {
          op: 'transactions.import',
          payload: {
            inflow: identity.inflow,
            outflow: identity.outflow,
            accountId: account.ID,
            categoryId: 0,
            budgetId,
            date: identity.date,
            memo: identity.memo.substring(0, 255),
            payee: identity.payee,
            transferId: '',
            importIdentities: [identity],
          },
          idempotencyKey: keys.get(identity.operationId),
          meta: { label: 'bank-sync', skipUndo: true, skipInvalidate: true },
        });
        result.imported++;
      }
      if (plan.reviews.length) {
        await executeSpaceMutation(runtime, {
          op: 'bankSync.addReviews',
          payload: { budgetId, reviews: plan.reviews },
          meta: { label: 'bank-sync', skipUndo: true },
        });
        result.reviews += plan.reviews.length;
      }
      balances.push({
        accountId: account.ID,
        balance: remote.balance,
        balanceDate:
          remote.balance === null ? null : (remote.balanceDate ?? new Date().toISOString()),
      });
    } catch (error) {
      result.errors.push(`${link.ExternalName}: ${getErrorMessage(error, t`Sync failed`)}`);
    }
  }

  await record(result.errors.length ? result.errors.join('\n') : null, balances);
  return result;
}
