/**
 * @fileoverview Input validation for CLI arguments and configuration.
 * @module validation
 */

const fs = require('fs');
const logger = require('./logger');
const { getEventDetails } = require('./api-client');

/**
 * Validates CLI arguments for various commands.
 * @param {Object} argv - Parsed command-line arguments.
 * @param {Object} config - Application configuration.
 * @returns {Object} Validation result with errors array.
 */
function validateArguments(argv, config) {
  const errors = [];
  const command = argv._[0];

  // Validate fetch-events arguments
  if (command === 'fetch-events' || command === 'start-service') {
    if (argv.fetchWindowHours !== undefined) {
      if (argv.fetchWindowHours <= 0) {
        errors.push('fetchWindowHours must be positive');
      }
      if (argv.fetchWindowHours > 720) { // 30 days
        errors.push('fetchWindowHours should not exceed 720 (30 days)');
      }
    }
  }

  // Validate process-schedule arguments
  if (command === 'process-schedule' || command === 'start-service') {
    if (argv.preEventQueryMinutes !== undefined) {
      if (argv.preEventQueryMinutes <= 0) {
        errors.push('preEventQueryMinutes must be positive');
      }
      if (argv.preEventQueryMinutes > 1440) { // 24 hours
        errors.push('preEventQueryMinutes should not exceed 1440 (24 hours)');
      }
    }

    if (argv.output) {
      const ext = argv.output.toLowerCase();
      if (!ext.endsWith('.pdf')) {
        errors.push('output filename must end with .pdf');
      }
    }
  }

  // Validate start-service arguments
  if (command === 'start-service') {
    if (argv.serviceRunIntervalHours !== undefined) {
      if (argv.serviceRunIntervalHours <= 0) {
        errors.push('serviceRunIntervalHours must be positive');
      }
      if (argv.serviceRunIntervalHours < 0.1) {
        errors.push('serviceRunIntervalHours should not be less than 0.1 (6 minutes)');
      }
    }
  }

  // Validate cleanup arguments
  if (command === 'cleanup') {
    if (argv.days !== undefined && argv.days <= 0) {
      errors.push('days must be positive');
    }
  }

  // Validate list-events arguments
  if (command === 'list-events') {
    if (argv.limit !== undefined && argv.limit <= 0) {
      errors.push('limit must be positive');
    }
  }

  // Validate dashboard port
  if (command === 'dashboard') {
    if (argv.port !== undefined) {
      if (argv.port < 1024 || argv.port > 65535) {
        errors.push('port must be between 1024 and 65535');
      }
    }
  }

  // Validate backup path
  if (command === 'backup') {
    if (argv.path) {
      const dir = require('path').dirname(argv.path);
      if (!fs.existsSync(dir)) {
        errors.push(`backup directory does not exist: ${dir}`);
      }
    }
  }

  // Validate restore path
  if (command === 'restore') {
    if (!argv.path) {
      errors.push('restore path is required');
    } else if (!fs.existsSync(argv.path)) {
      errors.push(`backup file does not exist: ${argv.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates the application configuration on startup.
 * @param {Object} config - Application configuration.
 * @returns {Promise<Object>} Validation result with errors array.
 */
async function validateConfiguration(config) {
  const errors = [];
  const warnings = [];

  // Check API key
  if (!process.env.API_KEY) {
    errors.push('API_KEY environment variable is not set');
  }

  // Validate numeric configuration
  if (config.fetchWindowHours <= 0) {
    errors.push('fetchWindowHours must be positive');
  }

  if (config.preEventQueryMinutes <= 0) {
    errors.push('preEventQueryMinutes must be positive');
  }

  if (config.serviceRunIntervalHours && config.serviceRunIntervalHours <= 0) {
    errors.push('serviceRunIntervalHours must be positive');
  }

  // Check if preEventQueryMinutes is reasonable
  if (config.preEventQueryMinutes > 60) {
    warnings.push('preEventQueryMinutes > 60 may cause events to be processed too early');
  }

  // Validate print mode
  const validPrintModes = ['local', 'email'];
  if (config.printMode && !validPrintModes.includes(config.printMode)) {
    errors.push(`printMode must be one of: ${validPrintModes.join(', ')}`);
  }

  // Check email configuration if print mode is email
  if (config.printMode === 'email') {
    if (!process.env.PRINTER_EMAIL) {
      errors.push('PRINTER_EMAIL environment variable required for email print mode');
    }
    if (!process.env.SMTP_USER) {
      errors.push('SMTP_USER environment variable required for email print mode');
    }
    if (!process.env.SMTP_PASS) {
      errors.push('SMTP_PASS environment variable required for email print mode');
    }
  }

  // Validate PDF layout
  if (config.pdfLayout) {
    if (config.pdfLayout.logo && !fs.existsSync(config.pdfLayout.logo)) {
      warnings.push(`PDF logo file not found: ${config.pdfLayout.logo}`);
    }

    if (config.pdfLayout.columns) {
      if (!Array.isArray(config.pdfLayout.columns)) {
        errors.push('pdfLayout.columns must be an array');
      } else if (config.pdfLayout.columns.length === 0) {
        errors.push('pdfLayout.columns must not be empty');
      } else {
        config.pdfLayout.columns.forEach((col, index) => {
          if (!col.id) {
            errors.push(`pdfLayout.columns[${index}] missing required 'id' field`);
          }
          if (!col.header) {
            errors.push(`pdfLayout.columns[${index}] missing required 'header' field`);
          }
          if (!col.width || col.width <= 0) {
            errors.push(`pdfLayout.columns[${index}] 'width' must be positive`);
          }
        });
      }
    }
  }

  // Check categories if specified
  if (config.allowedCategories && !Array.isArray(config.allowedCategories)) {
    errors.push('categories must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Tests API connectivity.
 * @returns {Promise<Object>} Test result.
 */
async function testApiConnection() {
  try {
    // Try to fetch a known endpoint
    const response = await require('./api-client').api.get('/event', {
      params: {
        limit: 1
      }
    });
    return {
      success: true,
      message: 'API connection successful'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      statusCode: error.response?.status
    };
  }
}

/**
 * Tests database connectivity and permissions.
 * @returns {Object} Test result.
 */
function testDatabaseConnection() {
  try {
    const { getDb } = require('./database');
    const db = getDb();

    // Try to read
    db.prepare('SELECT COUNT(*) as count FROM events').get();

    // Try to write
    const testId = `test-${Date.now()}`;
    db.prepare("INSERT INTO events (id, name, startDate, status) VALUES (?, ?, ?, ?)")
      .run(testId, 'Test Event', new Date().toISOString(), 'pending');

    // Clean up
    db.prepare('DELETE FROM events WHERE id = ?').run(testId);

    return {
      success: true,
      message: 'Database connection and permissions OK'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Runs all startup validation checks.
 * @param {Object} config - Application configuration.
 * @returns {Promise<Object>} Validation results.
 */
async function runStartupValidation(config) {
  logger.info('Running startup validation checks...');

  const results = {
    configuration: await validateConfiguration(config),
    database: testDatabaseConnection(),
    api: await testApiConnection()
  };

  // Log results
  if (results.configuration.errors.length > 0) {
    logger.error('Configuration validation failed:');
    results.configuration.errors.forEach(err => logger.error(`  - ${err}`));
  }

  if (results.configuration.warnings.length > 0) {
    logger.warn('Configuration warnings:');
    results.configuration.warnings.forEach(warn => logger.warn(`  - ${warn}`));
  }

  if (!results.database.success) {
    logger.error(`Database validation failed: ${results.database.message}`);
  }

  if (!results.api.success) {
    logger.error(`API validation failed: ${results.api.message}`);
  }

  const allValid = results.configuration.valid &&
                   results.database.success &&
                   results.api.success;

  if (allValid) {
    logger.info('✓ All startup validation checks passed');
  } else {
    logger.error('✗ Startup validation failed');
  }

  return {
    ...results,
    allValid
  };
}

module.exports = {
  validateArguments,
  validateConfiguration,
  testApiConnection,
  testDatabaseConnection,
  runStartupValidation
};
