#!/bin/bash
#
# Service Health Monitor
# Checks if Hello Club service is running and healthy
# Can be run from cron: */5 * * * * /path/to/monitor-service.sh
#

set -euo pipefail

SERVICE_NAME="helloclub"
HEALTH_FILE="/home/user/Hello-Club-Event-Attendance-Auto-Print/service-health.json"
LOG_FILE="/home/user/Hello-Club-Event-Attendance-Auto-Print/monitor.log"
MAX_AGE_SECONDS=180  # Health file must be updated within 3 minutes
ALERT_EMAIL="${ALERT_EMAIL:-}"  # Set via environment or config

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

alert() {
    local message="$1"
    log "ALERT: $message"

    # Send email if configured
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$message" | mail -s "Hello Club Service Alert" "$ALERT_EMAIL" 2>/dev/null || true
    fi

    # Log to system journal
    logger -t helloclub-monitor -p user.alert "$message"
}

# Check if service is running
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    alert "Service $SERVICE_NAME is NOT running! Attempting restart..."
    sudo systemctl start "$SERVICE_NAME"
    sleep 5

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        alert "Service $SERVICE_NAME successfully restarted"
    else
        alert "CRITICAL: Failed to restart $SERVICE_NAME"
        exit 1
    fi
fi

# Check if health file exists and is recent
if [[ ! -f "$HEALTH_FILE" ]]; then
    alert "Health file missing: $HEALTH_FILE"
    exit 1
fi

# Check health file age
file_age=$(($(date +%s) - $(stat -c %Y "$HEALTH_FILE")))
if [[ $file_age -gt $MAX_AGE_SECONDS ]]; then
    alert "Health file is stale (${file_age}s old). Service may be frozen."
    alert "Attempting service restart..."
    sudo systemctl restart "$SERVICE_NAME"
    exit 1
fi

# Parse health status
status=$(jq -r '.status // "unknown"' "$HEALTH_FILE" 2>/dev/null || echo "unknown")

if [[ "$status" == "unhealthy" ]]; then
    alert "Service reports unhealthy status. Checking details..."
    jq . "$HEALTH_FILE" >> "$LOG_FILE"

    # Check specific issues
    db_status=$(jq -r '.checks.database.status // "unknown"' "$HEALTH_FILE")
    if [[ "$db_status" != "ok" ]]; then
        alert "Database check failed: $db_status"
    fi

    exit 1
elif [[ "$status" == "degraded" ]]; then
    log "WARNING: Service is degraded but functional"
    failed_jobs=$(jq -r '.checks.jobs.failed // 0' "$HEALTH_FILE")
    log "Failed jobs count: $failed_jobs"
fi

# Check for excessive failed jobs
failed_count=$(jq -r '.checks.jobs.failed // 0' "$HEALTH_FILE")
if [[ $failed_count -gt 10 ]]; then
    alert "High failed job count: $failed_count"
fi

log "Health check passed. Status: $status"
exit 0
