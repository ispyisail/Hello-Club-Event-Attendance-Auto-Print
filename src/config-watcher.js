/**
 * @fileoverview Configuration file watcher for hot-reload capability.
 * @module config-watcher
 */

const fs = require('fs');
const logger = require('./logger');
const configSchema = require('./config-schema');

let currentConfig = null;
let watcher = null;
let reloadCallback = null;

/**
 * Starts watching the configuration file for changes.
 * @param {string} configPath - Path to the config file.
 * @param {Function} callback - Callback function to call when config changes.
 * @returns {fs.FSWatcher} File watcher instance.
 */
function watchConfig(configPath, callback) {
  if (watcher) {
    logger.warn('Config watcher already running');
    return watcher;
  }

  reloadCallback = callback;

  // Initial load
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    currentConfig = JSON.parse(configData);
    logger.info('Initial config loaded');
  } catch (error) {
    logger.error('Failed to load initial config:', error.message);
  }

  // Watch for changes
  watcher = fs.watch(configPath, (eventType, filename) => {
    if (eventType === 'change') {
      logger.info('Configuration file changed, reloading...');
      reloadConfig(configPath);
    }
  });

  logger.info(`Watching configuration file: ${configPath}`);
  return watcher;
}

/**
 * Reloads the configuration file.
 * @param {string} configPath - Path to the config file.
 */
function reloadConfig(configPath) {
  try {
    // Read new configuration
    const configData = fs.readFileSync(configPath, 'utf8');
    const newConfig = JSON.parse(configData);

    // Validate new configuration
    const { error, value: validatedConfig } = configSchema.validate(newConfig);
    if (error) {
      logger.error('Invalid configuration, keeping current config:', error.details.map(d => d.message).join('\n'));
      return;
    }

    // Check if configuration actually changed
    if (JSON.stringify(currentConfig) === JSON.stringify(validatedConfig)) {
      logger.info('Configuration file changed but content is identical');
      return;
    }

    const oldConfig = currentConfig;
    currentConfig = validatedConfig;

    logger.info('='.repeat(50));
    logger.info('Configuration reloaded successfully');
    logger.info('='.repeat(50));

    // Log changes
    logConfigChanges(oldConfig, validatedConfig);

    // Call callback if provided
    if (reloadCallback) {
      reloadCallback(validatedConfig, oldConfig);
    }

  } catch (error) {
    logger.error('Failed to reload configuration:', error.message);
  }
}

/**
 * Logs configuration changes.
 * @param {Object} oldConfig - Previous configuration.
 * @param {Object} newConfig - New configuration.
 */
function logConfigChanges(oldConfig, newConfig) {
  const changes = [];

  // Check for changed values
  for (const key of Object.keys(newConfig)) {
    if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
      changes.push(`  ${key}: ${JSON.stringify(oldConfig[key])} → ${JSON.stringify(newConfig[key])}`);
    }
  }

  // Check for removed keys
  for (const key of Object.keys(oldConfig)) {
    if (!(key in newConfig)) {
      changes.push(`  ${key}: removed`);
    }
  }

  if (changes.length > 0) {
    logger.info('Configuration changes:');
    changes.forEach(change => logger.info(change));
  } else {
    logger.info('No significant changes detected');
  }
}

/**
 * Stops watching the configuration file.
 */
function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
    logger.info('Stopped watching configuration file');
  }
}

/**
 * Gets the current configuration.
 * @returns {Object} Current configuration.
 */
function getCurrentConfig() {
  return currentConfig;
}

module.exports = {
  watchConfig,
  stopWatching,
  getCurrentConfig,
  reloadConfig
};
