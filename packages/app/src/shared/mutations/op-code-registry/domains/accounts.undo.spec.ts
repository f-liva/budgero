import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUndoSpec } from '@shared/mutations/op-code-registry';

const accountMocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  listAccounts: vi.fn(),
}));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({ accounts: accountMocks }),
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

const checking = {
  ID: 4,
  Name: 'Checking',
  Type: 'checking',
  Currency: 'EUR',
  Metadata: '{"institution":"Bank"}',
  OnBudget: 1,
  Archived: false,
};

async function undoFor(op: string, args: Record<string, unknown>, result?: unknown) {
  const spec = getUndoSpec(op)!;
  const before = spec.capture ? await spec.capture(args) : undefined;
  return spec.build(args, result, before);
}

describe('account undo', () => {
  beforeEach(() => {
    accountMocks.getAccount.mockReset().mockReturnValue(checking);
    accountMocks.listAccounts.mockReset().mockReturnValue([{ ID: 4 }, { ID: 2 }, { ID: 9 }]);
  });

  it('deletes a newly created account', async () => {
    expect(await undoFor('accounts.create', { name: 'New' }, { ID: 12 })).toEqual([
      { op: 'accounts.delete', args: { id: 12 } },
    ]);
  });

  it('restores the previous name, type, metadata and on-budget flag', async () => {
    const args = { id: 4, name: 'Main', type: 'savings', currency: 'EUR', onBudget: false };
    expect(await undoFor('accounts.update', args)).toEqual([
      {
        op: 'accounts.update',
        args: {
          id: 4,
          name: 'Checking',
          type: 'checking',
          currency: 'EUR',
          metadata: { institution: 'Bank' },
          onBudget: true,
        },
      },
    ]);
  });

  it('skips undo for a currency change', async () => {
    expect(await undoFor('accounts.update', { id: 4, name: 'Checking', currency: 'USD' })).toEqual(
      []
    );
  });

  it('restores the previous account order', async () => {
    expect(
      await undoFor('accounts.reorder', { budgetId: 1, orderedAccountIds: [9, 4, 2] })
    ).toEqual([{ op: 'accounts.reorder', args: { budgetId: 1, orderedAccountIds: [4, 2, 9] } }]);
  });

  it('flips archive back only when it changed', async () => {
    expect(await undoFor('accounts.setArchived', { id: 4, archived: true })).toEqual([
      { op: 'accounts.setArchived', args: { id: 4, archived: false } },
    ]);
    expect(await undoFor('accounts.setArchived', { id: 4, archived: false })).toEqual([]);
  });
});
