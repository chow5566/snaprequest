import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import RequestRow from './components/RequestRow';
import ShareDialog from '../../components/ShareDialog';
import StatusBadge from '../../components/StatusBadge';
import { harToSnapshot } from './lib/har-to-snapshot';
import type { SnapshotData, SnapshotStatus, UploadResult } from '../../types';
import './style.css';

type FilterKind = 'failed' | 'xhr' | 'all';
type DevRequest = chrome.devtools.network.Request;

function toCurl(request: DevRequest): string {
  const lines = [`curl -X ${request.request.method}`, `  '${request.request.url}'`];
  for (const header of request.request.headers) {
    if (header.name.startsWith(':')) continue;
    lines.push(`  -H '${header.name}: ${header.value}'`);
  }
  if (request.request.postData?.text) {
    lines.push(`  --data-raw '${request.request.postData.text.replace(/'/g, `'\\''`)}'`);
  }
  return lines.join(' \\\n');
}

function Panel() {
  const [requests, setRequests] = useState<DevRequest[]>([]);
  const [filter, setFilter] = useState<FilterKind>('failed');
  const [sharing, setSharing] = useState<SnapshotData | null>(null);
  const [shared, setShared] = useState<{ result: UploadResult; status: SnapshotStatus } | null>(
    null,
  );
  const [menu, setMenu] = useState<{ x: number; y: number; request: DevRequest } | null>(null);

  useEffect(() => {
    const listener = (request: DevRequest) => {
      setRequests((prev) => [...prev, request]);
    };
    chrome.devtools.network.onRequestFinished.addListener(listener);
    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  const filtered = requests.filter((r) => {
    const resourceType = (r as unknown as { _resourceType?: string })._resourceType;
    if (filter === 'failed') return r.response.status >= 400;
    if (filter === 'xhr') return resourceType === 'xhr' || resourceType === 'fetch';
    return true;
  });

  async function handleShare(request: DevRequest) {
    setSharing(await harToSnapshot(request));
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="p-3 border-b flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterKind)}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="failed">仅失败请求</option>
          <option value="xhr">仅 XHR/Fetch</option>
          <option value="all">全部请求</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} 条请求</span>
        <span className="text-xs text-gray-400">提示：右键请求可分享</span>
        <button
          className="ml-auto text-xs text-gray-500 hover:text-gray-800"
          onClick={() => setRequests([])}
        >
          清空
        </button>
      </div>

      {shared && (
        <div className="p-2 border-b bg-emerald-50 text-xs flex items-center gap-2">
          <StatusBadge status={shared.status} />
          <code className="break-all text-gray-700">{shared.result.url}</code>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            暂无匹配请求。切换到「全部请求」或触发请求后，这里会自动显示。
          </div>
        ) : (
          filtered.map((req, index) => (
            <RequestRow
              key={index}
              request={req}
              onShare={() => handleShare(req)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, request: req });
              }}
            />
          ))
        )}
      </div>

      {menu && (
        <div
          className="fixed z-50 bg-white border rounded shadow-lg text-xs py-1 w-40"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="block w-full text-left px-3 py-1.5 hover:bg-blue-50"
            onClick={() => {
              handleShare(menu.request);
              setMenu(null);
            }}
          >
            分享给后端
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 hover:bg-gray-50"
            onClick={() => {
              navigator.clipboard.writeText(menu.request.request.url).catch(() => {});
              setMenu(null);
            }}
          >
            复制 URL
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 hover:bg-gray-50"
            onClick={() => {
              navigator.clipboard.writeText(toCurl(menu.request)).catch(() => {});
              setMenu(null);
            }}
          >
            复制为 cURL
          </button>
        </div>
      )}

      {sharing && (
        <ShareDialog
          snapshot={sharing}
          tabId={chrome.devtools.inspectedWindow.tabId}
          onShared={(result) => setShared({ result, status: 'created' })}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
);
