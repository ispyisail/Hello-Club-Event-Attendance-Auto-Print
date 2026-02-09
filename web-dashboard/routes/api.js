'use strict';

const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { testApiConnection, testEmailConnection } = require('../connection-tests');

const execFileAsync = promisify(execFile);
const APP_DIR = path.resolve(__dirname, '../..');
const SERVICE_NAME = 'helloclub';

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const assetsDir = path.join(APP_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    cb(null, assetsDir);
  },
  filename: (req, file, cb) => {
    // Always overwrite with 'logo.png'
    cb(null, 'logo.png');
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed'));
    }
  },
});

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

// --- PDF Preview ---

router.post('/preview-pdf', async (req, res) => {
  try {
    // Load current config
    const config = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8'));
    const pdfLayout = config.pdfLayout || {};

    // Generate sample event data
    const sampleEvent = {
      name: 'Sample Event Preview',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      timezone: 'UTC',
    };

    // Generate sample attendee data
    const sampleAttendees = [
      {
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-0100',
        signUpDate: new Date().toISOString(),
        isPaid: true,
        hasFee: true,
        rule: { name: 'Standard', fee: 25 },
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '555-0101',
        signUpDate: new Date(Date.now() - 86400000).toISOString(),
        isPaid: false,
        hasFee: true,
        rule: { name: 'Standard', fee: 25 },
      },
      {
        firstName: 'Bob',
        lastName: 'Wilson',
        phone: '555-0102',
        signUpDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        isPaid: true,
        hasFee: true,
        rule: { name: 'Membership', fee: 0 },
      },
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '555-0103',
        signUpDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        isPaid: true,
        hasFee: true,
        rule: { name: 'Standard', fee: 25 },
      },
      {
        firstName: 'Charlie',
        lastName: 'Brown',
        phone: '555-0104',
        signUpDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        isPaid: false,
        hasFee: true,
        rule: { name: 'Standard', fee: 25 },
      },
      {
        firstName: 'Emma',
        lastName: 'Davis',
        phone: '555-0105',
        signUpDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        isPaid: true,
        hasFee: false,
        rule: { name: 'Free', fee: 0 },
      },
      {
        firstName: 'David',
        lastName: 'Miller',
        phone: '555-0106',
        signUpDate: new Date(Date.now() - 6 * 86400000).toISOString(),
        isPaid: true,
        hasFee: true,
        rule: { name: 'Membership', fee: 0 },
      },
      {
        firstName: 'Sarah',
        lastName: 'Taylor',
        phone: '555-0107',
        signUpDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        isPaid: false,
        hasFee: true,
        rule: { name: 'Standard', fee: 30 },
      },
    ];

    // Generate PDF
    const PdfGenerator = require('../../src/services/pdf-generator');
    const generator = new PdfGenerator(sampleEvent, sampleAttendees, pdfLayout);
    const previewPath = path.join(APP_DIR, 'preview-temp.pdf');
    generator.generate('preview-temp.pdf');

    // Wait for PDF generation to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Stream PDF to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
    const stream = fs.createReadStream(previewPath);
    stream.pipe(res);
    stream.on('end', () => {
      // Cleanup temp file
      try {
        fs.unlinkSync(previewPath);
      } catch (_e) {
        // Ignore cleanup errors
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// --- Logo Upload ---

router.post('/config/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, error: 'No file uploaded' });
    }

    const logoPath = 'assets/logo.png';

    // Update config.json with logo path
    const configPath = path.join(APP_DIR, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.pdfLayout = config.pdfLayout || {};
    config.pdfLayout.logo = logoPath;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    res.json({ success: true, path: logoPath });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

router.delete('/config/logo', (req, res) => {
  try {
    const logoPath = path.join(APP_DIR, 'assets', 'logo.png');

    // Delete logo file if it exists
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Update config.json to remove logo
    const configPath = path.join(APP_DIR, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.pdfLayout) {
      config.pdfLayout.logo = null;
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
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
