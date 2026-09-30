import { useEffect, useState } from 'react';
import { isAutoCaptureEnabled, setAutoCaptureEnabled } from '../../../lib/settings';

export default function AutoCaptureToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isAutoCaptureEnabled().then((value) => {
      setEnabled(value);
      setLoading(false);
    });
  }, []);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    await setAutoCaptureEnabled(next);
  }

  if (loading) return null;

  return (
    <div className="flex items-center justify-between p-3 border-b bg-gray-50">
      <div>
        <div className="text-sm font-medium">自动捕获失败请求</div>
        <div className="text-xs text-gray-500">
          {enabled ? '已开启，后台静默记录' : '已关闭，可在 DevTools 中主动分享'}
        </div>
      </div>
      <button
        onClick={toggle}
        aria-pressed={enabled}
        className={`relative w-11 h-6 rounded-full transition ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
