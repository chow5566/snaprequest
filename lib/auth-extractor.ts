import type { AuthInfo } from '../types';

/**
 * 提取认证信息用于后端重放。
 * - Cookie：chrome.cookies API
 * - Bearer：请求头
 * - localStorage token：chrome.scripting 在 MAIN world 读取
 */
export async function extractAuthInfo(
  url: string,
  requestHeaders: Record<string, string>,
  tabId?: number,
): Promise<AuthInfo> {
  let cookieHeader: string | null = null;
  try {
    const cookies = await chrome.cookies.getAll({ url });
    cookieHeader =
      cookies.length > 0 ? cookies.map((c) => `${c.name}=${c.value}`).join('; ') : null;
  } catch {
    cookieHeader = null;
  }

  const bearerToken =
    requestHeaders['Authorization'] || requestHeaders['authorization'] || null;

  let storageTokens: Record<string, string> | null = null;
  const targetTabId = tabId ?? (await getActiveTabId());
  if (targetTabId != null) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        world: 'MAIN',
        func: () => {
          const tokens: Record<string, string> = {};
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)!;
              if (/token|auth|jwt|access/i.test(key)) {
                tokens[key] = localStorage.getItem(key) ?? '';
              }
            }
          } catch {
            /* ignore */
          }
          return tokens;
        },
      });
      const value = results[0]?.result as Record<string, string> | undefined;
      storageTokens = value && Object.keys(value).length > 0 ? value : null;
    } catch {
      storageTokens = null;
    }
  }

  return { cookies: cookieHeader, bearerToken, storageTokens };
}

async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}
