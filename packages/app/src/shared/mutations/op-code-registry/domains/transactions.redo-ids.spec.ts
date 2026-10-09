import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationExecutor, type UndoEntry } from '@budgero/runtime';
import {
  executeMutationOp,
  getInvalidatesForOp,
  getUndoSpec,
} from '@shared/mutations/op-code-registry';
import { useUndoStore } from '@shared/mutations/UndoStore';

// A tiny ledger that allocates IDs like SQLite AUTOINCREMENT.
const ledger = vi.hoisted(() => ({ rows: new Map<number, Record<string, unknown>>(), next: 1 }));
const transactionMocks = vi.hoisted(() => ({
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactionByID: vi.fn(),
  getTransactionsByTransferID: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({
      transactions: transactionMocks,
      importHistory: { duplicates: { identities: () => [], findOperation: () => undefined } },
    }),
    mutationsRouter: () => ({ execute: runtimeMocks.executeMutation }),
  }),
}));

const addArgs = {
  budgetId: 1,
  accountId: 2,
  categoryId: 3,
  date: '2026-10-08',
  memo: 'Coffee',
  payee: 'Cafe',
  inflow: 0,
  outflow: 4500,
};

describe('undo/redo keeps transaction IDs stable', () => {
  beforeEach(() => {
    ledger.rows.clear();
    ledger.next = 1;
    useUndoStore.getState().clear();
    transactionMocks.addTransaction.mockReset().mockImplementation((...params: unknown[]) => {
      const explicitId = params[14] as number | undefined;
      if (explicitId !== undefined && ledger.rows.has(explicitId)) throw new Error('taken');
      const id = explicitId ?? ledger.next++;
      ledger.rows.set(id, {
        ID: id,
        BudgetID: params[4],
        AccountID: params[2],
        CategoryID: params[3],
        Date: params[5],
        Memo: params[6],
        OutflowConverted: params[1],
        InflowConverted: params[0],
      });
      return Promise.resolve(id);
    });
    transactionMocks.deleteTransaction.mockReset().mockImplementation((id: number) => {
      if (!ledger.rows.delete(id)) throw new Error(`Transaction ${id} not found`);
    });
    transactionMocks.getTransactionByID.mockReset().mockImplementation((id: number) => {
      const row = ledger.rows.get(id);
      if (!row) throw new Error(`Transaction ${id} not found`);
      return row;
    });
    transactionMocks.getTransactionsByTransferID.mockReset().mockReturnValue([]);

    const executor = new MutationExecutor({
      executeOp: executeMutationOp,
      getUndoSpec,
      getInvalidatesForOp,
      getQueryClient: () => undefined,
      pushUndo: (entry: UndoEntry) => useUndoStore.getState().push(entry),
      recordHistory: () => {},
      getActiveSpaceId: () => 'space-1',
      getSpaceRole: () => 'owner',
    });
    runtimeMocks.executeMutation.mockReset().mockImplementation((spec) => executor.execute(spec));
  });

  it('add → undo → redo → undo removes the transaction every time', async () => {
    await runtimeMocks.executeMutation({ op: 'transactions.add', payload: addArgs });
    const store = useUndoStore.getState();
    for (let round = 0; round < 2; round += 1) {
      await store.undo();
      expect([...ledger.rows.keys()]).toEqual([]);
      await store.redo();
      expect([...ledger.rows.keys()]).toEqual([1]);
    }
    await store.undo();
    expect(ledger.rows.size).toBe(0);
  });

  it('delete → undo → redo deletes the restored row, and older edits still undo', async () => {
    await runtimeMocks.executeMutation({ op: 'transactions.add', payload: addArgs });
    await runtimeMocks.executeMutation({ op: 'transactions.delete', payload: { id: 1 } });
    const store = useUndoStore.getState();

    await store.undo();
    expect([...ledger.rows.keys()]).toEqual([1]);
    await store.redo();
    expect(ledger.rows.size).toBe(0);
    await store.undo();
    await store.undo();
    expect(ledger.rows.size).toBe(0);
    expect(useUndoStore.getState().past).toHaveLength(0);
  });

  it('drops an undo step that fails instead of blocking older steps', async () => {
    await runtimeMocks.executeMutation({ op: 'transactions.add', payload: addArgs });
    const store = useUndoStore.getState();
    store.push({
      id: 'broken',
      undo: [{ op: 'transactions.updateColumn', args: { id: 99, column: 'Memo', value: '' } }],
      redo: [],
      ts: 0,
    });

    await expect(store.undo()).rejects.toThrow();
    expect(useUndoStore.getState().past).toHaveLength(1);
    await store.undo();
    expect(ledger.rows.size).toBe(0);
  });
});
