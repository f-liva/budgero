import { describe, it, expect } from 'vitest';
import { NodeSqlJsAdapter, ServiceManager, DatabaseAdapter, asMilli } from '../src';

async function open(data?: Uint8Array) {
  const adapter = await NodeSqlJsAdapter.create(data);
  const manager = new ServiceManager();
  await manager.initialize(adapter as DatabaseAdapter);
  return { adapter, services: manager.getServices() };
}

async function setup() {
  const { adapter, services } = await open();
  const budgetId = await services.budgets.createBudget({
    name: 'Cleared',
    display_currency: 'USD',
    badge_icon: 'dollar',
    number_format: '123,456.78',
    create_default_categories: false,
  });
  const group = services.categories.addCategoryGroup('G', budgetId);
  const categoryId = services.categories.addCategory(group, budgetId, 'Food');
  const accountId = (
    await services.accounts.createAccount('Checking', budgetId, 'checking', 'USD', 0)
  ).ID;
  const add = (date: string, outflow: number, cleared = false) =>
    services.transactions.addTransaction(
      asMilli(0),
      asMilli(outflow),
      accountId,
      categoryId,
      budgetId,
      date,
      '',
      '',
      'Shop',
      null,
      null,
      false,
      [],
      cleared
    );
  const status = (id: number) =>
    adapter.prepare('SELECT Cleared, Reconciled FROM transactions WHERE ID = ?').get(id) as {
      Cleared: number;
      Reconciled: number;
    };
  const account = () => services.accounts.listAccounts(budgetId).find((a) => a.ID === accountId)!;
  return { adapter, services, budgetId, accountId, add, status, account };
}

describe('transaction cleared status', () => {
  it('starts new transactions uncleared unless the source says cleared', async () => {
    const { add, status } = await setup();
    expect(status(await add('2026-09-01', 1_000))).toEqual({ Cleared: 0, Reconciled: 0 });
    expect(status(await add('2026-09-01', 1_000, true))).toEqual({ Cleared: 1, Reconciled: 0 });
  });

  it('toggles cleared, reports only real changes, and never touches reconciled rows', async () => {
    const { services, accountId, add, status } = await setup();
    const locked = await add('2026-09-01', 1_000, true);
    services.transactions.reconcileAccount(accountId, '2026-09-01', { clearedOnly: true });
    const open1 = await add('2026-09-02', 2_000);
    const open2 = await add('2026-09-03', 3_000, true);

    expect(services.transactions.setTransactionsCleared([locked, open1, open2], true)).toEqual([
      open1,
    ]);
    expect(services.transactions.setTransactionsCleared([locked, open1], false)).toEqual([open1]);
    expect(status(locked)).toEqual({ Cleared: 1, Reconciled: 1 });
    expect(status(open1)).toEqual({ Cleared: 0, Reconciled: 0 });
  });

  it('reconciles only cleared rows, while the legacy op still locks everything', async () => {
    const { services, accountId, add, status } = await setup();
    const cleared = await add('2026-09-01', 1_000, true);
    const pending = await add('2026-09-02', 2_000);
    const later = await add('2026-09-20', 3_000, true);

    services.transactions.reconcileAccount(accountId, '2026-09-10', { clearedOnly: true });
    expect(status(cleared)).toEqual({ Cleared: 1, Reconciled: 1 });
    expect(status(pending)).toEqual({ Cleared: 0, Reconciled: 0 });
    expect(status(later)).toEqual({ Cleared: 1, Reconciled: 0 });

    services.transactions.reconcileAccount(accountId, '2026-09-10');
    expect(status(pending)).toEqual({ Cleared: 1, Reconciled: 1 });
  });

  it('unreconciles exactly what a reconcile locked', async () => {
    const { adapter, services, accountId, add, status } = await setup();
    const earlier = await add('2026-08-01', 500, true);
    services.transactions.reconcileAccount(accountId, '2026-08-01', { clearedOnly: true });
    const reconciledAt = () =>
      (
        adapter.prepare('SELECT ReconciledAt FROM accounts WHERE ID = ?').get(accountId) as {
          ReconciledAt: string | null;
        }
      ).ReconciledAt;
    const firstStamp = reconciledAt();

    const cleared = await add('2026-09-01', 1_000, true);
    const pending = await add('2026-09-02', 2_000);

    const legacy = services.transactions.reconcileAccount(accountId, '2026-09-10');
    expect(legacy.reconciledIds.sort()).toEqual([cleared, pending].sort());
    expect(legacy.newlyClearedIds).toEqual([pending]);
    expect(legacy.previousReconciledAt).toBe(firstStamp);

    services.transactions.unreconcileAccount(accountId, legacy);
    expect(status(earlier)).toEqual({ Cleared: 1, Reconciled: 1 });
    expect(status(cleared)).toEqual({ Cleared: 1, Reconciled: 0 });
    expect(status(pending)).toEqual({ Cleared: 0, Reconciled: 0 });
    expect(reconciledAt()).toBe(firstStamp);
  });

  it('reports the uncleared total so the cleared balance can be derived', async () => {
    const { services, add, account } = await setup();
    await add('2026-09-01', 1_000, true);
    const pending = await add('2026-09-02', 2_500);
    expect(account().BalanceNative).toBe(-3_500);
    expect(account().UnclearedNative).toBe(-2_500);

    services.transactions.setTransactionsCleared([pending], true);
    expect(account().UnclearedNative).toBe(0);
  });

  it('lets Push API updates set cleared, alone or with other fields', async () => {
    const { services, add, status } = await setup();
    const id = await add('2026-09-01', 1_000);
    await services.transactions.updatePushedTransaction(id, { cleared: true });
    expect(status(id).Cleared).toBe(1);
    await services.transactions.updatePushedTransaction(id, { memo: 'settled', cleared: false });
    expect(status(id).Cleared).toBe(0);
    await expect(
      services.transactions.updatePushedTransaction(id, { cleared: 'yes' })
    ).rejects.toThrow();
  });

  it('marks every existing transaction cleared when an older workspace upgrades', async () => {
    const { adapter, add } = await setup();
    const id = await add('2026-09-01', 1_000);
    adapter.exec('ALTER TABLE transactions DROP COLUMN Cleared');
    adapter.exec('DELETE FROM schema_migrations WHERE version >= 66');
    const olderBackup = await adapter.backup();
    adapter.close();

    const upgraded = await open(olderBackup);
    expect(
      upgraded.adapter.prepare('SELECT Cleared FROM transactions WHERE ID = ?').get(id)
    ).toEqual({ Cleared: 1 });
    upgraded.adapter.close();
  });
});
