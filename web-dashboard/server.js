'use strict';

// Load environment variables from .env file
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { spawn } = require('child_process');
const express = require('express');
const { WebSocketServer } = require('ws');
const auth = require('./middleware/auth');
const apiRoutes = require('./routes/api');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/logs' });

const PORT = parseInt(process.env.DASHBOARD_PORT) || 3000;
const LOG_FILE = path.resolve(__dirname, '..', 'activity.log');
const APP_DIR = path.resolve(__dirname, '..');
const MAX_WS_CLIENTS = 5;

app.use(express.json());
app.use(auth);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(APP_DIR, 'assets')));
app.use('/api', apiRoutes);

// WebSocket: stream live logs
wss.on('connection', (ws) => {
  if (wss.clients.size > MAX_WS_CLIENTS) {
    ws.close(1013, 'Too many connections');
    return;
  }
  // Send last 100 lines immediately on connect
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(Boolean).slice(-100);
    ws.send(JSON.stringify({ type: 'history', lines }));
  } catch (_e) {
    ws.send(JSON.stringify({ type: 'history', lines: [] }));
  }

  // Tail for live updates
  const tail = spawn('tail', ['-f', '-n', '0', LOG_FILE]);

  tail.stdout.on('data', (data) => {
    if (ws.readyState === ws.OPEN) {
      const lines = data.toString().split('\n').filter(Boolean);
      ws.send(JSON.stringify({ type: 'lines', lines }));
    }
  });

  tail.on('error', (err) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => tail.kill());
  ws.on('error', () => tail.kill());
});

server.listen(PORT, () => {
  console.log(`Hello Club Dashboard running on http://localhost:${PORT}`);
});

module.exports = server;
