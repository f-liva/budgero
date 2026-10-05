import type { Metadata } from 'next';
import Image from 'next/image';
import { permanentRedirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { pricing } from '@/lib/pricing';

const canonical = 'https://budgero.app/actual-budget-alternative';
const title = 'An Actual Budget alternative for multi-currency budgeting | Budgero';
const description =
  'Keep envelope budgeting with Budgero: multiple currencies in one budget, encrypted sync, and Cloud or self-hosting. Compare the trade-offs with Actual Budget.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical, type: 'website', locale: 'en_US' },
  twitter: { title, description, card: 'summary_large_image' },
};

const comparison = [
  {
    feature: 'Budgeting method',
    actual: 'Envelope budgeting with money you already have.',
    budgero: 'Zero-based envelope budgeting with money you already have.',
  },
  {
    feature: 'Multiple currencies in one budget',
    actual:
      'No native currency conversion; the documentation describes an experimental workaround.',
    budgero: 'Accounts retain their currencies; categories and reports use your budget currency.',
  },
  {
    feature: 'Encrypted budget sync',
    actual: 'End-to-end encryption is available when you enable it.',
    budgero: 'End-to-end encryption is built into workspace sync.',
  },
  {
    feature: 'Bank connections',
    actual: 'Optional integrations through supported providers, with a server and provider setup.',
    budgero:
      'Optional bank sync (beta) through your own SimpleFIN (US & Canada) or Enable Banking (Europe) account; Budgero never sees your bank data. Manual entry and statement imports also work.',
  },
  {
    feature: 'Hosting',
    actual: 'Local desktop use, your own server, or third-party hosting such as PikaPods.',
    budgero: `Free self-hosted software or Budgero Cloud (${pricing.monthly}/month or ${pricing.yearly}/year). Hosting costs still apply when self-hosting.`,
  },
];

export default async function ActualBudgetAlternativePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // This is an original English page. Do not serve it under untranslated locale URLs.
  if (locale !== 'en') permanentRedirect('/actual-budget-alternative');
  setRequestLocale('en');

  return (
    <main className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/20 pb-14 pt-28 sm:pb-20 sm:pt-36">
        <div className="container mx-auto max-w-6xl px-4">
          <p className="text-sm font-medium text-muted-foreground">Actual Budget alternative</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Keep envelope budgeting. Bring your currencies together.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Budgero is an Actual Budget alternative for households with accounts in different
            currencies, or people who want a managed Cloud service with encrypted budget sync. You
            can also self-host it. Bank sync is optional (beta): bring your own SimpleFIN or Enable
            Banking connection, and Budgero's servers never see your bank data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="https://my.budgero.app/auth?mode=signup">
                Try Budgero for 35 days <ArrowRight className="ml-2 size-4" aria-hidden />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/self-hostable">Explore free self-hosting</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Cloud trial: no credit card required.
          </p>
          <figure className="mt-12">
            <Image
              src="/screenshots/en/budget-desktop.png"
              alt="Budgero envelope budget with assigned amounts, spending, available balances, and a category detail panel"
              width={2880}
              height={1920}
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="h-auto w-full rounded-xl border border-border shadow-sm"
              priority
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              A real Budgero budget using sample data. Both apps let you give available money a job.
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="container mx-auto max-w-4xl space-y-14 px-4 py-14 sm:py-20">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Written by Budgero, the maker of one of the products compared. Based on the official
          documentation linked below, checked <time dateTime="2026-09-16">September 16, 2026</time>.
          We have not tested every hosting setup or bank provider.
        </p>

        <section className="space-y-5" aria-labelledby="compare">
          <h2 id="compare" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Actual Budget and Budgero: the practical differences
          </h2>
          <p className="text-sm text-muted-foreground sm:hidden">
            Swipe the table to compare both apps.
          </p>
          <div
            className="overflow-x-auto rounded-lg border border-border"
            role="region"
            aria-label="Actual Budget and Budgero comparison"
            tabIndex={0}
          >
            <table className="w-full min-w-[620px] text-left text-sm leading-relaxed">
              <caption className="sr-only">Actual Budget and Budgero feature comparison</caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="p-4">
                    Your priority
                  </th>
                  <th scope="col" className="p-4">
                    Actual Budget
                  </th>
                  <th scope="col" className="p-4">
                    Budgero
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-t border-border align-top">
                    <th scope="row" className="p-4 font-medium">
                      {row.feature}
                    </th>
                    <td className="p-4 text-muted-foreground">{row.actual}</td>
                    <td className="p-4 text-muted-foreground">{row.budgero}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Actual’s bank-sync credentials are outside its encrypted budget-sync layer. Provider
            availability, fees, and setup vary. See its{' '}
            <a
              className="underline underline-offset-4"
              href="https://actualbudget.org/docs/advanced/bank-sync/"
            >
              bank integration documentation
            </a>{' '}
            before choosing an app around a particular bank.
          </p>
        </section>

        <section className="space-y-4 leading-relaxed" aria-labelledby="currencies">
          <h2 id="currencies" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            When a different currency is more than a display setting
          </h2>
          <p>
            Suppose your rent comes from a euro account and you also keep money in pounds. Adding
            the two balances as plain numbers would give a misleading total. Budgero keeps each
            account in its original currency and converts amounts into the budget currency for
            planning and reporting. You can override a rate when it differs from your statement.
          </p>
          <p>
            Actual’s documentation says native multi-currency support is not available and describes
            a rule-template workaround. If that already meets your needs, a switch may add more work
            than value. If managing conversions has become a regular chore, try{' '}
            <Link href="/docs/multi-currency" className="underline underline-offset-4">
              Budgero’s multi-currency workflow
            </Link>{' '}
            with a small sample first.
          </p>
        </section>

        <section className="space-y-4 leading-relaxed" aria-labelledby="stay">
          <h2 id="stay" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            When staying with Actual Budget makes sense
          </h2>
          <p>
            Actual is free, open-source budgeting software. It has desktop options, self-hosting,
            optional bank integrations, and third-party hosting. You do not have to maintain a
            Docker server yourself to use it. If your budget works well today and a supported bank
            connection saves you time, those are good reasons to keep it.
          </p>
          <p>
            If you want a different hosted service with bank import, YNAB is another option to
            compare. Its direct import supports selected banks, so check your own bank first. Our{' '}
            <Link href="/best-ynab-alternatives" className="underline underline-offset-4">
              budgeting app comparison
            </Link>{' '}
            covers more choices; the{' '}
            <Link href="/blog/actual-budget-vs-budgero" className="underline underline-offset-4">
              detailed Actual Budget vs Budgero article
            </Link>{' '}
            looks further at these two apps.
          </p>
        </section>

        <section className="space-y-4 leading-relaxed" aria-labelledby="switch">
          <h2 id="switch" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Try a switch without moving your whole history
          </h2>
          <ol className="list-decimal space-y-3 pl-6">
            <li>Keep an export of your Actual budget before starting.</li>
            <li>Create a small Budgero budget and choose each account’s currency.</li>
            <li>
              Either start from current balances, or test a limited transaction CSV export through{' '}
              <Link href="/docs/csv-import" className="underline underline-offset-4">
                the import preview
              </Link>
              . For a fresh start, use the current statement balance. For historical imports, use
              the balance immediately before the imported period so you do not count those
              transactions twice.
            </li>
            <li>Check dates, transfers, split transactions, currencies, and final balances.</li>
            <li>Set up your category assignments and goals, then try your normal weekly review.</li>
          </ol>
          <p>
            If you used Actual’s currency-conversion rules, check whether exported amounts are
            already converted. Before importing into a foreign-currency account, make sure the
            amounts are in that account’s original currency. Starting from current statement
            balances avoids having to reconstruct those historical amounts.
          </p>
          <p>
            Budgero does not offer a one-click Actual budget-file migration. A transaction import
            does not recreate Actual’s category funding history, rules, or all its settings. Keep
            your original budget until you are satisfied with the new one.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-8" aria-labelledby="sources">
          <h2 id="sources" className="text-xl font-semibold">
            Sources and further reading
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              <a className="underline" href="https://actualbudget.org/docs/install/">
                Actual: local, self-hosted, and hosted installation options
              </a>
            </li>
            <li>
              <a
                className="underline"
                href="https://actualbudget.org/docs/budgeting/multi-currency/"
              >
                Actual: current multi-currency limitations
              </a>
            </li>
            <li>
              <a className="underline" href="https://actualbudget.org/docs/getting-started/sync/">
                Actual: sync and optional end-to-end encryption
              </a>
            </li>
            <li>
              <a className="underline" href="https://actualbudget.org/docs/advanced/bank-sync/">
                Actual: bank connections and encryption scope
              </a>
            </li>
            <li>
              <a className="underline" href="https://actualbudget.org/docs/tour/accounts/">
                Actual: account exports
              </a>
            </li>
            <li>
              <a className="underline" href="https://www.ynab.com/pricing">
                YNAB: subscription and bank-import availability
              </a>
            </li>
            <li>
              <Link className="underline" href="/docs/security">
                Budgero: security model
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
