import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GetTransactionsByAccountRow } from '@budgero/core/browser';
import { useDuplicateShortcut } from './useDuplicateShortcut';

const mutate = vi.fn();
vi.mock('@entities/transaction/api/useTransactions', () => ({
  useDuplicateTransactions: () => ({ mutate, isPending: false }),
}));
vi.mock('@features/transactions/ui/add-transaction/add-transaction.utils', () => ({
  generateTransferId: () => 'new-transfer',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (ID: number, extra: Partial<GetTransactionsByAccountRow> = {}) =>
  ({ ID, TransferID: '', ...extra }) as GetTransactionsByAccountRow;

function Harness({ ids, rows }: { ids: number[]; rows: GetTransactionsByAccountRow[] }) {
  useDuplicateShortcut(ids, rows);
  return <input aria-label="memo" />;
}

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

describe('useDuplicateShortcut', () => {
  it('Shift+D duplicates the selected rows, with a new ID per transfer', () => {
    render(
      <Harness
        ids={[1, 2, -3]}
        rows={[row(1), row(2, { TransferID: 'tr' }), row(-3, { IsProjected: true }), row(4)]}
      />
    );
    fireEvent.keyDown(window, { key: 'D', shiftKey: true });
    expect(mutate).toHaveBeenCalledWith(
      { ids: [1, 2], transferIds: { tr: 'new-transfer' } },
      expect.any(Object)
    );
  });

  it('ignores D without Shift, and keys typed into inputs', () => {
    render(<Harness ids={[1]} rows={[row(1)]} />);
    fireEvent.keyDown(window, { key: 'd' });
    fireEvent.keyDown(screen.getByLabelText('memo'), { key: 'D', shiftKey: true });
    expect(mutate).not.toHaveBeenCalled();
  });
});
