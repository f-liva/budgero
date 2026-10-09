import { describe, expect, it } from 'vitest';
import { DatabaseAdapter, NodeSqlJsAdapter, ServiceManager } from '../src';

describe('user_meta HideZeroAmounts preference', () => {
  it('defaults to off and round-trips through the service', async () => {
    const adapter = await NodeSqlJsAdapter.create();
    const serviceManager = new ServiceManager();
    await serviceManager.initialize(adapter as DatabaseAdapter);
    const { userMeta } = serviceManager.getServices();

    expect(userMeta.getHideZeroAmounts()).toBe(false);
    userMeta.setHideZeroAmounts(true);
    expect(userMeta.getHideZeroAmounts()).toBe(true);
    userMeta.setHideZeroAmounts(false);
    expect(userMeta.getHideZeroAmounts()).toBe(false);
  });
});
