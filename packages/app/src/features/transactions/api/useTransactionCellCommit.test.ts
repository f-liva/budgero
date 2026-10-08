import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTransactionCellCommit } from './useTransactionCellCommit';

vi.mock('@entities/transaction/api/useTransactions', () => ({
  useUpdateTransactionColumn: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

describe('useTransactionCellCommit', () => {
  it.each([
    ['budget', 'OutflowConverted', { OutflowConverted: 0, InflowConverted: 20000 }],
    ['budget', 'InflowConverted', { InflowConverted: 0, OutflowConverted: 20000 }],
    ['account', 'OutflowConverted', { OutflowNative: 0, InflowNative: 20000 }],
    ['account', 'InflowConverted', { InflowNative: 0, OutflowNative: 20000 }],
  ] as const)('shows a negative %s %s entry as the opposite flow', (display, column, patch) => {
    const { result } = renderHook(() => useTransactionCellCommit());
    expect(
      result.current.mutate(1, column, -20000, {
        accountId: 1,
        transactionCurrencyDisplay: display,
      })
    ).toEqual(patch);
  });
});
