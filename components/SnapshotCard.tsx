import type { CapturedRequest } from '../types';

function statusClass(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700';
  if (status >= 400) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-700';
}

function pretty(value: unknown): string {
  if (value == null) return '（空）';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SnapshotCard({ snapshot }: { snapshot: CapturedRequest }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{snapshot.method}</span>
        <span className={`px-2 py-1 rounded text-xs ${statusClass(snapshot.status)}`}>
          {snapshot.status || 'ERR'}
        </span>
      </div>

      <div className="text-xs text-gray-600 break-all">{snapshot.url}</div>
      <div className="text-xs text-gray-400">耗时 {snapshot.duration}ms</div>

      <details className="text-xs">
        <summary className="cursor-pointer font-medium">请求头</summary>
        <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-40">
          {pretty(snapshot.requestHeaders)}
        </pre>
      </details>

      <details className="text-xs">
        <summary className="cursor-pointer font-medium">请求参数</summary>
        <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-40">
          {pretty(snapshot.requestBody)}
        </pre>
      </details>

      <details className="text-xs">
        <summary className="cursor-pointer font-medium">响应内容</summary>
        <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-40">
          {pretty(snapshot.responseBody)}
        </pre>
      </details>

      {snapshot.consoleErrors?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-red-600">
            Console 错误（{snapshot.consoleErrors.length}）
          </summary>
          <pre className="mt-1 p-2 bg-red-50 rounded overflow-auto max-h-40">
            {snapshot.consoleErrors.map((e) => e.message).join('\n')}
          </pre>
        </details>
      )}

      {snapshot.userActions?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            用户操作（{snapshot.userActions.length}）
          </summary>
          <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-40">
            {snapshot.userActions.map((a) => `${a.type} → ${a.target}`).join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}
