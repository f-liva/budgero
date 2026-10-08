import { useMemo } from 'react';
import { useAllTransactions } from '@entities/transaction/api/useTransactions';
import { useAccounts } from '@entities/account/api/useAccounts';

interface UncategorizedCount {
  total: number;
  byAccount: Record<number, { accountName: string; count: number }>;
}

/**
 * Hook to get count of uncategorized transactions
 * Returns total count and count per account
 *
 * Pure derivation over `useAllTransactions` + `useAccounts` — recomputes
 * whenever those caches refresh, so it needs no query key of its own.
 */
export function useUncategorizedTransactions(budgetId: number) {
  const { data: allTransactions = [], isLoading: transactionsLoading } =
    useAllTransactions(budgetId);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(budgetId);

  const data = useMemo<UncategorizedCount>(() => {
    // Off-budget accounts never use categories, and on-budget ↔ on-budget
    // transfers have a system-managed one, so neither needs categorizing.
    const onBudget = new Map(accounts.map((a) => [a.ID, Number(a.OnBudget) !== 0]));
    const transferLegs = new Map<string, { id: number; accountId: number }[]>();
    for (const transaction of allTransactions) {
      const transferId = transaction.TransferID?.trim();
      if (!transferId) continue;
      transferLegs.set(transferId, [
        ...(transferLegs.get(transferId) ?? []),
        { id: transaction.ID, accountId: transaction.AccountId },
      ]);
    }

    const uncategorized = allTransactions.filter((transaction) => {
      // Check if category is null, undefined, 0, or named "Uncategorized"
      // BUT do not count split parents; those are categorized via child lines
      const isSplitParent = transaction.Category === 'Split';
      if (isSplitParent) return false;
      if (onBudget.get(transaction.AccountId) === false) return false;
      const transferId = transaction.TransferID?.trim();
      if (transferId) {
        const otherLeg = transferLegs.get(transferId)?.find((leg) => leg.id !== transaction.ID);
        if (otherLeg && onBudget.get(otherLeg.accountId) === true) return false;
      }

      return (
        !transaction.CategoryID ||
        transaction.CategoryID === 0 ||
        transaction.Category === 'Uncategorized' ||
        transaction.Category === null ||
        transaction.Category === undefined ||
        transaction.Category === ''
      );
    });

    const byAccount: Record<number, { accountName: string; count: number }> = {};

    uncategorized.forEach((transaction) => {
      const accountId = transaction.AccountId; // Note: AccountId with lowercase 'd'
      const account = accounts.find((a) => a.ID === accountId);

      if (!byAccount[accountId]) {
        byAccount[accountId] = {
          accountName: account?.Name || `Account ${accountId}`,
          count: 0,
        };
      }
      byAccount[accountId].count++;
    });

    return {
      total: uncategorized.length,
      byAccount,
    };
  }, [allTransactions, accounts]);

  return { data, isLoading: transactionsLoading || accountsLoading };
}
