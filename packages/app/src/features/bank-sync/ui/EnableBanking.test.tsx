import { generateKeyPairSync } from 'node:crypto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { BankConnection, EnableBankingConfig } from '@budgero/core/browser';
import { EnableBankingBanksCard } from './EnableBankingBanksCard';
import { EnableBankingSetupCard } from './EnableBankingSetupCard';

const mock = vi.hoisted(() => ({
  execute: vi.fn(),
  application: vi.fn(),
}));
vi.mock('@shared/runtime/runtime-provider', () => ({ useRuntime: () => ({}) }));
vi.mock('@shared/runtime/mutation-router', () => ({
  executeSpaceMutation: (...args: unknown[]) => mock.execute(...args),
}));
vi.mock('../lib/enable-banking/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/enable-banking/client')>()),
  getApplication: (...args: unknown[]) => mock.application(...args),
  listAspsps: async (_credentials: unknown, country: string) =>
    country === 'DE'
      ? [
          {
            name: 'Deutsche Bank',
            country: 'DE',
            logo: 'https://enablebanking.com/brands/DE/Deutsche_Bank/',
          },
          { name: 'N26', country: 'DE', beta: true },
        ]
      : [{ name: 'Nordea', country: 'FI', logo: 'https://enablebanking.com/brands/FI/Nordea/' }],
}));

const APP_ID = '8a1b2c3d-1111-2222-3333-444455556666';
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
}) as string;
const callback = `${window.location.origin}/bank-sync/callback`;

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  mock.execute.mockReset().mockResolvedValue({});
  mock.application.mockReset();
});

async function uploadKey(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(/Private key/i, { selector: 'input' });
  await user.upload(input, new File([pem], `${APP_ID}.pem`, { type: 'application/x-pem-file' }));
  await waitFor(() => expect(screen.getByLabelText('Application ID')).toHaveValue(APP_ID));
}

describe('Enable Banking setup', () => {
  it('verifies the key against Enable Banking before saving it into the budget', async () => {
    mock.application.mockResolvedValue({
      name: 'My Budgero',
      environment: 'PRODUCTION',
      redirect_urls: [callback],
    });
    const user = userEvent.setup();
    render(<EnableBankingSetupCard budgetId={7} />, { wrapper });
    expect(screen.getByText(callback)).toBeInTheDocument();

    await uploadKey(user);
    await user.click(screen.getByRole('button', { name: 'Verify and save' }));

    await waitFor(() => expect(mock.execute).toHaveBeenCalled());
    expect(mock.application).toHaveBeenCalledWith({ appId: APP_ID, privateKeyPem: pem });
    expect(mock.execute.mock.calls[0][1]).toMatchObject({
      op: 'bankSync.saveEnableBankingConnection',
      payload: {
        budgetId: 7,
        config: { appId: APP_ID, appName: 'My Budgero', environment: 'PRODUCTION' },
      },
    });
  });

  it("refuses an app that doesn't list Budgero's redirect URL", async () => {
    mock.application.mockResolvedValue({ name: 'Other', redirect_urls: ['https://x.test/cb'] });
    const user = userEvent.setup();
    render(<EnableBankingSetupCard budgetId={7} />, { wrapper });
    await uploadKey(user);
    await user.click(screen.getByRole('button', { name: 'Verify and save' }));

    expect(await screen.findByText(/doesn't list/)).toHaveTextContent(callback);
    expect(mock.execute).not.toHaveBeenCalled();
  });

  it('rejects files that are not private keys', async () => {
    const user = userEvent.setup();
    render(<EnableBankingSetupCard budgetId={7} />, { wrapper });
    const input = screen.getByLabelText(/Private key/i, { selector: 'input' });
    await user.upload(input, new File(['hello'], 'notes.pem'));
    expect(await screen.findByText(/isn't an RSA private key/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify and save' })).toBeDisabled();
  });
});

describe('Enable Banking banks', () => {
  const connection = (sessions: EnableBankingConfig['sessions']): BankConnection => ({
    ID: 1,
    BudgetID: 7,
    Provider: 'enablebanking',
    AccessURL: 'https://api.enablebanking.com',
    ConfigJSON: JSON.stringify({ appId: APP_ID, privateKeyPem: pem, sessions }),
    LastSyncAt: null,
    LastError: null,
    CreatedAt: '2026-10-02',
  });
  const session = (sessionId: string, name: string, days: number, accounts = 1) => ({
    sessionId,
    aspsp: { name, country: 'FI' },
    validUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
    createdAt: '2026-10-02T00:00:00Z',
    accounts: Array.from({ length: accounts }, (_, i) => ({
      uid: `${sessionId}-${i}`,
      hash: `${sessionId}-h${i}`,
      name: 'Current',
      currency: 'EUR',
    })),
  });

  it('offers a bank picker when nothing is authorized yet', async () => {
    render(<EnableBankingBanksCard connection={connection([])} />, { wrapper });
    expect(screen.getByRole('button', { name: /Continue to bank login/ })).toBeDisabled();
  });

  it('asks to reconnect only banks that expire within a week or already expired', () => {
    render(
      <EnableBankingBanksCard
        connection={connection([
          session('a', 'Nordea', 120),
          session('b', 'OP', 3),
          session('c', 'S-Pankki', -1, 0),
        ])}
      />,
      { wrapper }
    );
    expect(screen.getAllByRole('button', { name: /Reconnect/ })).toHaveLength(2);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText(/returned no accounts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add bank/ })).toBeInTheDocument();
  });

  it('searches countries and banks, and shows bank logos', async () => {
    const user = userEvent.setup();
    render(<EnableBankingBanksCard connection={connection([])} />, { wrapper });

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.type(screen.getByPlaceholderText('Search countries…'), 'germ');
    expect(screen.queryByRole('option', { name: /Finland/ })).toBeNull();
    await user.click(await screen.findByRole('option', { name: /Germany/ }));

    const bankPicker = screen.getByRole('combobox', { name: 'Bank' });
    await waitFor(() => expect(bankPicker).toBeEnabled());
    await user.click(bankPicker);
    await user.type(screen.getByPlaceholderText('Search banks…'), 'deut');
    const option = await screen.findByRole('option', { name: /Deutsche Bank/ });
    expect(option.querySelector('img')?.getAttribute('src')).toBe(
      'https://enablebanking.com/brands/DE/Deutsche_Bank/'
    );
    await user.click(option);
    expect(screen.getByRole('button', { name: /Continue to bank login/ })).toBeEnabled();
  });

  it('shows the saved logo next to a connected bank', () => {
    const withLogo = {
      ...session('a', 'Nordea', 120),
      aspsp: { name: 'Nordea', country: 'FI', logo: 'https://enablebanking.com/brands/FI/Nordea/' },
    };
    const { container } = render(<EnableBankingBanksCard connection={connection([withLogo])} />, {
      wrapper,
    });
    expect(
      container.querySelector('img[src="https://enablebanking.com/brands/FI/Nordea/"]')
    ).not.toBeNull();
  });
});
