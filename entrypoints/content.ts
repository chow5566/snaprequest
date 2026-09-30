import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import {
  DEFAULT_FILTER,
  FILTER_CONFIG_KEY,
  type FilterConfig,
} from '../lib/filter-config';
import { AUTO_CAPTURE_KEY } from '../lib/settings';
import { shouldCapture } from '../lib/filter';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let autoCaptureEnabled = true;
    let filterConfig: FilterConfig = DEFAULT_FILTER;
    let mainWorldReady = false;

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const msg = event.data;

      if (msg?.type === 'SNAPREQUEST_MAIN_READY') {
        mainWorldReady = true;
        pushConfig();
        return;
      }

      if (msg?.type === 'SNAPREQUEST_CAPTURED') {
        handleCaptured(msg.payload);
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'AUTO_CAPTURE_CHANGED') {
        autoCaptureEnabled = message.enabled;
        pushConfig();
      }
      if (message?.type === 'FILTER_CONFIG_CHANGED') {
        filterConfig = message.config;
        pushConfig();
      }
    });

    void init();

    async function init() {
      try {
        await injectScript('/main-world.js', { keepInDom: false });
      } catch {
        /* 某些页面（chrome:// 等）无法注入，忽略 */
      }

      try {
        const stored = await chrome.storage.local.get([
          AUTO_CAPTURE_KEY,
          FILTER_CONFIG_KEY,
        ]);
        autoCaptureEnabled = stored[AUTO_CAPTURE_KEY] !== false;
        filterConfig = { ...DEFAULT_FILTER, ...(stored[FILTER_CONFIG_KEY] ?? {}) };
      } catch {
        /* 扩展上下文失效，保持默认值 */
      }

      // 主世界可能已就绪，主动下发一次
      pushConfig();
    }

    function pushConfig() {
      if (!mainWorldReady) return;
      window.postMessage(
        {
          type: 'SNAPREQUEST_CONFIG',
          enabled: autoCaptureEnabled,
          filter: filterConfig,
        },
        '*',
      );
    }

    function handleCaptured(payload: any) {
      if (!payload) return;
      if (!autoCaptureEnabled) return;

      const target = {
        url: payload.url as string,
        method: payload.method as string,
        status: payload.status as number,
        resourceType: (payload.resourceType as string) || 'xhr',
      };

      if (!shouldCapture(target, filterConfig)) {
        safeSend({ type: 'REQUEST_FILTERED' });
        return;
      }

      safeSend({ type: 'REQUEST_CAPTURED', payload });
    }

    function safeSend(message: unknown) {
      try {
        // 扩展被重新加载后 chrome.runtime 会失效，直接跳过
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage(message).catch(() => {});
      } catch {
        /* Extension context invalidated */
      }
    }
  },
});
