'use strict';

const crypto = require('crypto');

/**
 * Constant-time string comparison to prevent timing attacks.
 * Handles strings of different lengths safely.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  const len = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(len);
  const paddedB = Buffer.alloc(len);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

/**
 * Basic HTTP authentication middleware.
 * Auth is skipped if DASHBOARD_USER / DASHBOARD_PASS env vars are not set
 * (Pi is behind firewall; auth is optional extra layer).
 */
module.exports = function basicAuth(req, res, next) {
  const username = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASS;

  if (!username || !password) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Hello Club Dashboard"');
    return res.status(401).send('Authentication required');
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return res.status(401).send('Invalid credentials');

  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  if (safeEqual(user, username) && safeEqual(pass, password)) return next();

  res.set('WWW-Authenticate', 'Basic realm="Hello Club Dashboard"');
  return res.status(401).send('Invalid credentials');
};
