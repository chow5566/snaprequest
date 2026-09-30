import type { SnapshotData } from '../../../types';

export async function harToSnapshot(
  request: chrome.devtools.network.Request,
): Promise<SnapshotData> {
  const responseBody = await new Promise<unknown>((resolve) => {
    request.getContent((content) => {
      if (content == null) return resolve(null);
      resolve(safeParse(content));
    });
  });

  return {
    overview: {
      url: request.request.url,
      method: request.request.method,
      status: request.response.status,
      duration: Math.round(request.time),
      timestamp: new Date(request.startedDateTime).getTime(),
    },
    request: {
      headers: Object.fromEntries(request.request.headers.map((h) => [h.name, h.value])),
      body: request.request.postData?.text ? safeParse(request.request.postData.text) : null,
    },
    response: {
      headers: Object.fromEntries(request.response.headers.map((h) => [h.name, h.value])),
      body: responseBody,
    },
    consoleErrors: [],
    userActions: [],
    source: 'devtools',
  };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
