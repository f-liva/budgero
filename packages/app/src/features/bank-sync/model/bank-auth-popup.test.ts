import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthorizationCancelled,
  relayBankCallbackFromPopup,
  waitForBankCallback,
} from './bank-auth-popup';

const PENDING_KEY = 'budgero.bankSync.pendingAuth';
const popup = () => ({ closed: false, close: vi.fn() }) as unknown as Window;

function pending(mode: 'popup' | 'redirect', state = 's1') {
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      state,
      budgetId: 1,
      aspsp: { name: 'OP', country: 'FI' },
      mode,
      createdAt: Date.now(),
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.pushState(null, '', '/bank-sync/callback?code=abc&state=s1');
  vi.spyOn(window, 'close').mockImplementation(() => undefined);
});
afterEach(() => {
  window.history.pushState(null, '', '/');
  vi.restoreAllMocks();
});

describe('bank login popup', () => {
  it("hands the bank's answer to the window that opened the popup", async () => {
    pending('popup');
    const answer = waitForBankCallback('s1', popup());
    expect(relayBankCallbackFromPopup()).toBe(true);
    const params = await answer;
    expect(params.get('code')).toBe('abc');
    expect(params.get('state')).toBe('s1');
  });

  it('leaves redirect logins and stray callbacks to the normal callback page', () => {
    pending('redirect');
    expect(relayBankCallbackFromPopup()).toBe(false);
    pending('popup', 'someone-else');
    expect(relayBankCallbackFromPopup()).toBe(false);
    window.history.pushState(null, '', '/settings/bank-sync?state=s1');
    pending('popup');
    expect(relayBankCallbackFromPopup()).toBe(false);
  });

  it('stops waiting when the user cancels', async () => {
    const controller = new AbortController();
    const window = popup();
    const answer = waitForBankCallback('s1', window, controller.signal);
    controller.abort();
    await expect(answer).rejects.toBeInstanceOf(AuthorizationCancelled);
    expect(window.close).toHaveBeenCalled();
  });

  it('ignores answers meant for another login', async () => {
    pending('popup', 'other');
    window.history.pushState(null, '', '/bank-sync/callback?code=x&state=other');
    const controller = new AbortController();
    const answer = waitForBankCallback('s1', popup(), controller.signal);
    relayBankCallbackFromPopup();
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(answer).rejects.toBeInstanceOf(AuthorizationCancelled);
  });
});
