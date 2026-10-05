import { describe, expect, it, vi } from 'vitest';
import type { BankConnection } from '@budgero/core/browser';

const mock = vi.hoisted(() => ({ start: vi.fn(), list: vi.fn() }));
vi.mock('../lib/enable-banking/client', () => ({
  createSession: vi.fn(),
  listAspsps: (...args: unknown[]) => mock.list(...args),
  startAuthorization: (...args: unknown[]) => mock.start(...args),
}));

const { beginAuthorization } = await import('./enable-banking-auth');

const connection = {
  BudgetID: 7,
  Provider: 'enablebanking',
  ConfigJSON: JSON.stringify({ appId: 'app', privateKeyPem: 'PEM', sessions: [] }),
} as BankConnection;

describe('Enable Banking authorization', () => {
  it("reconnects with the bank's own consent limit, not 180 days", async () => {
    mock.list.mockResolvedValue([
      { name: 'OP', country: 'FI', maximum_consent_validity: 90 * 86400 },
      { name: 'Nordea', country: 'FI', maximum_consent_validity: 180 * 86400 },
    ]);
    mock.start.mockResolvedValue({ url: 'https://bank.example/login' });

    const { url } = await beginAuthorization(connection, { name: 'OP', country: 'FI' });

    expect(url).toBe('https://bank.example/login');
    expect(mock.list).toHaveBeenCalledWith({ appId: 'app', privateKeyPem: 'PEM' }, 'FI');
    expect(mock.start.mock.calls[0][1].aspsp).toMatchObject({
      name: 'OP',
      maximum_consent_validity: 90 * 86400,
    });
  });

  it('skips the lookup when the bank list already gave the limit', async () => {
    mock.list.mockClear();
    mock.start.mockResolvedValue({ url: 'https://bank.example/login' });
    await beginAuthorization(connection, {
      name: 'Nordea',
      country: 'FI',
      maximum_consent_validity: 180 * 86400,
    });
    expect(mock.list).not.toHaveBeenCalled();
  });
});
