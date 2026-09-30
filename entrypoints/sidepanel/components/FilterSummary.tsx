import { useEffect, useState } from 'react';
import { getFilterConfig } from '../../../lib/filter-config';

export default function FilterSummary({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    getFilterConfig().then((config) => {
      if (config.enableAdvanced) {
        setSummary('高级模式');
      } else if (config.captureMode === 'failed_only') {
        const includes = config.urlIncludes.filter(Boolean).slice(0, 2).join(', ');
        setSummary(`仅失败请求 · ${includes}`);
      } else {
        setSummary(`全部请求 · 排除 ${config.urlExcludes.length} 项`);
      }
    });
  }, []);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 text-xs">
      <div>
        <span className="text-gray-500">记录范围：</span>
        <span className="font-medium">{summary || '加载中...'}</span>
      </div>
      <button onClick={onOpenSettings} className="text-blue-600 hover:underline">
        调整
      </button>
    </div>
  );
}
