import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { BankProvider } from '@budgero/core/browser';
import { Button } from '@shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { ConnectSimpleFINCard } from './ConnectSimpleFINCard';
import { EnableBankingSetupCard } from './EnableBankingSetupCard';

function defaultRegion(): 'eu' | 'us' {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    return zone.startsWith('Europe/') || zone.startsWith('Atlantic/') ? 'eu' : 'us';
  } catch {
    return 'us';
  }
}

/** Offers whichever providers aren't connected yet; both can run side by side. */
export function ConnectBankCard({
  budgetId,
  connected = [],
}: {
  budgetId: number;
  connected?: BankProvider[];
}) {
  const [open, setOpen] = useState(false);
  const hasSimpleFIN = connected.includes('simplefin');
  const hasEnableBanking = connected.includes('enablebanking');

  if (hasSimpleFIN && hasEnableBanking) return null;

  if (hasSimpleFIN || hasEnableBanking) {
    if (!open) {
      return (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {hasSimpleFIN ? (
            <Trans>Also connect European banks (Enable Banking)</Trans>
          ) : (
            <Trans>Also connect US & Canada banks (SimpleFIN)</Trans>
          )}
        </Button>
      );
    }
    return hasSimpleFIN ? (
      <EnableBankingSetupCard budgetId={budgetId} />
    ) : (
      <ConnectSimpleFINCard budgetId={budgetId} />
    );
  }

  return (
    <Tabs defaultValue={defaultRegion()} className="space-y-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="us">
          <Trans>US & Canada</Trans>
        </TabsTrigger>
        <TabsTrigger value="eu">
          <Trans>Europe</Trans>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="us">
        <ConnectSimpleFINCard budgetId={budgetId} />
      </TabsContent>
      <TabsContent value="eu">
        <EnableBankingSetupCard budgetId={budgetId} />
      </TabsContent>
    </Tabs>
  );
}
