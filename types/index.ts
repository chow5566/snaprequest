// ---------------------------------------------------------------------------
// 捕获的原始请求（自动通道）
// ---------------------------------------------------------------------------
export interface ConsoleError {
  message: string;
  stack?: string;
  timestamp: number;
}

export interface UserAction {
  type: 'click' | 'input' | 'navigate';
  target: string;
  timestamp: number;
}

export interface CapturedRequest {
  id?: number;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  resourceType?: string;
  consoleErrors: ConsoleError[];
  userActions: UserAction[];
  tabId: number;
}

// ---------------------------------------------------------------------------
// 认证信息（上传前单独提取，后端加密存储）
// ---------------------------------------------------------------------------
export interface AuthInfo {
  cookies: string | null;
  bearerToken: string | null;
  storageTokens: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// 统一快照格式（两个通道共用）
// ---------------------------------------------------------------------------
export interface SnapshotData {
  overview: {
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: number;
  };
  request: {
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    headers: Record<string, string>;
    body: unknown;
  };
  consoleErrors: ConsoleError[];
  userActions: UserAction[];
  source: 'auto' | 'devtools';
}

export type SnapshotStatus =
  | 'created'
  | 'viewed'
  | 'replayed'
  | 'resolved'
  | 'still_failing'
  | 'need_more_info';

export interface UploadResult {
  id: string;
  url: string;
  expires_at: string;
}

export function capturedToSnapshot(req: CapturedRequest): SnapshotData {
  return {
    overview: {
      url: req.url,
      method: req.method,
      status: req.status,
      duration: req.duration,
      timestamp: req.timestamp,
    },
    request: {
      headers: req.requestHeaders,
      body: req.requestBody,
    },
    response: {
      headers: req.responseHeaders,
      body: req.responseBody,
    },
    consoleErrors: req.consoleErrors ?? [],
    userActions: req.userActions ?? [],
    source: 'auto',
  };
}
