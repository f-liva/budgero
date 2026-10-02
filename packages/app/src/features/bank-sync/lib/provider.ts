import { t } from '@lingui/core/macro';
import {
  fromDecimalString,
  fromSimpleFINTransaction,
  parseEnableBankingConfig,
  type BankConnection,
  type BankLink,
  type BankTransaction,
  type EnableBankingConfig,
  type EnableBankingSession,
  type SimpleFINAccount,
  type SimpleFINAccountSet,
} from '@budgero/core/browser';
import { formatDateISO } from '@shared/lib/date-utils';
import { getErrorMessage } from '@shared/lib/errors';
import {
  EnableBankingError,
  getBalance,
  getTransactions,
  toBankTransactions,
} from './enable-banking/client';
import { fetchBalances, fetchTransactions } from './simplefin-client';

/** A bank account as any provider reports it. */
export interface RemoteBankAccount {
  /** Stable external ID stored on links (SimpleFIN account ID, Enable Banking identification hash). */
  id: string;
  name: string;
  orgName: string;
  currency: string;
  /** Milli-units; null when the provider wasn't asked (saves bank quota). */
  balance: number | null;
  /** ISO timestamp of `balance`. */
  balanceDate: string | null;
  transactions?: BankTransaction[];
}

export interface RemoteAccountSet {
  errors: string[];
  accounts: RemoteBankAccount[];
}

export function providerName(connection: Pick<BankConnection, 'Provider'>): string {
  return connection.Provider === 'enablebanking' ? 'Enable Banking' : 'SimpleFIN';
}

export function fromSimpleFINAccount(account: SimpleFINAccount): RemoteBankAccount {
  return {
    id: account.id,
    name: account.name,
    orgName: account.org.name ?? account.org.domain ?? '',
    currency: account.currency,
    balance: fromDecimalString(account.balance.replace(/^\+/, '')),
    balanceDate: new Date(account['balance-date'] * 1000).toISOString(),
    transactions: account.transactions?.map(fromSimpleFINTransaction),
  };
}

function fromSimpleFINSet(set: SimpleFINAccountSet): RemoteAccountSet {
  return { errors: set.errors ?? [], accounts: set.accounts.map(fromSimpleFINAccount) };
}

function requireEnableBankingConfig(connection: BankConnection): EnableBankingConfig {
  const config = parseEnableBankingConfig(connection);
  if (!config) throw new Error(t`Enable Banking credentials are missing. Reconnect bank sync.`);
  return config;
}

export function isSessionExpired(validUntil: string, now = Date.now()): boolean {
  return new Date(validUntil).getTime() <= now;
}

const WARN_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

/** Banks grant ~180 days; warn a week ahead so syncing never silently stops. */
export function sessionExpiresSoon(
  session: Pick<EnableBankingSession, 'validUntil'>,
  now = Date.now()
): boolean {
  return new Date(session.validUntil).getTime() - now < WARN_BEFORE_MS;
}

/** Accounts from authorized Enable Banking sessions, without calling the bank. */
export function enableBankingAccounts(config: EnableBankingConfig): RemoteBankAccount[] {
  const accounts = new Map<string, RemoteBankAccount>();
  for (const session of config.sessions) {
    for (const account of session.accounts) {
      accounts.set(account.hash, {
        id: account.hash,
        name: account.name,
        orgName: session.aspsp.name,
        currency: account.currency,
        balance: null,
        balanceDate: null,
      });
    }
  }
  return [...accounts.values()];
}

/** Lists the provider's accounts for the connection panel. */
export async function fetchRemoteAccounts(connection: BankConnection): Promise<RemoteAccountSet> {
  if (connection.Provider === 'enablebanking') {
    return { errors: [], accounts: enableBankingAccounts(requireEnableBankingConfig(connection)) };
  }
  return fromSimpleFINSet(await fetchBalances(connection.AccessURL));
}

/**
 * Fetches balances and transactions since `start`. Enable Banking is asked
 * only about `onlyAccountIds` (linked accounts), since every call spends the
 * bank's daily access quota.
 */
export async function fetchRemoteTransactions(
  connection: BankConnection,
  start: Date,
  onlyAccountIds?: Set<string>,
  firstSyncIds: Set<string> = new Set()
): Promise<RemoteAccountSet> {
  if (connection.Provider !== 'enablebanking') {
    return fromSimpleFINSet(await fetchTransactions(connection.AccessURL, start));
  }
  const config = requireEnableBankingConfig(connection);
  const credentials = { appId: config.appId, privateKeyPem: config.privateKeyPem };
  const result: RemoteAccountSet = { errors: [], accounts: [] };
  const dateFrom = formatDateISO(start);
  const done = new Set<string>();

  // Newest session first, so a re-authorized bank wins over a stale one.
  const sessions = [...config.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const session of sessions) {
    const wanted = session.accounts.filter(
      (account) => !done.has(account.hash) && (!onlyAccountIds || onlyAccountIds.has(account.hash))
    );
    if (!wanted.length) continue;
    if (isSessionExpired(session.validUntil)) {
      result.errors.push(
        t`Access to ${session.aspsp.name} expired. Reconnect it in Settings › Bank sync.`
      );
      continue;
    }
    for (const account of wanted) {
      try {
        const [balance, rows] = await Promise.all([
          getBalance(credentials, account.uid),
          getTransactions(credentials, account.uid, dateFrom, {
            longest: firstSyncIds.has(account.hash),
          }),
        ]);
        done.add(account.hash);
        result.accounts.push({
          id: account.hash,
          name: account.name,
          orgName: session.aspsp.name,
          currency: balance?.currency || account.currency,
          balance: balance?.amount ?? null,
          balanceDate: balance?.date ?? null,
          transactions: toBankTransactions(rows),
        });
      } catch (error) {
        if (error instanceof EnableBankingError && error.needsReauthorization) {
          result.errors.push(
            t`Access to ${session.aspsp.name} expired. Reconnect it in Settings › Bank sync.`
          );
          break;
        }
        result.errors.push(`${account.name}: ${getErrorMessage(error, t`Sync failed`)}`);
      }
    }
  }
  return result;
}

export function linkedExternalIds(links: Pick<BankLink, 'ExternalAccountID'>[]): Set<string> {
  return new Set(links.map((link) => link.ExternalAccountID));
}
