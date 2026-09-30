import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse, json, preflight } from '../_shared/http.ts';
import { decryptAuth } from '../_shared/crypto.ts';

const STRIP_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'accept-encoding',
  'transfer-encoding',
  'cookie',
  'authorization',
]);

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { snapshot_id } = await req.json();
    if (!snapshot_id) return errorResponse('缺少 snapshot_id');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: snapshot, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .single();

    if (error || !snapshot) return errorResponse('not_found', 404);
    if (snapshot.revoked) return errorResponse('not_found', 404);
    if (new Date(snapshot.expires_at) < new Date()) return errorResponse('expired', 410);

    const originalData = snapshot.data;
    const method: string = originalData.overview.method ?? 'GET';
    const url: string = originalData.overview.url;

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      (originalData.request.headers ?? {}) as Record<string, string>,
    )) {
      if (STRIP_HEADERS.has(key.toLowerCase())) continue;
      if (value === '[已脱敏]') continue;
      headers[key] = value;
    }

    let auth: { cookies?: string | null; bearerToken?: string | null } | null = null;
    if (snapshot.encrypted_auth && snapshot.auth_iv) {
      try {
        auth = (await decryptAuth(snapshot.encrypted_auth, snapshot.auth_iv)) as typeof auth;
      } catch {
        auth = null;
      }
    }
    if (auth?.cookies) headers['Cookie'] = auth.cookies;
    if (auth?.bearerToken) headers['Authorization'] = auth.bearerToken;

    const hasBody = method !== 'GET' && method !== 'HEAD' && originalData.request.body != null;
    let body: string | undefined;
    if (hasBody) {
      const raw = originalData.request.body;
      body = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const startTime = Date.now();
    let replayResponse: Response;
    try {
      replayResponse = await fetch(url, { method, headers, body, redirect: 'follow' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('replay_logs').insert({
        snapshot_id,
        replay_status: 'failed',
        replay_response: { error: message },
      });
      return json({ status: 'failed', error: message });
    }

    const text = await replayResponse.text();
    const responseBody = parseBody(text);
    const duration = Date.now() - startTime;

    await supabase.from('replay_logs').insert({
      snapshot_id,
      replay_status: 'success',
      replay_response: { status: replayResponse.status, body: responseBody, duration },
    });

    await supabase.from('snapshots').update({ status: 'replayed' }).eq('id', snapshot_id);

    return json({
      status: 'success',
      replay: { status_code: replayResponse.status, body: responseBody, duration },
      original: {
        status_code: originalData.overview.status,
        body: originalData.response?.body ?? null,
      },
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
