import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { consentValidUntil, pickBalance, toBankTransactions } from './client';
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
    expect(rows).toEqual([
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
    expect(days(consentValidUntil({}, now))).toBeLessThan(180);
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
