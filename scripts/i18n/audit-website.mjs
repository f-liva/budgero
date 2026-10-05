#!/usr/bin/env node
/**
 * Flags untranslated text on the built website by diffing each non-English
 * page against its English counterpart in .next/server/app.
 *
 * A text run that renders identically on /de/... and /... is either brand
 * vocabulary or a missed translation; everything long enough to be a sentence
 * is reported. Original native articles have no English counterpart and need
 * editorial review; historical changelog entries remain in English by design.
 *
 *   pnpm --dir packages/website run build && node scripts/i18n/audit-website.mjs [--max N]
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = join(ROOT, 'packages', 'website', '.next', 'server', 'app');
const LOCALES = ['de', 'fr', 'es', 'nl'];

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : Infinity;
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

// Strings that legitimately render identically across locales.
const ALLOW = [
  /^[\s\d\p{P}\p{S}]*$/u, // punctuation/numbers only
  /^Monarch Money Alternative$/, // footer label; valid as-is in every locale
  // Comma-separated brand enumerations (bank lists on the Europe landers).
  /^[A-Za-z][\w&. ]{1,24}(, [A-Za-z][\w&. ()]{1,24}){2,}( \+ live FX)?$/,
  /^Budgero( Self-Host)? vs\.? [\w .]+$/, // comparison headings are brand phrases
  /^[\w ]+ Alternative$/, // "<Brand> Alternative" heading, valid in de/nl
  /^Docker \/ docker-compose$/,
  /^Native iOS & Android$/,
  /^Open source \(AGPL-3\.0\)$/, // "open source" is the accepted term in fr/nl
  /^Is Budgero open source\?$/, // identical in idiomatic Dutch
  /^Keep it secret, keep it safe\.$/, // LOTR quote under the Gandalf gif, kept in English
  /^VS Code → Terminal → New Terminal\.$/, // UI menu path, kept as the app shows it
  // Enable Banking's control panel is English-only; guides quote its labels verbatim.
  /^(Enable Banking control panel|Allowed redirect URLs|Generate in the browser|Activate by linking accounts)$/,
  /^(Budgero|YNAB|Monarch( Money)?|PocketGuard|EveryDollar|Goodbudget|Quicken( Simplifi)?|Firefly III|Actual( Budget)?|GoCardless|Plaid|Docker|GitHub|SQLite|CSV|API|FAQ|RSS|Changelog|Blog|Cloud|Self-Host(ed|able)?)[\s\d\p{P}\p{S}]*$/iu,
  /^(AES-256(-GCM)?|PBKDF2(-HMAC-SHA256)?|AGPL-3\.0|JWT|LLM|SQL( Explorer)?|iPhone|Android|Windows|Mac(OS)?|Linux|Unix|iOS|Web)[\s\d\p{P}\p{S}]*$/iu,
  /^https?:\/\//,
  /@[\w-]+\.\w+/, // emails
  /^[\w.-]+\s(run|serve)\b/, // CLI commands
];

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

function textRuns(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(code|pre|svg)[\s\S]*?<\/\1>/gi, ' ');
  const runs = [];
  // Accessible names and descriptions need the same coverage as visible copy.
  const matches = [
    ...cleaned.matchAll(/>([^<>]+)</g),
    ...cleaned.matchAll(/(?:alt|aria-label|title|placeholder)="([^"]+)"/g),
  ];
  for (const m of matches) {
    const text = decode(m[1]).replace(/\s+/g, ' ').trim();
    if (text.length >= 20 && text.split(' ').length >= 3) runs.push(text);
  }
  return runs;
}

const meta = (html, name) =>
  decode(
    (html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`)) ||
      html.match(new RegExp(`<meta property="${name}" content="([^"]*)"`)) || [, ''])[1]
  );
const title = (html) => decode((html.match(/<title>([^<]*)<\/title>/) || [, ''])[1]);

const findings = [];
let pages = 0;
let redirects = 0;
let originalArticles = 0;

for (const locale of LOCALES) {
  const base = join(APP, locale);
  if (!existsSync(base)) continue;
  const pairs = [...htmlFiles(base)].map((file) => ({ file, rel: relative(base, file) }));
  // The locale homepage sits beside the directory as <locale>.html.
  if (existsSync(join(APP, `${locale}.html`)))
    pairs.push({ file: join(APP, `${locale}.html`), rel: 'index.html' });
  for (const { file, rel } of pairs) {
    // Next can emit an HTML artifact containing metadata even for a redirect.
    // Audit rendered pages, not English metadata in a locale's 308 response.
    const routeMeta = file.replace(/\.html$/, '.meta');
    if (existsSync(routeMeta)) {
      const { status, headers } = JSON.parse(readFileSync(routeMeta, 'utf8'));
      if (status >= 300 && status < 400 && headers?.location) {
        redirects += 1;
        continue;
      }
    }
    // Release notes remain in English on both the index and its archive pages.
    if (rel === 'changelog.html' || /^changelog\/page\/[1-9]\d*\.html$/.test(rel)) continue;
    const enFile = rel === 'index.html' ? join(APP, 'en.html') : join(APP, 'en', rel);
    if (!existsSync(enFile)) {
      if (rel.startsWith('blog/')) originalArticles += 1;
      continue;
    }
    pages += 1;

    const loc = readFileSync(file, 'utf8');
    const en = readFileSync(enFile, 'utf8');
    const enRuns = new Set(textRuns(en));

    const dupes = [...new Set(textRuns(loc))].filter(
      (t) => enRuns.has(t) && !ALLOW.some((re) => re.test(t))
    );
    for (const text of dupes) {
      findings.push({
        locale,
        page: `/${locale}/${rel.replace(/\.html$/, '')}`,
        kind: 'text',
        text,
      });
    }

    const locTitle = title(loc);
    if (locTitle && locTitle === title(en)) {
      findings.push({
        locale,
        page: `/${locale}/${rel.replace(/\.html$/, '')}`,
        kind: 'title',
        text: locTitle,
      });
    }
    const locDesc = meta(loc, 'description');
    if (locDesc && locDesc === meta(en, 'description')) {
      findings.push({
        locale,
        page: `/${locale}/${rel.replace(/\.html$/, '')}`,
        kind: 'meta',
        text: locDesc.slice(0, 80),
      });
    }
  }
}

const byPage = new Map();
for (const f of findings) {
  if (!byPage.has(f.page)) byPage.set(f.page, []);
  byPage.get(f.page).push(f);
}

console.log(
  `Audited ${pages} locale pages. ${findings.length} findings on ${byPage.size} pages.\n`
);
console.log(
  `Skipped ${redirects} redirect artifacts and ${originalArticles} original articles without an English counterpart.\n`
);
const sorted = [...byPage.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [page, list] of sorted) {
  console.log(`${page}  (${list.length})`);
  for (const f of list.slice(0, 8)) console.log(`  [${f.kind}] ${f.text.slice(0, 110)}`);
  if (list.length > 8) console.log(`  ... ${list.length - 8} more`);
}

if (JSON_OUT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(JSON_OUT, JSON.stringify(findings, null, 1));
}

if (Number.isFinite(MAX) && findings.length > MAX) {
  console.error(`\nFAIL: ${findings.length} findings > --max ${MAX}`);
  process.exit(1);
}
