import { beforeEach, describe, expect, it } from 'vitest';
import { asMilli, NodeSqlJsAdapter, ServiceManager, type Services } from '../src';

// Undo/redo recreates rows under their original IDs so history entries that
// reference them stay valid.
describe('creates accept an explicit ID', () => {
  let services: Services;
  let budgetId: number;

  beforeEach(async () => {
    const sm = new ServiceManager();
    await sm.initialize(await NodeSqlJsAdapter.create());
    services = sm.getServices();
    budgetId = await services.budgets.createBudget({
      name: 'Test',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    });
  });

  it('labels, category groups and categories', () => {
    const label = services.labels.addLabel(budgetId, 'Trip', '#ff0000');
    services.labels.deleteLabel(label, budgetId);
    expect(services.labels.addLabel(budgetId, 'Trip', '#ff0000', label)).toBe(label);

    const group = services.categories.addCategoryGroup('Fun', budgetId);
    const category = services.categories.addCategory(group, budgetId, 'Games');
    services.categories.deleteCategory(category);
    expect(services.categories.addCategory(group, budgetId, 'Games', '', 3, category)).toBe(
      category
    );
    services.categories.deleteCategory(category);
    services.categories.deleteCategoryGroup(group);
    expect(services.categories.addCategoryGroup('Fun', budgetId, group)).toBe(group);
  });

  it('accounts, warranties, recurring templates and custom rates', async () => {
    const account = await services.accounts.createAccount(
      'Wallet',
      budgetId,
      'checking',
      'USD',
      asMilli(0)
    );
    services.accounts.deleteAccount(account.ID);
    const again = await services.accounts.createAccount(
      'Wallet',
      budgetId,
      'checking',
      'USD',
      asMilli(0),
      undefined,
      undefined,
      'Initial Balance',
      undefined,
      account.ID
    );
    expect(again.ID).toBe(account.ID);

    const warranty = services.warranties.create({ budgetId, name: 'TV', expiresAt: '2028-01-01' });
    services.warranties.delete(warranty);
    expect(
      services.warranties.create({ id: warranty, budgetId, name: 'TV', expiresAt: '2028-01-01' })
    ).toBe(warranty);

    const input = {
      budgetId,
      accountId: again.ID,
      name: 'Rent',
      amount: asMilli(800_000),
      direction: 'outflow' as const,
      schedule: { frequency: 'monthly' as const, interval: 1, startDate: '2026-01-01' },
    };
    const template = await services.recurring.createRecurringTransaction(input);
    await services.recurring.deleteRecurringTransaction(template.id);
    const restored = await services.recurring.createRecurringTransaction({
      ...input,
      id: template.id,
    });
    expect(restored.id).toBe(template.id);

    const rate = await services.currency.addCustomRate(
      'EUR',
      'USD',
      1.1,
      '2026-01-01',
      null,
      budgetId,
      true
    );
    await services.currency.deleteCustomRate(rate.id, budgetId);
    await services.currency.deleteCustomRate(rate.reverseId!, budgetId);
    const readded = await services.currency.addCustomRate(
      'EUR',
      'USD',
      1.1,
      '2026-01-01',
      null,
      budgetId,
      true,
      rate
    );
    expect([readded.id, readded.reverseId]).toEqual([rate.id, rate.reverseId]);
  });
});
