import { useEffect, useRef, useState } from 'react';
import type { CapturedRequest, SnapshotStatus, UploadResult } from '../../types';
import { capturedToSnapshot } from '../../types';
import { getRecentRequests } from '../../lib/db';
import { isSupabaseConfigured, getSnapshotStatus } from '../../lib/supabase';
import SnapshotCard from '../../components/SnapshotCard';
import ShareDialog from '../../components/ShareDialog';
import StatusBadge from '../../components/StatusBadge';
import AutoCaptureToggle from './components/AutoCaptureToggle';
import FilterSummary from './components/FilterSummary';
import FilterSettings from './components/FilterSettings';

const POLL_MS = 5000;
type ViewMode = 'failed' | 'all';

function statusClass(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700';
  if (status >= 400) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
}

export default function App() {
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('failed');
  const [showShare, setShowShare] = useState(false);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [lastShare, setLastShare] = useState<UploadResult | null>(null);
  const [shareStatus, setShareStatus] = useState<SnapshotStatus>('created');
  const [shareNote, setShareNote] = useState<string | null>(null);
  const shareIdRef = useRef<string | null>(null);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [viewMode]);

  useEffect(() => {
    if (!lastShare || !isSupabaseConfigured) return;
    shareIdRef.current = lastShare.id;
    const timer = setInterval(async () => {
      if (shareIdRef.current !== lastShare.id) return;
      try {
        const result = await getSnapshotStatus(lastShare.id);
        if (!result) return;
        setShareStatus(result.status);
        setShareNote(result.resolution_note ?? null);
      } catch {
        /* 忽略轮询错误 */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [lastShare]);

  async function load() {
    const all = await getRecentRequests(50);
    const list = viewMode === 'failed' ? all.filter((r) => r.status >= 400 || r.status === 0) : all;
    setRequests(list);
    setSelectedId((prev) => {
      if (prev != null && list.some((r) => r.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }

  const selected = requests.find((r) => r.id === selectedId) ?? requests[0] ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <AutoCaptureToggle />
      <FilterSummary onOpenSettings={() => setShowFilterSettings(true)} />

      <div className="flex items-center gap-2 px-3 py-2 border-b bg-white text-xs">
        <div className="inline-flex rounded border overflow-hidden">
          <button
            className={`px-2 py-1 ${viewMode === 'failed' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setViewMode('failed')}
          >
            失败请求
          </button>
          <button
            className={`px-2 py-1 ${viewMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setViewMode('all')}
          >
            全部请求
          </button>
        </div>
        <span className="text-gray-400">共 {requests.length} 条（近 2 分钟）</span>
      </div>

      <div className="flex-1 overflow-auto">
        {requests.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">
            {viewMode === 'failed'
              ? '暂无失败请求。触发接口报错后，这里会自动显示。'
              : '暂无捕获记录。确认顶部「自动捕获」已开启，并在页面上触发请求。'}
          </div>
        ) : (
          <div className="divide-y bg-white">
            {requests.slice(0, 20).map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedId(req.id ?? null)}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                  selected?.id === req.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{req.method}</span>
                  <span className={`px-1.5 py-0.5 rounded ${statusClass(req.status)}`}>
                    {req.status || 'ERR'}
                  </span>
                  <span className="text-gray-400 ml-auto">{req.duration}ms</span>
                </div>
                <div className="text-gray-600 truncate">{req.url}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="border-t bg-gray-50 max-h-[55%] overflow-auto p-3 space-y-3">
          {lastShare && (
            <div className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">最近分享</span>
                <StatusBadge status={shareStatus} />
              </div>
              <code className="block bg-gray-50 p-2 rounded text-xs break-all">
                {lastShare.url}
              </code>
              {shareNote && <div className="text-xs text-gray-600">备注：{shareNote}</div>}
            </div>
          )}

          <SnapshotCard snapshot={selected} />
          <button
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            onClick={() => setShowShare(true)}
          >
            分享给后端
          </button>
        </div>
      )}

      {showShare && selected && (
        <ShareDialog
          snapshot={capturedToSnapshot(selected)}
          onShared={(result) => {
            setLastShare(result);
            setShareStatus('created');
            setShareNote(null);
          }}
          onClose={() => setShowShare(false)}
        />
      )}

      {showFilterSettings && (
        <FilterSettings onClose={() => setShowFilterSettings(false)} />
      )}
    </div>
  );
}
