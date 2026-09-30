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

    const { data, error } = await supabase
      .from('snapshots')
      .select('status, resolution_note, revoked')
      .eq('id', snapshot_id)
      .single();

    if (error || !data) return errorResponse('not_found', 404);

    return json({
      status: data.status,
      resolution_note: data.resolution_note,
      revoked: data.revoked,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
