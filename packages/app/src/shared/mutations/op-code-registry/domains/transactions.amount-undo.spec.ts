import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MutationExecutor, type UndoEntry } from '@budgero/runtime';
import {
  executeMutationOp,
  getInvalidatesForOp,
  getUndoSpec,
} from '@shared/mutations/op-code-registry';
import { useUndoStore } from '@shared/mutations/UndoStore';

const transactionState = vi.hoisted(() => ({
  ID: 42,
  InflowConverted: 0,
  OutflowConverted: 5000,
}));
const transactionMocks = vi.hoisted(() => ({
  getTransactionByID: vi.fn(),
  updateTransactionColumn: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({ executeMutation: vi.fn() }));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({ transactions: transactionMocks }),
    mutationsRouter: () => ({ execute: runtimeMocks.executeMutation }),
  }),
}));

type AmountColumn = 'InflowConverted' | 'OutflowConverted';
const PARTNER: Record<AmountColumn, AmountColumn> = {
  InflowConverted: 'OutflowConverted',
  OutflowConverted: 'InflowConverted',
};

describe('transactions.updateColumn amount undo', () => {
  beforeEach(() => {
    transactionState.InflowConverted = 0;
    transactionState.OutflowConverted = 5000;
    transactionMocks.getTransactionByID.mockReset();
    transactionMocks.updateTransactionColumn.mockReset();
    runtimeMocks.executeMutation.mockReset();
    useUndoStore.getState().clear();

    transactionMocks.getTransactionByID.mockImplementation(() => ({ ...transactionState }));
    // Mirrors core: a negative entry moves to the opposite side.
    transactionMocks.updateTransactionColumn.mockImplementation(
      (_id: number, column: AmountColumn, value: number) => {
        if (value < 0) {
          transactionState[column] = 0;
          transactionState[PARTNER[column]] = -value;
        } else {
          transactionState[column] = value;
        }
      }
    );
  });

  it('restores both sides after a negative entry flipped the transaction', async () => {
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
    runtimeMocks.executeMutation.mockImplementation((spec) => executor.execute(spec));

    await executor.execute({
      op: 'transactions.updateColumn',
      payload: { id: 42, columnName: 'OutflowConverted', newValue: -20000 },
    });
    expect(transactionState).toMatchObject({ InflowConverted: 20000, OutflowConverted: 0 });

    await useUndoStore.getState().undo();
    expect(transactionState).toMatchObject({ InflowConverted: 0, OutflowConverted: 5000 });

    await useUndoStore.getState().redo();
    expect(transactionState).toMatchObject({ InflowConverted: 20000, OutflowConverted: 0 });
  });
});
