import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const config = window.SNAPREQUEST_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const pathMatch = window.location.pathname.match(/\/s\/([^/?#]+)/);
const snapshotId = params.get('id') || (pathMatch ? pathMatch[1] : null);

async function init() {
  if (!snapshotId) return renderError('缺少快照 ID');
  const { data, error } = await supabase.functions.invoke('get-snapshot', {
    body: { snapshot_id: snapshotId },
  });
  if (error || data?.error) {
    return renderError(errorMessage(data?.error || error?.message || '快照不存在或已失效'));
  }
  renderSnapshot(data);
}

function errorMessage(code) {
  const map = {
    not_found: '快照不存在或已被撤销',
    expired: '快照已过期',
    max_views_reached: '快照访问次数已达上限',
  };
  return map[code] || code;
}

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function pretty(value) {
  if (value == null) return '（空）';
  if (typeof value === 'string') return esc(value);
  try {
    return esc(JSON.stringify(value, null, 2));
  } catch {
    return esc(String(value));
  }
}

function renderSnapshot(snapshot) {
  const data = snapshot.data;
  document.getElementById('app').innerHTML = `
    <div class="container">
      <header class="header">
        <h1>接口报错快照</h1>
        <span class="status-badge ${getStatusClass(snapshot.status)}">${getStatusText(snapshot.status)}</span>
      </header>
      <section class="card">
        <h2>请求概览</h2>
        <div class="row"><span class="label">接口</span><code>${esc(data.overview.method)} ${esc(data.overview.url)}</code></div>
        <div class="row"><span class="label">状态码</span><span class="status-code">${esc(data.overview.status)}</span></div>
        <div class="row"><span class="label">耗时</span><span>${esc(data.overview.duration)}ms</span></div>
        <div class="row"><span class="label">来源</span><span>${data.source === 'devtools' ? 'DevTools 主动分享' : '自动捕获'}</span></div>
      </section>
      <section class="card"><h2>请求参数</h2><pre>${pretty(data.request.body)}</pre></section>
      <section class="card"><h2>原始响应</h2><pre>${pretty(data.response.body)}</pre></section>
      <section class="card auth-section">
        <h2>认证信息</h2>
        <p>${snapshot.has_auth ? '🔒 已加密存储，点击下方按钮重放时自动使用。' : '本次请求未包含认证信息。'}</p>
      </section>
      <section class="actions">
        <button id="replay-btn" class="btn-primary" ${!snapshot.has_auth ? 'disabled' : ''}>🔁 用原始认证信息重放此请求</button>
      </section>
      <section id="replay-result" class="hidden"></section>
      <section id="status-actions" class="hidden">
        <h2>问题是否已解决？</h2>
        <div class="status-buttons">
          <button class="btn-success" data-status="resolved">✅ 已解决</button>
          <button class="btn-danger" data-status="still_failing">⚠️ 仍报错</button>
          <button class="btn-secondary" data-status="need_more_info">❓ 需更多信息</button>
        </div>
      </section>
    </div>`;

  document.getElementById('replay-btn')?.addEventListener('click', handleReplay);
  document.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => handleStatusUpdate(btn.dataset.status));
  });
}

async function handleReplay() {
  const btn = document.getElementById('replay-btn');
  btn.disabled = true;
  btn.textContent = '重放中...';

  const { data, error } = await supabase.functions.invoke('replay-request', {
    body: { snapshot_id: snapshotId },
  });

  btn.disabled = false;
  btn.textContent = '🔁 再次重放';

  if (error || data?.status === 'failed') {
    document.getElementById('replay-result').innerHTML =
      `<div class="card error-card"><h2>重放失败</h2><pre>${esc(data?.error || error?.message)}</pre></div>`;
    return;
  }

  const autoClass = autoClassify(data.original.status_code, data.replay.status_code);
  document.getElementById('replay-result').innerHTML = `
    <div class="card">
      <h2>重放结果</h2>
      <div class="diff-grid">
        <div class="diff-col"><h3>原始响应</h3><span class="status-code">${esc(data.original.status_code)}</span><pre>${pretty(data.original.body)}</pre></div>
        <div class="diff-col"><h3>重放响应</h3><span class="status-code">${esc(data.replay.status_code)}</span><pre>${pretty(data.replay.body)}</pre></div>
      </div>
      <p class="auto-hint">${getAutoHint(autoClass)}</p>
    </div>`;
  document.getElementById('status-actions').classList.remove('hidden');
}

function autoClassify(originalStatus, replayStatus) {
  if (originalStatus >= 400 && replayStatus < 400) return 'likely_resolved';
  if (originalStatus >= 400 && (replayStatus === 401 || replayStatus === 403)) return 'auth_expired';
  if (originalStatus >= 400 && replayStatus >= 400 && originalStatus === replayStatus) return 'still_failing';
  if (originalStatus >= 400 && replayStatus >= 400) return 'still_failing_diff';
  return 'unknown';
}

function getAutoHint(cls) {
  const map = {
    likely_resolved: '✅ 重放成功，原始请求为失败。问题可能已修复，请确认。',
    auth_expired: '⚠️ 原始认证信息可能已过期，重放返回 401/403，无法判断业务逻辑。',
    still_failing: '⚠️ 重放仍返回相同错误，问题可稳定复现。',
    still_failing_diff: '⚠️ 重放仍失败，但错误内容与原始不同，可能是新问题。',
    unknown: '❓ 无法自动判断，请手动确认。',
  };
  return map[cls] || map.unknown;
}

async function handleStatusUpdate(status) {
  const note = prompt('可选：添加备注');
  await supabase.functions.invoke('update-status', {
    body: { snapshot_id: snapshotId, status, note },
  });
  alert('状态已更新');
  document.getElementById('status-actions').classList.add('hidden');
}

function renderError(message) {
  document.getElementById('app').innerHTML =
    `<div class="container"><div class="card error-card"><h2>无法打开快照</h2><p>${esc(message)}</p></div></div>`;
}

function getStatusClass(status) {
  const map = {
    created: 'status-created',
    viewed: 'status-viewed',
    replayed: 'status-replayed',
    resolved: 'status-resolved',
    still_failing: 'status-failing',
    need_more_info: 'status-info',
  };
  return map[status] || '';
}

function getStatusText(status) {
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

init();
