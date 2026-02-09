'use strict';

// --- State ---
let ws = null;
let logPaused = false;
let dashboardTimer = null;

// --- Helpers ---
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function api(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + endpoint, opts);
  return res.json();
}

function showAlert(panelId, type, message, autoClear = true) {
  const el = $(`#${panelId}-alert`);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.textContent = message;
  if (autoClear)
    setTimeout(() => {
      el.classList.remove('show');
    }, 4000);
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(`#panel-${tab.dataset.tab}`).classList.add('active');

    if (tab.dataset.tab === 'logs') initLogs();
    if (tab.dataset.tab === 'config') loadConfig();
  });
});

// --- Dashboard ---
function setServiceStatus(running, data) {
  const dot = $('#status-dot');
  const status = $('#header-status');
  dot.className = 'status-dot ' + (running ? 'running' : 'stopped');
  status.textContent = running
    ? `Running${data.scheduledJobs ? ` · ${data.scheduledJobs} jobs scheduled` : ''}`
    : 'Stopped';
}

function updateStats(stats) {
  if (!stats) return;
  $('#events-total').textContent = stats.events?.total ?? '—';
  $('#events-processed').textContent = stats.events?.byStatus?.processed ?? '—';
  $('#events-failed').textContent = stats.events?.byStatus?.failed ?? '—';
  $('#events-rate').textContent = stats.events?.successRate ?? '—';
  $('#jobs-total').textContent = stats.jobs?.total ?? '—';
  $('#jobs-completed').textContent = stats.jobs?.byStatus?.completed?.count ?? '—';
  $('#jobs-failed').textContent = stats.jobs?.byStatus?.failed?.count ?? '—';
  $('#jobs-retry-rate').textContent = stats.jobs?.retryRate ?? '—';
  $('#q-pending').textContent = stats.currentStatus?.pending ?? '—';
  $('#q-retrying').textContent = stats.currentStatus?.retrying ?? '—';
  $('#q-failed').textContent = stats.currentStatus?.failed ?? '—';

  renderActivity(stats.recentActivity || []);
}

function renderActivity(activities) {
  const container = $('#recent-activity');
  if (!activities.length) {
    container.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }
  container.innerHTML = activities
    .map((a) => {
      const cls =
        a.status === 'completed'
          ? 'completed'
          : a.status === 'failed'
            ? 'failed'
            : a.status === 'retrying'
              ? 'retrying'
              : '';
      return `<div class="activity-item ${cls}">
        <div class="activity-item-title">${esc(a.eventName)} <span class="text-muted">(${a.status})</span></div>
        <div class="activity-item-meta">ID: ${a.eventId} · ${new Date(a.eventDate).toLocaleString()}${a.retryCount ? ` · Retries: ${a.retryCount}` : ''}</div>
        ${a.error ? `<div class="activity-item-error">${esc(a.error)}</div>` : ''}
      </div>`;
    })
    .join('');
}

async function loadDashboard() {
  try {
    const [statusRes, statsRes] = await Promise.all([api('GET', '/service/status'), api('GET', '/statistics')]);
    if (statusRes.success) setServiceStatus(statusRes.data.running, statusRes.data);
    if (statsRes.success) updateStats(statsRes.data);
    $('#last-updated').textContent = new Date().toLocaleTimeString();
  } catch (e) {
    showAlert('dashboard', 'error', 'Failed to load dashboard: ' + e.message);
  }
}

// --- Logs ---
function initLogs() {
  if (ws && ws.readyState !== WebSocket.CLOSED) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws/logs`);
  $('#ws-status').textContent = 'Connecting...';

  ws.onopen = () => {
    $('#ws-status').textContent = 'Connected — streaming live logs';
  };

  ws.onmessage = (e) => {
    if (logPaused) return;
    const msg = JSON.parse(e.data);
    const container = $('#log-container');
    if (msg.type === 'history') {
      container.innerHTML = msg.lines.map(formatLogLine).join('');
    } else if (msg.type === 'lines') {
      msg.lines.forEach((line) => container.insertAdjacentHTML('beforeend', formatLogLine(line)));
    } else if (msg.type === 'error') {
      container.insertAdjacentHTML(
        'beforeend',
        `<div class="log-line log-error">[stream error] ${esc(msg.message)}</div>`
      );
    }
    container.scrollTop = container.scrollHeight;
  };

  ws.onclose = () => {
    $('#ws-status').textContent = 'Disconnected — refresh page to reconnect';
  };

  ws.onerror = () => {
    $('#ws-status').textContent = 'Connection error';
  };
}

function formatLogLine(line) {
  const cls = / error:/i.test(line) ? 'log-error' : / warn:/i.test(line) ? 'log-warn' : '';
  return `<div class="log-line ${cls}">${esc(line)}</div>`;
}

function togglePause() {
  logPaused = !logPaused;
  $('#btn-pause').textContent = logPaused ? 'Resume' : 'Pause';
}

function clearLogs() {
  $('#log-container').innerHTML = '';
}

// --- Config ---
async function loadConfig() {
  try {
    const [envRes, jsonRes] = await Promise.all([api('GET', '/config/env'), api('GET', '/config/json')]);
    if (envRes.success) $('#env-editor').value = envRes.data;
    else $('#env-editor').placeholder = 'Error: ' + envRes.error;
    if (jsonRes.success) $('#json-editor').value = JSON.stringify(jsonRes.data, null, 2);
    else $('#json-editor').placeholder = 'Error: ' + jsonRes.error;
  } catch (e) {
    showAlert('config', 'error', 'Failed to load config: ' + e.message);
  }
}

async function saveEnv() {
  const result = await api('PUT', '/config/env', { content: $('#env-editor').value });
  showAlert('config', result.success ? 'success' : 'error', result.success ? '.env saved' : result.error);
}

async function saveJson() {
  try {
    const data = JSON.parse($('#json-editor').value);
    const result = await api('PUT', '/config/json', data);
    showAlert('config', result.success ? 'success' : 'error', result.success ? 'config.json saved' : result.error);
  } catch (e) {
    showAlert('config', 'error', 'Invalid JSON: ' + e.message);
  }
}

async function testApi() {
  showAlert('config', 'info', 'Testing API connection...', false);
  const result = await api('POST', '/test/api');
  showAlert('config', result.success ? 'success' : 'error', result.message);
}

async function testEmail() {
  showAlert('config', 'info', 'Testing email connection...', false);
  const result = await api('POST', '/test/email');
  showAlert('config', result.success ? 'success' : 'error', result.message);
}

async function testPrint() {
  showAlert('config', 'info', 'Testing CUPS printer...', false);
  const result = await api('POST', '/test/print');
  showAlert('config', result.success ? 'success' : 'error', result.message);
}

// --- Init ---
loadDashboard();
dashboardTimer = setInterval(loadDashboard, 30000);
