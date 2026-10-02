import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import type { BankLink } from '@budgero/core/browser';
import { BankFeedSettingsDialog } from './BankFeedSettingsDialog';

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@shared/runtime/runtime-provider', () => ({ useRuntime: () => ({}) }));
vi.mock('@shared/runtime/mutation-router', () => ({
  executeSpaceMutation: (...args: unknown[]) => mock.execute(...args),
}));

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.scrollIntoView = () => {};
});

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const link = {
  BudgetID: 7,
  AccountID: 3,
  Provider: 'enablebanking',
  ExternalName: 'Current',
  SettingsJSON: '{}',
} as BankLink;

describe('bank feed settings', () => {
  it('saves the chosen settings for the linked account', async () => {
    mock.execute.mockReset().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BankFeedSettingsDialog
        link={link}
        provider="enablebanking"
        accountName="Käyttötili"
        onOpenChange={onOpenChange}
      />,
      { wrapper }
    );

    await user.click(screen.getByRole('switch', { name: 'Import pending transactions' }));
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(await screen.findByRole('option', { name: /Value date/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mock.execute).toHaveBeenCalled());
    expect(mock.execute.mock.calls[0][1]).toMatchObject({
      op: 'bankSync.updateLinkSettings',
      payload: {
        budgetId: 7,
        accountId: 3,
        settings: {
          importPending: true,
          date: 'value',
          payee: 'auto',
          memo: 'auto',
          tidyPayees: true,
        },
      },
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('offers the value date only for Enable Banking', async () => {
    const user = userEvent.setup();
    render(
      <BankFeedSettingsDialog
        link={link}
        provider="simplefin"
        accountName="Checking"
        onOpenChange={vi.fn()}
      />,
      { wrapper }
    );
    await user.click(screen.getAllByRole('combobox')[0]);
    expect(await screen.findByRole('option', { name: /Purchase date/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Value date/ })).toBeNull();
  });
});
