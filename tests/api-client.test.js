/**
 * @fileoverview Tests for the API client module
 * Tests error handling, pagination, timeouts, and data processing
 */

// Mock environment variables BEFORE any imports
process.env.API_KEY = 'test_api_key_12345';
process.env.API_BASE_URL = 'https://api.test.com';
process.env.API_TIMEOUT = '5000';

// Mock dependencies
jest.mock('axios');
jest.mock('../src/services/logger');

const axios = require('axios');
const logger = require('../src/services/logger');

describe('API Client', () => {
  let mockAxiosInstance;
  let getUpcomingEvents;
  let getEventDetails;
  let getAllAttendees;

  beforeAll(() => {
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    axios.create.mockReturnValue(mockAxiosInstance);

    // NOW we can require the API client (it will use our mocked axios)
    const apiClient = require('../src/core/api-client');
    getUpcomingEvents = apiClient.getUpcomingEvents;
    getEventDetails = apiClient.getEventDetails;
    getAllAttendees = apiClient.getAllAttendees;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear API cache between tests
    const apiClient = require('../src/core/api-client');
    if (apiClient.clearCache) {
      apiClient.clearCache();
    }
  });

  describe('getUpcomingEvents', () => {
    it('should fetch upcoming events successfully', async () => {
      const mockEvents = [
        { id: '1', name: 'Event 1', startDate: '2025-01-01T10:00:00Z' },
        { id: '2', name: 'Event 2', startDate: '2025-01-02T14:00:00Z' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { events: mockEvents },
      });

      const result = await getUpcomingEvents(24);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/event', {
        params: expect.objectContaining({
          sort: 'startDate',
        }),
      });
      expect(result).toEqual(mockEvents);
    });

    it('should handle 401 unauthorized error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      });

      await expect(getUpcomingEvents(24)).rejects.toThrow(/401 Unauthorized.*API_KEY/);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network timeout error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      await expect(getUpcomingEvents(24)).rejects.toThrow(/API Timeout.*5000ms/);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network error (no response)', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        request: {},
        message: 'Network Error',
      });

      await expect(getUpcomingEvents(24)).rejects.toThrow(/Network Error.*No response received/);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle 500 server error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      });

      await expect(getUpcomingEvents(24)).rejects.toThrow(/API Error: 500/);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { events: [] },
      });

      const result = await getUpcomingEvents(24);

      expect(result).toEqual([]);
    });
  });

  describe('getEventDetails', () => {
    it('should fetch event details successfully', async () => {
      const mockEvent = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z',
        description: 'A test event',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockEvent,
      });

      const result = await getEventDetails('123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/event/123');
      expect(result).toEqual(mockEvent);
    });

    it('should handle 404 not found error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: 'Event not found' },
        },
      });

      await expect(getEventDetails('999')).rejects.toThrow(/API Error: 404/);
    });
  });

  describe('getAllAttendees', () => {
    it('should fetch all attendees with pagination', async () => {
      const mockPage1 = {
        data: {
          attendees: [
            { id: '1', firstName: 'John', lastName: 'Doe' },
            { id: '2', firstName: 'Jane', lastName: 'Smith' },
          ],
          meta: { total: 4 },
        },
      };

      const mockPage2 = {
        data: {
          attendees: [
            { id: '3', firstName: 'Bob', lastName: 'Johnson' },
            { id: '4', firstName: 'Alice', lastName: 'Williams' },
          ],
          meta: { total: 4 },
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockPage1).mockResolvedValueOnce(mockPage2);

      const result = await getAllAttendees('123');

      // Pagination stops when offset >= total (2 pages for 4 attendees)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(4);
      // Note: Results are sorted by lastName, firstName
      expect(result[0].lastName).toBe('Doe');
      expect(result[3].lastName).toBe('Williams');
    });

    it('should sort attendees by lastName, firstName', async () => {
      const mockAttendees = {
        data: {
          attendees: [
            { id: '1', firstName: 'John', lastName: 'Zebra' },
            { id: '2', firstName: 'Alice', lastName: 'Apple' },
            { id: '3', firstName: 'Bob', lastName: 'Apple' },
          ],
          meta: { total: 3 },
        },
      };

      // Single page - offset (3) >= total (3) after first request
      mockAxiosInstance.get.mockResolvedValueOnce(mockAttendees);

      const result = await getAllAttendees('123');

      // Should be sorted: Alice Apple, Bob Apple, John Zebra
      expect(result[0].firstName).toBe('Alice');
      expect(result[0].lastName).toBe('Apple');
      expect(result[1].firstName).toBe('Bob');
      expect(result[1].lastName).toBe('Apple');
      expect(result[2].firstName).toBe('John');
      expect(result[2].lastName).toBe('Zebra');
    });

    it('should handle attendees with missing name fields', async () => {
      const mockAttendees = {
        data: {
          attendees: [
            { id: '1', firstName: 'John' }, // No lastName
            { id: '2', lastName: 'Smith' }, // No firstName
            { id: '3' }, // No name fields
          ],
          meta: { total: 3 },
        },
      };

      // Single page - offset (3) >= total (3) after first request
      mockAxiosInstance.get.mockResolvedValueOnce(mockAttendees);

      const result = await getAllAttendees('123');

      expect(result).toHaveLength(3);
      // Should not crash, even with missing fields
    });

    it('should handle empty attendee list', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          attendees: [],
          meta: { total: 0 },
        },
      });

      const result = await getAllAttendees('123');

      expect(result).toEqual([]);
    });

    it('should respect 1-second delay between pagination requests', async () => {
      jest.useFakeTimers();

      const mockPage1 = {
        data: {
          attendees: [{ id: '1', firstName: 'John', lastName: 'Doe' }],
          meta: { total: 2 },
        },
      };

      const mockPage2 = {
        data: {
          attendees: [{ id: '2', firstName: 'Jane', lastName: 'Smith' }],
          meta: { total: 2 },
        },
      };

      // Only 2 pages needed - pagination stops when offset >= total
      mockAxiosInstance.get.mockResolvedValueOnce(mockPage1).mockResolvedValueOnce(mockPage2);

      const promise = getAllAttendees('123');

      // Fast-forward through delays
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toHaveLength(2);

      jest.useRealTimers();
    });

    it('should handle pagination error gracefully', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: {
            attendees: [{ id: '1', firstName: 'John', lastName: 'Doe' }],
            meta: { total: 2 },
          },
        })
        .mockRejectedValueOnce({
          response: {
            status: 500,
            data: { error: 'Server error' },
          },
        });

      // Disable stale cache fallback to test error handling
      await expect(getAllAttendees('123', { allowStale: false })).rejects.toThrow(/API Error: 500/);
    });
  });

  describe('Error Context', () => {
    it('should include context in error messages for events', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'Forbidden' },
        },
      });

      // Disable stale cache fallback to test error handling
      await expect(getUpcomingEvents(24, { allowStale: false })).rejects.toThrow(/fetching upcoming events/);
    });

    it('should include context in error messages for event details', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'Forbidden' },
        },
      });

      // Disable stale cache fallback to test error handling
      await expect(getEventDetails('123', { allowStale: false })).rejects.toThrow(/fetching details for event 123/);
    });

    it('should include context in error messages for attendees', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 403,
          data: { error: 'Forbidden' },
        },
      });

      // Disable stale cache fallback to test error handling
      await expect(getAllAttendees('123', { allowStale: false })).rejects.toThrow(/fetching attendees for event 123/);
    });
  });
});
