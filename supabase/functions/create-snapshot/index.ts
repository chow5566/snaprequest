import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse, json, preflight } from '../_shared/http.ts';
import { encryptAuth, generateId } from '../_shared/crypto.ts';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json();
    const {
      data,
      auth,
      expires_in_hours = 24,
      max_views = 10,
      source = 'auto',
    } = body ?? {};

    if (!data?.overview?.url) return errorResponse('缺少 data.overview.url');

    const id = generateId();

    let encrypted_auth: string | null = null;
    let auth_iv: string | null = null;
    if (auth) {
      const enc = await encryptAuth(auth);
      encrypted_auth = enc.encrypted;
      auth_iv = enc.iv;
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const expiresAt = new Date(
      Date.now() + clamp(Number(expires_in_hours), 1, 720) * 3600 * 1000,
    ).toISOString();

    const { error } = await supabase.from('snapshots').insert({
      id,
      data,
      source: source === 'devtools' ? 'devtools' : 'auto',
      encrypted_auth,
      auth_iv,
      expires_at: expiresAt,
      max_views: clamp(Number(max_views), 1, 1000),
    });

    if (error) return errorResponse(error.message, 500);

    const base = (Deno.env.get('SHARE_PAGE_URL') ?? '').replace(/\/$/, '');
    // 支持三种分享页形态：
    //  - 静态站（Vercel 等）：https://host            → https://host/s/<id>
    //  - 单 HTML（含 .html）  ：.../snapshot.html      → .../snapshot.html?id=<id>
    //  - Edge Function 页面  ：.../functions/v1/share → .../share?id=<id>
    let url = '';
    if (base) {
      const useQuery = base.includes('.html') || base.includes('/functions/');
      url = useQuery ? `${base}?id=${id}` : `${base}/s/${id}`;
    }
    return json({
      id,
      url,
      expires_at: expiresAt,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
