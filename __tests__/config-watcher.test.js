const fs = require('fs');
const {
  watchConfig,
  stopWatching,
  getCurrentConfig,
  reloadConfig
} = require('../src/config-watcher');

// Mock fs
jest.mock('fs');

// Mock logger
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock config-schema
jest.mock('../src/config-schema', () => ({
  validate: jest.fn((config) => ({
    error: null,
    value: config
  }))
}));

const logger = require('../src/logger');
const configSchema = require('../src/config-schema');

describe('Config Watcher Module', () => {
  let mockWatcher;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock watcher
    mockWatcher = {
      close: jest.fn()
    };

    fs.watch.mockReturnValue(mockWatcher);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      categories: ['Test'],
      fetchWindowHours: 24
    }));
  });

  afterEach(() => {
    // Clean up watcher
    stopWatching();
  });

  describe('watchConfig', () => {
    it('should start watching configuration file', () => {
      const callback = jest.fn();

      watchConfig('config.json', callback);

      expect(fs.watch).toHaveBeenCalledWith(
        'config.json',
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Watching'));
    });

    it('should load initial configuration', () => {
      const callback = jest.fn();

      watchConfig('config.json', callback);

      expect(fs.readFileSync).toHaveBeenCalledWith('config.json', 'utf8');
      expect(logger.info).toHaveBeenCalledWith('Initial config loaded');
    });

    it('should not create duplicate watchers', () => {
      const callback = jest.fn();

      const watcher1 = watchConfig('config.json', callback);
      const watcher2 = watchConfig('config.json', callback);

      expect(watcher1).toBe(watcher2);
      expect(logger.warn).toHaveBeenCalledWith('Config watcher already running');
    });

    it('should handle initial load errors gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const callback = jest.fn();
      watchConfig('config.json', callback);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load initial config:',
        expect.any(String)
      );
    });
  });

  describe('File Change Detection', () => {
    it('should trigger reload on file change', () => {
      const callback = jest.fn();
      let fileChangeHandler;

      fs.watch.mockImplementation((path, handler) => {
        fileChangeHandler = handler;
        return mockWatcher;
      });

      watchConfig('config.json', callback);

      // Simulate file change
      const newConfig = { categories: ['Updated'], fetchWindowHours: 48 };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));

      fileChangeHandler('change', 'config.json');

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it('should not reload on non-change events', () => {
      const callback = jest.fn();
      let fileChangeHandler;

      fs.watch.mockImplementation((path, handler) => {
        fileChangeHandler = handler;
        return mockWatcher;
      });

      watchConfig('config.json', callback);

      // Simulate rename event (not a change)
      fileChangeHandler('rename', 'config.json');

      // Callback should not be called for non-change events
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('reloadConfig', () => {
    beforeEach(() => {
      // Start watcher with initial config
      watchConfig('config.json', jest.fn());
    });

    it('should reload and validate new configuration', () => {
      const newConfig = { categories: ['New'], fetchWindowHours: 36 };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));

      reloadConfig('config.json');

      expect(configSchema.validate).toHaveBeenCalledWith(newConfig);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('reloaded successfully'));
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = { invalid: true };
      fs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      configSchema.validate.mockReturnValue({
        error: {
          details: [{ message: 'Invalid configuration' }]
        },
        value: null
      });

      reloadConfig('config.json');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid configuration'),
        expect.any(String)
      );
    });

    it('should detect when configuration has not changed', () => {
      const sameConfig = { categories: ['Test'], fetchWindowHours: 24 };
      fs.readFileSync.mockReturnValue(JSON.stringify(sameConfig));

      reloadConfig('config.json');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('content is identical')
      );
    });

    it('should call callback with old and new config', () => {
      const callback = jest.fn();
      stopWatching(); // Stop existing watcher

      const oldConfig = { categories: ['Old'], fetchWindowHours: 24 };
      fs.readFileSync.mockReturnValue(JSON.stringify(oldConfig));

      watchConfig('config.json', callback);

      const newConfig = { categories: ['New'], fetchWindowHours: 48 };
      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));

      reloadConfig('config.json');

      expect(callback).toHaveBeenCalledWith(newConfig, oldConfig);
    });

    it('should handle file read errors', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      reloadConfig('config.json');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to reload configuration:',
        expect.any(String)
      );
    });

    it('should handle JSON parse errors', () => {
      fs.readFileSync.mockReturnValue('{ invalid json }');

      reloadConfig('config.json');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to reload configuration:',
        expect.any(String)
      );
    });
  });

  describe('stopWatching', () => {
    it('should close the file watcher', () => {
      watchConfig('config.json', jest.fn());

      stopWatching();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Stopped watching configuration file');
    });

    it('should handle stopping when no watcher exists', () => {
      stopWatching();

      // Should not throw, and close should not be called
      expect(mockWatcher.close).not.toHaveBeenCalled();
    });

    it('should allow starting a new watcher after stopping', () => {
      watchConfig('config.json', jest.fn());
      stopWatching();

      fs.watch.mockClear();

      watchConfig('config.json', jest.fn());

      expect(fs.watch).toHaveBeenCalled();
    });
  });

  describe('getCurrentConfig', () => {
    it('should return current configuration', () => {
      const expectedConfig = { categories: ['Test'], fetchWindowHours: 24 };
      fs.readFileSync.mockReturnValue(JSON.stringify(expectedConfig));

      watchConfig('config.json', jest.fn());

      const currentConfig = getCurrentConfig();

      expect(currentConfig).toEqual(expectedConfig);
    });

    it('should return null before config is loaded', () => {
      const config = getCurrentConfig();
      expect(config).toBeNull();
    });

    it('should return updated config after reload', () => {
      const initialConfig = { categories: ['Initial'], fetchWindowHours: 24 };
      fs.readFileSync.mockReturnValue(JSON.stringify(initialConfig));

      watchConfig('config.json', jest.fn());

      const updatedConfig = { categories: ['Updated'], fetchWindowHours: 48 };
      fs.readFileSync.mockReturnValue(JSON.stringify(updatedConfig));

      reloadConfig('config.json');

      const currentConfig = getCurrentConfig();
      expect(currentConfig).toEqual(updatedConfig);
    });
  });

  describe('Configuration Change Logging', () => {
    it('should log specific configuration changes', () => {
      const oldConfig = {
        categories: ['Old'],
        fetchWindowHours: 24,
        printMode: 'local'
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(oldConfig));
      watchConfig('config.json', jest.fn());

      const newConfig = {
        categories: ['New'],
        fetchWindowHours: 48,
        printMode: 'email'
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));
      reloadConfig('config.json');

      // Should log configuration changes
      expect(logger.info).toHaveBeenCalledWith('Configuration changes:');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('categories'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('fetchWindowHours'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('printMode'));
    });

    it('should log when keys are removed', () => {
      const oldConfig = {
        categories: ['Test'],
        fetchWindowHours: 24,
        removedKey: 'value'
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(oldConfig));
      watchConfig('config.json', jest.fn());

      const newConfig = {
        categories: ['Test'],
        fetchWindowHours: 24
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(newConfig));
      reloadConfig('config.json');

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('removed'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large configuration files', () => {
      const largeConfig = {
        categories: Array.from({ length: 1000 }, (_, i) => `Category${i}`),
        fetchWindowHours: 24
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(largeConfig));

      watchConfig('config.json', jest.fn());

      const config = getCurrentConfig();
      expect(config.categories).toHaveLength(1000);
    });

    it('should handle rapid consecutive changes', () => {
      const callback = jest.fn();
      let fileChangeHandler;

      fs.watch.mockImplementation((path, handler) => {
        fileChangeHandler = handler;
        return mockWatcher;
      });

      watchConfig('config.json', callback);

      // Simulate rapid changes
      for (let i = 0; i < 10; i++) {
        const config = { categories: [`Config${i}`], fetchWindowHours: 24 + i };
        fs.readFileSync.mockReturnValue(JSON.stringify(config));
        fileChangeHandler('change', 'config.json');
      }

      // Callback should be called for each valid change
      expect(callback).toHaveBeenCalled();
    });

    it('should handle nested configuration objects', () => {
      const nestedConfig = {
        categories: ['Test'],
        pdfLayout: {
          columns: [
            { id: 'name', width: 100 },
            { id: 'phone', width: 100 }
          ]
        },
        webhooks: {
          onSuccess: 'https://example.com'
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(nestedConfig));
      watchConfig('config.json', jest.fn());

      const config = getCurrentConfig();
      expect(config.pdfLayout.columns).toHaveLength(2);
      expect(config.webhooks.onSuccess).toBe('https://example.com');
    });

    it('should handle configuration with circular references gracefully', () => {
      // JSON.stringify will throw on circular references
      const config = { categories: ['Test'] };
      config.self = config; // Create circular reference

      fs.readFileSync.mockImplementation(() => {
        // This would fail in real scenario
        throw new Error('Converting circular structure to JSON');
      });

      watchConfig('config.json', jest.fn());

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle configuration reload efficiently', () => {
      const config = {
        categories: Array.from({ length: 100 }, (_, i) => `Cat${i}`),
        fetchWindowHours: 24
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(config));
      watchConfig('config.json', jest.fn());

      const startTime = Date.now();

      // Reload 10 times
      for (let i = 0; i < 10; i++) {
        reloadConfig('config.json');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });
});
