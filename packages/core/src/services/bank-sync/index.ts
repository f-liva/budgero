import type { DatabaseAdapter } from '../../database/interface.js';
import { ImportDuplicateService, type DuplicateInput } from '../import/duplicate-planner.js';
import { fromDecimalString, subMilli, ZERO_MILLI, type MilliUnits } from '../../money/index.js';
import { getLocalDateString } from '../../utils/date.js';
import { BankSyncQueries } from './queries.js';
import type {
  BankConnection,
  BankImportPlan,
  BankImportPlanInput,
  BankLink,
  BankLinkInput,
  BankProvider,
  BankReview,
  BankReviewInput,
  BankReviewStatus,
  BankSyncRecordInput,
  BankTransaction,
  EnableBankingConfig,
  EnableBankingSession,
  SimpleFINTransaction,
} from './types.js';

export * from './types.js';

const MANUAL_MATCH_DAYS = 5;
const REISSUE_DAYS = 3;

/** Namespaces source keys and operation IDs. Never change an existing one. */
const SOURCE_NAMESPACE: Record<BankProvider, string> = {
  simplefin: 'simplefin-v1',
  enablebanking: 'enablebanking-v1',
};

export const ENABLE_BANKING_API_URL = 'https://api.enablebanking.com';

export function bankOperationId(
  budgetId: number,
  accountId: number,
  externalAccountId: string,
  transactionId: string,
  provider: BankProvider = 'simplefin'
): string {
  return JSON.stringify([
    SOURCE_NAMESPACE[provider],
    budgetId,
    accountId,
    externalAccountId,
    transactionId,
  ]);
}

function bankSourceKey(provider: BankProvider, externalAccountId: string, id: string): string {
  return JSON.stringify([SOURCE_NAMESPACE[provider], externalAccountId, id]);
}

export function simpleFINDate(transaction: SimpleFINTransaction): string {
  return getLocalDateString(new Date((transaction.transacted_at || transaction.posted) * 1000));
}

export function isPostedSimpleFINTransaction(transaction: SimpleFINTransaction): boolean {
  return !transaction.pending && transaction.posted > 0;
}

export function fromSimpleFINTransaction(transaction: SimpleFINTransaction): BankTransaction {
  const description = transaction.description?.trim() ?? '';
  const payee = transaction.payee?.trim() || description;
  return {
    id: transaction.id,
    date: simpleFINDate(transaction),
    amount: fromDecimalString(transaction.amount.replace(/^\+/, '')),
    payee,
    memo: transaction.memo?.trim() || (payee === description ? '' : description),
    pending: !isPostedSimpleFINTransaction(transaction),
  };
}

export function parseEnableBankingConfig(
  connection: Pick<BankConnection, 'Provider' | 'ConfigJSON'> | null | undefined
): EnableBankingConfig | null {
  if (connection?.Provider !== 'enablebanking') return null;
  try {
    const config = JSON.parse(connection.ConfigJSON || '{}') as Partial<EnableBankingConfig>;
    if (!config.appId || !config.privateKeyPem) return null;
    return { ...config, sessions: config.sessions ?? [] } as EnableBankingConfig;
  } catch {
    return null;
  }
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return getLocalDateString(new Date(y, m - 1, d + days));
}

export class BankSyncService {
  private queries: BankSyncQueries;

  constructor(private db: DatabaseAdapter) {
    this.queries = new BankSyncQueries(db);
  }

  getConnection(budgetId: number, provider: BankProvider): BankConnection | null {
    return this.queries.getConnection(budgetId, provider);
  }

  /** Every provider connected for the budget: SimpleFIN and Enable Banking can coexist. */
  listConnections(budgetId: number): BankConnection[] {
    return this.queries.listConnections(budgetId);
  }

  saveConnection(budgetId: number, accessUrl: string): BankConnection {
    this.queries.upsertConnection(budgetId, 'simplefin', accessUrl, '{}');
    return this.queries.getConnection(budgetId, 'simplefin')!;
  }

  /** Saves the app credentials; keeps authorized sessions when only the key changes. */
  saveEnableBankingConnection(
    budgetId: number,
    config: Omit<EnableBankingConfig, 'sessions'>
  ): BankConnection {
    const sessions = this.enableBankingConfig(budgetId)?.sessions ?? [];
    this.writeEnableBankingConfig(budgetId, { ...config, sessions });
    return this.queries.getConnection(budgetId, 'enablebanking')!;
  }

  /** Adds a session, replacing any earlier one for the same bank (re-authorization). */
  saveEnableBankingSession(budgetId: number, session: EnableBankingSession): void {
    const config = this.enableBankingConfig(budgetId);
    if (!config) throw new Error('Enable Banking is not connected for this budget');
    const sessions = config.sessions.filter(
      (s) =>
        s.sessionId !== session.sessionId &&
        !(s.aspsp.name === session.aspsp.name && s.aspsp.country === session.aspsp.country)
    );
    this.writeEnableBankingConfig(budgetId, { ...config, sessions: [...sessions, session] });
  }

  removeEnableBankingSession(budgetId: number, sessionId: string): void {
    const config = this.enableBankingConfig(budgetId);
    if (!config) return;
    const sessions = config.sessions.filter((s) => s.sessionId !== sessionId);
    this.writeEnableBankingConfig(budgetId, { ...config, sessions });
  }

  private enableBankingConfig(budgetId: number): EnableBankingConfig | null {
    return parseEnableBankingConfig(this.getConnection(budgetId, 'enablebanking'));
  }

  private writeEnableBankingConfig(budgetId: number, config: EnableBankingConfig): void {
    this.queries.upsertConnection(
      budgetId,
      'enablebanking',
      ENABLE_BANKING_API_URL,
      JSON.stringify(config)
    );
  }

  /** Removes one provider's connection with its links and pending reviews. */
  deleteConnection(budgetId: number, provider: BankProvider): void {
    this.queries.deleteConnection(budgetId, provider);
  }

  listLinks(budgetId: number, provider?: BankProvider): BankLink[] {
    return this.queries.listLinks(budgetId, provider);
  }

  saveLink(input: BankLinkInput): void {
    this.queries.upsertLink(input);
  }

  deleteLink(accountId: number): void {
    this.queries.deleteLink(accountId);
  }

  latestTransactionDate(accountId: number): string | null {
    return this.queries.latestTransactionDate(accountId, getLocalDateString());
  }

  recordSync(input: BankSyncRecordInput): void {
    this.queries.recordSync(input);
  }

  listPendingReviews(budgetId: number, accountId?: number): BankReview[] {
    return this.queries.listPendingReviews(budgetId, accountId);
  }

  addReviews(reviews: BankReviewInput[]): void {
    this.queries.addReviews(reviews);
  }

  setReviewStatus(id: number, status: BankReviewStatus): void {
    this.queries.setReviewStatus(id, status);
  }

  planImport(input: BankImportPlanInput): BankImportPlan {
    const { budgetId, accountId, currency, link } = input;
    const provider = input.provider ?? 'simplefin';
    const reviewed = this.queries.reviewedOperationIds(budgetId, accountId);
    let skipped = 0;
    const rows: DuplicateInput[] = [];
    for (const transaction of input.transactions) {
      const { date, amount } = transaction;
      if (transaction.pending || date < link.ImportFrom) continue;
      if (amount === 0) continue;
      const sourceKey = bankSourceKey(provider, link.ExternalAccountID, transaction.id);
      const row: DuplicateInput = {
        index: rows.length,
        valid: true,
        budgetId,
        accountId,
        currency,
        operationId: bankOperationId(
          budgetId,
          accountId,
          link.ExternalAccountID,
          transaction.id,
          provider
        ),
        fileRowKey: sourceKey,
        sourceKey,
        date,
        inflow: amount > 0 ? (amount as MilliUnits) : ZERO_MILLI,
        outflow: amount < 0 ? subMilli(ZERO_MILLI, amount as MilliUnits) : ZERO_MILLI,
        payee: transaction.payee,
        memo: transaction.memo,
      };
      if (reviewed.has(row.operationId) || input.wasImported(row)) skipped++;
      else rows.push({ ...row, index: rows.length });
    }

    const fetchedKeys = new Set(
      input.transactions.map((tx) => bankSourceKey(provider, link.ExternalAccountID, tx.id))
    );
    const sourcePrefix = `${JSON.stringify([SOURCE_NAMESPACE[provider], link.ExternalAccountID]).slice(0, -1)},`;
    const fetchedFrom = input.transactions.map((tx) => tx.date).sort()[0] ?? '';
    const orphans = this.queries
      .bankImportedRows(budgetId, accountId, sourcePrefix)
      .filter(
        (row) => !fetchedKeys.has(row.identity.sourceKey ?? '') && row.identity.date >= fetchedFrom
      );
    const rekeys: BankImportPlan['rekeys'] = [];
    const normalized = (s: string) => s.trim().toLowerCase();

    const plans = new ImportDuplicateService(this.db).plan(rows);
    const claimed = this.queries.pendingCandidateIds(budgetId, accountId);
    const imports: BankImportPlan['imports'] = [];
    const reviews: BankReviewInput[] = [];
    for (const [i, plan] of plans.entries()) {
      const { index: _index, valid: _valid, budgetId: _b, accountId: _a, ...identity } = rows[i];
      const review = (candidateTransactionId: number) => {
        claimed.add(candidateTransactionId);
        reviews.push({ budgetId, accountId, identity, candidateTransactionId });
      };
      if (plan.status === 'already-imported') {
        skipped++;
        continue;
      }
      // Same-date/amount hints are for files; bank rows carry real IDs, so only a reused ID needs review.
      const reusedId = plan.status === 'needs-review' && plan.reason.startsWith('Repeated bank');
      if (reusedId && plan.candidates[0]) {
        review(plan.candidates[0].id);
        continue;
      }
      const reissued = orphans.findIndex(
        (row) =>
          row.identity.date >= shiftDate(identity.date, -REISSUE_DAYS) &&
          row.identity.date <= shiftDate(identity.date, REISSUE_DAYS) &&
          row.identity.inflow === identity.inflow &&
          row.identity.outflow === identity.outflow &&
          normalized(row.identity.payee) === normalized(identity.payee)
      );
      if (reissued >= 0) {
        rekeys.push({ identity, transactionId: orphans[reissued].transactionId });
        orphans.splice(reissued, 1);
        continue;
      }
      const manual = this.queries
        .findManualMatches(
          budgetId,
          accountId,
          identity.inflow,
          identity.outflow,
          shiftDate(identity.date, -MANUAL_MATCH_DAYS),
          shiftDate(identity.date, MANUAL_MATCH_DAYS)
        )
        .find((match) => !claimed.has(match.id));
      if (manual) review(manual.id);
      else imports.push(identity);
    }
    return { imports, reviews, rekeys, skipped };
  }
}
