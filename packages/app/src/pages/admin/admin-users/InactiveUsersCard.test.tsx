import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InactiveUser } from '@features/admin/model/admin-users';
import { InactiveUsersCard } from './InactiveUsersCard';

const mock = vi.hoisted(() => ({ list: vi.fn(), purge: vi.fn() }));
vi.mock('@features/admin/api/useAdminApi', () => {
  const api = {
    getInactiveUsers: (days: number) => mock.list(days),
    purgeUsers: (ids: string[], clerk: boolean) => mock.purge(ids, clerk),
  };
  return { useAdminApi: () => api };
});

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.scrollIntoView = () => {};
});

const user = (id: string, extra: Partial<InactiveUser> = {}): InactiveUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  subscription_status: 'trialing',
  has_subscription: false,
  is_founding_member: false,
  is_blocked: false,
  owned_spaces: 1,
  shared_spaces: 0,
  stored_bytes: 2048,
  last_active_at: '2025-01-01T00:00:00Z',
  ...extra,
});

describe('inactive users', () => {
  beforeEach(() => {
    mock.list.mockReset().mockResolvedValue({
      days: 180,
      cutoff: '2026-04-08T00:00:00Z',
      clerk_checked: true,
      users: [
        user('dormant', { in_clerk: false }),
        user('payer', { protected_reason: 'paying subscriber' }),
      ],
    });
    mock.purge.mockReset().mockResolvedValue({
      results: [{ user_id: 'dormant', status: 'purged' }],
    });
  });

  it('keeps protected users unselectable and purges only after typing DELETE', async () => {
    const onPurged = vi.fn();
    const u = userEvent.setup();
    render(<InactiveUsersCard onPurged={onPurged} />);

    expect(await screen.findByText('dormant@example.com')).toBeInTheDocument();
    expect(mock.list).toHaveBeenCalledWith(180);
    expect(screen.getByText('Not in Clerk')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select payer@example.com' })).toBeDisabled();

    await u.click(screen.getByRole('checkbox', { name: 'Select all deletable users' }));
    await u.click(screen.getByRole('button', { name: /Delete permanently \(1\)/ }));

    const confirm = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();
    await u.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await u.click(confirm);

    await waitFor(() => expect(mock.purge).toHaveBeenCalledWith(['dormant'], true));
    await waitFor(() => expect(onPurged).toHaveBeenCalled());
  });
});
