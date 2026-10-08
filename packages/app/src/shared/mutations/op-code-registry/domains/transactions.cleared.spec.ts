import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeMutationOp, getUndoSpec } from '@shared/mutations/op-code-registry';

const transactionMocks = vi.hoisted(() => ({
  addTransaction: vi.fn(),
  setTransactionsCleared: vi.fn(),
  reconcileAccount: vi.fn(),
  unreconcileAccount: vi.fn(),
}));
const importMocks = vi.hoisted(() => ({ findOperation: vi.fn() }));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({
      transactions: transactionMocks,
      importHistory: { duplicates: importMocks },
    }),
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

const addArgs = {
  inflow: 0,
  outflow: 1_000,
  accountId: 3,
  categoryId: 5,
  budgetId: 1,
  date: '2026-09-29',
  memo: '',
  payee: 'Shop',
};
const clearedArg = () => transactionMocks.addTransaction.mock.calls[0].at(-1);

describe('cleared status ops', () => {
  beforeEach(() => {
    transactionMocks.addTransaction.mockReset().mockResolvedValue(10);
    transactionMocks.setTransactionsCleared.mockReset();
    transactionMocks.reconcileAccount.mockReset();
    importMocks.findOperation.mockReset().mockReturnValue(undefined);
  });

  it('adds manual and Push API transactions uncleared unless cleared is true', async () => {
    await executeMutationOp('transactions.add', addArgs);
    expect(clearedArg()).toBe(false);

    transactionMocks.addTransaction.mockClear();
    await executeMutationOp('transactions.add', { ...addArgs, cleared: true });
    expect(clearedArg()).toBe(true);
  });

  it('imports bank-statement rows cleared unless the file says otherwise', async () => {
    const identity = { operationId: 'file:1' };
    await executeMutationOp('transactions.import', { ...addArgs, importIdentities: [identity] });
    expect(clearedArg()).toBe(true);

    transactionMocks.addTransaction.mockClear();
    await executeMutationOp('transactions.import', {
      ...addArgs,
      importIdentities: [{ operationId: 'file:2' }],
      cleared: false,
    });
    expect(clearedArg()).toBe(false);
  });

  it('setCleared validates input and undoes only the rows it changed', async () => {
    transactionMocks.setTransactionsCleared.mockReturnValue([7]);
    const result = await executeMutationOp('transactions.setCleared', {
      ids: [7, 8],
      cleared: true,
    });
    expect(transactionMocks.setTransactionsCleared).toHaveBeenCalledWith([7, 8], true);
    expect(result).toEqual({ changed: [7] });
    expect(
      getUndoSpec('transactions.setCleared')?.build(
        { ids: [7, 8], cleared: true },
        result,
        undefined
      )
    ).toEqual([{ op: 'transactions.setCleared', args: { ids: [7], cleared: false } }]);

    await expect(
      executeMutationOp('transactions.setCleared', { ids: ['7'], cleared: true })
    ).rejects.toThrow(/ids/);
    await expect(
      executeMutationOp('transactions.setCleared', { ids: [7], cleared: 'yes' })
    ).rejects.toThrow(/cleared/);
  });

  it('reconcileCleared locks cleared rows only; the legacy op keeps its meaning', async () => {
    await executeMutationOp('transactions.reconcileCleared', {
      accountId: 3,
      reconcileDate: '2026-09-29',
    });
    expect(transactionMocks.reconcileAccount).toHaveBeenLastCalledWith(3, '2026-09-29', {
      clearedOnly: true,
    });

    await executeMutationOp('transactions.reconcile', {
      accountId: 3,
      reconcileDate: '2026-09-29',
    });
    expect(transactionMocks.reconcileAccount).toHaveBeenLastCalledWith(3, '2026-09-29');
  });

  it('undoes a reconcile by unlocking exactly what it locked', async () => {
    const reconcile = {
      reconciledIds: [11, 12],
      newlyClearedIds: [],
      previousReconciledAt: '2026-08-01T00:00:00.000Z',
    };
    const args = { accountId: 3, reconcileDate: '2026-09-29' };
    const undo = getUndoSpec('transactions.reconcileCleared')!.build(args, reconcile, undefined);
    expect(undo).toEqual([
      { op: 'transactions.unreconcile', args: { accountId: 3, ...reconcile } },
    ]);

    await executeMutationOp(undo[0].op, undo[0].args);
    expect(transactionMocks.unreconcileAccount).toHaveBeenCalledWith(3, reconcile);
  });
});
