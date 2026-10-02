import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  post: vi.fn(),
  setWebsocket: vi.fn(),
  user: 'user-a',
  issued: 0,
}));
vi.mock('libcurl.js', () => ({
  libcurl: {
    load_wasm: async () => undefined,
    set_websocket: (url: string) => mock.setWebsocket(url),
    fetch: async () => new Response('{}'),
  },
}));
vi.mock('libcurl.js/libcurl.wasm?url', () => ({ default: '/libcurl.wasm' }));
vi.mock('@shared/api/api-client', () => ({
  apiClient: { post: (path: string) => mock.post(path) },
}));
vi.mock('@shared/lib/clerk-token-manager', () => ({
  getGlobalToken: async () => `h.${btoa(JSON.stringify({ sub: mock.user }))}.s`,
}));

const { openTunnel, resetTunnel } = await import('./tunnel');

beforeEach(() => {
  mock.post.mockReset().mockImplementation(async () => {
    mock.issued++;
    return {
      ticket: `ticket-${mock.issued}`,
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      client_ip: '85.76.1.2',
    };
  });
  mock.setWebsocket.mockReset();
  mock.user = 'user-a';
  resetTunnel();
});

describe('relay tunnel tickets', () => {
  it('shares one ticket between parallel requests', async () => {
    const [a, b] = await Promise.all([openTunnel(), openTunnel()]);
    expect(mock.post).toHaveBeenCalledTimes(1);
    expect(mock.setWebsocket).toHaveBeenCalledTimes(1);
    expect(a.clientIp).toBe('85.76.1.2');
    expect(b.clientIp).toBe('85.76.1.2');
    await openTunnel();
    expect(mock.post).toHaveBeenCalledTimes(1);
  });

  it('fetches a fresh ticket after a reset, e.g. when the server restarted', async () => {
    await openTunnel();
    resetTunnel();
    await openTunnel();
    expect(mock.post).toHaveBeenCalledTimes(2);
    expect(mock.setWebsocket.mock.calls.at(-1)?.[0]).toMatch(/\/bank-relay\/ticket-\d+\/$/);
  });

  it("never reuses another user's ticket", async () => {
    await openTunnel();
    mock.user = 'user-b';
    await openTunnel();
    expect(mock.post).toHaveBeenCalledTimes(2);
  });
});
