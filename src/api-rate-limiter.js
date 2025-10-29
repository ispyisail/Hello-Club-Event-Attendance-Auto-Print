/**
 * @fileoverview API rate limiting tracker and dashboard.
 * @module api-rate-limiter
 */

const logger = require('./logger');

// Track API call history
const callHistory = [];
const MAX_HISTORY = 1000;

let rateLimitInfo = {
  limit: null,
  remaining: null,
  reset: null,
  resetTime: null
};

/**
 * Records an API call.
 * @param {string} endpoint - API endpoint called.
 * @param {Object} response - Axios response object.
 */
function recordApiCall(endpoint, response) {
  const call = {
    endpoint: endpoint,
    timestamp: new Date().toISOString(),
    status: response.status,
    duration: response.config.metadata?.duration || 0
  };

  // Extract rate limit headers if present
  if (response.headers) {
    if (response.headers['x-ratelimit-limit']) {
      rateLimitInfo.limit = parseInt(response.headers['x-ratelimit-limit']);
    }
    if (response.headers['x-ratelimit-remaining']) {
      rateLimitInfo.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      rateLimitInfo.reset = parseInt(response.headers['x-ratelimit-reset']);
      rateLimitInfo.resetTime = new Date(rateLimitInfo.reset * 1000).toISOString();
    }
  }

  callHistory.push(call);

  // Keep only recent history
  if (callHistory.length > MAX_HISTORY) {
    callHistory.shift();
  }

  // Log warning if approaching rate limit
  if (rateLimitInfo.remaining !== null && rateLimitInfo.remaining < 10) {
    logger.warn(`API rate limit warning: Only ${rateLimitInfo.remaining} requests remaining`);
  }
}

/**
 * Gets API call statistics.
 * @param {number} [minutes=60] - Time window in minutes.
 * @returns {Object} Statistics.
 */
function getStats(minutes = 60) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - minutes * 60 * 1000);

  const recentCalls = callHistory.filter(call =>
    new Date(call.timestamp) >= cutoff
  );

  const byEndpoint = {};
  recentCalls.forEach(call => {
    if (!byEndpoint[call.endpoint]) {
      byEndpoint[call.endpoint] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0
      };
    }
    byEndpoint[call.endpoint].count++;
    byEndpoint[call.endpoint].totalDuration += call.duration;
  });

  // Calculate averages
  for (const endpoint of Object.keys(byEndpoint)) {
    byEndpoint[endpoint].avgDuration =
      byEndpoint[call.endpoint].totalDuration / byEndpoint[endpoint].count;
  }

  return {
    timeWindow: minutes,
    totalCalls: recentCalls.length,
    callsPerMinute: recentCalls.length / minutes,
    byEndpoint: byEndpoint,
    rateLimit: rateLimitInfo
  };
}

/**
 * Displays API statistics in a dashboard format.
 */
function displayApiStats() {
  const stats = getStats(60);

  console.log('\n' + '='.repeat(60));
  console.log('  Hello Club - API Statistics');
  console.log('='.repeat(60));

  // Rate limit info
  if (stats.rateLimit.limit !== null) {
    console.log('\nRate Limit Information:');
    console.log(`  Limit:     ${stats.rateLimit.limit} requests/hour`);
    console.log(`  Remaining: ${stats.rateLimit.remaining}`);
    console.log(`  Resets:    ${stats.rateLimit.resetTime || 'Unknown'}`);

    if (stats.rateLimit.limit && stats.rateLimit.remaining) {
      const percentUsed = ((stats.rateLimit.limit - stats.rateLimit.remaining) / stats.rateLimit.limit * 100).toFixed(1);
      console.log(`  Used:      ${percentUsed}%`);

      // Visual bar
      const barLength = 40;
      const filled = Math.floor(barLength * percentUsed / 100);
      const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
      console.log(`  [${bar}]`);
    }
  } else {
    console.log('\nRate Limit Information: Not available');
  }

  // Call statistics
  console.log(`\nAPI Calls (Last ${stats.timeWindow} minutes):`);
  console.log(`  Total Calls:       ${stats.totalCalls}`);
  console.log(`  Calls per Minute:  ${stats.callsPerMinute.toFixed(2)}`);

  if (Object.keys(stats.byEndpoint).length > 0) {
    console.log('\nBy Endpoint:');
    for (const [endpoint, data] of Object.entries(stats.byEndpoint)) {
      console.log(`  ${endpoint}:`);
      console.log(`    Calls:        ${data.count}`);
      console.log(`    Avg Duration: ${data.avgDuration.toFixed(2)}ms`);
    }
  }

  // Recent call history
  const recentCalls = callHistory.slice(-10);
  if (recentCalls.length > 0) {
    console.log('\nRecent Calls (last 10):');
    recentCalls.forEach(call => {
      const time = new Date(call.timestamp).toLocaleTimeString();
      console.log(`  ${time} - ${call.endpoint} (${call.status}) - ${call.duration}ms`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log();
}

/**
 * Gets the current rate limit status.
 * @returns {Object} Rate limit information.
 */
function getRateLimitStatus() {
  return rateLimitInfo;
}

/**
 * Resets all tracking data.
 */
function reset() {
  callHistory.length = 0;
  rateLimitInfo = {
    limit: null,
    remaining: null,
    reset: null,
    resetTime: null
  };
  logger.info('API rate limiter data reset');
}

module.exports = {
  recordApiCall,
  getStats,
  displayApiStats,
  getRateLimitStatus,
  reset
};
