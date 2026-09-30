import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthInfo, SnapshotData, UploadResult } from '../types';

export const SUPABASE_URL = (import.meta.env.WXT_PUBLIC_SUPABASE_URL as string) || '';
export const SUPABASE_ANON_KEY =
  (import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY as string) || '';
export const SHARE_PAGE_URL =
  (import.meta.env.WXT_PUBLIC_SHARE_PAGE_URL as string) || 'http://localhost:5173';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置：请在 .env 中填写 SUPABASE_URL / ANON_KEY');
  }
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export interface ShareOptions {
  expiresInHours?: number;
  maxViews?: number;
  /** fallback：当后端未配置 SHARE_PAGE_URL 时由前端拼接 */
  sharePageUrl?: string;
}

export async function shareSnapshot(
  data: SnapshotData,
  auth: AuthInfo | null,
  options: ShareOptions = {},
): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 未配置：请在 .env 中填写 SUPABASE_URL / ANON_KEY');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      data,
      auth,
      expires_in_hours: options.expiresInHours ?? 24,
      max_views: options.maxViews ?? 10,
      source: data.source || 'auto',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `分享失败（${response.status}）`);
  }

  const result = (await response.json()) as UploadResult;
  const base = options.sharePageUrl || SHARE_PAGE_URL;
  if (base && !result.url) {
    result.url = `${base.replace(/\/$/, '')}/s/${result.id}`;
  }
  return result;
}

export interface SnapshotStatusResult {
  status: import('../types').SnapshotStatus;
  resolution_note: string | null;
  revoked: boolean;
}

/** 轻量状态查询（不增加 view_count），用于扩展端轮询状态闭环 */
export async function getSnapshotStatus(
  snapshotId: string,
): Promise<SnapshotStatusResult | null> {
  if (!isSupabaseConfigured) return null;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/get-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ snapshot_id: snapshotId }),
  });
  if (!response.ok) return null;
  return (await response.json()) as SnapshotStatusResult;
}

export async function revokeSnapshot(snapshotId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/revoke-snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ snapshot_id: snapshotId }),
  });
  if (!response.ok) throw new Error(await response.text());
}
