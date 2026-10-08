import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUndoSpec } from '@shared/mutations/op-code-registry';

const splitMocks = vi.hoisted(() => ({ getSplits: vi.fn() }));
const transactionMocks = vi.hoisted(() => ({ getTransactionsByTransferID: vi.fn() }));
const importMocks = vi.hoisted(() => ({ identities: vi.fn(() => []) }));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({
      splits: splitMocks,
      transactions: transactionMocks,
      importHistory: { duplicates: importMocks },
    }),
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

async function undoFor(op: string, args: Record<string, unknown>) {
  const spec = getUndoSpec(op)!;
  return spec.build(args, undefined, await spec.capture?.(args));
}

describe('split and transfer undo', () => {
  beforeEach(() => {
    splitMocks.getSplits.mockReset();
    transactionMocks.getTransactionsByTransferID.mockReset();
  });

  it('puts the previous split lines back', async () => {
    const lines = [
      { CategoryID: 1, OutflowConverted: 300 },
      { CategoryID: 2, OutflowConverted: 700 },
    ];
    splitMocks.getSplits.mockReturnValue(lines);
    for (const op of ['transactions.upsertSplits', 'transactions.clearSplits']) {
      expect(await undoFor(op, { transactionId: 5 })).toEqual([
        { op: 'transactions.upsertSplits', args: { transactionId: 5, splits: lines } },
      ]);
    }
  });

  it('clears splits that did not exist before', async () => {
    splitMocks.getSplits.mockReturnValue([]);
    expect(await undoFor('transactions.upsertSplits', { transactionId: 5 })).toEqual([
      { op: 'transactions.clearSplits', args: { transactionId: 5 } },
    ]);
  });

  it('restores both legs of a deleted transfer', async () => {
    transactionMocks.getTransactionsByTransferID.mockReturnValue([
      { ID: 1, AccountID: 1, Date: '2026-10-01', OutflowConverted: 500, TransferID: 'tr-1' },
      { ID: 2, AccountID: 2, Date: '2026-10-01', InflowConverted: 500, TransferID: 'tr-1' },
    ]);
    const undo = await undoFor('transactions.deleteTransfer', { transferId: 'tr-1' });
    expect(undo.map((call) => [call.op, call.args.accountId, call.args.transferId])).toEqual([
      ['transactions.add', 1, 'tr-1'],
      ['transactions.add', 2, 'tr-1'],
    ]);
  });
});
