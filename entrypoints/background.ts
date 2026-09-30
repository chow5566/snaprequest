import { defineBackground } from 'wxt/utils/define-background';
import { addRequest, cleanupOldRequests } from '../lib/db';
import type { CapturedRequest } from '../types';

const BUFFER_MS = 120_000;
const CLEANUP_THROTTLE_MS = 10_000;

export default defineBackground(() => {
  const filterStats = { captured: 0, filtered: 0, lastResetAt: Date.now() };
  let lastCleanupAt = 0;

  // 点击工具栏图标直接打开侧边栏
  chrome.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: true })
    .catch(() => {});

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'REQUEST_CAPTURED') {
      const request: CapturedRequest = {
        ...(message.payload as CapturedRequest),
        tabId: sender.tab?.id ?? -1,
        consoleErrors: [],
        userActions: [],
      };
      filterStats.captured++;
      void persist(request);
      return false;
    }

    if (message?.type === 'REQUEST_FILTERED') {
      filterStats.filtered++;
      return false;
    }

    if (message?.type === 'GET_FILTER_STATS') {
      sendResponse(filterStats);
      return true;
    }

    if (message?.type === 'CLEAR_REQUESTS') {
      void import('../lib/db').then(({ clearRequests }) =>
        clearRequests().then(() => sendResponse({ ok: true })),
      );
      return true;
    }

    return false;
  });

  async function persist(request: CapturedRequest) {
    try {
      await addRequest(request);
      const now = Date.now();
      if (now - lastCleanupAt > CLEANUP_THROTTLE_MS) {
        lastCleanupAt = now;
        await cleanupOldRequests(BUFFER_MS);
      }
    } catch (error) {
      console.error('[SnapRequest] 写入缓冲区失败', error);
    }
  }
});
