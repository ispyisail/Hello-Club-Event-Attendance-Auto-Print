/**
 * @fileoverview Event Processing Statistics Tracker
 * Tracks and reports on event processing metrics
 */

const { getDb } = require('./database');
const logger = require('../services/logger');

/**
 * Get comprehensive statistics about event processing
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Object} Statistics object
 */
function getStatistics(days = 7) {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffISO = cutoffDate.toISOString();

  const stats = {
    period: `Last ${days} days`,
    generated_at: new Date().toISOString(),
    events: {},
    jobs: {},
    performance: {},
    recentActivity: [],
  };

  try {
    // Event statistics - only count events that have scheduled jobs
    const eventStats = db
      .prepare(
        `
      SELECT
        e.status,
        COUNT(*) as count
      FROM events e
      INNER JOIN scheduled_jobs sj ON e.id = sj.event_id
      WHERE e.startDate >= ?
      GROUP BY e.status
    `
      )
      .all(cutoffISO);

    stats.events.total = eventStats.reduce((sum, row) => sum + row.count, 0);
    stats.events.byStatus = {};
    eventStats.forEach((row) => {
      stats.events.byStatus[row.status] = row.count;
    });

    stats.events.successRate =
      stats.events.total > 0
        ? (((stats.events.byStatus.processed || 0) / stats.events.total) * 100).toFixed(2) + '%'
        : '0%';

    // Job statistics
    const jobStats = db
      .prepare(
        `
      SELECT
        status,
        COUNT(*) as count,
        AVG(retry_count) as avg_retries
      FROM scheduled_jobs
      WHERE created_at >= ?
      GROUP BY status
    `
      )
      .all(cutoffISO);

    stats.jobs.total = jobStats.reduce((sum, row) => sum + row.count, 0);
    stats.jobs.byStatus = {};
    jobStats.forEach((row) => {
      stats.jobs.byStatus[row.status] = {
        count: row.count,
        avgRetries: row.avg_retries ? parseFloat(row.avg_retries).toFixed(2) : '0',
      };
    });

    // Jobs that required retries
    const retriedJobs = db
      .prepare(
        `
      SELECT COUNT(*) as count
      FROM scheduled_jobs
      WHERE created_at >= ? AND retry_count > 0
    `
      )
      .get(cutoffISO);

    stats.jobs.requiredRetries = retriedJobs.count;
    stats.jobs.retryRate =
      stats.jobs.total > 0 ? ((retriedJobs.count / stats.jobs.total) * 100).toFixed(2) + '%' : '0%';

    // Performance metrics (estimated based on job timing)
    const performanceData = db
      .prepare(
        `
      SELECT
        julianday(updated_at) - julianday(created_at) as processing_days,
        status
      FROM scheduled_jobs
      WHERE created_at >= ? AND status IN ('completed', 'failed')
      ORDER BY created_at DESC
      LIMIT 100
    `
      )
      .all(cutoffISO);

    if (performanceData.length > 0) {
      const processingTimes = performanceData
        .filter((row) => row.processing_days > 0)
        .map((row) => row.processing_days * 24 * 60); // Convert to minutes

      if (processingTimes.length > 0) {
        stats.performance.avgProcessingTime =
          (processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(2) + ' minutes';
        stats.performance.maxProcessingTime = Math.max(...processingTimes).toFixed(2) + ' minutes';
        stats.performance.minProcessingTime = Math.min(...processingTimes).toFixed(2) + ' minutes';
      }
    }

    // Recent activity (last 10 jobs)
    const recentActivity = db
      .prepare(
        `
      SELECT
        sj.event_id,
        sj.event_name,
        sj.status,
        sj.retry_count,
        sj.error_message,
        sj.updated_at,
        e.startDate
      FROM scheduled_jobs sj
      LEFT JOIN events e ON sj.event_id = e.id
      ORDER BY sj.updated_at DESC
      LIMIT 10
    `
      )
      .all();

    stats.recentActivity = recentActivity.map((row) => ({
      eventId: row.event_id,
      eventName: row.event_name,
      status: row.status,
      retryCount: row.retry_count,
      error: row.error_message,
      lastUpdated: row.updated_at,
      eventDate: row.startDate,
    }));

    // Upcoming events (scheduled print jobs sorted by event date)
    const upcomingEvents = db
      .prepare(
        `
      SELECT
        sj.event_id,
        sj.event_name,
        sj.scheduled_time,
        sj.status,
        e.startDate
      FROM scheduled_jobs sj
      LEFT JOIN events e ON sj.event_id = e.id
      WHERE sj.status IN ('scheduled', 'retrying')
        AND e.startDate >= datetime('now')
      ORDER BY e.startDate ASC
      LIMIT 20
    `
      )
      .all();

    stats.upcomingEvents = upcomingEvents.map((row) => ({
      eventId: row.event_id,
      eventName: row.event_name,
      eventDate: row.startDate,
      scheduledTime: row.scheduled_time,
      status: row.status,
    }));

    // Current status summary
    const currentPending = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM scheduled_jobs WHERE status = 'scheduled'
    `
      )
      .get();

    const currentFailed = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM scheduled_jobs WHERE status = 'failed'
    `
      )
      .get();

    const currentRetrying = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM scheduled_jobs WHERE status = 'retrying'
    `
      )
      .get();

    stats.currentStatus = {
      pending: currentPending.count,
      failed: currentFailed.count,
      retrying: currentRetrying.count,
    };
  } catch (error) {
    logger.error('Error generating statistics:', error);
    stats.error = error.message;
  }

  return stats;
}

/**
 * Get a summary of statistics for logging
 * @returns {string} Summary string
 */
function getStatisticsSummary() {
  const stats = getStatistics(7);

  const summary = [
    `Statistics Summary (${stats.period}):`,
    `  Events: ${stats.events.total} total`,
    `  - Processed: ${stats.events.byStatus?.processed || 0}`,
    `  - Failed: ${stats.events.byStatus?.failed || 0}`,
    `  - Pending: ${stats.events.byStatus?.pending || 0}`,
    `  Success Rate: ${stats.events.successRate}`,
    ``,
    `  Jobs: ${stats.jobs.total} total`,
    `  - Completed: ${stats.jobs.byStatus?.completed?.count || 0}`,
    `  - Failed: ${stats.jobs.byStatus?.failed?.count || 0}`,
    `  - Retrying: ${stats.jobs.byStatus?.retrying?.count || 0}`,
    `  Retry Rate: ${stats.jobs.retryRate}`,
    ``,
    `  Current Status:`,
    `  - Pending: ${stats.currentStatus?.pending || 0}`,
    `  - Failed: ${stats.currentStatus?.failed || 0}`,
    `  - Retrying: ${stats.currentStatus?.retrying || 0}`,
  ].join('\n');

  return summary;
}

/**
 * Write statistics to a JSON file for external monitoring
 * @param {string} filePath - Path to write the stats file
 */
function writeStatisticsFile(filePath = 'statistics.json') {
  const fs = require('fs');
  const stats = getStatistics(30); // 30 days for file output

  try {
    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
    logger.info(`Statistics written to ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write statistics file:`, error);
  }
}

module.exports = {
  getStatistics,
  getStatisticsSummary,
  writeStatisticsFile,
};
