import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUndoSpec } from '@shared/mutations/op-code-registry';

const mocks = vi.hoisted(() => ({
  recurring: { getRecurringTransaction: vi.fn() },
  warranties: { getById: vi.fn() },
  currency: { getCustomRatesForBudget: vi.fn() },
  scenarios: { getScenario: vi.fn() },
}));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => mocks,
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

async function undoFor(op: string, args: Record<string, unknown>, result?: unknown) {
  const spec = getUndoSpec(op)!;
  return spec.build(args, result, await spec.capture?.(args));
}

describe('recurring, warranty, custom-rate and scenario undo', () => {
  beforeEach(() => {
    mocks.scenarios.getScenario.mockReset().mockReturnValue(null);
  });

  it('recurring: deletes a created template, restores an edit, unskips', async () => {
    expect(await undoFor('recurring.create', {}, { id: 3 })).toEqual([
      { op: 'recurring.delete', args: { id: 3 } },
    ]);

    mocks.recurring.getRecurringTransaction.mockReturnValue({
      id: 3,
      accountId: 1,
      toAccountId: null,
      categoryId: 9,
      name: 'Rent',
      memo: '',
      amount: 800_000,
      direction: 'outflow',
      schedule: { frequency: 'monthly', interval: 1, startDate: '2026-01-01' },
      notifyDaysBefore: 3,
      active: true,
    });
    const [restore] = await undoFor('recurring.update', { id: 3, patch: { amount: 1 } });
    expect(restore).toMatchObject({
      op: 'recurring.update',
      args: { id: 3, patch: { amount: 800_000, name: 'Rent', active: true } },
    });

    expect(await undoFor('recurring.skip', { id: 44 })).toEqual([
      { op: 'recurring.resetOccurrence', args: { id: 44 } },
    ]);
  });

  it('warranties: delete on create, restore on update, recreate on delete', async () => {
    expect(await undoFor('warranties.create', { budgetId: 1 }, 6)).toEqual([
      { op: 'warranties.delete', args: { id: 6 } },
    ]);

    mocks.warranties.getById.mockReturnValue({
      ID: 6,
      BudgetID: 1,
      Name: 'TV',
      ExpiresAt: '2028-01-01',
      Amount: 500_000,
      TransactionID: null,
      ReceiptImage: null,
      Notes: '',
    });
    const fields = {
      name: 'TV',
      expiresAt: '2028-01-01',
      amount: 500_000,
      transactionId: null,
      receiptImage: null,
      notes: '',
    };
    expect(await undoFor('warranties.update', { id: 6, name: 'OLED' })).toEqual([
      { op: 'warranties.update', args: { id: 6, ...fields } },
    ]);
    expect(await undoFor('warranties.delete', { id: 6 })).toEqual([
      { op: 'warranties.create', args: { budgetId: 1, ...fields } },
    ]);
  });

  it('custom rates: removes both added rows, restores edits and deletes', async () => {
    expect(
      await undoFor('currency.customRates.add', { budgetId: 1 }, { id: 4, reverseId: 5 })
    ).toEqual([
      { op: 'currency.customRates.delete', args: { id: 4, budgetId: 1 } },
      { op: 'currency.customRates.delete', args: { id: 5, budgetId: 1 } },
    ]);

    mocks.currency.getCustomRatesForBudget.mockReturnValue([
      {
        ID: 4,
        FromCurrency: 'EUR',
        ToCurrency: 'HUF',
        Rate: 400,
        StartDate: '2026-01-01',
        EndDate: null,
      },
    ]);
    expect(await undoFor('currency.customRates.update', { id: 4, budgetId: 1, rate: 1 })).toEqual([
      {
        op: 'currency.customRates.update',
        args: { id: 4, rate: 400, startDate: '2026-01-01', endDate: null, budgetId: 1 },
      },
    ]);
    expect(await undoFor('currency.customRates.delete', { id: 4, budgetId: 1 })).toEqual([
      {
        op: 'currency.customRates.add',
        args: {
          fromCurrency: 'EUR',
          toCurrency: 'HUF',
          rate: 400,
          startDate: '2026-01-01',
          endDate: null,
          budgetId: 1,
        },
      },
    ]);
  });

  it('scenarios: deletes a new one, restores an edited or deleted one under its ID', async () => {
    const created = { ID: 'sc_1', BudgetID: 1, Name: 'Plan', Payload: '{}' };
    expect(await undoFor('scenarios.save', { budgetId: 1, name: 'Plan' }, created)).toEqual([
      { op: 'scenarios.delete', args: { id: 'sc_1' } },
    ]);

    mocks.scenarios.getScenario.mockReturnValue(created);
    const restore = {
      op: 'scenarios.save',
      args: { id: 'sc_1', budgetId: 1, name: 'Plan', payload: '{}' },
    };
    expect(await undoFor('scenarios.save', { id: 'sc_1', name: 'Plan B' }, created)).toEqual([
      restore,
    ]);
    expect(await undoFor('scenarios.delete', { id: 'sc_1' })).toEqual([restore]);
  });
});
