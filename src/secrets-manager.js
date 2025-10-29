/**
 * @fileoverview Utility for masking sensitive data in logs and error messages.
 * Prevents API keys, passwords, and other secrets from appearing in logs.
 * @module secrets-manager
 */

/**
 * Patterns for detecting sensitive data
 */
const SENSITIVE_PATTERNS = {
  apiKey: /Bearer\s+([A-Za-z0-9-_]+)/gi,
  password: /(password['"]\s*:\s*['"])([^'"]+)(['"])/gi,
  token: /(token['"]\s*:\s*['"])([^'"]+)(['"])/gi,
  email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
};

/**
 * Mask sensitive data in a string
 * @param {string} input - The input string that may contain sensitive data
 * @param {Object} options - Masking options
 * @returns {string} String with sensitive data masked
 */
function maskSensitiveData(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  const {
    maskApiKeys = true,
    maskPasswords = true,
    maskTokens = true,
    maskEmails = false,
    maskPhones = false,
    maskCreditCards = true,
    replacement = '***REDACTED***'
  } = options;

  let masked = input;

  // Mask API keys in Authorization headers
  if (maskApiKeys) {
    masked = masked.replace(SENSITIVE_PATTERNS.apiKey, `Bearer ${replacement}`);
  }

  // Mask passwords in JSON/logs
  if (maskPasswords) {
    masked = masked.replace(SENSITIVE_PATTERNS.password, `$1${replacement}$3`);
  }

  // Mask tokens
  if (maskTokens) {
    masked = masked.replace(SENSITIVE_PATTERNS.token, `$1${replacement}$3`);
  }

  // Mask email addresses (optional, for privacy)
  if (maskEmails) {
    masked = masked.replace(SENSITIVE_PATTERNS.email, (match) => {
      const [local, domain] = match.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    });
  }

  // Mask phone numbers (optional)
  if (maskPhones) {
    masked = masked.replace(SENSITIVE_PATTERNS.phone, '***-***-****');
  }

  // Mask credit card numbers
  if (maskCreditCards) {
    masked = masked.replace(SENSITIVE_PATTERNS.creditCard, '**** **** **** ****');
  }

  return masked;
}

/**
 * Mask sensitive data in an object (deep)
 * @param {Object} obj - Object to mask
 * @param {Array<string>} sensitiveKeys - Keys to mask
 * @returns {Object} Object with sensitive values masked
 */
function maskSensitiveObject(obj, sensitiveKeys = ['password', 'apiKey', 'token', 'secret', 'auth']) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveObject(item, sensitiveKeys));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => keyLower.includes(sk.toLowerCase()));

    if (isSensitive && typeof value === 'string') {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveObject(value, sensitiveKeys);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Validate URL to prevent SSRF attacks
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is safe
 */
function validateWebhookUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Prevent localhost/internal IPs
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata
      '::ffff:127.0.0.1'
    ];

    if (blockedHosts.includes(hostname)) {
      return false;
    }

    // Prevent private IP ranges
    if (hostname.match(/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./)) {
      return false;
    }

    // URL is safe
    return true;
  } catch (error) {
    // Invalid URL
    return false;
  }
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize event name for display (prevent XSS)
 * @param {string} name - Event name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeEventName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Escape HTML special characters
  return name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Get safe environment variable (with validation)
 * @param {string} name - Environment variable name
 * @param {Object} options - Validation options
 * @returns {string|null} Environment variable value or null
 */
function getSafeEnvVar(name, options = {}) {
  const {
    required = false,
    defaultValue = null,
    validator = null
  } = options;

  const value = process.env[name];

  if (!value) {
    if (required) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return defaultValue;
  }

  if (validator && !validator(value)) {
    throw new Error(`Environment variable ${name} failed validation`);
  }

  return value;
}

module.exports = {
  maskSensitiveData,
  maskSensitiveObject,
  validateWebhookUrl,
  validateEmail,
  sanitizeEventName,
  getSafeEnvVar,
  SENSITIVE_PATTERNS
};
