import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { withLocalizedUrls } from '@/lib/localized-metadata';
import { ArrowRight, Check, X, Globe, Shield, DollarSign, Users } from 'lucide-react';
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
  const t = await getTranslations({ locale, namespace: 'everydollar_alternative' });
  return withLocalizedUrls(locale, '/everydollar-alternative', {
    title: t('meta_title'),
    description: t('meta_description'),
    keywords: [
      copy('u_8560acccb045'),
      copy('u_7d08e86ddcb5'),
      copy('u_a92507f27b36'),
      copy('u_0fe05b27ddfb'),
      copy('u_d63abd376d02'),
      copy('u_9cdac0a51092'),
    ],
    alternates: { canonical: 'https://budgero.app/everydollar-alternative' },
    openGraph: {
      title: t('meta_title'),
      description: t('meta_description'),
      url: 'https://budgero.app/everydollar-alternative',
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
    everydollar: t('comparisonData_free_79_99_yr_premium'),
    budgeroNote: t('comparisonData_or_free_with_self_host'),
    everydollarNote: null,
  },
  {
    feature: t('comparisonData_zero_based_budgeting'),
    budgero: true,
    everydollar: true,
    budgeroNote: null,
    everydollarNote: null,
  },
  {
    feature: copy('u_82f4e719a19c'),
    budgero: copy('u_bf40ecdaa803'),
    everydollar: 'Standard',
    budgeroNote: t('comparisonData_zero_knowledge_client_side'),
    everydollarNote: t('comparisonData_server_side_ramsey_can_access_data'),
  },
  {
    feature: t('comparisonData_bank_sync'),
    budgero: true,
    everydollar: t('comparisonData_premium_only'),
    budgeroNote: copy('u_6e7d19eaf95d'),
    everydollarNote: t('comparisonData_us_banks_only'),
  },
  {
    feature: copy('u_e5bf6e1036a3'),
    budgero: t('comparisonData_168_currencies'),
    everydollar: 'No',
    budgeroNote: t('comparisonData_live_fx_rates'),
    everydollarNote: t('comparisonData_usd_only'),
  },
  {
    feature: t('comparisonData_works_offline'),
    budgero: true,
    everydollar: false,
    budgeroNote: null,
    everydollarNote: t('comparisonData_limited_offline_support'),
  },
  {
    feature: t('comparisonData_shared_budgets'),
    budgero: t('comparisonData_5_seats'),
    everydollar: t('comparisonData_per_user'),
    budgeroNote: t('comparisonData_included_in_plan'),
    everydollarNote: t('comparisonData_each_user_needs_own_subscription'),
  },
  {
    feature: t('comparisonData_self_host_option'),
    budgero: true,
    everydollar: false,
    budgeroNote: t('comparisonData_free_forever'),
    everydollarNote: null,
  },
  {
    feature: t('comparisonData_works_worldwide'),
    budgero: true,
    everydollar: false,
    budgeroNote: null,
    everydollarNote: t('comparisonData_us_only'),
  },
  {
    feature: t('comparisonData_ynab_csv_import'),
    budgero: true,
    everydollar: false,
    budgeroNote: null,
    everydollarNote: null,
  },
  {
    feature: t('comparisonData_debt_tracking'),
    budgero: true,
    everydollar: true,
    budgeroNote: null,
    everydollarNote: null,
  },
  {
    feature: t('comparisonData_ai_features'),
    budgero: t('comparisonData_local_llm'),
    everydollar: 'No',
    budgeroNote: t('comparisonData_data_stays_on_your_device'),
    everydollarNote: null,
  },
];

const makeFaqs = (t: (key: string, values?: Record<string, string | number>) => string) => [
  {
    q: t('faqs_can_i_keep_following_the_baby'),
    a: t('faqs_yes_the_ramsey_method_is_app'),
  },
  {
    q: t('faqs_is_there_a_free_version_like'),
    a: t('faqs_everydollar_s_free_tier_is_manual'),
  },
  {
    q: t('faqs_how_does_the_debt_snowball_work'),
    a: t('faqs_budgero_tracks_each_debt_account_with'),
  },
  {
    q: t('faqs_does_everydollar_work_outside_the_us'),
    a: t('faqs_not_meaningfully_everydollar_is_usd_only'),
  },
  {
    q: t('faqs_how_do_i_switch_from_everydollar'),
    a: t('faqs_export_your_transactions_from_everydollar_as'),
  },
];

export default async function EveryDollarAlternativePage({
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
    namespace: 'everydollar_alternative',
  });
  const faqs = makeFaqs(t);
  const comparisonData = makeComparisonData(t, copy);
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
        url: 'https://budgero.app/everydollar-alternative',
        description: copy('u_42cf4c08c7aa'),
        offers: {
          '@type': 'Offer',
          price: pricing.yearly.replace(/[^0-9.]/g, ''),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          copy('u_0c3992b67600'),
          copy('u_699441c94b63'),
          copy('u_8e49033eb893'),
          copy('u_4cbe6f1ece84'),
          copy('u_9a326d07d39f'),
          copy('u_6a5146239471'),
          copy('u_a75e1bcc9dad'),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
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
            name: copy('u_e323a573ea68'),
            item: 'https://budgero.app/everydollar-alternative',
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
                  className="mb-6 px-4 py-1.5 text-sm font-medium border-amber-500/30 text-amber-700 bg-amber-500/10"
                >
                  <Shield className="w-3.5 h-3.5 mr-2" /> {t('privacy_first_budgeting')}{' '}
                </Badge>

                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                  {' '}
                  {t('everydollar_alternative')}{' '}
                  <span className="block text-2xl md:text-3xl mt-2 text-foreground/70 font-medium">
                    {' '}
                    {t('zero_based_budgeting_without_the_ramsey')}{' '}
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                  {' '}
                  {t('everydollar_is_a_solid_zero_based')}{' '}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=everydollar-alternative&utm_content=hero">
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
                    <a href="#comparison"> {t('compare_features')} </a>
                  </Button>
                </div>

                <p className="mt-4 text-sm text-foreground/60">
                  {' '}
                  {t('no_credit_card_required_zero_knowledge')}{' '}
                </p>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Key Differences Section */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {t('why_switch_from_everydollar')}{' '}
                </h2>
                <p className="text-lg text-foreground/70">
                  {' '}
                  {t('same_zero_based_budgeting_approach_none')}{' '}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#e4dff0] flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-[#564176]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('zero_knowledge_encryption')}{' '}
                  </h3>
                  <p className="text-foreground/70">
                    {' '}
                    {t('everydollar_stores_your_data_on_ramsey')}{' '}
                  </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dfe4ec] flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-[#314258]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('168_currencies')}{' '}
                  </h3>
                  <p className="text-foreground/70">
                    {' '}
                    {t('everydollar_is_us_only_budgero_handles')}{' '}
                  </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#dde9df] flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-[#2f6246]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('no_philosophy_lock_in')}{' '}
                  </h3>
                  <p className="text-foreground/70">
                    {' '}
                    {t('budgero_uses_zero_based_budgeting_without')}{' '}
                  </p>
                </div>

                <div className="bg-card rounded-xl p-6 border border-border/70">
                  <div className="w-12 h-12 rounded-full bg-[#efe4d8] flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-[#8a5730]" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">
                    {' '}
                    {t('5_seats_included')}{' '}
                  </h3>
                  <p className="text-foreground/70"> {t('share_your_budget_with_up_to')} </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Comparison Table */}
            <section id="comparison" className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {t('budgero_vs_everydollar')}{' '}
                </h2>
                <p className="text-lg text-foreground/70"> {t('feature_by_feature_comparison')} </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
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
                        {t('everydollar')}{' '}
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
                          {typeof row.everydollar === 'boolean' ? (
                            <div className="flex flex-col items-center gap-1">
                              {row.everydollar ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : (
                                <X className="w-5 h-5 text-foreground/35" />
                              )}
                              {row.everydollarNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.everydollarNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm text-foreground/65">{row.everydollar}</span>
                              {row.everydollarNote && (
                                <span className="text-xs text-foreground/55">
                                  {row.everydollarNote}
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

            {/* Where EveryDollar Wins */}
            <section className="py-16 max-w-3xl mx-auto">
              <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                  {' '}
                  {t('where_everydollar_wins')}{' '}
                </h2>
                <p className="text-lg text-foreground/75 mb-6">
                  {' '}
                  {t('everydollar_has_genuine_strengths_here_s')}{' '}
                </p>
                <ul className="space-y-4 text-foreground/75">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{t('simple_clean_interface_focused_on_one')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{t('tight_integration_with_ramsey_s_financial')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{t('bank_sync_in_premium_tier_us')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{t('large_community_of_ramsey_followers')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{t('free_tier_available_with_no_time')}</span>
                  </li>
                </ul>
                <p className="mt-6 text-foreground/70 italic">
                  {' '}
                  {t('if_you_follow_the_ramsey_method')}{' '}
                </p>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Baby Steps compatibility */}
            <section className="py-16 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                {' '}
                {t('keep_the_baby_steps_upgrade_the')}{' '}
              </h2>
              <div className="space-y-6 text-lg text-foreground/75 leading-relaxed">
                <p> {t('most_people_searching_for_an_everydollar')} </p>
                <p>
                  {' '}
                  {t('what_changes_when_you_switch_your')}{' '}
                  <Link href="/multi-currency-budgeting" className="underline hover:text-foreground">
                    {' '}
                    {t('multiple_currencies')}{' '}
                  </Link>{' '}
                  {t('if_your_life_needs_that_what')}{' '}
                  <Link href="/self-hostable" className="underline hover:text-foreground">
                    {' '}
                    {t('budgero_self_host')}{' '}
                  </Link>{' '}
                  {t('is_free_forever_if_you_ll')}{' '}
                </p>
                <p>
                  {' '}
                  {t('debt_payoff_specifically')}{' '}
                  <Link href="/docs/debt-tracking" className="underline hover:text-foreground">
                    {' '}
                    {t('budgero_s_debt_tracking')}{' '}
                  </Link>{' '}
                  {t('handles_balances_and_payoff_progress_and')}{' '}
                </p>
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
                      <span>{t('you_live_outside_the_us')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_budget_in_multiple_currencies')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_want_5_seats_included_in')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{t('you_don_t_follow_the_ramsey')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>
                        {' '}
                        {t('you_want_a')}{' '}
                        <Link href="/self-hostable" className="underline">
                          {' '}
                          {t('self_host_option')}{' '}
                        </Link>
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <X className="w-6 h-6 text-foreground/35" />{' '}
                    {t('stick_with_everydollar_if')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/70">
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_follow_the_ramsey_baby_steps')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_need_us_bank_sync')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_want_a_free_basic_tier')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{t('you_prefer_the_ramsey_ecosystem')}</span>
                    </li>
                  </ul>
                </div>
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

            <TestimonialsSection />

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Final CTA */}
            <section className="py-20 text-center">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  {' '}
                  {t('ready_to_try_a_zero_based')}{' '}
                </h2>
                <p className="text-lg text-foreground/70 mb-8">
                  {' '}
                  {t('35_day_free_trial_no_credit')}{' '}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=everydollar-alternative&utm_content=final">
                      {' '}
                      {t('start_free_trial')} <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                </div>
                <p className="mt-6 text-sm text-foreground/60">
                  {' '}
                  {t('want_all_features_for_free')}{' '}
                  <Link href="/self-hostable" className="underline hover:text-foreground">
                    {' '}
                    {t('self_host_budgero')}{' '}
                  </Link>{' '}
                  {t('with_full_sync_multi_currency_and')}{' '}
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {t('comparing_more_apps_see_the')}{' '}
                  <Link href="/best-ynab-alternatives" className="underline hover:text-foreground">
                    {' '}
                    {t('best_ynab_alternatives')}{' '}
                  </Link>{' '}
                  {t('for_2026')}{' '}
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
