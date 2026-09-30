import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const config = window.SNAPREQUEST_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

const params = new URLSearchParams(location.search);
const pathMatch = location.pathname.match(/\/s\/([^/?#]+)/);
const snapshotId = params.get('id') || (pathMatch ? pathMatch[1] : null);

const app = document.getElementById('app');
const toastHost = document.getElementById('toasts');

let snapshot = null;
let replay = null;
let activeTab = 'request';

/* ------------------------------------------------------------------ */
/* 主题                                                                */
/* ------------------------------------------------------------------ */
const themeBtn = document.getElementById('theme-btn');
function applyThemeLabel() {
  const t = document.documentElement.getAttribute('data-theme') || 'dark';
  themeBtn.textContent = t === 'dark' ? '🌙 深色' : '☀️ 浅色';
}
themeBtn.addEventListener('click', () => {
  const next =
    (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('sr-theme', next);
  } catch (e) {}
  applyThemeLabel();
});
applyThemeLabel();

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */
function esc(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

function highlight(value) {
  let json;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '<span class="tok-null">（空）</span>';
    try {
      json = JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (e) {
      return esc(value);
    }
  } else if (value == null) {
    return '<span class="tok-null">（空）</span>';
  } else {
    try {
      json = JSON.stringify(value, null, 2);
    } catch (e) {
      return esc(String(value));
    }
  }
  return esc(json).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, str, colon, bool) => {
      if (str !== undefined) {
        return colon
          ? `<span class="tok-key">${str}</span>${colon}`
          : `<span class="tok-str">${str}</span>`;
      }
      if (bool !== undefined) return `<span class="tok-bool">${bool}</span>`;
      return `<span class="tok-num">${match}</span>`;
    },
  );
}

function statusClass(status) {
  const n = Number(status);
  if (!n) return 'status-err';
  if (n >= 500) return 'status-5xx';
  if (n >= 400) return 'status-4xx';
  if (n >= 300) return 'status-3xx';
  return 'status-2xx';
}

function statusLabel(status) {
  const map = {
    created: '已创建',
    viewed: '已查看',
    replayed: '已重放',
    resolved: '已解决',
    still_failing: '仍报错',
    need_more_info: '需更多信息',
  };
  return map[status] || status;
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

function errorText(code) {
  const map = {
    not_found: '快照不存在或已被撤销',
    expired: '快照已过期',
    max_views_reached: '快照访问次数已达上限',
  };
  return map[code] || code || '无法打开快照';
}

function toast(message, type) {
  const el = document.createElement('div');
  el.className = `toast ${type || ''}`;
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制', 'success');
  } catch (e) {
    toast('复制失败，请手动选择', 'error');
  }
}

function codeBlock(value, wrap = true) {
  return `<div class="code-wrap"><button class="copy-btn" data-copy>复制</button><pre class="code ${
    wrap ? 'wrap' : ''
  }">${highlight(value)}</pre></div>`;
}

function headersBlock(headers) {
  const entries = Object.entries(headers || {});
  if (!entries.length) return '<div class="empty">无</div>';
  const rows = entries
    .map(([k, v]) => {
      const redacted = v === '[已脱敏]';
      return `<div class="h-row"><div class="h-key">${esc(k)}</div><div class="h-val ${
        redacted ? 'redacted' : ''
      }">${esc(v)}</div></div>`;
    })
    .join('');
  return `<div class="headers-wrap"><button class="copy-btn" data-copy-headers>复制</button><div class="headers">${rows}</div></div>`;
}

function buildCurl(data) {
  const method = data.overview.method || 'GET';
  const lines = [`curl -X ${method} '${data.overview.url}'`];
  for (const [k, v] of Object.entries(data.request.headers || {})) {
    if (k.startsWith(':') || v === '[已脱敏]') continue;
    lines.push(`  -H '${k}: ${String(v).replace(/'/g, `'\\''`)}'`);
  }
  if (data.request.body != null && method !== 'GET' && method !== 'HEAD') {
    const body =
      typeof data.request.body === 'string'
        ? data.request.body
        : JSON.stringify(data.request.body);
    lines.push(`  --data-raw '${body.replace(/'/g, `'\\''`)}'`);
  }
  return lines.join(' \\\n');
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */
function renderError(message) {
  app.innerHTML = `<div class="center"><div class="error-box"><h2>无法打开快照</h2><p>${esc(
    message,
  )}</p></div></div>`;
}

function render() {
  const data = snapshot.data;
  const ov = data.overview;
  const ctxErrors = data.consoleErrors || [];
  const ctxActions = data.userActions || [];

  app.innerHTML = `
    <section class="card">
      <div class="card-body">
        <div class="overview">
          <span class="pill method">${esc(ov.method)}</span>
          <span class="pill ${statusClass(ov.status)}">${ov.status || 'ERR'}</span>
          <span class="pill ghost">${ov.duration} ms</span>
          <span class="pill ghost">${data.source === 'devtools' ? 'DevTools 主动分享' : '自动捕获'}</span>
          <span class="pill ghost" id="status-pill">${statusLabel(snapshot.status)}</span>
        </div>
        <div class="url-line">
          <code>${esc(ov.url)}</code>
          <button class="copy-btn" style="position: static; opacity: 1" data-copy-url>复制</button>
        </div>
        <dl class="meta-grid">
          <div class="meta"><dt>发生时间</dt><dd>${fmtTime(ov.timestamp)}</dd></div>
          <div class="meta"><dt>查看次数</dt><dd>${snapshot.view_count} / ${snapshot.max_views}</dd></div>
          <div class="meta"><dt>有效期至</dt><dd>${fmtTime(new Date(snapshot.expires_at).getTime())}</dd></div>
          <div class="meta"><dt>来源</dt><dd>${data.source === 'devtools' ? 'DevTools' : '自动捕获'}</dd></div>
        </dl>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>认证信息</h2></div>
      <div class="card-body">
        <div class="auth-row">
          ${
            snapshot.has_auth
              ? '<span class="ok">🔒 已加密存储</span><span>重放时自动使用，页面不展示明文。</span>'
              : '<span>本次请求未包含认证信息，重放可能失败。</span>'
          }
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <div class="action-bar">
          <button class="btn primary" id="replay-btn" ${snapshot.has_auth ? '' : ''}>🔁 重放此请求</button>
          <button class="btn ghost" data-copy-url>复制链接</button>
          <button class="btn ghost" data-copy-curl>复制为 cURL</button>
          <button class="btn ghost" id="revoke-btn">撤销分享</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="tabs" id="tabs">
        <button class="tab ${activeTab === 'request' ? 'active' : ''}" data-tab="request">请求</button>
        <button class="tab ${activeTab === 'response' ? 'active' : ''}" data-tab="response">响应</button>
        <button class="tab ${activeTab === 'context' ? 'active' : ''}" data-tab="context">上下文${
          ctxErrors.length + ctxActions.length
            ? `<span class="count">${ctxErrors.length + ctxActions.length}</span>`
            : ''
        }</button>
      </div>
      <div class="card-body" id="tab-panel"></div>
    </section>

    <section class="card hidden" id="replay-card"></section>
    <section class="card hidden" id="status-card">
      <div class="card-head"><h2>问题是否已解决？</h2></div>
      <div class="card-body">
        <textarea class="status-note" id="status-note" placeholder="可选：补充说明（会同步给发起分享的同事）"></textarea>
        <div class="action-bar">
          <button class="btn success" data-status="resolved">✅ 已解决</button>
          <button class="btn danger" data-status="still_failing">⚠️ 仍报错</button>
          <button class="btn ghost" data-status="need_more_info">❓ 需更多信息</button>
        </div>
      </div>
    </section>
  `;

  renderTabPanel();
  if (replay) renderReplay();
  bindAppEvents();
}

function renderTabPanel() {
  const data = snapshot.data;
  const panel = document.getElementById('tab-panel');
  if (!panel) return;

  if (activeTab === 'request') {
    panel.innerHTML = `
      <div class="subsection">
        <div class="subsection-title">请求头</div>
        ${headersBlock(data.request.headers)}
      </div>
      <div class="subsection">
        <div class="subsection-title">请求参数</div>
        ${codeBlock(data.request.body)}
      </div>`;
  } else if (activeTab === 'response') {
    panel.innerHTML = `
      <div class="subsection">
        <div class="subsection-title">响应头</div>
        ${headersBlock(data.response.headers)}
      </div>
      <div class="subsection">
        <div class="subsection-title">响应内容</div>
        ${codeBlock(data.response.body)}
      </div>`;
  } else {
    const errors = data.consoleErrors || [];
    const actions = data.userActions || [];
    panel.innerHTML = `
      <div class="subsection">
        <div class="subsection-title">Console 错误（${errors.length}）</div>
        ${
          errors.length
            ? errors
                .map(
                  (e) =>
                    `<div class="code-wrap" style="margin-bottom:8px"><pre class="code wrap">${esc(
                      e.message,
                    )}</pre></div>`,
                )
                .join('')
            : '<div class="empty">无</div>'
        }
      </div>
      <div class="subsection">
        <div class="subsection-title">用户操作（${actions.length}）</div>
        ${
          actions.length
            ? headersBlock(
                actions.reduce((acc, a, i) => {
                  acc[`#${i + 1} ${a.type}`] = `${a.target}  ·  ${fmtTime(a.timestamp)}`;
                  return acc;
                }, {}),
              )
            : '<div class="empty">无</div>'
        }
      </div>`;
  }
}

function renderReplay() {
  const card = document.getElementById('replay-card');
  const statusCard = document.getElementById('status-card');
  if (!card) return;
  card.classList.remove('hidden');
  if (statusCard) statusCard.classList.remove('hidden');

  const cls = autoClassify(replay.original.status_code, replay.replay.status_code);
  const hint = autoHint(cls);

  card.innerHTML = `
    <div class="card-head"><h2>重放结果</h2></div>
    <div class="card-body">
      <div class="diff-grid">
        <div class="diff-col original">
          <div class="diff-col-head">
            <h3>原始响应</h3>
            <span class="pill ${statusClass(replay.original.status_code)}">${
              replay.original.status_code || 'ERR'
            }</span>
          </div>
          <div class="code-wrap"><button class="copy-btn" data-copy>复制</button><pre class="code wrap">${highlight(
            replay.original.body,
          )}</pre></div>
        </div>
        <div class="diff-col replay">
          <div class="diff-col-head">
            <h3>重放响应</h3>
            <span class="pill ${statusClass(replay.replay.status_code)}">${
              replay.replay.status_code || 'ERR'
            }</span>
          </div>
          <div class="code-wrap"><button class="copy-btn" data-copy>复制</button><pre class="code wrap">${highlight(
            replay.replay.body,
          )}</pre></div>
        </div>
      </div>
      <div class="hint ${hint.tone}">
        <span class="badge-emoji">${hint.icon}</span>
        <span>${hint.text}（重放耗时 ${replay.replay.duration} ms）</span>
      </div>
    </div>`;

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ------------------------------------------------------------------ */
/* 交互                                                                */
/* ------------------------------------------------------------------ */
function bindAppEvents() {
  app.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      app.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
      renderTabPanel();
    });
  });

  document.getElementById('replay-btn')?.addEventListener('click', handleReplay);
  document.getElementById('revoke-btn')?.addEventListener('click', handleRevoke);

  app.querySelectorAll('[data-copy-url]').forEach((btn) =>
    btn.addEventListener('click', () => copyText(location.href)),
  );
  app.querySelectorAll('[data-copy-curl]').forEach((btn) =>
    btn.addEventListener('click', () => copyText(buildCurl(snapshot.data))),
  );

  app.querySelectorAll('[data-status]').forEach((btn) =>
    btn.addEventListener('click', () => handleStatus(btn.dataset.status, btn)),
  );

  // 复制代码块
  app.querySelectorAll('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const pre = btn.closest('.code-wrap')?.querySelector('pre');
      if (pre) copyText(pre.textContent);
    }),
  );
  // 复制请求/响应头
  app.querySelectorAll('[data-copy-headers]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const rows = btn.closest('.headers-wrap')?.querySelectorAll('.h-row');
      if (!rows) return;
      const text = Array.from(rows)
        .map((r) => `${r.querySelector('.h-key').textContent}: ${r.querySelector('.h-val').textContent}`)
        .join('\n');
      copyText(text);
    }),
  );
}

async function handleReplay() {
  const btn = document.getElementById('replay-btn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> 重放中...';

  const { data, error } = await supabase.functions.invoke('replay-request', {
    body: { snapshot_id: snapshotId },
  });

  btn.disabled = false;
  btn.innerHTML = original;

  if (error || data?.status === 'failed') {
    toast('重放失败：' + (data?.error || error?.message || '未知错误'), 'error');
    return;
  }
  replay = data;
  renderReplay();
  setStatusPill('replayed');
  toast('重放完成', 'success');
}

async function handleStatus(status, btn) {
  const note = document.getElementById('status-note')?.value || '';
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  const { error } = await supabase.functions.invoke('update-status', {
    body: { snapshot_id: snapshotId, status, note },
  });
  btn.disabled = false;
  btn.innerHTML = original;
  if (error) {
    toast('更新失败：' + error.message, 'error');
    return;
  }
  setStatusPill(status);
  toast('状态已更新，已通知发起人', 'success');
}

async function handleRevoke() {
  if (!window.confirm('撤销后链接立即失效、认证信息被删除，确定要撤销吗？')) return;
  const { error } = await supabase.functions.invoke('revoke-snapshot', {
    body: { snapshot_id: snapshotId },
  });
  if (error) {
    toast('撤销失败：' + error.message, 'error');
    return;
  }
  renderError('该快照已被撤销');
}

function setStatusPill(status) {
  const pill = document.getElementById('status-pill');
  if (pill) pill.textContent = statusLabel(status);
}

function autoClassify(originalStatus, replayStatus) {
  if (originalStatus >= 400 && replayStatus < 400) return 'likely_resolved';
  if (originalStatus >= 400 && (replayStatus === 401 || replayStatus === 403)) return 'auth_expired';
  if (originalStatus >= 400 && replayStatus >= 400 && originalStatus === replayStatus)
    return 'still_failing';
  if (originalStatus >= 400 && replayStatus >= 400) return 'still_failing_diff';
  return 'unknown';
}

function autoHint(cls) {
  const map = {
    likely_resolved: {
      tone: 'ok',
      icon: '✅',
      text: '重放成功，而原始请求失败，问题很可能已修复。',
    },
    auth_expired: {
      tone: 'warn',
      icon: '⚠️',
      text: '重放返回 401/403，原始认证信息可能已过期，无法判断业务逻辑。',
    },
    still_failing: {
      tone: 'err',
      icon: '🔁',
      text: '重放仍返回相同错误，问题可稳定复现。',
    },
    still_failing_diff: {
      tone: 'warn',
      icon: '⚠️',
      text: '重放仍失败，但错误内容与原始不同，可能是新问题。',
    },
    unknown: { tone: '', icon: '❓', text: '无法自动判断，请人工确认。' },
  };
  return map[cls] || map.unknown;
}

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */
async function init() {
  if (!snapshotId) return renderError('缺少快照 ID');
  const { data, error } = await supabase.functions.invoke('get-snapshot', {
    body: { snapshot_id: snapshotId },
  });
  if (error || data?.error) return renderError(errorText(data?.error || error?.message));
  snapshot = data;
  render();
}

init();
