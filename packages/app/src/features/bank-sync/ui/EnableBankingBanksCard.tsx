import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { AlertTriangle, Landmark, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  parseEnableBankingConfig,
  type BankConnection,
  type EnableBankingSession,
} from '@budgero/core/browser';
import { getLocaleTag } from '@shared/i18n';
import { formatRelativeToNow } from '@shared/lib/date-format';
import { getErrorMessage } from '@shared/lib/errors';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog';
import { Label } from '@shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { useAspsps, useRemoveBankSession, useStartBankAuthorization } from '../api/useBankSync';
import type { Aspsp } from '../lib/enable-banking/client';
import { isSessionExpired, sessionExpiresSoon } from '../lib/provider';
import { ENABLE_BANKING_CONTROL_PANEL_URL } from '../lib/enable-banking/client';

/** Countries Enable Banking covers (EEA and the UK). */
const COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
];

function guessCountry(): string {
  const region = getLocaleTag().split('-')[1]?.toUpperCase();
  return region && COUNTRIES.includes(region) ? region : 'FI';
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([getLocaleTag()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function AddBankForm({ connection }: { connection: BankConnection }) {
  const { t } = useLingui();
  const [country, setCountry] = useState(guessCountry);
  const [bankName, setBankName] = useState('');
  const aspsps = useAspsps(connection, country);
  const start = useStartBankAuthorization();
  const countries = useMemo(
    () =>
      COUNTRIES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    []
  );
  const bank = aspsps.data?.find((aspsp) => aspsp.name === bankName);

  const submit = (aspsp: Aspsp) =>
    start.mutate(
      { connection, aspsp },
      { onError: (error) => toast.error(getErrorMessage(error, t`Couldn't start the bank login`)) }
    );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label>
            <Trans>Country</Trans>
          </Label>
          <Select
            value={country}
            onValueChange={(value) => {
              setCountry(value);
              setBankName('');
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map(({ code, name }) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>
            <Trans>Bank</Trans>
          </Label>
          <Select value={bankName} onValueChange={setBankName} disabled={!aspsps.data?.length}>
            <SelectTrigger>
              <SelectValue
                placeholder={aspsps.isLoading ? t`Loading banks…` : t`Choose your bank`}
              />
            </SelectTrigger>
            <SelectContent>
              {aspsps.data?.map((aspsp) => (
                <SelectItem key={aspsp.name} value={aspsp.name}>
                  {aspsp.name}
                  {aspsp.beta ? ' (beta)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {aspsps.error && (
        <p className="text-xs text-destructive">
          {getErrorMessage(aspsps.error, t`Couldn't load banks from Enable Banking`)}
        </p>
      )}
      <Button size="sm" disabled={!bank || start.isPending} onClick={() => bank && submit(bank)}>
        {start.isPending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Landmark className="h-3.5 w-3.5 mr-1.5" />
        )}
        <Trans>Continue to bank login</Trans>
      </Button>
      <p className="text-[11px] text-muted-foreground">
        <Trans>
          You'll log in at your bank and come back here. Banks grant access for up to 180 days, and
          Budgero reminds you a week before that access expires.
        </Trans>
      </p>
    </div>
  );
}

export function EnableBankingBanksCard({ connection }: { connection: BankConnection }) {
  const { t } = useLingui();
  const config = parseEnableBankingConfig(connection);
  const start = useStartBankAuthorization();
  const remove = useRemoveBankSession();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<EnableBankingSession | null>(null);
  const sessions = config?.sessions ?? [];
  const showForm = adding || sessions.length === 0;

  const reconnect = (session: EnableBankingSession) =>
    start.mutate(
      { connection, aspsp: { name: session.aspsp.name, country: session.aspsp.country } },
      { onError: (error) => toast.error(getErrorMessage(error, t`Couldn't start the bank login`)) }
    );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          <Trans>Banks</Trans>
        </CardTitle>
        {sessions.length > 0 && !adding && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            <Trans>Add bank</Trans>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length > 0 && (
          <ul className="divide-y rounded-md border">
            {sessions.map((session) => {
              const expired = isSessionExpired(session.validUntil);
              const soon = !expired && sessionExpiresSoon(session);
              const until = formatRelativeToNow(new Date(session.validUntil), { addSuffix: true });
              return (
                <li key={session.sessionId} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{session.aspsp.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {session.aspsp.country}
                      </span>
                      {expired && (
                        <Badge variant="destructive" className="text-[10px]">
                          <Trans>Expired</Trans>
                        </Badge>
                      )}
                    </div>
                    <div
                      className={
                        expired || soon ? 'text-xs text-amber-600' : 'text-xs text-muted-foreground'
                      }
                    >
                      {expired ? (
                        <Trans>Access ended {until}. Reconnect to keep syncing.</Trans>
                      ) : (
                        <Trans>Access expires {until}</Trans>
                      )}
                      {' · '}
                      <Trans>{session.accounts.length} accounts</Trans>
                    </div>
                  </div>
                  {(expired || soon) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={start.isPending}
                      onClick={() => reconnect(session)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      <Trans>Reconnect</Trans>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={t`Remove ${session.aspsp.name}`}
                    onClick={() => setRemoving(session)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {sessions.some((s) => s.accounts.length === 0) && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              <Trans>
                A bank returned no accounts. In the{' '}
                <a
                  href={ENABLE_BANKING_CONTROL_PANEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  control panel
                </a>
                , link those accounts to your app, then reconnect the bank.
              </Trans>
            </span>
          </p>
        )}

        {showForm && <AddBankForm connection={connection} />}
        {adding && sessions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
            <Trans>Cancel</Trans>
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t`Remove ${removing?.aspsp.name ?? ''}?`}
        description={t`Budgero stops syncing this bank and revokes its access at Enable Banking. Links stay, so reconnecting the bank later picks up where it left off. Imported transactions stay.`}
        confirmText={t`Remove`}
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync({ connection, sessionId: removing.sessionId });
          setRemoving(null);
        }}
      />
    </Card>
  );
}
