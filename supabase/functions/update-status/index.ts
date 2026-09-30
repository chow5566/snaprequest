import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse, json, preflight } from '../_shared/http.ts';

const ALLOWED = ['resolved', 'still_failing', 'need_more_info'];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const { snapshot_id, status, note } = await req.json();
    if (!snapshot_id) return errorResponse('缺少 snapshot_id');
    if (!ALLOWED.includes(status)) return errorResponse('invalid_status', 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const update: Record<string, unknown> = {
      status,
      resolution_note: note || null,
    };
    if (status === 'resolved') update.resolved_at = new Date().toISOString();

    const { error } = await supabase.from('snapshots').update(update).eq('id', snapshot_id);
    if (error) return errorResponse(error.message, 500);

    return json({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
