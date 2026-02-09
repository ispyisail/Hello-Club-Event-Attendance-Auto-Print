'use strict';

const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { testApiConnection, testEmailConnection } = require('../connection-tests');

const execFileAsync = promisify(execFile);
const APP_DIR = path.resolve(__dirname, '../..');
const SERVICE_NAME = 'helloclub';

// --- Service Control ---

router.get('/service/status', async (req, res) => {
  // Try health file first (written every 60s by the service)
  try {
    const healthFile = path.join(APP_DIR, 'service-health.json');
    if (fs.existsSync(healthFile)) {
      const health = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
      const ageSeconds = (Date.now() - new Date(health.timestamp).getTime()) / 1000;
      return res.json({ success: true, data: { ...health, running: ageSeconds < 120 } });
    }
  } catch (_e) {
    /* fall through to systemctl */
  }

  try {
    const { stdout } = await execFileAsync('systemctl', ['is-active', SERVICE_NAME]);
    res.json({ success: true, data: { running: stdout.trim() === 'active', status: stdout.trim() } });
  } catch (_e) {
    res.json({ success: true, data: { running: false, status: 'stopped' } });
  }
});

router.post('/service/start', async (req, res) => {
  try {
    await execFileAsync('sudo', ['/usr/bin/systemctl', 'start', SERVICE_NAME]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.stderr || error.message });
  }
});

router.post('/service/stop', async (req, res) => {
  try {
    await execFileAsync('sudo', ['/usr/bin/systemctl', 'stop', SERVICE_NAME]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.stderr || error.message });
  }
});

router.post('/service/restart', async (req, res) => {
  try {
    await execFileAsync('sudo', ['/usr/bin/systemctl', 'restart', SERVICE_NAME]);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.stderr || error.message });
  }
});

// --- Statistics ---

router.get('/statistics', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'statistics.json'), 'utf8'));
    res.json({ success: true, data });
  } catch (_e) {
    res.json({ success: false, error: 'Statistics not available yet' });
  }
});

// --- Logs ---

router.get('/logs/activity', (req, res) => {
  try {
    const lines = Math.min(parseInt(req.query.lines) || 200, 1000);
    const content = fs.readFileSync(path.join(APP_DIR, 'activity.log'), 'utf8');
    res.json({ success: true, data: content.split('\n').filter(Boolean).slice(-lines) });
  } catch (_e) {
    res.json({ success: false, error: 'Log not available' });
  }
});

// --- Config ---

router.get('/config/env', (req, res) => {
  try {
    res.json({ success: true, data: fs.readFileSync(path.join(APP_DIR, '.env'), 'utf8') });
  } catch (_e) {
    res.json({ success: false, error: '.env not found' });
  }
});

router.put('/config/env', (req, res) => {
  try {
    if (typeof req.body.content !== 'string') return res.json({ success: false, error: 'Invalid content' });
    fs.writeFileSync(path.join(APP_DIR, '.env'), req.body.content);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/config/json', (req, res) => {
  try {
    res.json({ success: true, data: JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8')) });
  } catch (_e) {
    res.json({ success: false, error: 'config.json not found' });
  }
});

router.put('/config/json', (req, res) => {
  try {
    fs.writeFileSync(path.join(APP_DIR, 'config.json'), JSON.stringify(req.body, null, 2) + '\n');
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// --- Connection Tests ---

router.post('/test/api', async (req, res) => {
  res.json(await testApiConnection());
});

router.post('/test/email', async (req, res) => {
  res.json(await testEmailConnection());
});

router.post('/test/print', async (req, res) => {
  const { testPrintConnection } = require('../connection-tests');
  res.json(await testPrintConnection());
});

// --- Fetch Categories from Hello Club ---

router.get('/fetch-categories', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 100); // Default 30, max 100
    const fetchWindowHours = days * 24;

    // Import api-client dynamically to use current .env
    delete require.cache[require.resolve('../../src/core/api-client')];
    const { getUpcomingEvents } = require('../../src/core/api-client');

    // Fetch events from Hello Club API
    const events = await getUpcomingEvents(fetchWindowHours, { allowStale: false });

    // Group events by category
    const categoryMap = {};

    events.forEach((event) => {
      const categoryName = event.category || 'Uncategorized';
      if (!categoryMap[categoryName]) {
        categoryMap[categoryName] = {
          name: categoryName,
          events: [],
        };
      }
      categoryMap[categoryName].events.push({
        id: event.id,
        name: event.name,
        date: event.startDate,
      });
    });

    // Convert to array and sort by event count (descending)
    const categories = Object.values(categoryMap)
      .map((cat) => ({
        name: cat.name,
        eventCount: cat.events.length,
        events: cat.events.sort((a, b) => new Date(a.date) - new Date(b.date)), // Sort events by date
        dateRange:
          cat.events.length > 0
            ? {
                from: cat.events[0].date,
                to: cat.events[cat.events.length - 1].date,
              }
            : null,
      }))
      .sort((a, b) => b.eventCount - a.eventCount); // Sort categories by event count

    res.json({
      success: true,
      data: {
        categories,
        totalEvents: events.length,
        searchDays: days,
      },
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message || 'Failed to fetch categories from Hello Club API',
    });
  }
});

module.exports = router;
