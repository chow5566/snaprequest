import { CSS_B64, JS_B64, CONFIG_B64 } from './assets.ts';

function decode(base64: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  );
}

function page(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>接口报错快照 — SnapRequest</title>
<style>${decode(CSS_B64)}</style>
</head>
<body>
<div id="app"><div class="loading">加载中...</div></div>
<script>${decode(CONFIG_B64)}</script>
<script type="module">${decode(JS_B64)}</script>
</body>
</html>`;
}

Deno.serve(() =>
  new Response(page(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  }),
);
