/**
 * @fileoverview Tests for the email service module
 * Tests SMTP connection, email sending, and error handling
 */

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../src/services/logger');

const nodemailer = require('nodemailer');
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
      sendMail: mockSendMail
    };

    // Mock nodemailer.createTransport
    nodemailer.createTransport.mockReturnValue(mockTransporter);
  });

  describe('sendEmailWithAttachment', () => {
    const transportOptions = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'testpassword'
      }
    };

    const emailParams = {
      to: 'recipient@test.com',
      from: 'sender@test.com',
      subject: 'Test Subject',
      body: 'Test email body',
      attachmentPath: 'C:\\test\\attachment.pdf'
    };

    it('should send email with attachment successfully', async () => {
      const mockResponse = {
        messageId: '12345',
        response: '250 Message accepted'
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

      expect(nodemailer.createTransport).toHaveBeenCalledWith(transportOptions);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: emailParams.from,
        to: emailParams.to,
        subject: emailParams.subject,
        text: emailParams.body,
        attachments: [
          {
            path: emailParams.attachmentPath
          }
        ]
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

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email:',
        authError
      );
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
      const recipientError = new Error('Recipient address rejected');
      recipientError.responseCode = 550;

      mockSendMail.mockRejectedValue(recipientError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          'invalid@test',
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          emailParams.attachmentPath
        )
      ).rejects.toThrow('Recipient address rejected');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle missing attachment file error', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      fileError.code = 'ENOENT';

      mockSendMail.mockRejectedValue(fileError);

      await expect(
        sendEmailWithAttachment(
          transportOptions,
          emailParams.to,
          emailParams.from,
          emailParams.subject,
          emailParams.body,
          'C:\\nonexistent\\file.pdf'
        )
      ).rejects.toThrow(/no such file or directory/);

      expect(logger.error).toHaveBeenCalled();
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
          text: ''
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
          subject: specialSubject
        })
      );
    });
  });
});
