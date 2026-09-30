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

    const { error } = await supabase
      .from('snapshots')
      .update({ revoked: true, encrypted_auth: null, auth_iv: null })
      .eq('id', snapshot_id);

    if (error) return errorResponse(error.message, 500);

    return json({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }
});
