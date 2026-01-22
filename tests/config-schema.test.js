/**
 * @fileoverview Tests for the configuration schema validator
 * Tests Joi schema validation, defaults, and error handling
 */

const configSchema = require('../src/utils/config-schema');

describe('Config Schema Validation', () => {
  describe('Valid configurations', () => {
    it('should validate minimal valid config', () => {
      const config = {
        categories: ['Category1', 'Category2'],
        preEventQueryMinutes: 5,
        serviceRunIntervalHours: 1,
        fetchWindowHours: 24,
        printMode: 'local'
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.categories).toEqual(['Category1', 'Category2']);
    });

    it('should validate full config with all optional fields', () => {
      const config = {
        categories: ['Test'],
        preEventQueryMinutes: 10,
        serviceRunIntervalHours: 2,
        fetchWindowHours: 48,
        outputFilename: 'custom.pdf',
        printMode: 'email',
        email: {
          to: 'test@example.com',
          from: 'sender@example.com',
          transport: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'username',
              pass: 'password'
            }
          }
        },
        retry: {
          maxAttempts: 5,
          baseDelayMinutes: 10
        },
        api: {
          paginationLimit: 200,
          paginationDelayMs: 2000,
          cacheFreshSeconds: 180,
          cacheStaleSeconds: 3600
        },
        logging: {
          maxFileSizeBytes: 10485760,
          maxFiles: 10
        },
        database: {
          cleanupDays: 60
        },
        pdfLayout: {
          logo: 'logo.png',
          fontSize: 12,
          columns: [
            { id: 'name', header: 'Name', width: 150 }
          ]
        },
        webhook: {
          url: 'https://example.com/webhook',
          enabled: true,
          timeoutMs: 15000,
          maxRetries: 3,
          retryDelayMs: 3000
        }
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.email.to).toBe('test@example.com');
      expect(value.retry.maxAttempts).toBe(5);
      expect(value.webhook.enabled).toBe(true);
    });
  });

  describe('Default values', () => {
    it('should apply default values for missing fields', () => {
      const config = {
        categories: ['Test']
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.preEventQueryMinutes).toBe(5);
      expect(value.serviceRunIntervalHours).toBe(1);
      expect(value.fetchWindowHours).toBe(24);
      expect(value.outputFilename).toBe('attendees.pdf');
      expect(value.printMode).toBe('email');
    });

    it('should apply default retry config', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.retry).toEqual({
        maxAttempts: 3,
        baseDelayMinutes: 5
      });
    });

    it('should apply default API config', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.api).toEqual({
        paginationLimit: 100,
        paginationDelayMs: 1000,
        cacheFreshSeconds: 120,
        cacheStaleSeconds: 1800
      });
    });

    it('should apply default logging config', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.logging).toEqual({
        maxFileSizeBytes: 5242880,
        maxFiles: 5
      });
    });

    it('should apply default database config', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.database).toEqual({
        cleanupDays: 30
      });
    });

    it('should apply default webhook config', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.webhook).toEqual({
        url: null,
        enabled: false,
        timeoutMs: 10000,
        maxRetries: 2,
        retryDelayMs: 2000
      });
    });

    it('should apply default PDF layout', () => {
      const config = { categories: [] };

      const { error, value } = configSchema.validate(config);

      expect(value.pdfLayout).toBeDefined();
      expect(value.pdfLayout.logo).toBeNull();
      expect(value.pdfLayout.fontSize).toBe(10);
      expect(value.pdfLayout.columns).toHaveLength(5);
    });
  });

  describe('Validation errors', () => {
    it('should reject invalid preEventQueryMinutes', () => {
      const config = {
        categories: [],
        preEventQueryMinutes: 0 // Must be at least 1
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
      expect(error.message).toContain('preEventQueryMinutes');
    });

    it('should reject negative serviceRunIntervalHours', () => {
      const config = {
        categories: [],
        serviceRunIntervalHours: -1
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
      expect(error.message).toContain('positive');
    });

    it('should reject invalid printMode', () => {
      const config = {
        categories: [],
        printMode: 'invalid'
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
      expect(error.message).toContain('printMode');
    });

    it('should accept only "local" or "email" for printMode', () => {
      const validModes = ['local', 'email'];

      validModes.forEach(mode => {
        const { error } = configSchema.validate({
          categories: [],
          printMode: mode
        });
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid email address format', () => {
      const config = {
        categories: [],
        printMode: 'email',
        email: {
          to: 'invalid-email',
          from: 'sender@example.com',
          transport: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: { user: 'user', pass: 'pass' }
          }
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
      expect(error.message).toContain('valid email');
    });

    it('should reject missing email transport fields', () => {
      const config = {
        categories: [],
        email: {
          to: 'test@example.com',
          from: 'sender@example.com',
          transport: {
            host: 'smtp.example.com'
            // Missing port, secure, auth
          }
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });

    it('should reject retry maxAttempts out of range', () => {
      const invalidConfigs = [
        { retry: { maxAttempts: 0 } },
        { retry: { maxAttempts: 11 } }
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });

    it('should reject retry baseDelayMinutes out of range', () => {
      const invalidConfigs = [
        { retry: { baseDelayMinutes: 0 } },
        { retry: { baseDelayMinutes: 61 } }
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });

    it('should reject API paginationLimit out of range', () => {
      const invalidConfigs = [
        { api: { paginationLimit: 5 } },   // Too low
        { api: { paginationLimit: 600 } }  // Too high
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });

    it('should reject API cacheFreshSeconds out of range', () => {
      const invalidConfigs = [
        { api: { cacheFreshSeconds: 10 } },    // Too low
        { api: { cacheFreshSeconds: 4000 } }   // Too high
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });

    it('should reject logging maxFileSizeBytes out of range', () => {
      const config = {
        categories: [],
        logging: {
          maxFileSizeBytes: 1000 // Less than 1MB minimum
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });

    it('should reject database cleanupDays out of range', () => {
      const invalidConfigs = [
        { database: { cleanupDays: 0 } },
        { database: { cleanupDays: 400 } }
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });

    it('should reject invalid webhook URL', () => {
      const config = {
        categories: [],
        webhook: {
          url: 'not-a-valid-url'
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
      expect(error.message).toContain('uri');
    });

    it('should accept null or empty string for webhook URL', () => {
      const validConfigs = [
        { webhook: { url: null } },
        { webhook: { url: '' } }
      ];

      validConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeUndefined();
      });
    });

    it('should reject webhook timeoutMs out of range', () => {
      const invalidConfigs = [
        { webhook: { timeoutMs: 500 } },    // Too low
        { webhook: { timeoutMs: 70000 } }   // Too high
      ];

      invalidConfigs.forEach(config => {
        const { error } = configSchema.validate({
          categories: [],
          ...config
        });
        expect(error).toBeDefined();
      });
    });
  });

  describe('PDF Layout validation', () => {
    it('should accept null logo', () => {
      const config = {
        categories: [],
        pdfLayout: {
          logo: null
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeUndefined();
    });

    it('should reject invalid fontSize', () => {
      const config = {
        categories: [],
        pdfLayout: {
          fontSize: -5
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });

    it('should validate column structure', () => {
      const config = {
        categories: [],
        pdfLayout: {
          columns: [
            { id: 'col1', header: 'Column 1', width: 100 },
            { id: 'col2', header: 'Column 2', width: 150 }
          ]
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeUndefined();
    });

    it('should reject incomplete column definition', () => {
      const config = {
        categories: [],
        pdfLayout: {
          columns: [
            { id: 'col1', header: 'Column 1' } // Missing width
          ]
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });

    it('should reject negative column width', () => {
      const config = {
        categories: [],
        pdfLayout: {
          columns: [
            { id: 'col1', header: 'Column 1', width: -50 }
          ]
        }
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });
  });

  describe('Type coercion', () => {
    it('should accept integer values correctly', () => {
      const config = {
        categories: [],
        preEventQueryMinutes: 10,
        serviceRunIntervalHours: 2,
        fetchWindowHours: 48
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(typeof value.preEventQueryMinutes).toBe('number');
      expect(typeof value.serviceRunIntervalHours).toBe('number');
    });

    it('should accept boolean values correctly', () => {
      const config = {
        categories: [],
        webhook: {
          enabled: true
        }
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(typeof value.webhook.enabled).toBe('boolean');
    });
  });

  describe('Categories field', () => {
    it('should accept array of strings', () => {
      const config = {
        categories: ['Cat1', 'Cat2', 'Cat3']
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.categories).toEqual(['Cat1', 'Cat2', 'Cat3']);
    });

    it('should accept empty array', () => {
      const config = {
        categories: []
      };

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.categories).toEqual([]);
    });

    it('should use empty array as default', () => {
      const config = {};

      const { error, value } = configSchema.validate(config);

      expect(error).toBeUndefined();
      expect(value.categories).toEqual([]);
    });

    it('should reject non-string items in categories', () => {
      const config = {
        categories: ['Cat1', 123, 'Cat3']
      };

      const { error } = configSchema.validate(config);

      expect(error).toBeDefined();
    });
  });
});
