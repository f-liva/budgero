import { useLingui } from '@lingui/react/macro';
import React from 'react';
import type { DateRange } from 'react-day-picker';
import { CenteredLoader } from '@shared/ui/CenteredLoader';
import { TransactionsTable, type FilteredStats } from '@features/transactions';
import type { GetTransactionsByAccountRow, Category } from '@budgero/core/browser';
import type { MobilePageStats } from '../account-page.utils';

export interface AccountTransactionsSectionProps {
  isTransactionsLoading: boolean;
  transactionsData: GetTransactionsByAccountRow[];
  accountId: number;
  onMobilePageChange: (stats: MobilePageStats | null) => void;
  onCreateRecurringFromSelection: (transaction: GetTransactionsByAccountRow) => void;
  categories?: Category[];
  onDateRangeChange?: (range: DateRange | undefined) => void;
  onFilteredStatsChange?: (stats: FilteredStats) => void;
  onFilterModeChange?: (active: boolean) => void;
  totalTransactionCount?: number;
  uncategorizedCount?: number;
  unclearedCount?: number;
  hasMoreTransactions?: boolean;
  isLoadingMoreTransactions?: boolean;
  onLoadMoreTransactions?: () => Promise<unknown>;
  headerActions?: React.ReactNode;
}

export const AccountTransactionsSection = React.memo(function AccountTransactionsSection({
  isTransactionsLoading,
  transactionsData,
  accountId,
  onMobilePageChange,
  onCreateRecurringFromSelection,
  categories,
  onDateRangeChange,
  onFilteredStatsChange,
  onFilterModeChange,
  totalTransactionCount,
  uncategorizedCount,
  unclearedCount,
  hasMoreTransactions,
  isLoadingMoreTransactions,
  onLoadMoreTransactions,
  headerActions,
}: AccountTransactionsSectionProps) {
  const { t } = useLingui();

  // Only the first load swaps the table out. A transfer save must not unmount it,
  // since the table hosts the add dialog that Quick Add keeps open.
  if (isTransactionsLoading) {
    return <CenteredLoader className="py-12" label={t`Loading transactions...`} />;
  }

  return (
    <TransactionsTable
      initialData={transactionsData}
      hideAccountColumn
      onMobilePageChange={onMobilePageChange}
      onCreateRecurringFromSelection={onCreateRecurringFromSelection}
      preselectedAccountId={accountId}
      categories={categories}
      onDateRangeChange={onDateRangeChange}
      onFilteredStatsChange={onFilteredStatsChange}
      onFilterModeChange={onFilterModeChange}
      totalTransactionCount={totalTransactionCount}
      uncategorizedCountOverride={uncategorizedCount}
      unclearedCountOverride={unclearedCount}
      hasMoreTransactions={hasMoreTransactions}
      isLoadingMoreTransactions={isLoadingMoreTransactions}
      onLoadMoreTransactions={onLoadMoreTransactions}
      headerActions={headerActions}
    />
  );
});
