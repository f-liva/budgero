import { Trans, useLingui } from '@lingui/react/macro';
import { BankConnectionPanel, ConnectBankCard, useBankConnections } from '@features/bank-sync';
import { SettingsPageHeader } from '@pages/settings/SettingsPageHeader';
import { useUiStore } from '@shared/store/useUiStore';
import { Badge } from '@shared/ui/badge';
import { InlineLoadingRow } from '@shared/ui/InlineLoadingRow';

export default function BankSyncPage() {
  const { t } = useLingui();
  const budgetId = useUiStore((state) => state.selectedBudget?.ID);
  const { data: connections = [], isLoading } = useBankConnections(budgetId);

  return (
    <div className="container max-w-3xl mx-auto p-4 sm:p-6 pb-20 sm:pb-6 space-y-4">
      <SettingsPageHeader
        title={t`Bank sync`}
        description={t`Import transactions from your banks through SimpleFIN Bridge (US and Canada) or Enable Banking (Europe).`}
      >
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <Trans>Beta</Trans>
        </Badge>
      </SettingsPageHeader>
      {!budgetId || isLoading ? (
        <InlineLoadingRow />
      ) : (
        <>
          {connections.map((connection) => (
            <BankConnectionPanel key={connection.Provider} connection={connection} />
          ))}
          <ConnectBankCard
            budgetId={budgetId}
            connected={connections.map((connection) => connection.Provider)}
          />
        </>
      )}
    </div>
  );
}
