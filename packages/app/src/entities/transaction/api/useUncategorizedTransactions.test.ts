import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUncategorizedTransactions } from './useUncategorizedTransactions';

const accounts = [
  { ID: 1, Name: 'Checking', OnBudget: 1 },
  { ID: 2, Name: 'Savings', OnBudget: 1 },
  { ID: 3, Name: 'Brokerage', OnBudget: 0 },
];

const transactions = [
  { ID: 10, AccountId: 1, CategoryID: 0, Category: null, TransferID: '' },
  { ID: 11, AccountId: 1, CategoryID: 5, Category: 'Food', TransferID: '' },
  { ID: 12, AccountId: 3, CategoryID: 0, Category: null, TransferID: '' },
  // On-budget ↔ on-budget transfer: category is system-managed.
  { ID: 13, AccountId: 1, CategoryID: 0, Category: null, TransferID: 'a' },
  { ID: 14, AccountId: 2, CategoryID: 0, Category: null, TransferID: 'a' },
  // Transfer to an off-budget account: the on-budget leg still needs a category.
  { ID: 15, AccountId: 2, CategoryID: 0, Category: null, TransferID: 'b' },
  { ID: 16, AccountId: 3, CategoryID: 0, Category: null, TransferID: 'b' },
];

vi.mock('@entities/transaction/api/useTransactions', () => ({
  useAllTransactions: () => ({ data: transactions, isLoading: false }),
}));
vi.mock('@entities/account/api/useAccounts', () => ({
  useAccounts: () => ({ data: accounts, isLoading: false }),
}));

describe('useUncategorizedTransactions', () => {
  it('ignores off-budget accounts and on-budget transfers', () => {
    const { result } = renderHook(() => useUncategorizedTransactions(1));
    expect(result.current.data.total).toBe(2);
    expect(result.current.data.byAccount).toEqual({
      1: { accountName: 'Checking', count: 1 },
      2: { accountName: 'Savings', count: 1 },
    });
  });
});
