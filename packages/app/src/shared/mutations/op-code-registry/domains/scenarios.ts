import type { ScenarioRecord } from '@budgero/core/browser';
import { S, safeCapture, type OpCodeEntry } from '../shared';

const captureScenario = (args: Record<string, unknown>) =>
  safeCapture(() => (args.id ? S().scenarios!.getScenario(args.id as string) : null));

const restoreScenario = (scenario: ScenarioRecord) => ({
  op: 'scenarios.save',
  args: {
    id: scenario.ID,
    budgetId: scenario.BudgetID,
    name: scenario.Name,
    payload: scenario.Payload,
  },
});

export const scenarioOps = {
  'scenarios.save': {
    execute: async (args) => {
      return S().scenarios!.saveScenario({
        id: args.id as string | undefined,
        budgetId: args.budgetId as number,
        name: args.name as string,
        payload: args.payload as string,
      });
    },
    invalidates: [['scenarios', '*']],
    undo: {
      capture: captureScenario,
      build: (_args, result, before) => {
        const previous = before as ScenarioRecord | null;
        if (previous) return [restoreScenario(previous)];
        const created = result as ScenarioRecord | undefined;
        return created ? [{ op: 'scenarios.delete', args: { id: created.ID } }] : [];
      },
    },
  },

  'scenarios.delete': {
    execute: async (args) => {
      S().scenarios!.deleteScenario(args.id as string);
    },
    invalidates: [['scenarios', '*']],
    undo: {
      capture: captureScenario,
      build: (_args, _result, before) => {
        const scenario = before as ScenarioRecord | null;
        return scenario ? [restoreScenario(scenario)] : [];
      },
    },
  },
} satisfies Record<string, OpCodeEntry>;
