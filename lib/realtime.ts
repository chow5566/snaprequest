import { getSupabaseClient } from './supabase';
import type { SnapshotStatus } from '../types';

export type StatusListener = (status: SnapshotStatus, note?: string | null) => void;

/**
 * 订阅单个快照的状态变更（Supabase Realtime）。
 * 返回取消订阅函数。
 */
export function subscribeToSnapshot(snapshotId: string, onUpdate: StatusListener): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`snapshot-${snapshotId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'snapshots',
        filter: `id=eq.${snapshotId}`,
      },
      (payload) => {
        const next = payload.new as { status: SnapshotStatus; resolution_note?: string | null };
        onUpdate(next.status, next.resolution_note ?? null);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
