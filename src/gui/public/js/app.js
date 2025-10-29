/**
 * Hello Club - GUI Control Center
 * Client-side JavaScript with Socket.io for real-time updates
 */

// ============================================================================
// Global Variables
// ============================================================================

let socket;
let currentLogType = 'activity';
let autoRefreshLogs = true;
let logRefreshInterval;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeSocketIO();
    initializeTabs();
    checkConfigFiles();
    loadConfig();
    loadEnv();
    loadLogs();
    startLogAutoRefresh();
});

// ============================================================================
// Socket.IO Connection
// ============================================================================

function initializeSocketIO() {
    socket = io();

    // Connection status
    socket.on('connect', () => {
        updateConnectionStatus('connected');
        console.log('Connected to GUI server');
    });

    socket.on('disconnect', () => {
        updateConnectionStatus('disconnected');
        console.log('Disconnected from GUI server');
    });

    socket.on('connect_error', () => {
        updateConnectionStatus('disconnected');
    });

    // Real-time updates
    socket.on('service-status', (status) => {
        updateServiceStatus(status);
    });

    socket.on('health-status', (health) => {
        updateHealthStatus(health);
    });

    socket.on('database-stats', (stats) => {
        updateDatabaseStats(stats);
    });

    socket.on('metrics-update', (metrics) => {
        updateMetrics(metrics);
    });

    socket.on('logs-update', (logs) => {
        displayLogs(logs);
    });

    socket.on('config-updated', () => {
        loadConfig();
        checkConfigFiles();
        showNotification('Configuration updated', 'success');
    });

    socket.on('config-created', () => {
        loadConfig();
        checkConfigFiles();
        showNotification('config.json created from example', 'success');
    });

    socket.on('env-updated', () => {
        loadEnv();
        checkConfigFiles();
        showNotification('.env file updated', 'success');
    });

    socket.on('env-created', () => {
        loadEnv();
        checkConfigFiles();
        showNotification('.env file created from example', 'success');
    });

    socket.on('circuit-breaker-reset', (name) => {
        showNotification(`Circuit breaker '${name}' reset`, 'info');
        loadCircuitBreakers();
    });

    socket.on('dlq-job-retried', (id) => {
        showNotification(`Job ${id} retried`, 'success');
        loadDeadLetterQueue();
    });

    socket.on('events-fetched', () => {
        showNotification('Events fetched successfully', 'success');
        socket.emit('request-status');
    });

    socket.on('schedule-processed', () => {
        showNotification('Schedule processed successfully', 'success');
        socket.emit('request-status');
    });
}

function updateConnectionStatus(status) {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;

    indicator.className = 'status-indicator';

    if (status === 'connected') {
        indicator.classList.add('status-connected');
        indicator.textContent = 'Connected';
    } else if (status === 'disconnected') {
        indicator.classList.add('status-disconnected');
        indicator.textContent = 'Disconnected';
    } else {
        indicator.classList.add('status-connecting');
        indicator.textContent = 'Connecting...';
    }

    updateLastUpdateTime();
}

// ============================================================================
// Tab Navigation
// ============================================================================

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Activate selected button
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    // Load tab-specific content
    loadTabContent(tabName);
}

function loadTabContent(tabName) {
    switch (tabName) {
        case 'dashboard':
            socket.emit('request-status');
            break;
        case 'service':
            loadServiceDetails();
            break;
        case 'config':
            checkConfigFiles();
            loadConfig();
            loadEnv();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'monitoring':
            loadCircuitBreakers();
            loadDeadLetterQueue();
            loadMetrics();
            break;
    }
}

// ============================================================================
// Service Status Updates
// ============================================================================

function updateServiceStatus(status) {
    // Update badge in header
    const badge = document.getElementById('service-status-badge');
    if (badge) {
        badge.className = 'status-badge';
        if (status.running) {
            badge.classList.add('running');
            badge.textContent = '● Running';
        } else if (status.installed) {
            badge.classList.add('stopped');
            badge.textContent = '○ Stopped';
        } else {
            badge.textContent = 'Not Installed';
        }
    }

    // Update dashboard
    const dashboardStatus = document.getElementById('dashboard-service-status');
    if (dashboardStatus) {
        let html = '<div class="info-grid">';
        html += `<div class="info-item"><strong>Status:</strong> <span class="${status.running ? 'text-success' : 'text-danger'}">${status.status}</span></div>`;
        html += `<div class="info-item"><strong>Type:</strong> ${status.type || 'Unknown'}</div>`;
        html += `<div class="info-item"><strong>Installed:</strong> ${status.installed ? 'Yes' : 'No'}</div>`;
        html += '</div>';
        dashboardStatus.innerHTML = html;
    }

    // Update service control page
    const serviceDetail = document.getElementById('service-status-detail');
    if (serviceDetail) {
        let html = '<div class="info-grid">';
        html += `<div class="info-item"><strong>Status:</strong> <span class="${status.running ? 'text-success' : 'text-danger'}">${status.status}</span></div>`;
        html += `<div class="info-item"><strong>Running:</strong> ${status.running ? '✓ Yes' : '✗ No'}</div>`;
        html += `<div class="info-item"><strong>Service Type:</strong> ${status.type || 'Not installed'}</div>`;
        html += '</div>';
        serviceDetail.innerHTML = html;
    }
}

function updateHealthStatus(health) {
    if (!health.success) return;

    const dashboardHealth = document.getElementById('dashboard-health');
    if (dashboardHealth && health.health) {
        const h = health.health;
        let html = '<div class="info-grid">';
        html += `<div class="info-item"><strong>Status:</strong> <span class="text-success">${h.status || 'Healthy'}</span></div>`;
        html += `<div class="info-item"><strong>Uptime:</strong> ${formatUptime(h.uptime)}</div>`;
        html += `<div class="info-item"><strong>Last Check:</strong> ${formatDate(h.timestamp)}</div>`;
        html += '</div>';
        dashboardHealth.innerHTML = html;
    }
}

function updateDatabaseStats(stats) {
    if (!stats.success) return;

    const dashboardDb = document.getElementById('dashboard-db-stats');
    if (dashboardDb && stats.stats && stats.stats.exists) {
        const s = stats.stats;
        let html = '<div class="info-grid">';
        html += `<div class="info-item"><strong>Total Events:</strong> ${s.totalEvents}</div>`;
        html += `<div class="info-item"><strong>Processed:</strong> ${s.processedEvents}</div>`;
        html += `<div class="info-item"><strong>Pending:</strong> ${s.pendingEvents}</div>`;
        html += `<div class="info-item"><strong>Size:</strong> ${formatBytes(s.size)}</div>`;
        html += '</div>';
        dashboardDb.innerHTML = html;
    } else if (dashboardDb) {
        dashboardDb.innerHTML = '<p class="text-muted">No database found</p>';
    }
}

// ============================================================================
// Service Control
// ============================================================================

async function startService() {
    try {
        const response = await fetch('/api/service/start', { method: 'POST' });
        const result = await response.json();
        showOperationResult('service-operation-result', result);
    } catch (error) {
        showOperationResult('service-operation-result', { success: false, message: error.message });
    }
}

async function stopService() {
    if (!confirm('Are you sure you want to stop the service?')) return;

    try {
        const response = await fetch('/api/service/stop', { method: 'POST' });
        const result = await response.json();
        showOperationResult('service-operation-result', result);
    } catch (error) {
        showOperationResult('service-operation-result', { success: false, message: error.message });
    }
}

async function restartService() {
    if (!confirm('Are you sure you want to restart the service?')) return;

    try {
        const response = await fetch('/api/service/restart', { method: 'POST' });
        const result = await response.json();
        showOperationResult('service-operation-result', result);
    } catch (error) {
        showOperationResult('service-operation-result', { success: false, message: error.message });
    }
}

async function loadServiceDetails() {
    try {
        const response = await fetch('/api/service/status');
        const status = await response.json();
        updateServiceStatus(status);
    } catch (error) {
        console.error('Failed to load service details:', error);
    }
}

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Check if config files exist and show status
 */
async function checkConfigFiles() {
    try {
        const response = await fetch('/api/config/check-files');
        const result = await response.json();

        if (result.success) {
            const files = result.files;

            // Update config.json status
            const configStatus = document.getElementById('config-file-status');
            const btnCreateConfig = document.getElementById('btn-create-config');

            if (configStatus) {
                if (files.configExists) {
                    configStatus.className = 'file-status exists';
                    configStatus.textContent = '✓ config.json exists';
                    if (btnCreateConfig) btnCreateConfig.style.display = 'none';
                } else if (files.configExampleExists) {
                    configStatus.className = 'file-status missing';
                    configStatus.textContent = '⚠️ config.json not found. Click "Create from Example" to get started.';
                    if (btnCreateConfig) btnCreateConfig.style.display = 'inline-block';
                } else {
                    configStatus.className = 'file-status missing';
                    configStatus.textContent = '⚠️ config.json and config.json.example not found';
                }
            }

            // Update .env status
            const envStatus = document.getElementById('env-file-status');
            const btnCreateEnv = document.getElementById('btn-create-env');

            if (envStatus) {
                if (files.envExists) {
                    envStatus.className = 'file-status exists';
                    envStatus.textContent = '✓ .env file exists';
                    if (btnCreateEnv) btnCreateEnv.style.display = 'none';
                } else if (files.envExampleExists) {
                    envStatus.className = 'file-status missing';
                    envStatus.textContent = '⚠️ .env file not found. Click "Create from Example" to get started.';
                    if (btnCreateEnv) btnCreateEnv.style.display = 'inline-block';
                } else {
                    envStatus.className = 'file-status missing';
                    envStatus.textContent = '⚠️ .env and .env.example not found';
                }
            }

            // Show banner if files are missing
            const banner = document.getElementById('config-status-banner');
            if (banner) {
                if (!files.configExists || !files.envExists) {
                    banner.className = 'status-banner warning';
                    banner.style.display = 'block';
                    const missing = [];
                    if (!files.configExists) missing.push('config.json');
                    if (!files.envExists) missing.push('.env');
                    banner.textContent = `⚠️ Configuration files missing: ${missing.join(', ')}. Create them from examples to get started.`;
                } else {
                    banner.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Failed to check config files:', error);
    }
}

/**
 * Load config.json
 */
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const result = await response.json();

        const textarea = document.getElementById('config-json');
        if (textarea) {
            if (result.success) {
                textarea.value = JSON.stringify(result.config, null, 2);
            } else {
                textarea.value = '// ' + result.message + '\n// Click "Create from Example" to create config.json';
                textarea.disabled = !document.getElementById('btn-create-config');
            }
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

/**
 * Save config.json
 */
async function saveConfig() {
    const textarea = document.getElementById('config-json');
    if (!textarea) return;

    try {
        const config = JSON.parse(textarea.value);
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const result = await response.json();
        showOperationResult('config-result', result);

        if (result.success) {
            showNotification('Configuration saved successfully. Restart service for changes to take effect.', 'success');
            checkConfigFiles(); // Refresh status
        }
    } catch (error) {
        showOperationResult('config-result', { success: false, message: 'Invalid JSON: ' + error.message });
    }
}

/**
 * Validate config.json JSON syntax
 */
function validateConfig() {
    const textarea = document.getElementById('config-json');
    if (!textarea) return;

    try {
        JSON.parse(textarea.value);
        showOperationResult('config-result', { success: true, message: 'Valid JSON ✓' });
    } catch (error) {
        showOperationResult('config-result', { success: false, message: 'Invalid JSON: ' + error.message });
    }
}

/**
 * Create config.json from config.json.example
 */
async function createConfigFromExample() {
    if (!confirm('Create config.json from config.json.example?')) return;

    try {
        const response = await fetch('/api/config/create-from-example', { method: 'POST' });
        const result = await response.json();

        showOperationResult('config-result', result);

        if (result.success) {
            showNotification('config.json created successfully', 'success');
            checkConfigFiles();
            loadConfig();
        }
    } catch (error) {
        showOperationResult('config-result', { success: false, message: error.message });
    }
}

/**
 * Load .env file
 */
async function loadEnv() {
    try {
        const response = await fetch('/api/env/raw');
        const result = await response.json();

        const textarea = document.getElementById('env-content');
        if (textarea) {
            if (result.success) {
                textarea.value = result.content;

                if (result.isExample) {
                    textarea.placeholder = 'Content loaded from .env.example. Click "Save .env File" to create .env.';
                } else if (!result.exists) {
                    textarea.value = '# .env file not found\n# Click "Create from Example" to create .env file';
                    textarea.disabled = true;
                } else {
                    textarea.placeholder = '';
                    textarea.disabled = false;
                }
            } else {
                textarea.value = '# ' + result.message + '\n# Click "Create from Example" to create .env file';
                textarea.disabled = !document.getElementById('btn-create-env');
            }
        }
    } catch (error) {
        console.error('Failed to load .env:', error);
    }
}

/**
 * Save .env file
 */
async function saveEnv() {
    const textarea = document.getElementById('env-content');
    if (!textarea) return;

    const content = textarea.value;

    try {
        const response = await fetch('/api/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content })
        });

        const result = await response.json();
        showOperationResult('env-result', result);

        if (result.success) {
            showNotification('.env file saved successfully. Restart service for changes to take effect.', 'success');
            checkConfigFiles(); // Refresh status
        }
    } catch (error) {
        showOperationResult('env-result', { success: false, message: error.message });
    }
}

/**
 * Create .env from .env.example
 */
async function createEnvFromExample() {
    if (!confirm('Create .env from .env.example?')) return;

    try {
        const response = await fetch('/api/env/create-from-example', { method: 'POST' });
        const result = await response.json();

        showOperationResult('env-result', result);

        if (result.success) {
            showNotification('.env file created successfully', 'success');
            checkConfigFiles();
            loadEnv();
        }
    } catch (error) {
        showOperationResult('env-result', { success: false, message: error.message });
    }
}

// ============================================================================
// Log Viewer
// ============================================================================

async function loadLogs(type = null) {
    if (type) {
        currentLogType = type;
    }

    const lines = document.getElementById('log-lines')?.value || 100;

    try {
        const response = await fetch(`/api/logs/${currentLogType}?lines=${lines}`);
        const result = await response.json();

        if (result.success) {
            displayLogs(result);
        }
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

function displayLogs(result) {
    const container = document.getElementById('log-content');
    if (!container || !result.success) return;

    if (result.logs.length === 0) {
        container.innerHTML = '<div class="text-muted">No log entries found</div>';
        return;
    }

    const html = result.logs.map(line => {
        let className = 'log-line';
        if (line.includes('ERROR') || line.includes('error')) {
            className += ' text-danger';
        } else if (line.includes('WARN') || line.includes('warn')) {
            className += ' text-warning';
        } else if (line.includes('INFO') || line.includes('info')) {
            className += ' text-info';
        }

        return `<div class="${className}">${escapeHtml(line)}</div>`;
    }).join('');

    container.innerHTML = html;

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function toggleAutoRefresh() {
    autoRefreshLogs = !autoRefreshLogs;

    const indicator = document.getElementById('auto-refresh-indicator');
    if (indicator) {
        indicator.textContent = `🔄 Auto-Refresh: ${autoRefreshLogs ? 'ON' : 'OFF'}`;
    }

    if (autoRefreshLogs) {
        startLogAutoRefresh();
    } else {
        stopLogAutoRefresh();
    }
}

function startLogAutoRefresh() {
    stopLogAutoRefresh();
    if (autoRefreshLogs) {
        logRefreshInterval = setInterval(() => {
            // Only refresh if logs tab is active
            const logsTab = document.getElementById('logs');
            if (logsTab && logsTab.classList.contains('active')) {
                loadLogs();
            }
        }, 5000); // Refresh every 5 seconds
    }
}

function stopLogAutoRefresh() {
    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }
}

// ============================================================================
// Monitoring
// ============================================================================

async function loadCircuitBreakers() {
    try {
        const response = await fetch('/api/circuit-breakers');
        const result = await response.json();

        if (result.success) {
            displayCircuitBreakers(result.states);
        }
    } catch (error) {
        console.error('Failed to load circuit breakers:', error);
    }
}

function displayCircuitBreakers(states) {
    const container = document.getElementById('circuit-breakers');
    if (!container) return;

    if (!states || Object.keys(states).length === 0) {
        container.innerHTML = '<p class="text-muted">No circuit breakers found</p>';
        return;
    }

    let html = '<div class="circuit-breaker-grid">';

    for (const [name, state] of Object.entries(states)) {
        const stateClass = state.state.toLowerCase().replace('_', '-');
        html += `
            <div class="circuit-breaker-item ${stateClass}">
                <div>
                    <strong>${name}</strong>
                    <div class="text-muted" style="font-size: 0.85rem;">
                        Failures: ${state.failures} | Success: ${state.successes}
                    </div>
                </div>
                <div>
                    <span class="status-badge">${state.state}</span>
                    <button class="btn btn-sm btn-secondary" onclick="resetCircuitBreaker('${name}')" style="margin-left: 0.5rem;">Reset</button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

async function resetCircuitBreaker(name) {
    try {
        const response = await fetch(`/api/circuit-breakers/${name}/reset`, { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            showNotification(result.message, 'success');
            loadCircuitBreakers();
        }
    } catch (error) {
        console.error('Failed to reset circuit breaker:', error);
    }
}

async function loadDeadLetterQueue() {
    try {
        const response = await fetch('/api/dlq');
        const result = await response.json();

        if (result.success) {
            displayDeadLetterQueue(result.queue);
        }
    } catch (error) {
        console.error('Failed to load DLQ:', error);
    }
}

function displayDeadLetterQueue(queue) {
    const container = document.getElementById('dead-letter-queue');
    if (!container) return;

    if (!queue || queue.length === 0) {
        container.innerHTML = '<p class="text-success">✓ Queue is empty - no failed jobs</p>';
        return;
    }

    let html = '';

    queue.forEach(job => {
        html += `
            <div class="dlq-item">
                <div class="dlq-item-header">
                    <strong>Job ${job.id}</strong>
                    <button class="btn btn-sm btn-primary" onclick="retryJob('${job.id}')">Retry</button>
                </div>
                <div class="dlq-item-details">
                    <div>Type: ${job.type}</div>
                    <div>Attempts: ${job.attempts}</div>
                    <div>Added: ${formatDate(job.timestamp)}</div>
                    <div>Error: ${job.error || 'Unknown error'}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function retryJob(id) {
    try {
        const response = await fetch(`/api/dlq/${id}/retry`, { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            showNotification('Job retried successfully', 'success');
            loadDeadLetterQueue();
        } else {
            showNotification('Failed to retry job: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Failed to retry job:', error);
    }
}

async function loadMetrics() {
    try {
        const response = await fetch('/api/metrics');
        const result = await response.json();

        if (result.success) {
            displayMetrics(result.metrics);
        }
    } catch (error) {
        console.error('Failed to load metrics:', error);
    }
}

function updateMetrics(result) {
    if (result.success) {
        displayMetrics(result.metrics);
    }
}

function displayMetrics(metrics) {
    const container = document.getElementById('metrics');
    if (!container || !metrics) return;

    let html = '<div class="info-grid">';
    html += `<div class="info-item"><strong>Total Requests:</strong> ${metrics.totalRequests || 0}</div>`;
    html += `<div class="info-item"><strong>Success:</strong> ${metrics.successfulRequests || 0}</div>`;
    html += `<div class="info-item"><strong>Errors:</strong> ${metrics.errors || 0}</div>`;
    html += `<div class="info-item"><strong>Avg Response Time:</strong> ${metrics.avgResponseTime || 0}ms</div>`;
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================================
// Tools
// ============================================================================

async function fetchEvents() {
    showToolResult('event-tools-result', { success: true, message: 'Fetching events...' }, 'info');

    try {
        const response = await fetch('/api/tools/fetch-events', { method: 'POST' });
        const result = await response.json();
        showToolResult('event-tools-result', result);
    } catch (error) {
        showToolResult('event-tools-result', { success: false, message: error.message });
    }
}

async function processSchedule() {
    showToolResult('event-tools-result', { success: true, message: 'Processing schedule...' }, 'info');

    try {
        const response = await fetch('/api/tools/process-schedule', { method: 'POST' });
        const result = await response.json();
        showToolResult('event-tools-result', result);
    } catch (error) {
        showToolResult('event-tools-result', { success: false, message: error.message });
    }
}

async function createBackup() {
    showToolResult('backup-result', { success: true, message: 'Creating backup...' }, 'info');

    try {
        const response = await fetch('/api/tools/backup', { method: 'POST' });
        const result = await response.json();
        showToolResult('backup-result', result);
    } catch (error) {
        showToolResult('backup-result', { success: false, message: error.message });
    }
}

async function clearCache() {
    if (!confirm('Are you sure you want to clear the PDF cache?')) return;

    showToolResult('cache-result', { success: true, message: 'Clearing cache...' }, 'info');

    try {
        const response = await fetch('/api/tools/cache-clear', { method: 'POST' });
        const result = await response.json();
        showToolResult('cache-result', result);
    } catch (error) {
        showToolResult('cache-result', { success: false, message: error.message });
    }
}

function showToolResult(elementId, result, forceType = null) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = 'operation-result';

    const type = forceType || (result.success ? 'success' : 'error');
    element.classList.add(type);
    element.textContent = result.message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// ============================================================================
// Utility Functions
// ============================================================================

function showOperationResult(elementId, result) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = 'operation-result';
    element.classList.add(result.success ? 'success' : 'error');
    element.textContent = result.message;
}

function showNotification(message, type = 'info') {
    // Simple console notification for now
    // Could be enhanced with toast notifications
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Update dashboard activity
    const activity = document.getElementById('dashboard-activity');
    if (activity) {
        const timestamp = new Date().toLocaleTimeString();
        const newActivity = `<div class="text-${type}">[${timestamp}] ${message}</div>`;
        activity.innerHTML = newActivity + activity.innerHTML;

        // Keep only last 5 activities
        const children = activity.children;
        while (children.length > 5) {
            activity.removeChild(children[children.length - 1]);
        }
    }
}

function updateLastUpdateTime() {
    const element = document.getElementById('last-update');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(ms) {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
