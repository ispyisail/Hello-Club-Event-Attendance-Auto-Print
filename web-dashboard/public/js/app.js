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

  renderUpcomingEvents(stats.upcomingEvents || []);
  renderActivity(stats.recentActivity || []);
}

function renderUpcomingEvents(events) {
  const container = $('#upcoming-events');
  if (!events.length) {
    container.innerHTML = '<div class="empty-state">No upcoming events scheduled</div>';
    return;
  }
  container.innerHTML = events
    .map((e) => {
      const cls = e.status === 'scheduled' ? '' : e.status === 'retrying' ? 'retrying' : '';
      const eventDate = new Date(e.eventDate);
      const scheduledTime = new Date(e.scheduledTime);
      return `<div class="activity-item ${cls}">
        <div class="activity-item-title">${esc(e.eventName)} <span class="text-muted">(${e.status})</span></div>
        <div class="activity-item-meta">Event: ${eventDate.toLocaleString()} · Print: ${scheduledTime.toLocaleString()}</div>
      </div>`;
    })
    .join('');
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

async function refreshEventsFromHelloClub() {
  showAlert('dashboard', 'info', 'Fetching latest events from Hello Club...', false);
  try {
    const result = await api('POST', '/events/refresh');
    if (result.success) {
      showAlert('dashboard', 'success', result.message + ' - Dashboard will auto-update in 10 seconds', false);
      // Wait 10 seconds then reload to show updated data
      let countdown = 10;
      const intervalId = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          showAlert('dashboard', 'success', `Refresh complete! Reloading in ${countdown}...`, false);
        } else {
          clearInterval(intervalId);
          showAlert('dashboard', 'success', 'Reloading dashboard...', false);
          loadDashboard();
        }
      }, 1000);
    } else {
      showAlert('dashboard', 'error', 'Failed to refresh: ' + result.error);
    }
  } catch (e) {
    showAlert('dashboard', 'error', 'Failed to refresh events: ' + e.message);
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
      $('#cfg-notification-email').value = env.NOTIFICATION_EMAIL || '';
      $('#cfg-notification-email-2').value = env.NOTIFICATION_EMAIL || '';
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

      // Load logo preview
      if (cfg.pdfLayout?.logo) {
        displayLogoPreview(cfg.pdfLayout.logo);
      } else {
        hideLogoPreview();
      }

      // Load column configuration
      renderColumnConfig(cfg.pdfLayout?.columns);
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
    const notifEmail = val('cfg-notification-email') || val('cfg-notification-email-2');
    if (notifEmail) env.NOTIFICATION_EMAIL = notifEmail;
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

async function testPrintEvent() {
  showAlert('config', 'info', 'Fetching next event and printing...', false);
  const result = await api('POST', '/test/print-event');
  showAlert('config', result.success ? 'success' : 'error', result.message);
}

async function simulateTrigger() {
  showAlert('config', 'info', '🎬 Simulating automated event trigger...', false);
  const result = await api('POST', '/test/simulate-trigger');
  showAlert('config', result.success ? 'success' : 'error', result.message);
}

// --- Printer Scanner ---
async function scanForPrinters() {
  showAlert('config', 'info', 'Scanning for printers...', false);
  const result = await api('GET', '/printers/scan');

  if (!result.success) {
    showAlert('config', 'error', result.error);
    $('#printer-scan-results').style.display = 'none';
    return;
  }

  const { printers, count } = result.data;

  if (count === 0) {
    showAlert('config', 'warn', 'No printers found. Add a printer via CUPS at http://localhost:631');
    $('#printer-scan-results').style.display = 'none';
    return;
  }

  showAlert('config', 'success', `Found ${count} printer${count > 1 ? 's' : ''}`);

  // Display printer list
  const printerListEl = $('#printer-list');
  printerListEl.innerHTML = printers
    .map(
      (p) => `
    <div class="printer-item ${p.isDefault ? 'default' : ''}">
      <div class="printer-info">
        <strong>${p.name}</strong>
        ${p.isDefault ? '<span class="badge">Default</span>' : ''}
        <div class="printer-status">${p.status}</div>
        <div class="printer-device">${p.device}</div>
      </div>
      <div class="printer-actions">
        ${!p.isDefault ? `<button class="btn btn-sm" onclick="setDefaultPrinter('${p.name}')">Set Default</button>` : ''}
        <button class="btn btn-sm" onclick="usePrinter('${p.name}')">Use This</button>
      </div>
    </div>
  `
    )
    .join('');

  $('#printer-scan-results').style.display = 'block';
}

async function setDefaultPrinter(printerName) {
  showAlert('config', 'info', `Setting ${printerName} as default...`, false);
  const result = await api('POST', '/printers/set-default', { printerName });

  if (result.success) {
    showAlert('config', 'success', result.message);
    // Refresh the printer list
    await scanForPrinters();
  } else {
    showAlert('config', 'error', result.error);
  }
}

function usePrinter(printerName) {
  $('#cfg-printer-name').value = printerName;
  showAlert('config', 'success', `Printer name set to: ${printerName}`);
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

// --- Logo Upload ---
let draggedColumn = null;

function setupLogoDragDrop() {
  const dropZone = $('#logo-drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadLogo(files[0]);
    }
  });
}

function handleLogoSelect(event) {
  const file = event.target.files[0];
  if (file) uploadLogo(file);
}

async function uploadLogo(file) {
  // Validate file type
  if (!file.type.match(/^image\/(png|jpe?g)$/)) {
    showAlert('config', 'error', 'Only PNG and JPEG images are allowed');
    return;
  }

  // Validate file size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showAlert('config', 'error', 'Image must be smaller than 2MB');
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);

  try {
    const response = await fetch('/api/config/logo', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();

    if (result.success) {
      displayLogoPreview(result.path);
      showAlert('config', 'success', 'Logo uploaded successfully');
      // Update config in memory
      currentJsonConfig.pdfLayout = currentJsonConfig.pdfLayout || {};
      currentJsonConfig.pdfLayout.logo = result.path;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showAlert('config', 'error', 'Failed to upload logo: ' + error.message);
  }
}

async function removeLogo() {
  try {
    const result = await api('DELETE', '/config/logo');
    if (result.success) {
      hideLogoPreview();
      showAlert('config', 'success', 'Logo removed');
      if (currentJsonConfig.pdfLayout) {
        currentJsonConfig.pdfLayout.logo = null;
      }
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showAlert('config', 'error', 'Failed to remove logo: ' + error.message);
  }
}

function displayLogoPreview(logoPath) {
  $('#logo-preview').src = '/' + logoPath + '?' + Date.now(); // Cache bust
  $('#logo-preview-container').style.display = 'block';
  $('#logo-upload-prompt').style.display = 'none';
}

function hideLogoPreview() {
  $('#logo-preview-container').style.display = 'none';
  $('#logo-upload-prompt').style.display = 'block';
  $('#logo-file-input').value = '';
}

// --- Column Management ---
function setupColumnDragDrop() {
  const list = $('#column-config-list');
  if (!list) return;

  list.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('column-config-item')) {
      draggedColumn = e.target;
      e.target.classList.add('dragging');
    }
  });

  list.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('column-config-item')) {
      e.target.classList.remove('dragging');
      draggedColumn = null;
      updateColumnsFromUI();
    }
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(list, e.clientY);
    if (afterElement == null) {
      list.appendChild(draggedColumn);
    } else {
      list.insertBefore(draggedColumn, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.column-config-item:not(.dragging)')];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function renderColumnConfig(columns) {
  const list = $('#column-config-list');
  if (!list) return;

  // Default columns if none provided
  const defaultColumns = [
    { id: 'name', header: 'Name', width: 200 },
    { id: 'phone', header: 'Phone', width: 120 },
    { id: 'signUpDate', header: 'Signed up', width: 100 },
    { id: 'fee', header: 'Fee', width: 80 },
  ];

  const cols = columns && columns.length > 0 ? columns : defaultColumns;

  list.innerHTML = cols
    .map(
      (col) => `
    <div class="column-config-item" draggable="true" data-column-id="${col.id}">
      <span class="drag-handle">&#8801;</span>
      <label class="column-checkbox">
        <input type="checkbox" checked onchange="updateColumnsFromUI()">
        <span class="column-name">${col.id}</span>
      </label>
      <input type="text" class="column-header-input form-control" value="${esc(col.header)}" onchange="updateColumnsFromUI()" placeholder="Header">
      <input type="number" class="column-width-input form-control" value="${col.width}" min="50" max="300" onchange="updateColumnsFromUI()">
    </div>
  `
    )
    .join('');
}

function updateColumnsFromUI() {
  const items = document.querySelectorAll('.column-config-item');
  const columns = [];

  items.forEach((item) => {
    const id = item.dataset.columnId;
    const enabled = item.querySelector('input[type="checkbox"]').checked;
    const header = item.querySelector('.column-header-input').value;
    const width = parseInt(item.querySelector('.column-width-input').value);

    if (enabled) {
      columns.push({ id, header, width });
    }
  });

  // Update currentJsonConfig
  currentJsonConfig.pdfLayout = currentJsonConfig.pdfLayout || {};
  currentJsonConfig.pdfLayout.columns = columns;
}

// --- PDF Preview ---
async function generatePreview() {
  try {
    showAlert('config', 'info', 'Generating preview...', false);

    const response = await fetch('/api/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to generate preview');
    }

    // Open PDF in new tab
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    showAlert('config', 'success', 'Preview generated');
  } catch (error) {
    showAlert('config', 'error', 'Failed to generate preview: ' + error.message);
  }
}

// --- Init ---
loadDashboard();
dashboardTimer = setInterval(loadDashboard, 30000);
setupLogoDragDrop();
setupColumnDragDrop();
