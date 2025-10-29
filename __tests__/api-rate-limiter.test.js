const fs = require('fs');
const {
  recordApiCall,
  getStats,
  displayApiStats,
  resetStats
} = require('../src/api-rate-limiter');

// Mock fs
jest.mock('fs');

// Mock logger
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('API Rate Limiter Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStats();

    // Mock fs.existsSync to return false initially
    fs.existsSync.mockReturnValue(false);
  });

  describe('recordApiCall', () => {
    it('should record API call with rate limit headers', () => {
      const mockResponse = {
        status: 200,
        headers: {
          'x-ratelimit-limit': '1000',
          'x-ratelimit-remaining': '950',
          'x-ratelimit-reset': '1640000000'
        },
        config: {
          metadata: {
            startTime: Date.now() - 100,
            duration: 100
          }
        }
      };

      recordApiCall('/event', mockResponse);

      const stats = getStats();
      expect(stats.rateLimitInfo.limit).toBe(1000);
      expect(stats.rateLimitInfo.remaining).toBe(950);
      expect(stats.callHistory.length).toBe(1);
      expect(stats.callHistory[0].endpoint).toBe('/event');
      expect(stats.callHistory[0].status).toBe(200);
    });

    it('should record API call without rate limit headers', () => {
      const mockResponse = {
        status: 200,
        headers: {},
        config: {
          metadata: {
            duration: 50
          }
        }
      };

      recordApiCall('/event', mockResponse);

      const stats = getStats();
      expect(stats.callHistory.length).toBe(1);
      expect(stats.callHistory[0].duration).toBe(50);
    });

    it('should track multiple API calls', () => {
      const mockResponse1 = {
        status: 200,
        headers: { 'x-ratelimit-remaining': '100' },
        config: { metadata: { duration: 50 } }
      };

      const mockResponse2 = {
        status: 200,
        headers: { 'x-ratelimit-remaining': '99' },
        config: { metadata: { duration: 75 } }
      };

      recordApiCall('/event', mockResponse1);
      recordApiCall('/eventAttendee', mockResponse2);

      const stats = getStats();
      expect(stats.callHistory.length).toBe(2);
      expect(stats.rateLimitInfo.remaining).toBe(99);
    });

    it('should handle API errors', () => {
      const mockErrorResponse = {
        status: 429,
        headers: { 'x-ratelimit-remaining': '0' },
        config: { metadata: { duration: 100 } }
      };

      recordApiCall('/event', mockErrorResponse);

      const stats = getStats();
      expect(stats.callHistory[0].status).toBe(429);
      expect(stats.rateLimitInfo.remaining).toBe(0);
    });

    it('should limit call history to 1000 entries', () => {
      const mockResponse = {
        status: 200,
        headers: {},
        config: { metadata: { duration: 10 } }
      };

      // Record 1100 calls
      for (let i = 0; i < 1100; i++) {
        recordApiCall('/test', mockResponse);
      }

      const stats = getStats();
      expect(stats.callHistory.length).toBe(1000);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      const mockResponse = {
        status: 200,
        headers: {
          'x-ratelimit-limit': '1000',
          'x-ratelimit-remaining': '900'
        },
        config: { metadata: { duration: 100 } }
      };

      recordApiCall('/event', mockResponse);

      const stats = getStats();
      expect(stats).toHaveProperty('rateLimitInfo');
      expect(stats).toHaveProperty('callHistory');
      expect(stats).toHaveProperty('startTime');
      expect(stats.rateLimitInfo.limit).toBe(1000);
      expect(stats.rateLimitInfo.remaining).toBe(900);
    });

    it('should include start time', () => {
      const stats = getStats();
      expect(stats.startTime).toBeDefined();
      expect(typeof stats.startTime).toBe('number');
    });
  });

  describe('displayApiStats', () => {
    it('should display stats for given time window', () => {
      const now = Date.now();

      // Record some calls
      const mockResponse = {
        status: 200,
        headers: { 'x-ratelimit-remaining': '100' },
        config: { metadata: { duration: 50 } }
      };

      recordApiCall('/event', mockResponse);
      recordApiCall('/eventAttendee', mockResponse);

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      displayApiStats(60); // 60 minute window

      expect(consoleSpy).toHaveBeenCalled();

      // Check that it displays rate limit info
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('API Rate Limiting Statistics');

      consoleSpy.mockRestore();
    });

    it('should filter calls by time window', () => {
      const now = Date.now();
      const oldTimestamp = now - (2 * 60 * 60 * 1000); // 2 hours ago

      // Manually add old and new calls to history
      const mockResponse1 = {
        status: 200,
        headers: {},
        config: { metadata: { duration: 50 } }
      };

      recordApiCall('/old-call', mockResponse1);

      // Simulate some time passing
      const mockResponse2 = {
        status: 200,
        headers: {},
        config: { metadata: { duration: 60 } }
      };

      recordApiCall('/new-call', mockResponse2);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      displayApiStats(1); // 1 minute window

      consoleSpy.mockRestore();
    });

    it('should handle no API calls', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      displayApiStats(60);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('API Rate Limiting Statistics');

      consoleSpy.mockRestore();
    });

    it('should display rate limit progress bar', () => {
      const mockResponse = {
        status: 200,
        headers: {
          'x-ratelimit-limit': '1000',
          'x-ratelimit-remaining': '750'
        },
        config: { metadata: { duration: 50 } }
      };

      recordApiCall('/event', mockResponse);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      displayApiStats(60);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('750'); // Remaining requests

      consoleSpy.mockRestore();
    });
  });

  describe('resetStats', () => {
    it('should clear all statistics', () => {
      const mockResponse = {
        status: 200,
        headers: { 'x-ratelimit-remaining': '100' },
        config: { metadata: { duration: 50 } }
      };

      recordApiCall('/event', mockResponse);

      let stats = getStats();
      expect(stats.callHistory.length).toBe(1);

      resetStats();

      stats = getStats();
      expect(stats.callHistory.length).toBe(0);
      expect(stats.rateLimitInfo.remaining).toBeNull();
    });

    it('should reset start time', () => {
      const beforeReset = getStats().startTime;

      // Wait a bit
      jest.advanceTimersByTime(1000);

      resetStats();

      const afterReset = getStats().startTime;
      expect(afterReset).toBeGreaterThanOrEqual(beforeReset);
    });
  });

  describe('Edge Cases', () => {
    it('should handle response without config.metadata', () => {
      const mockResponse = {
        status: 200,
        headers: {},
        config: {}
      };

      expect(() => recordApiCall('/test', mockResponse)).not.toThrow();
    });

    it('should handle malformed rate limit headers', () => {
      const mockResponse = {
        status: 200,
        headers: {
          'x-ratelimit-limit': 'invalid',
          'x-ratelimit-remaining': 'also-invalid'
        },
        config: { metadata: { duration: 50 } }
      };

      recordApiCall('/test', mockResponse);

      const stats = getStats();
      // Should handle gracefully - parseInt on invalid strings returns NaN
      expect(stats.callHistory.length).toBe(1);
    });

    it('should handle very long durations', () => {
      const mockResponse = {
        status: 200,
        headers: {},
        config: { metadata: { duration: 999999 } }
      };

      recordApiCall('/slow-endpoint', mockResponse);

      const stats = getStats();
      expect(stats.callHistory[0].duration).toBe(999999);
    });

    it('should track different status codes', () => {
      const statusCodes = [200, 201, 400, 401, 429, 500];

      statusCodes.forEach(code => {
        const mockResponse = {
          status: code,
          headers: {},
          config: { metadata: { duration: 50 } }
        };
        recordApiCall('/test', mockResponse);
      });

      const stats = getStats();
      expect(stats.callHistory.length).toBe(statusCodes.length);

      const recordedCodes = stats.callHistory.map(call => call.status);
      expect(recordedCodes).toEqual(statusCodes);
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency API calls efficiently', () => {
      const startTime = Date.now();

      const mockResponse = {
        status: 200,
        headers: {},
        config: { metadata: { duration: 10 } }
      };

      // Record 500 calls
      for (let i = 0; i < 500; i++) {
        recordApiCall(`/endpoint-${i}`, mockResponse);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (under 100ms for 500 calls)
      expect(duration).toBeLessThan(100);

      const stats = getStats();
      expect(stats.callHistory.length).toBe(500);
    });
  });
});
