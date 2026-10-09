import { describe, expect, it } from 'vitest';
import { asMilli } from '@budgero/core/browser';
import {
  hasReadOnlyTransferCategory,
  transferHasOffBudgetLeg,
  transferPayeeLabel,
} from './transfer-category';

describe('hasReadOnlyTransferCategory', () => {
  it('is read-only only when both linked accounts are on-budget', () => {
    expect(
      hasReadOnlyTransferCategory({
        TransferID: 'transfer-1',
        AccountOnBudget: true,
        TransferAccountOnBudget: true,
      })
    ).toBe(true);

    expect(
      hasReadOnlyTransferCategory({
        TransferID: 'transfer-1',
        AccountOnBudget: true,
        TransferAccountOnBudget: false,
      })
    ).toBe(false);

    expect(
      hasReadOnlyTransferCategory({
        TransferID: undefined,
        AccountOnBudget: true,
        TransferAccountOnBudget: true,
      })
    ).toBe(false);
  });
});

describe('transferHasOffBudgetLeg', () => {
  it('only allows the Transfers category for transfers crossing the budget boundary', () => {
    expect(
      transferHasOffBudgetLeg({
        TransferID: 'internal',
        AccountOnBudget: true,
        TransferAccountOnBudget: true,
      })
    ).toBe(false);
    expect(
      transferHasOffBudgetLeg({
        TransferID: 'external',
        AccountOnBudget: true,
        TransferAccountOnBudget: false,
      })
    ).toBe(true);
    expect(
      transferHasOffBudgetLeg({
        TransferID: undefined,
        AccountOnBudget: true,
        TransferAccountOnBudget: false,
      })
    ).toBe(false);
  });
});

describe('transferPayeeLabel', () => {
  const leg = {
    TransferID: 'transfer-1',
    TransferAccountName: 'Savings',
    Payee: '',
    OutflowConverted: asMilli(5000),
  };

  it('points at the other account in the direction the money moved', () => {
    expect(transferPayeeLabel(leg)).toBe('→ Savings');
    expect(transferPayeeLabel({ ...leg, OutflowConverted: asMilli(0) })).toBe('← Savings');
  });

  it('leaves real payees and non-transfers alone', () => {
    expect(transferPayeeLabel({ ...leg, Payee: 'Bank' })).toBeNull();
    expect(transferPayeeLabel({ ...leg, TransferID: '' })).toBeNull();
    expect(transferPayeeLabel({ ...leg, TransferAccountName: null })).toBeNull();
  });
});
