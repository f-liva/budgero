import { describe, it, expect } from 'vitest';
import { NodeSqlJsAdapter, ServiceManager, DatabaseAdapter } from '../src';

describe('scenarios', () => {
  it('re-inserts a deleted scenario under its original ID', async () => {
    const adapter = await NodeSqlJsAdapter.create();
    const manager = new ServiceManager();
    await manager.initialize(adapter as DatabaseAdapter);
    const services = manager.getServices();
    const budgetId = await services.budgets.createBudget({
      name: 'Plans',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: '123,456.78',
      create_default_categories: false,
    });

    const created = services.scenarios.saveScenario({ budgetId, name: 'Plan', payload: '{}' });
    services.scenarios.deleteScenario(created.ID);
    expect(services.scenarios.getScenario(created.ID)).toBeNull();

    services.scenarios.saveScenario({ id: created.ID, budgetId, name: 'Plan', payload: '{"a":1}' });
    expect(services.scenarios.getScenario(created.ID)).toMatchObject({
      ID: created.ID,
      Name: 'Plan',
      Payload: '{"a":1}',
    });
  });
});
