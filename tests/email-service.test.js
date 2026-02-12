/**
 * @fileoverview Tests for the email service module
 * Tests SMTP connection, email sending, and error handling
 */

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../src/services/logger');
jest.mock('fs');

const nodemailer = require('nodemailer');
const fs = require('fs');
const logger = require('../src/services/logger');
const { sendEmailWithAttachment } = require('../src/services/email-service');

describe('Email Service', () => {
  let mockTransporter;
  let mockSendMail;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock sendMail function
    mockSendMail = jest.fn();

    // Create mock transporter
    mockTransporter = {
      sendMail: mockSendMail,
      close: jest.fn(),
    };

    // Mock nodemailer.createTransport
    nodemailer.createTransport.mockReturnValue(mockTransporter);

    // Mock fs functions for path validation
    fs.existsSync.mockReturnValue(true);
    fs.statSync.mockReturnValue({ isFile: () => true });
  });

  describe('sendEmailWithAttachment', () => {
    const transportOptions = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'testpassword',
      },
    };

    // Use relative path that resolves to within project directory
    const emailParams = {
      to: 'recipient@test.com',
      from: 'sender@test.com',
      subject: 'Test Subject',
      body: 'Test email body',
      attachmentPath: 'attendees.pdf', // Relative to project root
    };

    it('should send email with attachment successfully', async () => {
      const mockResponse = {
        messageId: '12345',
        response: '250 Message accepted',
      };

      mockSendMail.mockResolvedValue(mockResponse);

      const result = await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        emailParams.subject,
        emailParams.body,
        emailParams.attachmentPath
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        ...transportOptions,
        connectionTimeout: 30000,
        socketTimeout: 60000,
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: emailParams.from,
        to: emailParams.to,
        subject: emailParams.subject,
        text: emailParams.body,
        attachments: [
          {
            path: expect.stringContaining('attendees.pdf'),
          },
        ],
      });

      expect(result).toEqual(mockResponse);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Email sent'));
    });

    it('should handle SMTP authentication error', async () => {
      const authError = new Error('Invalid login');
      authError.code = 'EAUTH';

      mockSendMail.mockRejectedValue(authError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Invalid login');

      expect(logger.error).toHaveBeenCalledWith('Failed to send email:', authError);
    });

    it('should handle SMTP connection refused error', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';

      mockSendMail.mockRejectedValue(connectionError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Connection refused');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network timeout error', async () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.code = 'ETIMEDOUT';

      mockSendMail.mockRejectedValue(timeoutError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Connection timeout');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle invalid recipient error', async () => {
      // Test with invalid email format (missing TLD)
      await expect(
        sendEmailWithAttachment(
          transportOptions,
          'invalid@test', // Invalid email - missing TLD
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Invalid recipient email address');
    });

    it('should handle SMTP recipient rejection error', async () => {
      const recipientError = new Error('Recipient address rejected');
      recipientError.responseCode = 550;

      mockSendMail.mockRejectedValue(recipientError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          'valid@test.com', // Valid format but SMTP rejects
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Recipient address rejected');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle missing attachment file error', async () => {
      // Mock file not existing
      fs.existsSync.mockReturnValue(false);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          'nonexistent.pdf'
        )
      ).rejects.toThrow(/does not exist/);
    });

    it('should create new transporter for each send', async () => {
      mockSendMail.mockResolvedValue({ messageId: '123' });

      await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        emailParams.subject,
        emailParams.body,
        emailParams.attachmentPath
      );

      await sendEmailWithAttachment(
        transportOptions,
        'another@test.com',
        emailParams.from,
        emailParams.subject,
        emailParams.body,
        emailParams.attachmentPath
      );

      // createTransport should be called twice (once per send)
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    });

    it('should handle empty email body', async () => {
      mockSendMail.mockResolvedValue({ messageId: '123' });

      await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        emailParams.subject,
        '', // Empty body
        emailParams.attachmentPath
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
        })
      );
    });

    it('should handle special characters in subject', async () => {
      mockSendMail.mockResolvedValue({ messageId: '123' });

      const specialSubject = 'Test: Event "Special" & More <123>';

      await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        specialSubject,
        emailParams.body,
        emailParams.attachmentPath
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: specialSubject,
        })
      );
    });

    it('should close transporter after successful send', async () => {
      mockSendMail.mockResolvedValue({ messageId: '123', response: '250 OK' });

      await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        emailParams.subject,
        emailParams.body,
        emailParams.attachmentPath
      );

      expect(mockTransporter.close).toHaveBeenCalledTimes(1);
    });

    it('should close transporter after failed send', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('SMTP error');

      expect(mockTransporter.close).toHaveBeenCalledTimes(1);
    });

    it('should add connection and socket timeouts to transport options', async () => {
      mockSendMail.mockResolvedValue({ messageId: '123', response: '250 OK' });

      await sendEmailWithAttachment(
        transportOptions,
        emailParams.to,
        emailParams.from,
        emailParams.subject,
        emailParams.body,
        emailParams.attachmentPath
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeout: 30000,
          socketTimeout: 60000,
        })
      );
    });
  });
});
