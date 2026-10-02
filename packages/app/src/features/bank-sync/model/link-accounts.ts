import { t } from '@lingui/core/macro';
import {
  AccountTypeEnum,
  isCryptoCurrency,
  type Account,
  type BankConnection,
} from '@budgero/core/browser';
import { getAccountTypeDefinition } from '@entities/account/model/accountTypes';
import { formatDateISO } from '@shared/lib/date-utils';
import type { AppRuntime } from '@shared/runtime/app-runtime';
import { executeSpaceMutation } from '@shared/runtime/mutation-router';
import {
  fetchRemoteTransactions,
  linkedExternalIds,
  type RemoteBankAccount,
} from '../lib/provider';
import { runBankSync, syncStart, type BankSyncResult } from './run-bank-sync';

export const DEFAULT_HISTORY_DAYS = 30;

export type LinkTarget =
  { kind: 'existing'; accountId: number } | { kind: 'new'; name: string; type: AccountTypeEnum };

export interface LinkRequest {
  remote: RemoteBankAccount;
  target: LinkTarget;
  importFrom: string;
}

export function isSupportedBankCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code) && !isCryptoCurrency(code);
}

export function guessAccountType(remote: RemoteBankAccount): AccountTypeEnum {
  const name = `${remote.name} ${remote.orgName}`.toLowerCase();
  if (/mortgage/.test(name)) return AccountTypeEnum.MORTGAGE;
  if (/loan|auto|student/.test(name)) return AccountTypeEnum.LOAN;
  if (/credit|card|visa|mastercard|amex|discover/.test(name)) return AccountTypeEnum.CREDIT;
  if (/401k|ira|roth|retire/.test(name)) return AccountTypeEnum.RETIREMENT;
  if (/invest|brokerage|stock/.test(name)) return AccountTypeEnum.INVESTMENT;
  if (/saving/.test(name)) return AccountTypeEnum.SAVINGS;
  if (remote.balance !== null && remote.balance < 0) return AccountTypeEnum.CREDIT;
  return AccountTypeEnum.CHECKING;
}

export function daysAgo(days: number, now = new Date()): string {
  return formatDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

/** Start right after the newest entry so history typed in by hand isn't imported twice. */
export function defaultImportFrom(latestTransactionDate: string | null | undefined): string {
  const fallback = daysAgo(DEFAULT_HISTORY_DAYS);
  if (!latestTransactionDate) return fallback;
  const [y, m, d] = latestTransactionDate.slice(0, 10).split('-').map(Number);
  const next = formatDateISO(new Date(y, m - 1, d + 1));
  return next > daysAgo(0) ? daysAgo(0) : next;
}

/** Balance on the eve of `importFrom`, so the imported history lands on today's bank balance. */
export function openingBalance(remote: RemoteBankAccount, importFrom: string): number {
  if (remote.balance === null) return 0;
  const balanceDay = remote.balanceDate ? formatDateISO(new Date(remote.balanceDate)) : null;
  const imported = (remote.transactions ?? [])
    .filter(
      (tx) => !tx.pending && tx.date >= importFrom && (balanceDay === null || tx.date <= balanceDay)
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  return remote.balance - imported;
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDateISO(new Date(y, m - 1, d - 1));
}

export async function linkAccounts(
  runtime: AppRuntime,
  connection: BankConnection,
  budgetId: number,
  requests: LinkRequest[]
): Promise<BankSyncResult> {
  const existing = runtime.services().bankSync.listLinks(budgetId, connection.Provider);
  const starts = [
    ...requests.map((r) => syncStart({ ImportFrom: r.importFrom, LastSyncAt: null })),
    ...existing.map(syncStart),
  ];
  const requested = new Set(requests.map((r) => r.remote.id));
  const set = await fetchRemoteTransactions(
    connection,
    new Date(Math.min(...starts.map((start) => start.getTime()))),
    new Set([...linkedExternalIds(existing), ...requested]),
    requested
  );
  const fetched = new Map(set.accounts.map((account) => [account.id, account]));
  const missing = requests.filter((r) => !fetched.has(r.remote.id));
  if (connection.Provider === 'enablebanking' && missing.length) {
    // Without the bank's balance the opening balance would be wrong; link nothing.
    throw new Error(set.errors.join('\n') || t`The bank didn't return ${missing[0].remote.name}.`);
  }

  for (const request of requests) {
    const remote = fetched.get(request.remote.id) ?? request.remote;
    let accountId: number;
    if (request.target.kind === 'existing') {
      accountId = request.target.accountId;
    } else {
      const definition = getAccountTypeDefinition(request.target.type);
      const account = await executeSpaceMutation<Account>(runtime, {
        op: 'accounts.create',
        payload: {
          name: request.target.name,
          budgetId,
          type: request.target.type,
          currency: remote.currency,
          balance: openingBalance(remote, request.importFrom),
          metadata: {},
          onBudget: definition?.budgetType !== 'always-off',
          initialBalanceDate: dayBefore(request.importFrom),
        },
        meta: { label: 'bank-sync' },
      });
      accountId = account.ID;
      // The opening balance comes from the bank's own balance, so it's cleared:
      // otherwise the cleared total never matches the bank.
      const opening = runtime
        .services()
        .transactions.getTransactionsByAccount(accountId)
        .map((row) => row.ID);
      if (opening.length) {
        await executeSpaceMutation(runtime, {
          op: 'transactions.setCleared',
          payload: { budgetId, ids: opening, cleared: true },
          meta: { label: 'bank-sync', skipUndo: true },
        });
      }
    }
    await executeSpaceMutation(runtime, {
      op: 'bankSync.saveLink',
      payload: {
        budgetId,
        input: {
          budgetId,
          provider: connection.Provider,
          accountId,
          externalAccountId: remote.id,
          externalName: remote.name,
          orgName: remote.orgName,
          importFrom: request.importFrom,
        },
      },
      meta: { label: 'bank-sync', skipUndo: true },
    });
  }

  return runBankSync(runtime, budgetId, { provider: connection.Provider, set });
}
