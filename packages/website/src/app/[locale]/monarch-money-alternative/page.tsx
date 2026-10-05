import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ComparisonReferences } from '@/components/comparison-references';
import type { Metadata } from 'next';
import { withLocalizedUrls } from '@/lib/localized-metadata';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Check, X, Globe, Shield, Cpu, DollarSign } from 'lucide-react';
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
  const t = await getTranslations({ locale, namespace: 'monarch_money_alternative' });
  return withLocalizedUrls(locale, '/monarch-money-alternative', {
    title: t('meta_title'),
    description: t('meta_description'),
    keywords: [
      copy('u_1d47c88100a5'),
      copy('u_8c3c344a1b9a'),
      copy('u_bdbf605648a6'),
      copy('u_911b94bb255e'),
      copy('u_9ebde0721714'),
      copy('u_68d62ee7d250'),
      copy('u_c8fd747052af'),
      copy('u_ed08a15fb4ec'),
      copy('u_3c4402922223'),
      copy('u_a9fd636e8efa'),
    ],
    alternates: { canonical: 'https://budgero.app/monarch-money-alternative' },
    openGraph: {
      title: t('meta_title'),
      description: t('og_description'),
      url: 'https://budgero.app/monarch-money-alternative',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta_title'),
      description: t('tw_description'),
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
    monarch: copy('u_9cbd9440c1c0'),
    budgeroNote: t('comparisonData_or_free_with_self_host'),
    monarchNote: null,
  },
  {
    feature: t('comparisonData_monthly_price'),
    budgero: copy('u_9326295f206a', {
      p0: pricing.monthly,
    }),
    monarch: copy('u_036aeeb1e563'),
    budgeroNote: null,
    monarchNote: null,
  },
  {
    feature: t('comparisonData_multi_currency_support'),
    budgero: true,
    monarch: false,
    budgeroNote: t('comparisonData_live_fx_rates_auto_conversion'),
    monarchNote: t('comparisonData_usd_cad_only_no_conversion'),
  },
  {
    feature: t('comparisonData_works_worldwide'),
    budgero: true,
    monarch: false,
    budgeroNote: null,
    monarchNote: t('comparisonData_us_canada_only'),
  },
  {
    feature: t('comparisonData_works_offline'),
    budgero: true,
    monarch: false,
    budgeroNote: null,
    monarchNote: t('comparisonData_cloud_only_needs_internet'),
  },
  {
    feature: t('comparisonData_zero_knowledge_encryption'),
    budgero: true,
    monarch: false,
    budgeroNote: t('comparisonData_we_cannot_see_your_data'),
    monarchNote: t('comparisonData_bank_level_but_not_zero_knowledge'),
  },
  {
    feature: t('comparisonData_local_llm_integration'),
    budgero: true,
    monarch: false,
    budgeroNote: t('comparisonData_connect_to_locally_hosted_models'),
    monarchNote: t('comparisonData_uses_third_party_ai_data_processed'),
  },
  {
    feature: t('comparisonData_bank_sync'),
    budgero: true,
    monarch: true,
    budgeroNote: copy('u_6e7d19eaf95d'),
    monarchNote: t('comparisonData_us_canada_banks_only'),
  },
  {
    feature: t('comparisonData_investment_tracking'),
    budgero: t('cell_manual'),
    monarch: t('cell_automatic'),
    budgeroNote: null,
    monarchNote: t('comparisonData_syncs_with_brokerages'),
  },
  {
    feature: t('comparisonData_zero_based_budgeting'),
    budgero: true,
    monarch: true,
    budgeroNote: null,
    monarchNote: null,
  },
  {
    feature: t('comparisonData_shared_budgets'),
    budgero: true,
    monarch: true,
    budgeroNote: null,
    monarchNote: null,
  },
  {
    feature: t('comparisonData_free_tier_available'),
    budgero: true,
    monarch: false,
    budgeroNote: t('comparisonData_budgero_self_host_is_free_forever'),
    monarchNote: t('comparisonData_7_day_trial_only'),
  },
];

const makeFaqs = (
  t: (key: string, values?: Record<string, string | number>) => string,
  copy: CopyTranslator
) => [
  {
    q: t('faqs_does_monarch_money_work_outside_the'),
    a: t('faqs_not_really_monarch_money_is_built'),
  },
  {
    q: t('faqs_what_is_the_cheapest_monarch_money'),
    a: t('faqs_budgero_budgero_cloud_is_monthly_month', {
      monthly: pricing.monthly,
      yearly: pricing.yearly,
    }),
  },
  {
    q: copy('u_f2b5117d763d'),
    a: copy('u_36ff085c3ef6'),
  },
  {
    q: copy('u_a650505d969d'),
    a: copy('u_ec2ef2c9d8d8'),
  },
  {
    q: t('faqs_does_budgero_support_shared_budgets_like'),
    a: t('faqs_yes_budgero_cloud_supports_encrypted_shared'),
  },
  {
    q: t('faqs_is_budgero_really_65_cheaper_than'),
    a: t('faqs_yes_and_there_is_no_asterisk', {
      yearly: pricing.yearly,
    }),
  },
  {
    q: t('faqs_what_about_investment_tracking_monarch_syncs'),
    a: t('faqs_budgero_supports_manual_investment_tracking_you'),
  },
  {
    q: copy('u_1d9635527f12'),
    a: copy('u_01fc680bf43a'),
  },
];

const MONARCH_YEARLY_USD = 99.99;

function priceNumber(displayPrice: string): string {
  return displayPrice.replace(/[^0-9.]/g, '');
}

export default async function MonarchMoneyAlternativePage({
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
    namespace: 'monarch_money_alternative',
  });
  const faqs = makeFaqs(t, copy);
  const comparisonData = makeComparisonData(t, copy);
  const budgeroYearly = parseFloat(priceNumber(pricing.yearly));
  const yearlySavings = Math.max(0, Math.round(MONARCH_YEARLY_USD - budgeroYearly));
  const percentCheaper = Math.max(
    0,
    Math.round(((MONARCH_YEARLY_USD - budgeroYearly) / MONARCH_YEARLY_USD) * 100)
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
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
        url: 'https://budgero.app/monarch-money-alternative',
        description: copy('u_7bc1f38237bb'),
        offers: [
          {
            '@type': 'Offer',
            name: copy('u_02c52ce2f60b'),
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2026-12-31',
          },
          {
            '@type': 'Offer',
            name: copy('u_94523db6cbd4'),
            price: priceNumber(pricing.monthly),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2026-12-31',
          },
          {
            '@type': 'Offer',
            name: copy('u_6fdf0566337b'),
            price: priceNumber(pricing.yearly),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            priceValidUntil: '2026-12-31',
          },
        ],
        featureList: [
          copy('u_8e49033eb893'),
          copy('u_699441c94b63'),
          copy('u_9a326d07d39f'),
          copy('u_6a5146239471'),
          copy('u_a75e1bcc9dad'),
          copy('u_0c3992b67600'),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: copy('u_3a78695388b3'),
            item: 'https://budgero.app/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: copy('u_f7810075485e'),
            item: 'https://budgero.app/monarch-money-alternative',
          },
        ],
      },
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
                  className="mb-6 px-4 py-1.5 text-sm font-medium border-[#111c34]/30 text-[#111c34] bg-[#111c34]/10"
                >
                  <Shield className="w-3.5 h-3.5 mr-2" />{' '}
                  {t('zero_knowledge_privacy_no_plaid')}{' '}
                </Badge>

                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                  {' '}
                  {t('monarch_money_alternative')}{' '}
                  <span className="block text-2xl md:text-3xl mt-2 text-foreground/70 font-medium">
                    {' '}
                    {t('private_no_plaid')} {percentCheaper}
                    {t('cheaper')}{' '}
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                  {' '}
                  {t('budgero_is_the_privacy_first_monarch')} {pricing.yearly}
                  {t('year_or_self_host_free_no')}{' '}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=monarch-alternative&utm_content=hero">
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

            {/* Key Advantages Section */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {t('why_switch_from_monarch_money')}{' '}
                </h2>
                <p className="text-lg text-foreground/70">
                  {' '}
                  {t('monarch_is_polished_but_it_can')}{' '}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dfe4ec] flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-[#314258]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('true_multi_currency')}{' '}
                  </h3>
                  <p className="text-foreground/70"> {t('monarch_shows_everything_as_with_no')} </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dde9df] flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-[#2f6246]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {percentCheaper}
                    {copy('u_ca00260b1811')}{' '}
                  </h3>
                  <p className="text-foreground/70">
                    {' '}
                    {copy('u_cc73c24cfef3')} {pricing.yearly}
                    {copy('u_0f11c790dc38')} {yearlySavings}
                    {copy('u_6adc86d95920')}{' '}
                    <Link href="/self-hostable" className="underline hover:text-foreground">
                      self-host
                    </Link>{' '}
                    {copy('u_50bde00eb59d')}{' '}
                  </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#e4dff0] flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-[#564176]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('zero_knowledge_privacy')}{' '}
                  </h3>
                  <p className="text-foreground/70">
                    {' '}
                    {t('monarch_has_bank_level_encryption_but')}{' '}
                  </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#efe4d8] flex items-center justify-center mb-4">
                    <Cpu className="w-6 h-6 text-[#8a5730]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('local_llm_integration')}{' '}
                  </h3>
                  <p className="text-foreground/70"> {t('monarch_s_ai_uses_third_party')} </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Comparison Table */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {copy('u_12487cf2994d')}{' '}
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
                        {t('monarch_money')}{' '}
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
                          {typeof row.monarch === 'boolean' ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.monarch ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <X className="w-5 h-5 text-foreground/35" />
                              )}
                              {row.monarchNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.monarchNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm text-foreground/65">{row.monarch}</span>
                              {row.monarchNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.monarchNote}
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
              <p className="mt-4 text-sm text-foreground/60">
                {' '}
                {copy('u_81b309c35de0')}{' '}
                <Link href="/docs/push-api" className="underline hover:text-foreground">
                  {' '}
                  {copy('u_1445799c033a')}{' '}
                </Link>
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-7 text-base bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                >
                  <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=monarch-alternative&utm_content=mid-table">
                    {' '}
                    {t('try_budgero_free_for_35_days')} <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <span className="text-sm text-foreground/60">
                  {' '}
                  {t('no_card_required_multi_currency_works')}{' '}
                </span>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Who This Is For */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#e8f0e8] rounded-2xl p-8 border border-[#bfd7c2]">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Check className="w-6 h-6 text-green-600" /> {t('switch_to_budgero_if')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_live_outside_the_us_canada')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_manage_money_in_multiple_currencies')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_want_true_privacy_with_zero')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_want_to_use_your_own')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>
                        {' '}
                        {t('you_want_to_save')}
                        {yearlySavings}
                        {t('year_or_go_free_with')}{' '}
                        <Link href="/self-hostable" className="underline">
                          {' '}
                          {t('self_host_2')}{' '}
                        </Link>
                        )
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_need_offline_access_when_traveling')}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <X className="w-6 h-6 text-foreground/35" /> {t('stick_with_monarch_if')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/70">
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_need_automatic_us_canadian_bank')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_want_automatic_investment_brokerage_syncing')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_only_use_usd_and_live')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_prefer_fully_hands_off_automation')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Monarch Limitations Section */}
            <section className="py-16 max-w-3xl mx-auto">
              <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                  {' '}
                  {t('what_monarch_money_gets_wrong')}{' '}
                </h2>
                <p className="text-lg text-foreground/75 mb-6">
                  {' '}
                  {t('monarch_money_is_a_solid_app')}{' '}
                </p>
                <ul className="space-y-4 text-foreground/75">
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_d3bede6ef268')}</strong>{' '}
                      {copy('u_8911f543a7b8')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_8f6b3e13107e')}</strong>{' '}
                      {copy('u_d93841ee1cd1')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_087688e0ad2d')}</strong>{' '}
                      {copy('u_7230aff07392')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_78449688181a')}</strong>{' '}
                      {copy('u_94e4a9a1c880')}{' '}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong className="text-foreground">{copy('u_a74af4d4b7d1')}</strong>{' '}
                      {copy('u_d877f09c6e4c')}
                      {yearlySavings}
                      {copy('u_d47974b24ffe')} {pricing.yearly}.
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* FAQ */}
            <section className="py-16 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
                {' '}
                {t('frequently_asked_questions')}{' '}
              </h2>
              <div className="space-y-8">
                {faqs.map((faq) => (
                  <div key={faq.q}>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{faq.q}</h3>
                    <p className="text-foreground/70 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            <ComparisonReferences
              reviewedOn="2026-09-05"
              sources={[
                {
                  label: copy('u_95a927ce853a'),
                  href: 'https://help.monarch.com/hc/en-us/articles/19985735202068-FAQs-about-Monarch',
                },
                {
                  label: copy('u_620b4f41f37e'),
                  href: 'https://help.monarch.com/hc/en-us/articles/360048393552-International-Accounts-and-Currency',
                },
                {
                  label: copy('u_e43984cc2cc2'),
                  href: 'https://help.monarch.com/hc/en-us/articles/44815447567636-Updating-Your-Subscription',
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
                  {t('ready_to_switch_from_monarch_money')}{' '}
                </h2>
                <p className="text-lg text-foreground/70 mb-8">
                  {' '}
                  {t('try_budgero_free_for_35_days_2')}{' '}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=monarch-alternative&utm_content=final">
                      {' '}
                      {t('start_free_trial')} <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                </div>
                <p className="mt-6 text-sm text-foreground/60">
                  {' '}
                  {t('want_all_features_for_free')}{' '}
                  <Link
                    href="/self-hosted-ynab-alternative"
                    className="underline hover:text-foreground"
                  >
                    {' '}
                    {t('self_host_budgero')}{' '}
                  </Link>{' '}
                  {t('with_full_sync_multi_currency_and')}{' '}
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {t('based_in_europe')}{' '}
                  <Link
                    href="/monarch-money-europe-alternative"
                    className="underline hover:text-foreground"
                  >
                    {' '}
                    {t('monarch_money_isn_t_available_here')}{' '}
                  </Link>{' '}
                  {t('see_the_dedicated_comparison')}{' '}
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {t('wondering_about_currencies')}{' '}
                  <Link
                    href="/monarch-money-multi-currency"
                    className="underline hover:text-foreground"
                  >
                    {' '}
                    {t('does_monarch_money_support_multiple_currencies')}{' '}
                  </Link>
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {copy('u_0ffc6d48143e')}{' '}
                  <Link href="/best-ynab-alternatives" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_f3dbffef182f')}{' '}
                  </Link>
                  .
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
