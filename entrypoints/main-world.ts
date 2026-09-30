import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { Vista, interceptFetch, interceptXHR, type FetchContext } from '@rxliuli/vista';
import { shouldCapture } from '../lib/filter';
import { DEFAULT_FILTER, type FilterConfig } from '../lib/filter-config';

const MAX_BODY = 256 * 1024;

export default defineUnlistedScript(() => {
  let enabled = false;
  let filter: FilterConfig = DEFAULT_FILTER;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (msg?.type === 'SNAPREQUEST_CONFIG') {
      if (typeof msg.enabled === 'boolean') enabled = msg.enabled;
      if (msg.filter) filter = msg.filter as FilterConfig;
    }
  });

  // 告诉 content script 主世界已就绪，请下发开关与过滤配置
  window.postMessage({ type: 'SNAPREQUEST_MAIN_READY' }, '*');

  const vista = new Vista<FetchContext>([interceptFetch, interceptXHR]);

  vista
    .use(async (c, next) => {
      const startTime = Date.now();
      // 必须在 next() 之前 clone 请求体，否则会被真实请求消费掉
      const reqClone = enabled ? safeClone(c.req) : null;

      await next();

      if (!enabled) return;
      const res = c.res;
      if (!res) return;

      const meta = {
        url: c.req.url,
        method: c.req.method,
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - startTime,
        requestHeaders: headersToObject(c.req.headers),
        responseHeaders: headersToObject(res.headers),
        resourceType: inferResourceType(c.req.url),
        timestamp: Date.now(),
      };

      // 主世界做一次廉价预筛，避免为无关请求读取 body
      if (
        !shouldCapture(
          {
            url: meta.url,
            method: meta.method,
            status: meta.status,
            resourceType: meta.resourceType,
          },
          filter,
        )
      ) {
        return;
      }

      const resClone = safeClone(res);
      void postCaptured(meta, reqClone, resClone);
    })
    .intercept();

  async function postCaptured(
    meta: Record<string, unknown>,
    reqClone: Request | null,
    resClone: Response | null,
  ) {
    const method = String(meta.method);
    const requestBody =
      reqClone && method !== 'GET' && method !== 'HEAD' ? await readBody(reqClone) : null;
    const responseBody = resClone ? await readBody(resClone) : null;

    window.postMessage(
      {
        type: 'SNAPREQUEST_CAPTURED',
        payload: { ...meta, requestBody, responseBody },
      },
      '*',
    );
  }

  function safeClone<T extends Request | Response>(value: T): T | null {
    try {
      return value.clone() as T;
    } catch {
      return null;
    }
  }

  async function readBody(message: Request | Response): Promise<unknown> {
    try {
      const text = await message.clone().text();
      if (text.length > MAX_BODY) {
        return `${text.slice(0, MAX_BODY)}\n...[truncated ${text.length - MAX_BODY} chars]`;
      }
      const contentType = (message.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('json')) {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
      return text;
    } catch {
      return null;
    }
  }

  function headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  function inferResourceType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'script';
    if (lower.endsWith('.css')) return 'stylesheet';
    if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(lower)) return 'image';
    if (/\.(woff2?|ttf|otf)$/i.test(lower)) return 'font';
    return 'xhr';
  }
});
