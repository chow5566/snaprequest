import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse, json, preflight } from '../_shared/http.ts';

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
      .select(
        'id, data, status, source, created_at, expires_at, view_count, max_views, revoked, encrypted_auth',
      )
      .eq('id', snapshot_id)
      .single();

    if (error || !snapshot) return errorResponse('not_found', 404);
    if (snapshot.revoked) return errorResponse('not_found', 404);
    if (new Date(snapshot.expires_at) < new Date()) return errorResponse('expired', 410);
    if (snapshot.view_count >= snapshot.max_views) {
      return errorResponse('max_views_reached', 410);
    }

    await supabase
      .from('snapshots')
      .update({ view_count: snapshot.view_count + 1, status: 'viewed' })
      .eq('id', snapshot_id);

    return json({
      id: snapshot.id,
      data: snapshot.data,
      status: snapshot.status,
      source: snapshot.source,
      created_at: snapshot.created_at,
      expires_at: snapshot.expires_at,
      view_count: snapshot.view_count + 1,
      max_views: snapshot.max_views,
      revoked: snapshot.revoked,
      has_auth: Boolean(snapshot.encrypted_auth),
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
