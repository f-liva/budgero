import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { parseEnableBankingConfig, type BankConnection } from '@budgero/core/browser';
import { useAccounts } from '@entities/account/api/useAccounts';
import { getErrorMessage } from '@shared/lib/errors';
import { cn } from '@shared/lib/utils';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog';
import { InlineLoadingRow } from '@shared/ui/InlineLoadingRow';
import {
  useBankLinks,
  useBankReviews,
  useDisconnectBank,
  useRemoteBankAccounts,
  useRunBankSync,
  useUnlinkBankAccount,
} from '../api/useBankSync';
import { formatBankAmount, formatSyncedAgo } from '../lib/format';
import { providerName, type RemoteBankAccount } from '../lib/provider';
import { describeAccessUrl } from '../lib/simplefin-client';
import { BankReviewDialog } from './BankReviewDialog';
import { EnableBankingBanksCard } from './EnableBankingBanksCard';
import { LinkAccountDialog } from './LinkAccountDialog';

const ONE_CENT_MILLI = 10;

export function BankConnectionPanel({ connection }: { connection: BankConnection }) {
  const { t } = useLingui();
  const budgetId = connection.BudgetID;
  const { data: allLinks = [] } = useBankLinks(budgetId);
  const { data: allReviews = [] } = useBankReviews(budgetId);
  const { data: accounts = [] } = useAccounts(budgetId);
  const remote = useRemoteBankAccounts(connection);
  const isEnableBanking = connection.Provider === 'enablebanking';
  const ebConfig = parseEnableBankingConfig(connection);
  const provider = providerName(connection);
  const connectedTo = isEnableBanking
    ? [ebConfig?.appName || 'Enable Banking', ebConfig?.environment === 'SANDBOX' ? 'sandbox' : '']
        .filter(Boolean)
        .join(' · ')
    : describeAccessUrl(connection.AccessURL);
  const sync = useRunBankSync();
  const disconnect = useDisconnectBank();
  const unlink = useUnlinkBankAccount();
  const [linking, setLinking] = useState<RemoteBankAccount | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.ID, a])), [accounts]);
  // Each provider gets its own panel; an account can still only be linked once overall.
  const links = useMemo(
    () => allLinks.filter((l) => l.Provider === connection.Provider),
    [allLinks, connection.Provider]
  );
  const reviews = useMemo(() => {
    const ids = new Set(links.map((l) => l.AccountID));
    return allReviews.filter((r) => ids.has(r.AccountID));
  }, [allReviews, links]);
  const linksByRemote = useMemo(() => new Map(links.map((l) => [l.ExternalAccountID, l])), [links]);
  const linkedAccountIds = useMemo(() => new Set(allLinks.map((l) => l.AccountID)), [allLinks]);
  const remoteAccounts = remote.data?.accounts ?? [];
  const syncedAgo = formatSyncedAgo(connection.LastSyncAt);

  const onSync = () =>
    sync.mutate(
      { budgetId, providers: [connection.Provider] },
      {
        onSuccess: (result) => {
          if (result.errors.length) toast.warning(result.errors.join('\n'));
          else toast.success(t`Bank sync finished`);
          if (result.reviews) setReviewOpen(true);
        },
        onError: (error) => toast.error(getErrorMessage(error, t`Bank sync failed`)),
      }
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="text-sm">
            <div className="font-medium">{provider}</div>
            <div className="text-xs text-muted-foreground">
              <Trans>Connected to {connectedTo}</Trans>
            </div>
            <div className="text-xs text-muted-foreground">
              {syncedAgo ? (
                <Trans>Last synced {syncedAgo}. Syncs automatically when you open Budgero.</Trans>
              ) : (
                <Trans>Not synced yet.</Trans>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              disabled={sync.isPending || !links.length}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', sync.isPending && 'animate-spin')} />
              <Trans>Sync now</Trans>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(true)}>
              <Unplug className="h-3.5 w-3.5 mr-1.5" />
              <Trans>Disconnect</Trans>
            </Button>
          </div>
        </CardContent>
      </Card>

      {connection.LastError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line text-xs">
            {connection.LastError}
          </AlertDescription>
        </Alert>
      )}

      {reviews.length > 0 && (
        <Alert className="border-amber-500/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between gap-2 text-sm">
            <span>
              <Trans>{reviews.length} bank transactions may match entries you already have.</Trans>
            </span>
            <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
              <Trans>Review</Trans>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isEnableBanking && <EnableBankingBanksCard connection={connection} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <Trans>Bank accounts</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {remote.isLoading ? (
            <InlineLoadingRow label={t`Loading accounts from ${provider}…`} />
          ) : remote.error ? (
            <p className="px-4 pb-4 text-sm text-destructive">
              {getErrorMessage(remote.error, t`Couldn't load accounts from ${provider}`)}
            </p>
          ) : remoteAccounts.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              {isEnableBanking ? (
                <Trans>No accounts yet. Connect a bank above.</Trans>
              ) : (
                <Trans>No accounts yet. Connect a bank in SimpleFIN Bridge, then come back.</Trans>
              )}
            </p>
          ) : (
            <ul className="divide-y">
              {remoteAccounts.map((account) => {
                const link = linksByRemote.get(account.id);
                const local = link ? accountsById.get(link.AccountID) : undefined;
                const bankBalance = account.balance ?? link?.LastBalance ?? null;
                const cleared = local ? local.BalanceNative - (local.UnclearedNative ?? 0) : null;
                const drift =
                  cleared === null || bankBalance === null ? 0 : Math.abs(bankBalance - cleared);
                return (
                  <li key={account.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{account.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[
                          account.orgName,
                          bankBalance === null
                            ? account.currency
                            : formatBankAmount(bankBalance, account.currency),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    {local ? (
                      <div className="text-right text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <Link2 className="h-3 w-3" />
                          {local.Name}
                        </div>
                        {drift >= ONE_CENT_MILLI && cleared !== null && (
                          <div className="text-amber-600">
                            <Trans>Cleared {formatBankAmount(cleared, local.Currency)}</Trans>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {link ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={unlink.isPending}
                        onClick={() => unlink.mutate({ budgetId, accountId: link.AccountID })}
                      >
                        <Trans>Unlink</Trans>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setLinking(account)}
                      >
                        <Trans>Link</Trans>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {remote.isFetching && !remote.isLoading && (
            <div className="flex justify-center pb-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {remote.data?.errors?.length ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs whitespace-pre-line">
            {remote.data.errors.join('\n')}
          </AlertDescription>
        </Alert>
      ) : null}

      {linking && (
        <LinkAccountDialog
          budgetId={budgetId}
          connection={connection}
          remote={linking}
          linkedAccountIds={linkedAccountIds}
          onOpenChange={(open) => !open && setLinking(null)}
        />
      )}
      <BankReviewDialog budgetId={budgetId} open={reviewOpen} onOpenChange={setReviewOpen} />
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t`Disconnect bank sync?`}
        description={
          isEnableBanking
            ? t`Links, pending reviews and the stored Enable Banking key are removed. Imported transactions stay. To fully revoke access, also delete the application in the Enable Banking control panel.`
            : t`Links and pending reviews are removed. Imported transactions stay. To fully revoke access, also delete the app connection in SimpleFIN Bridge.`
        }
        confirmText={t`Disconnect`}
        variant="destructive"
        isLoading={disconnect.isPending}
        onConfirm={async () => {
          await disconnect.mutateAsync({ budgetId, provider: connection.Provider });
          setConfirmDisconnect(false);
        }}
      />
    </div>
  );
}
