import type { SnapshotStatus } from '../types';

const STATUS_MAP: Record<SnapshotStatus, { label: string; className: string }> = {
  created: { label: '已创建', className: 'bg-gray-100 text-gray-700' },
  viewed: { label: '已查看', className: 'bg-blue-100 text-blue-700' },
  replayed: { label: '已重放', className: 'bg-amber-100 text-amber-700' },
  resolved: { label: '已解决', className: 'bg-emerald-100 text-emerald-700' },
  still_failing: { label: '仍报错', className: 'bg-red-100 text-red-700' },
  need_more_info: { label: '需更多信息', className: 'bg-violet-100 text-violet-700' },
};

export default function StatusBadge({ status }: { status: SnapshotStatus }) {
  const info = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}
