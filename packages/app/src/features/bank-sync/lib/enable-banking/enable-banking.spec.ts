import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  cleanRemittance,
  consentValidUntil,
  EnableBankingError,
  pickBalance,
  toBankTransactions,
  type EnableBankingTransaction,
} from './client';
import { describeSimpleFINError } from '../provider';
import { appIdFromFileName, pemToPkcs8, signEnableBankingJwt } from './jwt';
import { isPublicIp, relayUrl } from './tunnel';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pkcs8 = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const pkcs1 = keys.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string;

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function verify(jwt: string) {
  const spki = keys.publicKey.export({ type: 'spki', format: 'der' });
  const key = await crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const [header, payload, signature] = jwt.split('.');
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(`${header}.${payload}`)
  );
}

describe('Enable Banking JWT', () => {
  it.each([
    ['PKCS#8', pkcs8],
    ['PKCS#1', pkcs1],
  ])('signs a verifiable RS256 token from a %s key', async (_label, pem) => {
    const now = Date.UTC(2026, 9, 2, 12);
    const jwt = await signEnableBankingJwt({ appId: ' app-123 ', privateKeyPem: pem }, now);
    const [header, payload] = jwt.split('.');
    expect(decode(header)).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'app-123' });
    expect(decode(payload)).toEqual({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });
    expect(await verify(jwt)).toBe(true);
  });

  it('rejects files that are not private keys', async () => {
    expect(() =>
      pemToPkcs8('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----')
    ).toThrow();
    await expect(signEnableBankingJwt({ appId: 'a', privateKeyPem: 'nope' })).rejects.toThrow();
  });

  it('reads the app ID from the downloaded key file name', () => {
    expect(appIdFromFileName('8A1b2c3d-1111-2222-3333-444455556666.pem')).toBe(
      '8a1b2c3d-1111-2222-3333-444455556666'
    );
    expect(appIdFromFileName('private.pem')).toBeNull();
  });
});

describe('Enable Banking transactions', () => {
  it('signs amounts by indicator and picks counterparties as payees', () => {
    const rows = toBankTransactions([
      {
        entry_reference: 'r1',
        transaction_amount: { amount: '12.50', currency: 'EUR' },
        credit_debit_indicator: 'DBIT',
        status: 'BOOK',
        booking_date: '2026-09-05',
        creditor: { name: ' Cafe  Aalto ' },
        remittance_information: ['Card purchase', '1234'],
      },
      {
        entry_reference: 'r2',
        transaction_amount: { amount: '2500.00', currency: 'EUR' },
        credit_debit_indicator: 'CRDT',
        status: 'BOOK',
        value_date: '2026-09-06',
        debtor: { name: 'Employer Oy' },
      },
      {
        transaction_amount: { amount: '3.00', currency: 'EUR' },
        credit_debit_indicator: 'DBIT',
        status: 'PDNG',
        transaction_date: '2026-09-07',
        remittance_information: ['Pending kiosk'],
      },
    ]);
    expect(rows).toMatchObject([
      {
        id: 'r1',
        date: '2026-09-05',
        amount: -12500,
        payee: 'Cafe Aalto',
        memo: 'Card purchase 1234',
        pending: false,
      },
      {
        id: 'r2',
        date: '2026-09-06',
        amount: 2500000,
        payee: 'Employer Oy',
        memo: '',
        pending: false,
      },
      expect.objectContaining({ amount: -3000, payee: 'Pending kiosk', pending: true }),
    ]);
  });

  it('falls back to the other party when a bank names only one side', () => {
    const [row] = toBankTransactions([
      {
        entry_reference: 'jlqfa',
        transaction_amount: { amount: '2.34', currency: 'EUR' },
        credit_debit_indicator: 'CRDT',
        status: 'BOOK',
        booking_date: '2026-10-01',
        creditor: { name: 'Oliver Hämäläinen' },
        debtor: null,
        remittance_information: ['Oliver Hämäläinen-CRDT-2.34-jlqfa'],
      },
    ]);
    expect(row).toMatchObject({
      amount: 2340,
      payee: 'Oliver Hämäläinen',
      memo: 'Oliver Hämäläinen-CRDT-2.34-jlqfa',
    });
  });

  it('never uses transaction_id, which can change between fetches', () => {
    const row = {
      transaction_id: 'session-scoped-1',
      transaction_amount: { amount: '9.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT' as const,
      status: 'BOOK',
      booking_date: '2026-09-05',
      creditor: { name: 'Shop' },
    };
    const [first] = toBankTransactions([row]);
    const [again] = toBankTransactions([{ ...row, transaction_id: 'session-scoped-2' }]);
    expect(first.id).toMatch(/^fp:/);
    expect(again.id).toBe(first.id);
  });

  it('gives reference-less twins distinct, repeatable IDs', () => {
    const coffee = {
      transaction_amount: { amount: '4.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT' as const,
      status: 'BOOK',
      booking_date: '2026-09-05',
      creditor: { name: 'Coffee' },
    };
    const first = toBankTransactions([coffee, coffee]).map((row) => row.id);
    const again = toBankTransactions([coffee, coffee]).map((row) => row.id);
    expect(first[0]).not.toBe(first[1]);
    expect(again).toEqual(first);
  });

  it('prefers the booked balance, interim before closing', () => {
    const balance = (type: string, amount: string) => ({
      balance_type: type,
      balance_amount: { amount, currency: 'EUR' },
    });
    expect(pickBalance([balance('ITAV', '5'), balance('CLBD', '4')])?.balance_amount.amount).toBe(
      '4'
    );
    expect(pickBalance([balance('CLBD', '4'), balance('ITBD', '3')])?.balance_type).toBe('ITBD');
    expect(pickBalance([balance('XYZ', '1')])?.balance_type).toBe('XYZ');
    expect(pickBalance([])).toBeNull();
  });

  it('asks for the longest consent the bank allows, capped at 180 days', () => {
    const now = Date.UTC(2026, 0, 1);
    const days = (iso: string) => (new Date(iso).getTime() - now) / 86_400_000;
    expect(days(consentValidUntil({ maximum_consent_validity: 90 * 86400 }, now))).toBeCloseTo(
      90,
      0
    );
    expect(days(consentValidUntil({ maximum_consent_validity: 400 * 86400 }, now))).toBeCloseTo(
      180,
      0
    );
    // No stated limit: 90 days, which every bank accepts.
    expect(days(consentValidUntil({}, now))).toBeCloseTo(90, 0);
  });
});

describe('relay tunnel', () => {
  it('builds the relay WebSocket URL with the ticket in the path', () => {
    expect(relayUrl('abc.123.sig', { href: 'https://my.budgero.app/settings/bank-sync' })).toBe(
      'wss://my.budgero.app/api/v1/bank-relay/abc.123.sig/'
    );
    expect(relayUrl('t', { href: 'http://localhost:5173/x?y=1' })).toBe(
      'ws://localhost:5173/api/v1/bank-relay/t/'
    );
  });

  it('only forwards public IPs as the PSU address', () => {
    expect(isPublicIp('85.76.1.2')).toBe(true);
    expect(isPublicIp('2a00:1450::1')).toBe(true);
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '172.20.0.1', '::1', 'fd00::1', '']) {
      expect(isPublicIp(ip)).toBe(false);
    }
  });
});

describe('lessons from Actual Budget', () => {
  const base: EnableBankingTransaction = {
    entry_reference: 'r',
    transaction_amount: { amount: '10.00', currency: 'EUR' },
    credit_debit_indicator: 'DBIT',
    status: 'BOOK',
    booking_date: '2026-09-05',
  };

  it('strips SEPA structured prefixes but keeps merchant tokens', () => {
    expect(cleanRemittance(['SVWZ+Rechnung 42', 'EREF+INV-7'])).toBe('Rechnung 42 INV-7');
    expect(cleanRemittance(['BMW+ Service'])).toBe('BMW+ Service');
    const [row] = toBankTransactions([{ ...base, remittance_information: ['SVWZ+Miete Oktober'] }]);
    expect(row.payee).toBe('Miete Oktober');
  });

  it('skips rows without a usable date or amount instead of failing the account', () => {
    const rows = toBankTransactions([
      { ...base, entry_reference: 'no-date', booking_date: null },
      {
        ...base,
        entry_reference: 'bad-amount',
        transaction_amount: { amount: 'n/a', currency: 'EUR' },
      },
      { ...base, entry_reference: 'ok' },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['ok']);
  });

  it('never turns cancelled, rejected or scheduled rows into transactions', () => {
    const rows = toBankTransactions(
      ['BOOK', 'PDNG', 'HOLD', 'CNCL', 'RJCT', 'SCHD', 'INFO'].map((status) => ({
        ...base,
        entry_reference: status,
        status,
      }))
    );
    expect(rows.map((row) => [row.id, row.pending])).toEqual([
      ['BOOK', false],
      ['PDNG', true],
      ['HOLD', true],
    ]);
  });

  it('keeps every raw field for the per-account mapping', () => {
    const [row] = toBankTransactions([
      {
        ...base,
        value_date: '2026-09-06',
        transaction_date: '2026-09-04',
        creditor: { name: 'SHOP' },
        remittance_information: ['Card 1234'],
      },
    ]);
    expect(row.fields).toEqual({
      counterparty: 'SHOP',
      description: 'Card 1234',
      bookingDate: '2026-09-05',
      transactionDate: '2026-09-04',
      valueDate: '2026-09-06',
    });
  });

  it('treats any 401/403 or session error as needing a new bank login', () => {
    expect(new EnableBankingError('x', 401).needsReauthorization).toBe(true);
    expect(new EnableBankingError('x', 403).needsReauthorization).toBe(true);
    expect(new EnableBankingError('x', 400, 'closed_session').needsReauthorization).toBe(true);
    expect(new EnableBankingError('Session has expired', 422).needsReauthorization).toBe(true);
    expect(new EnableBankingError('Bad date', 422, 'WRONG_REQUEST').needsReauthorization).toBe(
      false
    );
    expect(new EnableBankingError('x', 429).rateLimited).toBe(true);
  });

  it('explains SimpleFIN connections that need attention', () => {
    expect(describeSimpleFINError('Connection to Chase may need attention')).toMatch(
      /^Chase needs attention in SimpleFIN Bridge/
    );
    expect(describeSimpleFINError('Something else')).toBe('Something else');
  });
});
