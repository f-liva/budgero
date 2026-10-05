import { getTranslations, setRequestLocale } from 'next-intl/server';
import { withLocalizedUrls } from '@/lib/localized-metadata';
import { useTranslations } from 'next-intl';
import { ComparisonReferences } from '@/components/comparison-references';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { ArrowRight, Check, X, Download, Import } from 'lucide-react';
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
  return withLocalizedUrls(locale, '/vs-ynab', {
    title: copy('u_ea12f2ca153d'),
    description: copy('u_ccb077bb5318', {
      p0: pricing.yearly,
    }),
    keywords: [
      copy('u_b05c62772f94'),
      copy('u_21fa16118428'),
      copy('u_f11e989211ed'),
      copy('u_7f52c07efe2f'),
      copy('u_7185b57af5da'),
      copy('u_6658fb7afb58'),
      copy('u_1a1c1ce0e1e0'),
      copy('u_3c423011cc46'),
      copy('u_0066035dafa0'),
      copy('u_a8ea113b32e5'),
      copy('u_8196d4b0cb42'),
      copy('u_03d4e5adb614'),
    ],
    alternates: { canonical: 'https://budgero.app/vs-ynab' },
    openGraph: {
      title: copy('u_ea12f2ca153d'),
      description: copy('u_d8e8c747da41', {
        p0: pricing.yearly,
      }),
      url: 'https://budgero.app/vs-ynab',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: copy('u_ea12f2ca153d'),
      description: copy('u_55d11ac3ae74', {
        p0: pricing.yearly,
      }),
    },
  });
}

const comparisonData = (copy: CopyTranslator) => [
  {
    feature: copy('u_648c2cfbe708'),
    cloud: `${pricing.monthly}/mo (${pricing.yearly}/yr)`,
    selfHost: 'Free forever',
    ynab: copy('u_93ed9cf1ddf4'),
  },
  {
    feature: copy('u_17f6390c3192'),
    cloud: copy('u_772598b85998'),
    selfHost: 'N/A — always free',
    ynab: copy('u_0900d7ae80cc'),
  },
  { feature: copy('u_0c3992b67600'), cloud: true, selfHost: true, ynab: true },
  {
    feature: copy('u_1b3f0f02f289'),
    cloud: 'AES-256-GCM, zero-knowledge',
    selfHost: 'Local encryption',
    ynab: false,
    ynabNote: copy('u_560045be1d1d'),
  },
  {
    feature: copy('u_2284493dc22a'),
    cloud: 'Installed PWA',
    selfHost: 'Installed PWA',
    ynab: copy('u_c38456dfac02'),
  },
  {
    feature: copy('u_d458c964237f'),
    cloud: '168 currencies',
    selfHost: '168 currencies',
    ynab: false,
    ynabNote: copy('u_51351ec81a57'),
  },
  {
    feature: copy('u_0fe68e5b1c82'),
    cloud: true,
    selfHost: true,
    ynab: true,
    cloudNote: copy('u_a1051ed81723'),
    ynabNote: copy('u_22df1744fe78'),
  },
  { feature: copy('u_4d3f4e3a228c'), cloud: true, selfHost: true, ynab: 'N/A' },
  {
    feature: copy('u_7752d5c2b8d3'),
    cloud: false,
    selfHost: true,
    ynab: false,
    cloudNote: copy('u_ec7f4064e601'),
  },
  {
    feature: copy('u_7aee26e5036f'),
    cloud: 'Export anytime',
    selfHost: copy('u_42edba3608e6'),
    ynab: false,
    ynabNote: copy('u_3bd68034d586'),
  },
  { feature: copy('u_429bbfa117e2'), cloud: 'PWA', selfHost: 'PWA', ynab: copy('u_9d9e36c78c83') },
  {
    feature: copy('u_965742a116f6'),
    cloud: true,
    selfHost: 'Via shared server',
    ynab: true,
    cloudNote: copy('u_c2caad830eb9'),
    ynabNote: copy('u_9200c1f623ac'),
  },
  {
    feature: copy('u_b379494d086d'),
    cloud: true,
    selfHost: true,
    ynab: false,
    cloudNote: copy('u_97f5f6f7e024'),
  },
  {
    feature: copy('u_f71c412cc471'),
    cloud: true,
    selfHost: true,
    ynab: false,
    cloudNote: copy('u_f7572a186550'),
  },
  {
    feature: copy('u_d604cff10a71'),
    cloud: 'Modern dashboards',
    selfHost: 'Modern dashboards',
    ynab: copy('u_f8fae034becd'),
  },
  {
    feature: copy('u_923fd4348d29'),
    cloud: true,
    selfHost: true,
    ynab: true,
    cloudNote: copy('u_296e08d090bc'),
    ynabNote: copy('u_b6baf72c0b41'),
  },
];

const faqs = (copy: CopyTranslator) => [
  {
    q: copy('u_6311d3151ec7'),
    a: copy('u_d75088c50002'),
  },
  {
    q: copy('u_b9c2c0ee275f'),
    a: copy('u_80ac15f55852'),
  },
  {
    q: copy('u_330a4e18cc92'),
    a: copy('u_91fd244be447', {
      p0: pricing.monthly,
      p1: pricing.yearly,
    }),
  },
  {
    q: copy('u_d2ebf5f35936'),
    a: copy('u_0920066ac3cd', {
      p0: pricing.monthly,
      p1: pricing.yearly,
    }),
  },
  {
    q: copy('u_4388ce36e1b6'),
    a: copy('u_0614ce87419e'),
  },
  {
    q: copy('u_67e97b727814'),
    a: copy('u_f9e403a18bf9'),
  },
  {
    q: copy('u_c171a06aee30'),
    a: copy('u_a0e8cd75484e'),
  },
  {
    q: copy('u_40d80a2e417e'),
    a: copy('u_ff144dc089cd'),
  },
  {
    q: copy('u_dbf2a408fa9f'),
    a: copy('u_441eee858b68'),
  },
  {
    q: copy('u_a553bdbc6d58'),
    a: copy('u_7bca609d5345'),
  },
];

function renderCellValue(val: unknown, note?: string, isHighlight?: boolean) {
  if (typeof val === 'boolean') {
    return (
      <div className="flex flex-col items-center gap-1">
        {val ? (
          <Check className="w-5 h-5 text-green-600" />
        ) : (
          <X className="w-5 h-5 text-foreground/35" />
        )}
        {note && <span className="text-xs text-foreground/55">{note}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-sm ${isHighlight ? 'font-medium text-[#2f6246]' : 'text-foreground/65'}`}
      >
        {String(val)}
      </span>
      {note && <span className="text-xs text-foreground/55">{note}</span>}
    </div>
  );
}

export default async function VsYnabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const copy = await getTranslations({
    locale: (await params).locale,
    namespace: 'updates',
  });
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
        url: 'https://budgero.app/vs-ynab',
        description: copy('u_03922fc1c06b'),
        offers: [
          {
            '@type': 'Offer',
            name: copy('u_02c52ce2f60b'),
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          {
            '@type': 'Offer',
            name: copy('u_3ffc9f1dabd5'),
            price: pricing.monthly.replace(/[^0-9.]/g, ''),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        ],
        featureList: [
          copy('u_0c3992b67600'),
          copy('u_e6072dcb869e'),
          copy('u_08f806a85dc0'),
          copy('u_9a326d07d39f'),
          copy('u_170eda937fe7'),
          copy('u_a87f8b3aa36a'),
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs(copy).map((faq) => ({
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
            name: copy('u_ada0cbd08be4'),
            item: 'https://budgero.app/vs-ynab',
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
            {/* Hero */}
            <section className="pt-24 pb-16 md:pt-32 md:pb-24 text-center">
              <div className="max-w-4xl mx-auto">
                <Badge
                  variant="outline"
                  className="mb-6 px-4 py-1.5 text-sm font-medium border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/10"
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> {copy('u_185e019f0e60')}{' '}
                </Badge>

                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                  {' '}
                  {copy('u_a009b76244b8')}{' '}
                </h1>

                <p className="text-xl md:text-2xl text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                  {' '}
                  {copy('u_86d87d871613')} {pricing.yearly}
                  {copy('u_1cc6b1d6f2fa')}{' '}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                  >
                    <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=vs-ynab&utm_content=hero">
                      {' '}
                      {copy('u_2e0d5e87f9b8')} <ArrowRight className="w-5 h-5 ml-2" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 text-lg border-border/80"
                  >
                    <a href="#comparison">{copy('u_e5ee7df6e9ab')}</a>
                  </Button>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Why People Switch */}
            <section className="py-16 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                {' '}
                {copy('u_0162ded9c40a')}{' '}
              </h2>
              <div className="space-y-6 text-lg text-foreground/75 leading-relaxed">
                <p> {copy('u_4d615bf6b105')} </p>

                <div className="space-y-4">
                  <p>
                    <strong className="text-foreground">{copy('u_8cb50b606851')}</strong>{' '}
                    {copy('u_919182e7c259')}{' '}
                  </p>
                  <p>
                    <strong className="text-foreground">{copy('u_c887213d1ca2')}</strong>{' '}
                    {copy('u_993b5a1903b9')}{' '}
                  </p>
                  <p>
                    <strong className="text-foreground">{copy('u_91eaabff1b9a')}</strong>{' '}
                    {copy('u_46cfc721e074')} {pricing.monthly}
                    {copy('u_f02908f678e5')} {pricing.yearly}
                    {copy('u_68433cbc8ac4')}{' '}
                  </p>
                  <p>
                    <strong className="text-foreground">{copy('u_9bc0308cd288')}</strong>{' '}
                    {copy('u_88e023a4db43')}{' '}
                  </p>
                  <p>
                    <strong className="text-foreground">{copy('u_6ca36c4eef0f')}</strong>{' '}
                    {copy('u_b8b8dc2c875c')}{' '}
                  </p>
                  <p>
                    <strong className="text-foreground">{copy('u_d4b47861fe34')}</strong>{' '}
                    {copy('u_c9de34646252')}{' '}
                  </p>
                  <p>
                    {' '}
                    {copy('u_b2796357374b')}{' '}
                    <Link
                      href="/blog/ynab-multi-currency"
                      className="underline hover:text-foreground"
                    >
                      {' '}
                      {copy('u_454275337b63')}{' '}
                    </Link>{' '}
                    {copy('u_20c9995039ed')}{' '}
                  </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Comparison Table */}
            <section id="comparison" className="py-16 max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {copy('u_a972a2d6dfb0')}{' '}
                </h2>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-muted/35">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-foreground">
                        {' '}
                        {copy('u_3d377ae910dc')}{' '}
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
                        {' '}
                        {copy('u_3ffc9f1dabd5')}{' '}
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
                        {' '}
                        {copy('u_02c52ce2f60b')}{' '}
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
                        YNAB
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {comparisonData(copy).map((row, index) => (
                      <tr
                        key={row.feature}
                        className={index % 2 === 0 ? 'bg-transparent' : 'bg-muted/25'}
                      >
                        <td className="px-4 py-4 text-sm font-medium text-foreground">
                          {row.feature}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {renderCellValue(row.cloud, row.cloudNote, true)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {renderCellValue(row.selfHost, undefined, true)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {renderCellValue(row.ynab, row.ynabNote, false)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-6 text-foreground/60 text-sm max-w-3xl">
                <strong className="text-foreground">{copy('u_ea889d29d166')}</strong>{' '}
                {copy('u_b4c9a2605f30')}{' '}
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-7 text-base bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                >
                  <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=vs-ynab&utm_content=mid-table">
                    {' '}
                    {copy('u_2e0d5e87f9b8')} <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <span className="text-sm text-foreground/60"> {copy('u_995b5e50926d')} </span>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Migration Walkthrough */}
            <section className="py-16 max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Badge className="mb-4 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                  <Import className="w-3.5 h-3.5 mr-2" /> {copy('u_5756cc002d6b')}{' '}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {' '}
                  {copy('u_3582b12d27b4')}{' '}
                </h2>
                <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
                  {' '}
                  {copy('u_309d125f71de')}{' '}
                </p>
              </div>

              <div className="space-y-6 max-w-3xl mx-auto">
                {[
                  {
                    step: '1',
                    title: copy('u_2f430ee3c2f9'),
                    text: copy('u_4a0298caea41'),
                    tip: copy('u_cfac9b7a6dcf'),
                  },
                  {
                    step: '2',
                    title: copy('u_7683701a7eb8'),
                    text: copy('u_d45dad73aefe'),
                  },
                  {
                    step: '3',
                    title: copy('u_3c919b7d050b'),
                    text: copy('u_2e666acee11c'),
                  },
                  {
                    step: '4',
                    title: copy('u_46a6d1acbcd2'),
                    text: copy('u_995e46f24706'),
                  },
                  {
                    step: '5',
                    title: copy('u_7d10f1dd4d3a'),
                    text: copy('u_97f27ea0a19a'),
                  },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-lg font-bold text-foreground">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1 text-lg">{item.title}</h3>
                      <p className="text-foreground/70">{item.text}</p>
                      {item.tip && (
                        <p className="mt-2 text-sm text-foreground/55 italic">
                          {copy('u_ab744fe26b88')} {item.tip}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-center text-foreground/60">
                {' '}
                {copy('u_2e6769f7f98c')}{' '}
                <Link href="/docs/ynab-import" className="underline hover:text-foreground">
                  {' '}
                  {copy('u_c91f31ccee44')}{' '}
                </Link>{' '}
                {copy('u_f65bbba87274')}{' '}
              </p>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* What Makes Budgero Different */}
            <section className="py-16 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
                {' '}
                {copy('u_dee600281c3c')}{' '}
              </h2>

              <div className="space-y-10">
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {' '}
                    {copy('u_a95c4a74acc7')}{' '}
                  </h3>
                  <p className="text-lg text-foreground/75 leading-relaxed">
                    {' '}
                    {copy('u_395cd94ecc4c')}{' '}
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {' '}
                    {copy('u_13dd277b2d9e')}{' '}
                  </h3>
                  <p className="text-lg text-foreground/75 leading-relaxed">
                    {' '}
                    {copy('u_99bafcee527e')}{' '}
                    <Link
                      href="/multi-currency-budgeting"
                      className="underline hover:text-foreground"
                    >
                      {' '}
                      {copy('u_bcc6cd2da733')}{' '}
                    </Link>{' '}
                    {copy('u_22b97311045f')}{' '}
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {' '}
                    {copy('u_867592223d41')}{' '}
                  </h3>
                  <p className="text-lg text-foreground/75 leading-relaxed">
                    {' '}
                    {copy('u_087931a9dbbb')}{' '}
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {' '}
                    {copy('u_64a31bf79923')}{' '}
                  </h3>
                  <p className="text-lg text-foreground/75 leading-relaxed">
                    {' '}
                    {copy('u_ad74f3d4fd6b')}{' '}
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {' '}
                    {copy('u_142369a8c8d1')}{' '}
                  </h3>
                  <p className="text-lg text-foreground/75 leading-relaxed">
                    {' '}
                    {copy('u_d048119ed423')}{' '}
                    <Link href="/self-hostable" className="underline hover:text-foreground">
                      {' '}
                      {copy('u_02c52ce2f60b')}{' '}
                    </Link>{' '}
                    {copy('u_88403bb85f71')}{' '}
                  </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Who This Is For */}
            <section className="py-16 max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
                {' '}
                {copy('u_440015a2eafc')}{' '}
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#e8f0e8] rounded-2xl p-8 border border-[#bfd7c2]">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <Check className="w-6 h-6 text-green-600" /> {copy('u_8c18d186573f')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/80">
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{copy('u_c72313cbd048')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span> {copy('u_9e5746de2401')} </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span> {copy('u_d5b09864c977')} </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{copy('u_11b0193aa58f')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span> {copy('u_ea403e5709d4')} </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{copy('u_c4f31261ab91')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{copy('u_d54c67296c93')}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-muted/25 rounded-2xl p-8 border border-border/70">
                  <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                    <X className="w-6 h-6 text-foreground/35" /> {copy('u_e098ccfb631b')}{' '}
                  </h3>
                  <ul className="space-y-3 text-foreground/70">
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{copy('u_08d87bf4e416')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span> {copy('u_1555896712b0')} </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>{copy('u_c4f5854ecd18')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-4 h-4 text-foreground/35 mt-1 flex-shrink-0" />
                      <span>
                        {' '}
                        {copy('u_1dc593d2e658')}{' '}
                        <Link
                          href="/monarch-money-alternative"
                          className="underline hover:text-foreground"
                        >
                          {' '}
                          {copy('u_96b3722151e7')}{' '}
                        </Link>{' '}
                        {copy('u_03fc61388f31')}{' '}
                      </span>
                    </li>
                  </ul>
                  <p className="mt-6 text-sm text-foreground/55"> {copy('u_7e53cfd1a4db')} </p>
                </div>
              </div>
            </section>

            <div className="my-12 border-t border-border" aria-hidden />

            {/* FAQ */}
            <section className="py-16 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
                {' '}
                {copy('u_a3d458e1bd1e')}{' '}
              </h2>
              <div className="space-y-8">
                {faqs(copy).map((faq) => (
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
                { label: copy('u_231b0d1311ac'), href: 'https://www.ynab.com/pricing' },
                {
                  label: copy('u_80eb9b5c67b8'),
                  href: 'https://www.ynab.com/security',
                },
                {
                  label: copy('u_c0894f028d2c'),
                  href: 'https://www.ynab.com/features',
                },
                { label: copy('u_04c6dce638dc'), href: 'https://api.ynab.com/' },
              ]}
            />

            <TestimonialsSection />

            <div className="my-12 border-t border-border" aria-hidden />

            {/* Final CTA */}
            <section className="py-20 text-center">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  {' '}
                  {copy('u_a2d168863b46')}{' '}
                </h2>
                <p className="text-lg text-foreground/70 mb-8"> {copy('u_fa3961709ffb')} </p>
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 text-lg bg-[#111c34] text-[#f8fafc] hover:bg-[#1e293b]"
                >
                  <a href="https://my.budgero.app/auth?mode=signup&utm_source=website&utm_medium=cta&utm_campaign=vs-ynab&utm_content=final">
                    {' '}
                    {copy('u_d4ddd6ce6fb8')} <ArrowRight className="w-5 h-5 ml-2" />
                  </a>
                </Button>
                <p className="mt-6 text-sm text-foreground/60">
                  {' '}
                  {copy('u_f94469dda6bf')}{' '}
                  <Link
                    href="/self-hosted-ynab-alternative"
                    className="underline hover:text-foreground"
                  >
                    {' '}
                    {copy('u_be683d0fec28')}{' '}
                  </Link>
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {copy('u_2d32e70c7181')}{' '}
                  <Link href="/ynab-alternative-europe" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_bdb2f3334b22')}{' '}
                  </Link>
                  .
                </p>
                <p className="mt-3 text-sm text-foreground/60">
                  {' '}
                  {copy('u_e492b9f41172')}{' '}
                  <Link href="/best-ynab-alternatives" className="underline hover:text-foreground">
                    {' '}
                    {copy('u_468e81859112')}{' '}
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
