import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { completeBankAuthorization, invalidateAfterBankSync } from '@features/bank-sync';
import { getErrorMessage } from '@shared/lib/errors';
import { useRuntime } from '@shared/runtime/runtime-provider';
import { Button } from '@shared/ui/button';
import { InlineLoadingRow } from '@shared/ui/InlineLoadingRow';

/** Where the bank sends the user back after granting access through Enable Banking. */
export default function BankSyncCallbackPage() {
  const { t } = useLingui();
  const runtime = useRuntime();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    void (async () => {
      try {
        // A fresh device may not have the budget (and its key) yet.
        await runtime.waitForInitialSync({ timeoutMs: 20_000 });
        const { session } = await completeBankAuthorization(runtime, params);
        invalidateAfterBankSync(queryClient);
        toast.success(t`${session.aspsp.name} connected`, {
          description: session.accounts.length
            ? t`Link its accounts to start importing.`
            : t`The bank returned no accounts. Link them to your app in the Enable Banking control panel, then reconnect.`,
        });
        void navigate('/settings/bank-sync', { replace: true });
      } catch (err) {
        setError(getErrorMessage(err, t`Couldn't finish connecting the bank`));
      }
    })();
  }, [runtime, navigate, queryClient, t]);

  return (
    <div className="container max-w-xl mx-auto p-6 space-y-4">
      {error ? (
        <>
          <p className="text-sm text-destructive whitespace-pre-line">{error}</p>
          <Button
            variant="outline"
            onClick={() => void navigate('/settings/bank-sync', { replace: true })}
          >
            <Trans>Back to bank sync</Trans>
          </Button>
        </>
      ) : (
        <InlineLoadingRow label={t`Finishing bank connection…`} />
      )}
    </div>
  );
}
