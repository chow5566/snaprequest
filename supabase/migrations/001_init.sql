-- SnapRequest 初始化迁移
-- 安全说明：
--   1. 两张表都开启 RLS，且不创建任何 anon 策略 —— 匿名 key（会打包进扩展和分享页）
--      无法通过 PostgREST 直接读写任何行。
--   2. 所有访问一律经过 Edge Function（使用 service_role，绕过 RLS）。
--   3. 状态同步在客户端采用轮询 get-status（因 RLS 不开放 snapshots 读取，
--      Realtime 对 anon 不会推送；如后续要启用 Realtime，请另建只含非敏感字段的
--      snapshot_status 表并单独配置策略）。

create table if not exists snapshots (
  id text primary key,
  data jsonb not null,
  encrypted_auth text,
  auth_iv text,
  status text default 'created'
    check (status in ('created','viewed','replayed','resolved','still_failing','need_more_info')),
  source text default 'auto' check (source in ('auto','devtools')),
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  max_views int default 10,
  view_count int default 0,
  revoked boolean default false,
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists idx_snapshots_expires on snapshots(expires_at);
create index if not exists idx_snapshots_status on snapshots(status);

create table if not exists replay_logs (
  id bigint primary key generated always as identity,
  snapshot_id text references snapshots(id) on delete cascade,
  replayed_at timestamptz default now(),
  replay_status text,
  replay_response jsonb
);

create index if not exists idx_replay_logs_snapshot on replay_logs(snapshot_id);

alter table snapshots enable row level security;
alter table replay_logs enable row level security;

-- 不创建策略：anon / authenticated 均无直接访问权限。
-- service_role 自动绕过 RLS。

-- 如后续需要 Realtime（需配合非敏感状态表）再启用：
-- alter publication supabase_realtime add table snapshots;
