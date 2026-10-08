import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeMutationOp, getUndoSpec } from '@shared/mutations/op-code-registry';

const goalMocks = vi.hoisted(() => ({
  getAllGoals: vi.fn(),
  getGoalsByCategoryIDs: vi.fn(),
  deleteGoal: vi.fn(),
}));
const categoryMocks = vi.hoisted(() => ({
  getAllCategoryGroups: vi.fn(),
  getCategoryGroup: vi.fn(),
  getCategoriesByGroup: vi.fn(),
}));

vi.mock('@shared/runtime/global', () => ({
  getRuntime: () => ({
    services: () => ({ goals: goalMocks, categories: categoryMocks }),
    mutationsRouter: () => ({ execute: vi.fn() }),
  }),
}));

const goal = {
  ID: 7,
  Type: 'target_date',
  Purpose: 'savings',
  CategoryID: 30,
  Target: 120_000,
  StartDate: '2026-01-01',
  TargetDate: '2026-12-01',
  Recurring: 0,
  CycleMonths: null,
};
const goalArgs = {
  goalType: 'target_date',
  categoryId: 30,
  target: 120_000,
  startDate: '2026-01-01',
  endDate: '2026-12-01',
  purpose: 'savings',
  recurring: false,
  cycleMonths: null,
};

async function undoFor(op: string, args: Record<string, unknown>, result?: unknown) {
  const spec = getUndoSpec(op)!;
  const before = spec.capture ? await spec.capture(args) : undefined;
  return spec.build(args, result, before);
}

describe('goal and category-order undo', () => {
  beforeEach(() => {
    goalMocks.getAllGoals.mockReset().mockReturnValue([goal]);
    goalMocks.getGoalsByCategoryIDs.mockReset().mockReturnValue([goal]);
    goalMocks.deleteGoal.mockReset();
  });

  it('deletes a created goal by category', async () => {
    expect(await undoFor('goals.create', goalArgs, 7)).toEqual([
      { op: 'goals.delete', args: { categoryId: 30 } },
    ]);
  });

  it('restores the previous goal settings', async () => {
    expect(await undoFor('goals.update', { ...goalArgs, target: 99 })).toEqual([
      { op: 'goals.update', args: goalArgs },
    ]);
  });

  it('recreates a deleted goal, and redo deletes the recreated one by category', async () => {
    expect(await undoFor('goals.delete', { goalId: 7, categoryId: 30 })).toEqual([
      { op: 'goals.create', args: goalArgs },
    ]);

    goalMocks.getGoalsByCategoryIDs.mockReturnValue([{ ...goal, ID: 8 }]);
    await executeMutationOp('goals.delete', { goalId: 7, categoryId: 30 });
    expect(goalMocks.deleteGoal).toHaveBeenCalledWith(8);
  });

  it('restores group and category order', async () => {
    categoryMocks.getAllCategoryGroups.mockReturnValue([{ ID: 1 }, { ID: 2 }]);
    expect(
      await undoFor('categoryGroups.reorder', { budgetId: 1, orderedGroupIds: [2, 1] })
    ).toEqual([{ op: 'categoryGroups.reorder', args: { budgetId: 1, orderedGroupIds: [1, 2] } }]);

    categoryMocks.getCategoryGroup.mockReturnValue({ ID: 2, BudgetID: 1 });
    categoryMocks.getCategoriesByGroup.mockReturnValue([{ ID: 5 }, { ID: 6 }]);
    expect(
      await undoFor('categories.reorder', { categoryGroupId: 2, orderedCategoryIds: [6, 5] })
    ).toEqual([
      { op: 'categories.reorder', args: { categoryGroupId: 2, orderedCategoryIds: [5, 6] } },
    ]);
  });
});
