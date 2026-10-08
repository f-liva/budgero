import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationExecutor, type UndoEntry } from '@budgero/runtime';
import {
  executeMutationOp,
  getInvalidatesForOp,
  getUndoSpec,
} from '@shared/mutations/op-code-registry';
import { useUndoStore } from '@shared/mutations/UndoStore';

type Row = Record<string, unknown> & { ID: number };

const ledger = vi.hoisted(() => ({
  rows: new Map<number, Row>(),
  splits: new Map<number, Record<string, unknown>[]>(),
  next: 1,
}));
const transactionMocks = vi.hoisted(() => ({
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactionByID: vi.fn(),
  getTransactionsByTransferID: vi.fn(),
}));
const splitMocks = vi.hoisted(() => ({ getSplits: vi.fn(), upsertSplits: vi.fn() }));
const runtimeMocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({ transactions: transactionMocks, splits: splitMocks }),
    mutationsRouter: () => ({ execute: runtimeMocks.executeMutation }),
  }),
}));

function seed(row: Omit<Row, 'ID'>) {
  const ID = ledger.next++;
  ledger.rows.set(ID, {
    BudgetID: 1,
    Date: '2026-10-01',
    Memo: '',
    Payee: '',
    InflowNative: 0,
    OutflowNative: 0,
    TransferID: '',
    Cleared: 1,
    ...row,
    ID,
  });
  return ID;
}

const run = (payload: Record<string, unknown>) =>
  runtimeMocks.executeMutation({ op: 'transactions.duplicate', payload });

describe('transactions.duplicate', () => {
  beforeEach(() => {
    ledger.rows.clear();
    ledger.splits.clear();
    ledger.next = 1;
    useUndoStore.getState().clear();
    transactionMocks.addTransaction.mockReset().mockImplementation((...p: unknown[]) => {
      const explicitId = p[14] as number | undefined;
      const ID = explicitId ?? ledger.next++;
      ledger.rows.set(ID, {
        ID,
        InflowNative: p[0],
        OutflowNative: p[1],
        AccountID: p[2],
        CategoryID: p[3],
        BudgetID: p[4],
        Date: p[5],
        Memo: p[6],
        TransferID: p[7],
        Payee: p[8],
        LabelID: p[9],
        Cleared: p[13] ? 1 : 0,
      });
      return Promise.resolve(ID);
    });
    transactionMocks.deleteTransaction.mockReset().mockImplementation((id: number) => {
      const row = ledger.rows.get(id);
      if (!row) throw new Error('missing');
      for (const other of [...ledger.rows.values()]) {
        if (row.TransferID && other.TransferID === row.TransferID) ledger.rows.delete(other.ID);
      }
      ledger.rows.delete(id);
    });
    transactionMocks.getTransactionByID.mockReset().mockImplementation((id: number) => {
      const row = ledger.rows.get(id);
      if (!row) throw new Error(`Transaction ${id} not found`);
      return row;
    });
    transactionMocks.getTransactionsByTransferID
      .mockReset()
      .mockImplementation((transferId: string) =>
        [...ledger.rows.values()].filter((row) => row.TransferID === transferId)
      );
    splitMocks.getSplits
      .mockReset()
      .mockImplementation((id: number) => ledger.splits.get(id) ?? []);
    splitMocks.upsertSplits.mockReset().mockImplementation((id: number, lines: []) => {
      ledger.splits.set(id, lines);
    });

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

  it('copies a transaction as a new uncleared row', async () => {
    const id = seed({
      AccountID: 2,
      CategoryID: 3,
      Memo: 'Coffee',
      Payee: 'Cafe',
      OutflowNative: 4500,
      LabelID: 7,
    });
    const result = await run({ ids: [id], transferIds: {} });

    expect(result).toMatchObject({ result: { created: [2] } });
    expect(ledger.rows.get(2)).toMatchObject({
      AccountID: 2,
      CategoryID: 3,
      Memo: 'Coffee',
      Payee: 'Cafe',
      OutflowNative: 4500,
      LabelID: 7,
      Date: '2026-10-01',
      Cleared: 0,
    });
  });

  it('copies both legs of a transfer once, under the new transfer ID', async () => {
    const out = seed({ AccountID: 2, OutflowNative: 1000, TransferID: 'old' });
    const into = seed({ AccountID: 3, InflowNative: 1000, TransferID: 'old' });
    await run({ ids: [out, into], transferIds: { old: 'new' } });

    const copies = [...ledger.rows.values()].filter((row) => row.TransferID === 'new');
    expect(copies.map((row) => row.AccountID)).toEqual([2, 3]);
  });

  it('copies split lines without their pair IDs', async () => {
    const id = seed({ AccountID: 2, OutflowNative: 3000 });
    ledger.splits.set(id, [
      {
        ID: 50,
        CategoryID: 4,
        Memo: 'a',
        InflowConverted: 0,
        OutflowConverted: 1000,
        PairID: null,
        OrderIndex: 0,
      },
      {
        ID: 51,
        TransferAccountID: 3,
        Memo: 'b',
        InflowConverted: 0,
        OutflowConverted: 2000,
        PairID: 'p1',
        OrderIndex: 1,
      },
    ]);
    await run({ ids: [id], transferIds: {} });

    expect(ledger.splits.get(2)).toEqual([
      expect.objectContaining({ CategoryID: 4, Memo: 'a', OutflowConverted: 1000, PairID: null }),
      expect.objectContaining({
        TransferAccountID: 3,
        Memo: 'b',
        OutflowConverted: 2000,
        PairID: null,
      }),
    ]);
    expect(ledger.splits.get(2)?.[0]).not.toHaveProperty('ID');
  });

  it('undo removes the copies and redo brings them back under the same IDs', async () => {
    const id = seed({ AccountID: 2, OutflowNative: 4500 });
    const transfer = seed({ AccountID: 2, OutflowNative: 1000, TransferID: 't' });
    seed({ AccountID: 3, InflowNative: 1000, TransferID: 't' });
    await run({ ids: [id, transfer], transferIds: { t: 't2' } });
    expect([...ledger.rows.keys()]).toEqual([1, 2, 3, 4, 5, 6]);

    const store = useUndoStore.getState();
    await store.undo();
    expect([...ledger.rows.keys()]).toEqual([1, 2, 3]);
    await store.redo();
    expect([...ledger.rows.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
