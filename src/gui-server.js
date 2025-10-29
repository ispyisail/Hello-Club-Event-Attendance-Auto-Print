/**
 * GUI Control Center Server
 *
 * Unified web interface for managing Hello Club Event Attendance Auto-Print
 * - Real-time updates via Socket.io
 * - Service control (start/stop/restart)
 * - Configuration management
 * - Log viewing and monitoring
 * - Health checks and metrics
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const logger = require('./logger');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration
const GUI_PORT = process.env.GUI_PORT || 3000;

// Detect if running as executable or Node.js
// When running as exe, use process.cwd() instead of __dirname
const IS_PKG = typeof process.pkg !== 'undefined';
const BASE_PATH = IS_PKG ? process.cwd() : __dirname;
const PROJECT_ROOT = IS_PKG ? process.cwd() : path.join(__dirname, '..');
const GUI_PUBLIC_PATH = IS_PKG
    ? path.join(process.cwd(), 'src', 'gui', 'public')
    : path.join(__dirname, 'gui', 'public');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(GUI_PUBLIC_PATH));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get service status (NSSM or node-windows)
 */
function getServiceStatus() {
    try {
        // Check NSSM first
        const nssmPath = path.join(PROJECT_ROOT, 'nssm', 'nssm-2.24', 'win64', 'nssm.exe');
        if (fs.existsSync(nssmPath)) {
            const output = execSync(`"${nssmPath}" status HelloClubAttendance`, { encoding: 'utf8' });
            const status = output.trim();
            return {
                installed: true,
                running: status === 'SERVICE_RUNNING',
                status: status,
                type: 'nssm'
            };
        }

        // Check node-windows service
        const output = execSync('sc query HelloClubAttendance', { encoding: 'utf8' });
        const running = output.includes('RUNNING');
        return {
            installed: true,
            running: running,
            status: running ? 'RUNNING' : 'STOPPED',
            type: 'windows'
        };
    } catch (error) {
        return {
            installed: false,
            running: false,
            status: 'NOT_INSTALLED',
            type: null
        };
    }
}

/**
 * Start the service
 */
function startService() {
    try {
        const nssmPath = path.join(PROJECT_ROOT, 'nssm', 'nssm-2.24', 'win64', 'nssm.exe');
        if (fs.existsSync(nssmPath)) {
            execSync(`"${nssmPath}" start HelloClubAttendance`);
        } else {
            execSync('sc start HelloClubAttendance');
        }
        return { success: true, message: 'Service started successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Stop the service
 */
function stopService() {
    try {
        const nssmPath = path.join(PROJECT_ROOT, 'nssm', 'nssm-2.24', 'win64', 'nssm.exe');
        if (fs.existsSync(nssmPath)) {
            execSync(`"${nssmPath}" stop HelloClubAttendance`);
        } else {
            execSync('sc stop HelloClubAttendance');
        }
        return { success: true, message: 'Service stopped successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Restart the service
 */
function restartService() {
    try {
        const nssmPath = path.join(PROJECT_ROOT, 'nssm', 'nssm-2.24', 'win64', 'nssm.exe');
        if (fs.existsSync(nssmPath)) {
            execSync(`"${nssmPath}" restart HelloClubAttendance`);
        } else {
            execSync('sc stop HelloClubAttendance');
            setTimeout(() => {
                execSync('sc start HelloClubAttendance');
            }, 2000);
        }
        return { success: true, message: 'Service restarted successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get configuration from config.json
 */
function getConfiguration() {
    try {
        const configPath = path.join(PROJECT_ROOT, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { success: true, config: config };
        }
        return { success: false, message: 'config.json not found' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Save configuration to config.json
 */
function saveConfiguration(config) {
    try {
        const configPath = path.join(PROJECT_ROOT, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return { success: true, message: 'Configuration saved successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get environment variables from .env
 */
function getEnvVariables() {
    try {
        const envPath = path.join(PROJECT_ROOT, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const envVars = {};
            envContent.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    // Mask sensitive values
                    if (key.includes('KEY') || key.includes('PASS') || key.includes('TOKEN')) {
                        value = value ? '********' : '';
                    }
                    envVars[key] = value;
                }
            });
            return { success: true, env: envVars };
        }
        return { success: false, message: '.env not found' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get log file contents (last N lines)
 */
function getLogs(logType = 'activity', lines = 100) {
    try {
        const logFiles = {
            activity: path.join(PROJECT_ROOT, 'activity.log'),
            error: path.join(PROJECT_ROOT, 'error.log')
        };

        const logPath = logFiles[logType];
        if (!fs.existsSync(logPath)) {
            return { success: true, logs: [] };
        }

        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.split('\n').filter(line => line.trim());
        const recentLines = allLines.slice(-lines);

        return { success: true, logs: recentLines };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get health check status
 */
function getHealthStatus() {
    try {
        const statusPath = path.join(PROJECT_ROOT, 'status.json');
        if (fs.existsSync(statusPath)) {
            const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            return { success: true, health: status };
        }
        return { success: false, message: 'status.json not found' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get metrics
 */
function getMetrics() {
    try {
        const metricsPath = path.join(PROJECT_ROOT, 'metrics.json');
        if (fs.existsSync(metricsPath)) {
            const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
            return { success: true, metrics: metrics };
        }
        return { success: false, message: 'metrics.json not found' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get database statistics
 */
function getDatabaseStats() {
    try {
        const dbPath = path.join(PROJECT_ROOT, 'events.db');
        if (!fs.existsSync(dbPath)) {
            return { success: true, stats: { exists: false } };
        }

        const stats = fs.statSync(dbPath);
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true });

        const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
        const processedCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE processed = 1').get().count;

        db.close();

        return {
            success: true,
            stats: {
                exists: true,
                size: stats.size,
                totalEvents: eventCount,
                processedEvents: processedCount,
                pendingEvents: eventCount - processedCount,
                lastModified: stats.mtime
            }
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get circuit breaker states
 */
function getCircuitBreakerStates() {
    try {
        const { getAllStates } = require('./circuit-breaker');
        const states = getAllStates();
        return { success: true, states: states };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Get dead letter queue
 */
function getDeadLetterQueue() {
    try {
        const { getQueue } = require('./dead-letter-queue');
        const queue = getQueue();
        return { success: true, queue: queue };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET / - Main dashboard
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(GUI_PUBLIC_PATH, 'index.html'));
});

/**
 * GET /api/status - Get overall system status
 */
app.get('/api/status', (req, res) => {
    const serviceStatus = getServiceStatus();
    const healthStatus = getHealthStatus();
    const dbStats = getDatabaseStats();

    res.json({
        service: serviceStatus,
        health: healthStatus.success ? healthStatus.health : null,
        database: dbStats.success ? dbStats.stats : null
    });
});

/**
 * GET /api/service/status - Get service status
 */
app.get('/api/service/status', (req, res) => {
    const status = getServiceStatus();
    res.json(status);
});

/**
 * POST /api/service/start - Start service
 */
app.post('/api/service/start', (req, res) => {
    const result = startService();
    res.json(result);

    // Broadcast status update to all connected clients
    setTimeout(() => {
        io.emit('service-status', getServiceStatus());
    }, 2000);
});

/**
 * POST /api/service/stop - Stop service
 */
app.post('/api/service/stop', (req, res) => {
    const result = stopService();
    res.json(result);

    // Broadcast status update to all connected clients
    setTimeout(() => {
        io.emit('service-status', getServiceStatus());
    }, 2000);
});

/**
 * POST /api/service/restart - Restart service
 */
app.post('/api/service/restart', (req, res) => {
    const result = restartService();
    res.json(result);

    // Broadcast status update to all connected clients
    setTimeout(() => {
        io.emit('service-status', getServiceStatus());
    }, 3000);
});

/**
 * GET /api/config - Get configuration
 */
app.get('/api/config', (req, res) => {
    const config = getConfiguration();
    res.json(config);
});

/**
 * POST /api/config - Save configuration
 */
app.post('/api/config', (req, res) => {
    const result = saveConfiguration(req.body);
    res.json(result);

    // Broadcast config update to all connected clients
    if (result.success) {
        io.emit('config-updated', req.body);
    }
});

/**
 * GET /api/env - Get environment variables
 */
app.get('/api/env', (req, res) => {
    const env = getEnvVariables();
    res.json(env);
});

/**
 * GET /api/logs/:type - Get logs
 */
app.get('/api/logs/:type', (req, res) => {
    const logType = req.params.type;
    const lines = parseInt(req.query.lines) || 100;
    const logs = getLogs(logType, lines);
    res.json(logs);
});

/**
 * GET /api/health - Get health status
 */
app.get('/api/health', (req, res) => {
    const health = getHealthStatus();
    res.json(health);
});

/**
 * GET /api/metrics - Get metrics
 */
app.get('/api/metrics', (req, res) => {
    const metrics = getMetrics();
    res.json(metrics);
});

/**
 * GET /api/database/stats - Get database statistics
 */
app.get('/api/database/stats', (req, res) => {
    const stats = getDatabaseStats();
    res.json(stats);
});

/**
 * GET /api/circuit-breakers - Get circuit breaker states
 */
app.get('/api/circuit-breakers', (req, res) => {
    const states = getCircuitBreakerStates();
    res.json(states);
});

/**
 * POST /api/circuit-breakers/:name/reset - Reset circuit breaker
 */
app.post('/api/circuit-breakers/:name/reset', (req, res) => {
    try {
        const { getCircuitBreaker } = require('./circuit-breaker');
        const breaker = getCircuitBreaker(req.params.name);
        breaker.reset();
        res.json({ success: true, message: `Circuit breaker '${req.params.name}' reset` });

        // Broadcast update
        io.emit('circuit-breaker-reset', req.params.name);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * GET /api/dlq - Get dead letter queue
 */
app.get('/api/dlq', (req, res) => {
    const queue = getDeadLetterQueue();
    res.json(queue);
});

/**
 * POST /api/dlq/:id/retry - Retry failed job
 */
app.post('/api/dlq/:id/retry', async (req, res) => {
    try {
        const { retryJob } = require('./dead-letter-queue');
        const { processScheduledEvents } = require('./functions');
        const finalConfig = require('./config-loader').loadConfig();

        const success = await retryJob(req.params.id, async (jobData) => {
            if (jobData.type === 'print') {
                await processScheduledEvents(finalConfig);
            }
        });

        res.json({
            success: success,
            message: success ? 'Job retried successfully' : 'Failed to retry job'
        });

        // Broadcast update
        if (success) {
            io.emit('dlq-job-retried', req.params.id);
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/tools/fetch-events - Fetch events
 */
app.post('/api/tools/fetch-events', async (req, res) => {
    try {
        const { fetchAndStoreEvents } = require('./functions');
        const finalConfig = require('./config-loader').loadConfig();

        await fetchAndStoreEvents(finalConfig);
        res.json({ success: true, message: 'Events fetched successfully' });

        // Broadcast update
        io.emit('events-fetched');
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/tools/process-schedule - Process schedule
 */
app.post('/api/tools/process-schedule', async (req, res) => {
    try {
        const { processScheduledEvents } = require('./functions');
        const finalConfig = require('./config-loader').loadConfig();

        await processScheduledEvents(finalConfig);
        res.json({ success: true, message: 'Schedule processed successfully' });

        // Broadcast update
        io.emit('schedule-processed');
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/tools/backup - Create backup
 */
app.post('/api/tools/backup', async (req, res) => {
    try {
        const { createBackup } = require('./backup-scheduler');
        await createBackup();
        res.json({ success: true, message: 'Backup created successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * POST /api/tools/cache-clear - Clear PDF cache
 */
app.post('/api/tools/cache-clear', (req, res) => {
    try {
        const { clearCache } = require('./pdf-cache');
        clearCache();
        res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ============================================================================
// Socket.io Real-time Updates
// ============================================================================

io.on('connection', (socket) => {
    logger.info(`GUI client connected: ${socket.id}`);

    // Send initial status
    socket.emit('service-status', getServiceStatus());
    socket.emit('health-status', getHealthStatus());
    socket.emit('database-stats', getDatabaseStats());

    // Handle client disconnect
    socket.on('disconnect', () => {
        logger.info(`GUI client disconnected: ${socket.id}`);
    });

    // Client requesting status update
    socket.on('request-status', () => {
        socket.emit('service-status', getServiceStatus());
        socket.emit('health-status', getHealthStatus());
        socket.emit('database-stats', getDatabaseStats());
    });

    // Client requesting logs
    socket.on('request-logs', (data) => {
        const logType = data.type || 'activity';
        const lines = data.lines || 100;
        const logs = getLogs(logType, lines);
        socket.emit('logs-update', logs);
    });
});

// Broadcast status updates every 5 seconds
setInterval(() => {
    io.emit('service-status', getServiceStatus());
    io.emit('health-status', getHealthStatus());
    io.emit('database-stats', getDatabaseStats());
}, 5000);

// Broadcast metrics updates every 10 seconds
setInterval(() => {
    io.emit('metrics-update', getMetrics());
}, 10000);

// ============================================================================
// Start Server
// ============================================================================

function startGuiServer(port = GUI_PORT) {
    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            logger.info(`GUI Control Center running at http://localhost:${port}`);
            console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                   Hello Club - GUI Control Center                          ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Server running at: http://localhost:${port}                                   ║
║                                                                            ║
║  Features:                                                                 ║
║    ✓ Real-time service monitoring                                         ║
║    ✓ Service control (start/stop/restart)                                 ║
║    ✓ Configuration editor                                                 ║
║    ✓ Live log viewer                                                      ║
║    ✓ Health monitoring                                                    ║
║    ✓ Database statistics                                                  ║
║    ✓ Circuit breaker management                                           ║
║    ✓ Dead letter queue viewer                                             ║
║    ✓ Tools & utilities                                                    ║
║                                                                            ║
║  Press Ctrl+C to stop                                                      ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
            `);
            resolve(server);
        });

        server.on('error', (error) => {
            logger.error(`GUI server error: ${error.message}`);
            reject(error);
        });
    });
}

module.exports = { startGuiServer };

// If run directly, start the server
if (require.main === module) {
    startGuiServer().catch(error => {
        console.error('Failed to start GUI server:', error);
        process.exit(1);
    });
}
