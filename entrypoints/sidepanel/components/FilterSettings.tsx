import { useEffect, useState } from 'react';
import {
  DEFAULT_FILTER,
  getFilterConfig,
  setFilterConfig,
  type FilterConfig,
} from '../../../lib/filter-config';

export default function FilterSettings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<FilterConfig | null>(null);

  useEffect(() => {
    getFilterConfig().then(setConfig);
  }, []);

  if (!config) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold">过滤规则</h3>
          <button onClick={onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">记录范围</div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={config.captureMode === 'failed_only'}
                onChange={() => setConfig({ ...config, captureMode: 'failed_only' })}
              />
              仅失败请求（4xx / 5xx / 网络错误）
            </label>
            <label className="flex items-center gap-2 text-sm mt-1">
              <input
                type="radio"
                checked={config.captureMode === 'all'}
                onChange={() => setConfig({ ...config, captureMode: 'all' })}
              />
              全部请求
            </label>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">只记录 URL 包含</div>
            {config.urlIncludes.map((value, index) => (
              <div key={index} className="flex gap-2 mb-1">
                <input
                  value={value}
                  onChange={(e) => {
                    const next = [...config.urlIncludes];
                    next[index] = e.target.value;
                    setConfig({ ...config, urlIncludes: next });
                  }}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  placeholder="/api/"
                />
                <button
                  onClick={() =>
                    setConfig({
                      ...config,
                      urlIncludes: config.urlIncludes.filter((_, i) => i !== index),
                    })
                  }
                  className="text-red-500 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={() => setConfig({ ...config, urlIncludes: [...config.urlIncludes, ''] })}
              className="text-blue-600 text-sm mt-1"
            >
              + 添加
            </button>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">排除 URL 包含</div>
            {config.urlExcludes.map((value, index) => (
              <div key={index} className="flex gap-2 mb-1">
                <input
                  value={value}
                  onChange={(e) => {
                    const next = [...config.urlExcludes];
                    next[index] = e.target.value;
                    setConfig({ ...config, urlExcludes: next });
                  }}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  placeholder="/log"
                />
                <button
                  onClick={() =>
                    setConfig({
                      ...config,
                      urlExcludes: config.urlExcludes.filter((_, i) => i !== index),
                    })
                  }
                  className="text-red-500 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={() => setConfig({ ...config, urlExcludes: [...config.urlExcludes, ''] })}
              className="text-blue-600 text-sm mt-1"
            >
              + 添加
            </button>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">只记录 HTTP 方法</div>
            <div className="flex flex-wrap gap-2">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                <label key={method} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={config.methods.includes(method)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...config.methods, method]
                        : config.methods.filter((x) => x !== method);
                      setConfig({ ...config, methods: next });
                    }}
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={() => setConfig(DEFAULT_FILTER)}
            className="flex-1 bg-gray-100 py-2 rounded text-sm"
          >
            恢复默认
          </button>
          <button
            onClick={async () => {
              await setFilterConfig(config);
              onClose();
            }}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
