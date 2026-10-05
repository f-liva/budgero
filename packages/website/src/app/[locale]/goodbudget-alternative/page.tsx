import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ComparisonReferences } from '@/components/comparison-references';
import type { Metadata } from 'next';
import { withLocalizedUrls } from '@/lib/localized-metadata';
import { ArrowRight, Check, X, Shield, Globe, BarChart3, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TestimonialsSection } from '@/components/landing/Testimonials';
import { pricing } from '@/lib/pricing';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const copy = await getTranslations({
    locale: (await params).locale,
    namespace: 'updates',
  });
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'goodbudget_alternative' });
  return withLocalizedUrls(locale, '/goodbudget-alternative', {
    title: t('meta_title'),
    description: t('meta_description'),
    keywords: [
      copy('u_e2c1a7669931'),
      copy('u_bfcd25b3a15c'),
      copy('u_c61e47d33fc0'),
      copy('u_f67042484cce'),
      copy('u_62a6c63f0738'),
      copy('u_a8a5785f4b80'),
    ],
    alternates: { canonical: 'https://budgero.app/goodbudget-alternative' },
    openGraph: {
      title: t('meta_title'),
      description: t('meta_description'),
      url: 'https://budgero.app/goodbudget-alternative',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta_title'),
      description: t('meta_description'),
    },
  });
}

const makeComparisonData = (
  t: (key: string, values?: Record<string, string | number>) => string,
  copy: CopyTranslator
) => [
  {
    feature: t('comparisonData_annual_price'),
    budgero: copy('u_6730f1c07c70', {
      p0: pricing.yearly,
    }),
    goodbudget: copy('u_5eeced2f5e87'),
    budgeroNote: copy('u_2c803e265a8f'),
    goodbudgetNote: copy('u_d985fe70b8ea'),
  },
  {
    feature: t('comparisonData_envelope_zero_based_method'),
    budgero: true,
    goodbudget: true,
    budgeroNote: null,
    goodbudgetNote: null,
  },
  {
    feature: t('comparisonData_zero_knowledge_encryption'),
    budgero: true,
    goodbudget: false,
    budgeroNote: t('comparisonData_we_cannot_see_your_data'),
    goodbudgetNote: t('comparisonData_standard_server_side_storage'),
  },
  {
    feature: t('comparisonData_bank_sync'),
    budgero: true,
    goodbudget: true,
    budgeroNote: copy('u_6e7d19eaf95d'),
    goodbudgetNote: copy('u_0fdadc3a8cb3'),
  },
  {
    feature: t('comparisonData_multi_currency_support'),
    budgero: true,
    goodbudget: false,
    budgeroNote: t('comparisonData_168_currencies_live_fx_rates'),
    goodbudgetNote: t('comparisonData_single_currency_only'),
  },
  {
    feature: t('comparisonData_works_offline'),
    budgero: true,
    goodbudget: true,
    budgeroNote: null,
    goodbudgetNote: null,
  },
  {
    feature: t('comparisonData_shared_budgets'),
    budgero: true,
    goodbudget: true,
    budgeroNote: t('comparisonData_5_seats_included'),
    goodbudgetNote: t('comparisonData_sync_between_partners'),
  },
  {
    feature: t('comparisonData_reporting_analytics'),
    budgero: copy('u_9f088dbebd6c'),
    goodbudget: copy('u_0e35f6e9742e'),
    budgeroNote: t('comparisonData_spending_breakdowns_net_worth_trends'),
    goodbudgetNote: t('comparisonData_simple_spending_reports'),
  },
  {
    feature: t('comparisonData_mobile_app'),
    budgero: 'PWA',
    goodbudget: t('cell_native'),
    budgeroNote: t('comparisonData_works_on_any_device_via_browser'),
    goodbudgetNote: t('comparisonData_ios_and_android_apps'),
  },
  {
    feature: t('comparisonData_self_host_option'),
    budgero: true,
    goodbudget: false,
    budgeroNote: t('comparisonData_full_features_free_forever'),
    goodbudgetNote: null,
  },
  {
    feature: t('comparisonData_csv_data_import'),
    budgero: true,
    goodbudget: true,
    budgeroNote: t('comparisonData_csv_pdf_ynab_import'),
    goodbudgetNote: t('comparisonData_csv_import'),
  },
];

export default async function GoodbudgetAlternativePage({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}) {
  const copy = await getTranslations({
    locale: (await params).locale,
    namespace: 'updates',
  });
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations({
    locale: (await params).locale,
    namespace: 'goodbudget_alternative',
  });
  const comparisonData = makeComparisonData(t, copy);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    image: 'https://budgero.app/logo_512.png',
    name: copy('u_045497ff4fcf'),
    applicationCategory: 'FinanceApplication',
    operatingSystem: [
      copy('u_2975104784a4'),
      copy('u_d598026a9cbc'),
      copy('u_aed6b7aa2a05'),
      copy('u_4828e60247c1'),
    ],
    url: 'https://budgero.app/goodbudget-alternative',
    description: copy('u_628f634b630a'),
    offers: {
      '@type': 'Offer',
      price: pricing.yearly.replace(/[^0-9.]/g, ''),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: [
      copy('u_5f8922541535'),
      copy('u_699441c94b63'),
      copy('u_e2ce38399846'),
      copy('u_55c95f414fa7'),
      copy('u_8f9170fc3fb3'),
      copy('u_a87f8b3aa36a'),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-background text-foreground">
        <div className="relative mx-auto max-w-screen-2xl">
          <div className="relative z-10 px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16 py-2 sm:py-4 lg:py-6">
            {/* Hero Section */}
            <section className="pt-24 pb-16 md:pt-32 md:pb-24 text-center">
              <div className="max-w-4xl mx-auto">
                <Badge
                  variant="outline"
                  className="mb-6 px-4 py-1.5 text-sm font-medium border-green-600/30 text-green-700 bg-green-50"
                >
                  <Shield className="w-3.5 h-3.5 mr-2" /> {t('modern_envelope_budgeting')}{' '}
                </Badge>

                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                  {' '}
                  {t('goodbudget_alternative')}{' '}
                  <span className="block text-2xl md:text-3xl mt-2 text-foreground/70 font-medium">
                    {' '}
                    {t('envelope_budgeting_with_encryption_multi_currenc')}{' '}
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                  {' '}
                  {copy('u_2c2faa90ca9b')}{' '}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=goodbudget-alternative&utm_content=hero">
                      {' '}
                      {t('start_35_day_free_trial')} <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 text-lg border-border/80"
                  >
                    <Link href="/self-hostable">{copy('u_b921dabc8643')}</Link>
                  </Button>
                </div>

                <p className="mt-4 text-sm text-foreground/60">
                  {' '}
                  {copy('u_afe641225326')} <br /> {copy('u_0568bd03b8eb')}{' '}
                  <Link href="/self-hostable" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_2da350be8075')}{' '}
                  </Link>{' '}
                  {copy('u_57462bbc2467')}{' '}
                </p>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Key Differences Section */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {t('why_switch_from_goodbudget')}{' '}
                </h2>
                <p className="text-lg text-foreground/70">
                  {' '}
                  {t('goodbudget_nails_the_basics_here_s')}{' '}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#e4dff0] flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-[#564176]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {copy('u_d32e38482f73')}{' '}
                  </h3>
                  <p className="text-foreground/70"> {copy('u_6fc17e114d7e')} </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dfe4ec] flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-[#314258]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {copy('u_ba9955814769')}
                  </h3>
                  <p className="text-foreground/70"> {copy('u_fb2c633a7973')} </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dde9df] flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-[#2f6246]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {copy('u_65b4684f7273')}
                  </h3>
                  <p className="text-foreground/70"> {copy('u_1ba4e577e03c')} </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#efe4d8] flex items-center justify-center mb-4">
                    <Paintbrush className="w-6 h-6 text-[#8a5730]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {copy('u_028f1d7feecc')}
                  </h3>
                  <p className="text-foreground/70"> {copy('u_010118c631c0')} </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Comparison Table */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {copy('u_981cbd45058e')}{' '}
                </h2>
                <p className="text-lg text-foreground/70">{copy('u_ca7a476ede2f')}</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <table className="w-full">
                  <thead className="bg-muted/35">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                        {' '}
                        {t('feature')}{' '}
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                        {' '}
                        {t('budgero')}{' '}
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">
                        {' '}
                        {t('goodbudget')}{' '}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {comparisonData.map((row, index) => (
                      <tr
                        key={row.feature}
                        className={index % 2 === 0 ? 'bg-transparent' : 'bg-muted/25'}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {row.feature}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {typeof row.budgero === 'boolean' ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.budgero ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <X className="w-5 h-5 text-foreground/35" />
                              )}
                              {row.budgeroNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.budgeroNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium text-[#2f6246]">
                                {row.budgero}
                              </span>
                              {row.budgeroNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.budgeroNote}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {typeof row.goodbudget === 'boolean' ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.goodbudget ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <X className="w-5 h-5 text-foreground/35" />
                              )}
                              {row.goodbudgetNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.goodbudgetNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm text-foreground/65">{row.goodbudget}</span>
                              {row.goodbudgetNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.goodbudgetNote}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Where Goodbudget Wins */}
            <section className="py-16 max-w-3xl mx-auto">
              <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                  {' '}
                  {t('where_goodbudget_wins')}{' '}
                </h2>
                <p className="text-lg text-foreground/75 mb-6">
                  {' '}
                  {t('goodbudget_has_real_strengths_here_s')}{' '}
                </p>
                <ul className="space-y-4 text-foreground/75">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{t('simpler_learning_curve')}</strong>{' '}
                      {t('goodbudget_keeps_things_minimal_if_you')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_098fc0c40ec2')}</strong>{' '}
                      {copy('u_528bd683cbeb')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_69b9ab67c035')}</strong>{' '}
                      {copy('u_16900bbb145c')}{' '}
                      <Link href="/self-hostable" className="underline hover:text-foreground">
                        {' '}
                        {copy('u_2da350be8075')}{' '}
                      </Link>
                      ).
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">
                        {t('long_track_record_for_couples')}
                      </strong>{' '}
                      {t('goodbudget_has_been_helping_couples_budget')}{' '}
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Switch or Stick */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#e8f0e8] rounded-2xl p-8 border border-[#bfd7c2]">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Check className="w-6 h-6 text-green-600" /> {t('switch_to_budgero_if')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_want_zero_knowledge_encryption_for')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_manage_money_in_multiple_currencies')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_need_deeper_reporting_spending_breakdowns')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_want_a_modern_polished_interface')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>
                        {' '}
                        {t('you_want_to')}{' '}
                        <Link href="/self-hostable" className="underline">
                          {' '}
                          {t('self_host')}{' '}
                        </Link>{' '}
                        {t('with_full_features_for_free')}{' '}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <X className="w-6 h-6 text-foreground/35" />{' '}
                    {t('stick_with_goodbudget_if')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/70">
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_prefer_the_simplest_possible_envelope')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_need_a_native_app_from')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_want_a_free_plan_for')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_only_use_one_currency_and')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            <ComparisonReferences
              reviewedOn="2026-09-05"
              sources={[
                {
                  label: copy('u_cb506cc7ea7b'),
                  href: 'https://goodbudget.com/help/billing/subscribe-to-goodbudget/',
                },
              ]}
            />

            <TestimonialsSection />

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Final CTA */}
            <section className="py-20 text-center">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  {' '}
                  {t('ready_to_switch_from_goodbudget')}{' '}
                </h2>
                <p className="text-lg text-foreground/70 mb-8">
                  {' '}
                  {t('try_budgero_free_for_35_days')}{' '}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=goodbudget-alternative&utm_content=final">
                      {' '}
                      {t('start_free_trial')} <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                </div>
                <p className="mt-6 text-sm text-foreground/60">
                  {' '}
                  {copy('u_f970e30131a2')}{' '}
                  <Link href="/self-hostable" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_a967afa170d4')}{' '}
                  </Link>{' '}
                  {copy('u_48113592907c')}{' '}
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {copy('u_3516e656a206')}{' '}
                  <Link href="/best-ynab-alternatives" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_c3aea3fa9c08')}{' '}
                  </Link>{' '}
                  {copy('u_e6ba00a43b38')}{' '}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
type CopyTranslator = (key: string, values?: Record<string, string | number>) => string;
