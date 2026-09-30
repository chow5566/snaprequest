import type { SnapshotData } from '../types';

const SENSITIVE_HEADERS = [
  'cookie',
  'authorization',
  'set-cookie',
  'x-csrf-token',
  'x-xsrf-token',
];

const SENSITIVE_BODY_KEYS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apikey',
  'private_key',
];

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    result[key] = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '[已脱敏]' : value;
  }
  return result;
}

export function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactBody);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '[已脱敏]';
    } else if (value && typeof value === 'object') {
      result[key] = redactBody(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 上传前的统一脱敏：请求/响应头与请求/响应体。
 * 认证信息不会走这里——它们由 ShareDialog 单独提取并加密上传。
 */
export function redactSnapshot(snapshot: SnapshotData): SnapshotData {
  return {
    ...snapshot,
    request: {
      headers: redactHeaders(snapshot.request.headers),
      body: redactBody(snapshot.request.body),
    },
    response: {
      headers: redactHeaders(snapshot.response.headers),
      body: redactBody(snapshot.response.body),
    },
  };
}
