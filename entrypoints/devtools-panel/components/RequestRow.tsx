export default function RequestRow({
  request,
  onShare,
  onContextMenu,
}: {
  request: chrome.devtools.network.Request;
  onShare: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  const status = request.response.status;
  const isFailed = status >= 400 || status === 0;

  return (
    <div
      className={`p-3 border-b text-xs hover:bg-gray-50 ${isFailed ? 'bg-red-50' : ''}`}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold">{request.request.method}</span>
          <span
            className={`px-2 py-0.5 rounded ${
              status >= 500
                ? 'bg-red-100 text-red-700'
                : status >= 400
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            {status || 'ERR'}
          </span>
          <span className="text-gray-400">{Math.round(request.time)}ms</span>
        </div>
        <button
          onClick={onShare}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
        >
          分享
        </button>
      </div>
      <div className="text-gray-600 break-all">{request.request.url}</div>
    </div>
  );
}
