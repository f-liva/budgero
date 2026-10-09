import { describe, expect, it, vi } from 'vitest';
import { getUndoSpec } from '@shared/mutations/op-code-registry';

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({}),
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

function redoFor(op: string, args: Record<string, unknown>, result: unknown, before?: unknown) {
  const spec = getUndoSpec(op) as { buildRedo?: (...params: unknown[]) => unknown } | undefined;
  return spec?.buildRedo?.(args, result, before);
}

describe('redo of a create reuses the IDs from the first run', () => {
  it.each([
    ['labels.add', { budgetId: 1, name: 'Trip' }, 5, { id: 5 }],
    ['categoryGroups.create', { budgetId: 1, name: 'Fun' }, 6, { id: 6 }],
    ['categories.create', { budgetId: 1, parentId: 6, name: 'Games' }, 7, { id: 7 }],
    ['warranties.create', { budgetId: 1, name: 'TV' }, 8, { id: 8 }],
    ['accounts.create', { budgetId: 1, name: 'Wallet' }, { ID: 9 }, { id: 9 }],
    ['scenarios.save', { budgetId: 1, name: 'Plan' }, { ID: 'sc_1' }, { id: 'sc_1' }],
    ['reports.create', { name: 'Food' }, { id: 'r1' }, { id: 'r1' }],
    ['customDashboards.create', { budgetId: 1, name: 'Main' }, { id: 'd1' }, { id: 'd1' }],
  ])('%s', (op, args, result, ids) => {
    expect(redoFor(op, args, result)).toEqual([{ op, args: { ...args, ...ids } }]);
  });

  it('recurring templates carry the ID inside the input', () => {
    const args = { input: { budgetId: 1, name: 'Rent' } };
    expect(redoFor('recurring.create', args, { id: 3 })).toEqual([
      { op: 'recurring.create', args: { input: { budgetId: 1, name: 'Rent', id: 3 } } },
    ]);
  });

  it('custom rates keep both the rate and its reverse', () => {
    const args = { budgetId: 1, fromCurrency: 'EUR', toCurrency: 'USD', alsoReverse: true };
    expect(redoFor('currency.customRates.add', args, { id: 4, reverseId: 5 })).toEqual([
      { op: 'currency.customRates.add', args: { ...args, id: 4, reverseId: 5 } },
    ]);
  });

  it('dashboard widgets reuse the widget the first add created', () => {
    const args = { dashboardId: 'd1', reportId: 'r1', chartId: 'c1' };
    const result = { widgets: [{ id: 'w0' }, { id: 'w9' }] };
    expect(redoFor('customDashboardWidgets.add', args, result, ['w0'])).toEqual([
      { op: 'customDashboardWidgets.add', args: { ...args, id: 'w9' } },
    ]);
  });

  it('rules are restored from the created snapshot', () => {
    const rule = { id: 'rule-1', budgetId: 1, name: 'Coffee' };
    expect(redoFor('rules.create', { input: {} }, rule)).toEqual([
      { op: 'rules.restore', args: { snapshot: rule } },
    ]);
  });
});
