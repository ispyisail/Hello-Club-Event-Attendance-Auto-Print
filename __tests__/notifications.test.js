const axios = require('axios');
const {
  notifyEventProcessed,
  notifyError,
  notifyWarning,
  sendSlackNotification,
  sendDiscordNotification,
  sendWebhook
} = require('../src/notifications');

// Mock axios
jest.mock('axios');

// Mock logger
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mock fs to prevent reading config.json
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}')
}));

describe('Notifications Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.WEBHOOK_ON_SUCCESS;
    delete process.env.WEBHOOK_ON_ERROR;
    delete process.env.WEBHOOK_ON_WARNING;
  });

  describe('sendSlackNotification', () => {
    it('should send a Slack notification with correct payload', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });

      await sendSlackNotification('https://hooks.slack.com/test', 'Test message', 'good');

      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'good',
              text: 'Test message'
            })
          ])
        }),
        expect.any(Object)
      );
    });

    it('should handle Slack API errors gracefully', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        sendSlackNotification('https://hooks.slack.com/test', 'Test', 'good')
      ).rejects.toThrow('Network error');
    });

    it('should use correct colors for different message types', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });

      await sendSlackNotification('https://hooks.slack.com/test', 'Success', 'good');
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ color: 'good' })
          ])
        }),
        expect.any(Object)
      );

      await sendSlackNotification('https://hooks.slack.com/test', 'Error', 'danger');
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({ color: 'danger' })
          ])
        }),
        expect.any(Object)
      );
    });
  });

  describe('sendDiscordNotification', () => {
    it('should send a Discord notification with correct embed', async () => {
      axios.post.mockResolvedValue({ status: 204 });

      await sendDiscordNotification('https://discord.com/api/webhooks/test', 'Test message', 0x00ff00);

      expect(axios.post).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              description: 'Test message',
              color: 0x00ff00
            })
          ])
        }),
        expect.any(Object)
      );
    });

    it('should handle Discord API errors', async () => {
      axios.post.mockRejectedValue(new Error('Discord error'));

      await expect(
        sendDiscordNotification('https://discord.com/api/webhooks/test', 'Test', 0x00ff00)
      ).rejects.toThrow('Discord error');
    });
  });

  describe('sendWebhook', () => {
    it('should send generic webhook with JSON payload', async () => {
      axios.post.mockResolvedValue({ status: 200 });

      await sendWebhook('https://example.com/webhook', { message: 'test' });

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        { message: 'test' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        })
      );
    });

    it('should handle webhook timeout', async () => {
      axios.post.mockRejectedValue(new Error('Timeout'));

      await expect(
        sendWebhook('https://example.com/webhook', { test: true })
      ).rejects.toThrow('Timeout');
    });
  });

  describe('notifyEventProcessed', () => {
    it('should send success notification when webhook configured', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      process.env.WEBHOOK_ON_SUCCESS = 'https://hooks.slack.com/success';

      await notifyEventProcessed('Test Event', 25, 'email');

      expect(axios.post).toHaveBeenCalled();
      const callArgs = axios.post.mock.calls[0];
      expect(callArgs[0]).toBe('https://hooks.slack.com/success');
      expect(callArgs[1].attachments[0].text).toContain('Test Event');
      expect(callArgs[1].attachments[0].text).toContain('25');
    });

    it('should not send notification when no webhook configured', async () => {
      await notifyEventProcessed('Test Event', 25, 'local');

      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should handle Slack URLs correctly', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      process.env.WEBHOOK_ON_SUCCESS = 'https://hooks.slack.com/services/XXX';

      await notifyEventProcessed('Event', 10, 'local');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('slack.com'),
        expect.objectContaining({ attachments: expect.any(Array) }),
        expect.any(Object)
      );
    });

    it('should handle Discord URLs correctly', async () => {
      axios.post.mockResolvedValue({ status: 204 });
      process.env.WEBHOOK_ON_SUCCESS = 'https://discord.com/api/webhooks/123/abc';

      await notifyEventProcessed('Event', 10, 'local');

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('discord.com'),
        expect.objectContaining({ embeds: expect.any(Array) }),
        expect.any(Object)
      );
    });
  });

  describe('notifyError', () => {
    it('should send error notification with danger color', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      process.env.WEBHOOK_ON_ERROR = 'https://hooks.slack.com/error';

      await notifyError('Test Error', 'Something went wrong');

      expect(axios.post).toHaveBeenCalled();
      const callArgs = axios.post.mock.calls[0];
      expect(callArgs[1].attachments[0].color).toBe('danger');
      expect(callArgs[1].attachments[0].text).toContain('Test Error');
      expect(callArgs[1].attachments[0].text).toContain('Something went wrong');
    });

    it('should not fail silently on webhook error', async () => {
      axios.post.mockRejectedValue(new Error('Webhook failed'));
      process.env.WEBHOOK_ON_ERROR = 'https://hooks.slack.com/error';

      // Should not throw, just log
      await expect(
        notifyError('Test', 'Details')
      ).resolves.not.toThrow();
    });
  });

  describe('notifyWarning', () => {
    it('should send warning notification with warning color', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });
      process.env.WEBHOOK_ON_WARNING = 'https://hooks.slack.com/warning';

      await notifyWarning('Test Warning', 'Check this');

      expect(axios.post).toHaveBeenCalled();
      const callArgs = axios.post.mock.calls[0];
      expect(callArgs[1].attachments[0].color).toBe('warning');
      expect(callArgs[1].attachments[0].text).toContain('Test Warning');
    });
  });

  describe('Platform Detection', () => {
    it('should detect Slack URLs', async () => {
      axios.post.mockResolvedValue({ status: 200, data: 'ok' });

      const slackUrls = [
        'https://hooks.slack.com/services/T00/B00/XXX',
        'https://hooks.slack.com/workflows/XXX'
      ];

      for (const url of slackUrls) {
        process.env.WEBHOOK_ON_SUCCESS = url;
        await notifyEventProcessed('Test', 1, 'local');

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('slack.com'),
          expect.objectContaining({ attachments: expect.any(Array) }),
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });

    it('should detect Discord URLs', async () => {
      axios.post.mockResolvedValue({ status: 204 });

      const discordUrls = [
        'https://discord.com/api/webhooks/123/abc',
        'https://discordapp.com/api/webhooks/456/def'
      ];

      for (const url of discordUrls) {
        process.env.WEBHOOK_ON_SUCCESS = url;
        await notifyEventProcessed('Test', 1, 'local');

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('discord'),
          expect.objectContaining({ embeds: expect.any(Array) }),
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });

    it('should use generic webhook for unknown platforms', async () => {
      axios.post.mockResolvedValue({ status: 200 });
      process.env.WEBHOOK_ON_SUCCESS = 'https://example.com/webhook';

      await notifyEventProcessed('Test', 1, 'local');

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({ message: expect.any(String) }),
        expect.any(Object)
      );
    });
  });
});
