import { useState } from 'react';
import type { SnapshotData, UploadResult } from '../types';
import { extractAuthInfo } from '../lib/auth-extractor';
import { isSupabaseConfigured, shareSnapshot } from '../lib/supabase';
import { redactSnapshot } from '../lib/redact';

interface ShareDialogProps {
  snapshot: SnapshotData;
  /** DevTools 通道传入被检查窗口的 tabId */
  tabId?: number;
  onShared?: (result: UploadResult) => void;
  onClose: () => void;
}

export default function ShareDialog({ snapshot, tabId, onShared, onClose }: ShareDialogProps) {
  const [includeAuth, setIncludeAuth] = useState(true);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxViews, setMaxViews] = useState(10);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      const auth = includeAuth
        ? await extractAuthInfo(snapshot.overview.url, snapshot.request.headers, tabId)
        : null;
      const safeSnapshot = redactSnapshot(snapshot);
      const result = await shareSnapshot(safeSnapshot, auth, { expiresInHours, maxViews });
      setShareUrl(result.url);
      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        /* 剪贴板可能被拒绝，忽略 */
      }
      onShared?.(result);
    } catch (err: any) {
      setError(err?.message || '分享失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
        {shareUrl ? (
          <>
            <h3 className="font-bold">分享成功</h3>
            <p className="text-sm text-gray-600">链接已复制到剪贴板：</p>
            <code className="block bg-gray-100 p-2 rounded text-xs break-all">{shareUrl}</code>
            <button
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              onClick={onClose}
            >
              关闭
            </button>
          </>
        ) : (
          <>
            <h3 className="font-bold">分享给后端</h3>
            <p className="text-sm text-gray-600">
              将生成一个短链接，后端打开后可查看请求详情并一键重放。
            </p>

            {!isSupabaseConfigured && (
              <div className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded p-2">
                尚未配置 Supabase。请在扩展目录的 <code>.env</code> 中填写
                URL / ANON_KEY 后重新构建。
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAuth}
                onChange={(e) => setIncludeAuth(e.target.checked)}
              />
              包含认证信息（Cookie / Token），用于后端重放
            </label>

            <div className="flex gap-3 text-sm">
              <label className="flex-1">
                <span className="block text-gray-500 mb-1">过期（小时）</span>
                <input
                  type="number"
                  min={1}
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full border rounded px-2 py-1"
                />
              </label>
              <label className="flex-1">
                <span className="block text-gray-500 mb-1">最大访问次数</span>
                <input
                  type="number"
                  min={1}
                  value={maxViews}
                  onChange={(e) => setMaxViews(Number(e.target.value))}
                  className="w-full border rounded px-2 py-1"
                />
              </label>
            </div>

            {error && (
              <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded p-2 break-all">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button className="flex-1 bg-gray-200 py-2 rounded" onClick={onClose}>
                取消
              </button>
              <button
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleShare}
                disabled={loading || !isSupabaseConfigured}
              >
                {loading ? '上传中...' : '确认分享'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
