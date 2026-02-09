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
let currentCategories = [];
let currentJsonConfig = {};

function parseEnv(str) {
  const env = {};
  for (const line of str.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

function buildEnv(env) {
  return Object.entries(env)
    .filter(([_, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function togglePassword(fieldId) {
  const input = $('#' + fieldId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleSection(sectionId) {
  const section = $('#' + sectionId);
  section.classList.toggle('collapsed');
}

function updatePrintModeFields() {
  const mode = $('#cfg-print-mode').value;
  $('#email-fields').style.display = mode === 'email' ? '' : 'none';
  $('#local-fields').style.display = mode === 'local' ? '' : 'none';
}

function renderCategories() {
  const list = $('#category-list');
  if (!currentCategories.length) {
    list.innerHTML =
      '<span class="text-muted" style="font-size:12px;">No categories — all events will be processed.</span>';
    return;
  }
  list.innerHTML = currentCategories
    .map(
      (cat) =>
        `<span class="category-tag">${esc(cat)}<button type="button" onclick="removeCategory('${esc(cat.replace(/'/g, "\\'"))}')" title="Remove">&times;</button></span>`
    )
    .join('');
}

function addCategory() {
  const input = $('#cfg-new-category');
  const val = input.value.trim();
  if (!val) return;
  if (currentCategories.includes(val)) {
    showAlert('config', 'error', 'Category already exists');
    return;
  }
  currentCategories.push(val);
  renderCategories();
  input.value = '';
}

function removeCategory(name) {
  currentCategories = currentCategories.filter((c) => c !== name);
  renderCategories();
}

async function loadConfig() {
  try {
    const [envRes, jsonRes] = await Promise.all([api('GET', '/config/env'), api('GET', '/config/json')]);

    if (envRes.success) {
      const env = parseEnv(envRes.data);
      $('#cfg-api-key').value = env.API_KEY || '';
      $('#cfg-api-base-url').value = env.API_BASE_URL || '';
      $('#cfg-printer-email').value = env.PRINTER_EMAIL || '';
      $('#cfg-smtp-host').value = env.SMTP_HOST || '';
      $('#cfg-smtp-port').value = env.SMTP_PORT || '';
      $('#cfg-smtp-user').value = env.SMTP_USER || '';
      $('#cfg-smtp-pass').value = env.SMTP_PASS || '';
      $('#cfg-email-from').value = env.EMAIL_FROM || '';
      $('#cfg-printer-name').value = env.PRINTER_NAME || '';
    } else {
      showAlert('config', 'error', 'Failed to load .env: ' + envRes.error);
    }

    if (jsonRes.success) {
      currentJsonConfig = jsonRes.data;
      const cfg = jsonRes.data;
      $('#cfg-print-mode').value = cfg.printMode || 'email';
      currentCategories = cfg.categories || [];
      renderCategories();
      $('#cfg-pre-event-minutes').value = cfg.preEventQueryMinutes ?? '';
      $('#cfg-fetch-window-hours').value = cfg.fetchWindowHours ?? '';
      $('#cfg-service-interval').value = cfg.serviceRunIntervalHours ?? '';
      $('#cfg-output-filename').value = cfg.outputFilename || '';
      $('#cfg-pdf-font-size').value = cfg.pdfLayout?.fontSize ?? '';
      updatePrintModeFields();
    } else {
      showAlert('config', 'error', 'Failed to load config.json: ' + jsonRes.error);
    }
  } catch (e) {
    showAlert('config', 'error', 'Failed to load config: ' + e.message);
  }
}

async function saveAllConfig() {
  try {
    // Build .env content
    const env = {};
    const val = (id) => $('#' + id).value.trim();
    if (val('cfg-api-key')) env.API_KEY = val('cfg-api-key');
    if (val('cfg-api-base-url')) env.API_BASE_URL = val('cfg-api-base-url');
    if (val('cfg-printer-email')) env.PRINTER_EMAIL = val('cfg-printer-email');
    if (val('cfg-smtp-host')) env.SMTP_HOST = val('cfg-smtp-host');
    if (val('cfg-smtp-port')) env.SMTP_PORT = val('cfg-smtp-port');
    if (val('cfg-smtp-user')) env.SMTP_USER = val('cfg-smtp-user');
    if (val('cfg-smtp-pass')) env.SMTP_PASS = val('cfg-smtp-pass');
    if (val('cfg-email-from')) env.EMAIL_FROM = val('cfg-email-from');
    if (val('cfg-printer-name')) env.PRINTER_NAME = val('cfg-printer-name');
    const envContent = buildEnv(env);

    // Build config.json by merging into existing config
    const jsonData = Object.assign({}, currentJsonConfig);
    jsonData.printMode = $('#cfg-print-mode').value;
    jsonData.categories = [...currentCategories];

    const preEvent = $('#cfg-pre-event-minutes').value;
    if (preEvent !== '') jsonData.preEventQueryMinutes = parseInt(preEvent, 10);
    const fetchWindow = $('#cfg-fetch-window-hours').value;
    if (fetchWindow !== '') jsonData.fetchWindowHours = parseInt(fetchWindow, 10);
    const interval = $('#cfg-service-interval').value;
    if (interval !== '') jsonData.serviceRunIntervalHours = parseInt(interval, 10);
    const filename = $('#cfg-output-filename').value.trim();
    if (filename) jsonData.outputFilename = filename;
    const fontSize = $('#cfg-pdf-font-size').value;
    if (fontSize !== '') {
      if (!jsonData.pdfLayout) jsonData.pdfLayout = {};
      jsonData.pdfLayout.fontSize = parseInt(fontSize, 10);
    }

    // Save both
    const [envRes, jsonRes] = await Promise.all([
      api('PUT', '/config/env', { content: envContent }),
      api('PUT', '/config/json', jsonData),
    ]);

    if (envRes.success && jsonRes.success) {
      showAlert('config', 'success', 'All settings saved successfully');
    } else {
      const errors = [];
      if (!envRes.success) errors.push('.env: ' + envRes.error);
      if (!jsonRes.success) errors.push('config.json: ' + jsonRes.error);
      showAlert('config', 'error', 'Save failed — ' + errors.join('; '));
    }
  } catch (e) {
    showAlert('config', 'error', 'Failed to save: ' + e.message);
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

// --- Category Fetch Modal ---
let fetchedCategoriesData = [];

function openCategoryFetchModal() {
  $('#category-fetch-modal').style.display = 'flex';
  $('#category-fetch-results').style.display = 'none';
  $('#category-fetch-loading').style.display = 'none';
  $('#category-fetch-error').style.display = 'none';
}

function closeCategoryFetchModal() {
  $('#category-fetch-modal').style.display = 'none';
  fetchedCategoriesData = [];
}

async function fetchCategoriesFromApi() {
  const days = Math.min(Math.max(parseInt($('#fetch-days').value) || 30, 1), 100);

  $('#category-fetch-results').style.display = 'none';
  $('#category-fetch-error').style.display = 'none';
  $('#category-fetch-loading').style.display = 'block';

  try {
    const result = await api('GET', `/fetch-categories?days=${days}`);

    if (result.success) {
      fetchedCategoriesData = result.data.categories;
      renderFetchedCategories(result.data);
      $('#category-fetch-loading').style.display = 'none';
      $('#category-fetch-results').style.display = 'block';
    } else {
      throw new Error(result.error || 'Failed to fetch categories');
    }
  } catch (error) {
    $('#category-fetch-loading').style.display = 'none';
    $('#category-fetch-error').style.display = 'block';
    $('#category-fetch-error').textContent =
      error.message || 'Failed to fetch categories. Check your API key and try again.';
  }
}

function renderFetchedCategories(data) {
  const { categories, totalEvents, searchDays } = data;

  $('#category-fetch-summary').textContent =
    `Found ${categories.length} categories (${totalEvents} events) in next ${searchDays} days`;
  $('#category-fetch-timestamp').textContent = `Last fetched: ${new Date().toLocaleTimeString()}`;

  const list = $('#category-fetch-list');
  if (!categories.length) {
    list.innerHTML = '<div class="empty-state">No events found in the specified time range.</div>';
    return;
  }

  list.innerHTML = categories
    .map((cat, idx) => {
      const isAdded = currentCategories.includes(cat.name);
      const dateFrom = new Date(cat.dateRange.from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const dateTo = new Date(cat.dateRange.to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return `
        <div class="fetched-category-item ${isAdded ? 'already-added' : ''}">
          <div class="fetched-category-header">
            <label class="fetched-category-checkbox">
              <input type="checkbox" id="fetch-cat-${idx}" ${isAdded ? 'disabled' : ''} data-category="${esc(cat.name)}">
              <span class="fetched-category-name">${esc(cat.name)}</span>
              <span class="fetched-category-count">(${cat.eventCount} event${cat.eventCount !== 1 ? 's' : ''})</span>
              ${isAdded ? '<span class="already-added-badge">Already added</span>' : ''}
            </label>
            <button class="fetched-category-toggle" onclick="toggleCategoryEvents(${idx})" title="Show/hide events">
              <span id="toggle-arrow-${idx}">&#9660;</span>
            </button>
          </div>
          <div class="fetched-category-meta">${dateFrom} - ${dateTo}</div>
          <div class="fetched-category-events collapsed" id="category-events-${idx}">
            ${cat.events
              .map((evt) => {
                const evtDate = new Date(evt.date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                return `<div class="fetched-event-item">${esc(evt.name)} <span style="color:#999;">(${evtDate})</span></div>`;
              })
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');
}

function toggleCategoryEvents(idx) {
  const eventsDiv = $(`#category-events-${idx}`);
  const arrow = $(`#toggle-arrow-${idx}`);
  const isCollapsed = eventsDiv.classList.contains('collapsed');

  if (isCollapsed) {
    eventsDiv.classList.remove('collapsed');
    arrow.textContent = '▲';
  } else {
    eventsDiv.classList.add('collapsed');
    arrow.textContent = '▼';
  }
}

function selectAllFetchedCategories() {
  document.querySelectorAll('#category-fetch-list input[type="checkbox"]:not([disabled])').forEach((cb) => {
    cb.checked = true;
  });
}

function deselectAllFetchedCategories() {
  document.querySelectorAll('#category-fetch-list input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
}

function addSelectedCategories() {
  const checkboxes = document.querySelectorAll('#category-fetch-list input[type="checkbox"]:checked');
  let addedCount = 0;

  checkboxes.forEach((cb) => {
    const categoryName = cb.dataset.category;
    if (!currentCategories.includes(categoryName)) {
      currentCategories.push(categoryName);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    renderCategories();
    showAlert('config', 'success', `Added ${addedCount} categor${addedCount !== 1 ? 'ies' : 'y'}`);
    closeCategoryFetchModal();
  } else {
    showAlert('config', 'info', 'No new categories selected');
  }
}

// --- Init ---
loadDashboard();
dashboardTimer = setInterval(loadDashboard, 30000);
