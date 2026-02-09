#!/bin/bash
# =============================================================================
# Raspberry Pi Application Upgrade Script
# Hello Club Event Attendance Auto-Print
#
# Pulls latest code from GitHub, preserves configs, and restarts services.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

APP_DIR="/opt/helloclub/app"
BACKUP_DIR="/opt/helloclub/backups"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    err "Please run as root: sudo bash setup/pi-upgrade.sh"
fi

# Check if app is installed
if [ ! -d "$APP_DIR/.git" ]; then
    err "Application not installed at $APP_DIR — run pi-install-app.sh first"
fi

echo "========================================================"
echo " Hello Club App Upgrade"
echo "========================================================"
echo ""
echo "  Location: $APP_DIR"
echo "  Current:  $(cd $APP_DIR && git log -1 --oneline)"
echo ""
echo "This will:"
echo "  • Pull latest code from GitHub"
echo "  • Preserve .env and config.json"
echo "  • Reinstall dependencies"
echo "  • Restart services"
echo ""
read -r -p "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# =============================================================================
# Step 1: Stop Services
# =============================================================================
step "Step 1: Stop Services"

systemctl stop helloclub helloclub-dashboard || true
ok "Services stopped"

# =============================================================================
# Step 2: Backup Configs
# =============================================================================
step "Step 2: Backup Current Configuration"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/upgrade_$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$BACKUP_PATH/.env"
    ok ".env backed up"
fi

if [ -f "$APP_DIR/config.json" ]; then
    cp "$APP_DIR/config.json" "$BACKUP_PATH/config.json"
    ok "config.json backed up"
fi

if [ -f "$APP_DIR/attendance.db" ]; then
    cp "$APP_DIR/attendance.db" "$BACKUP_PATH/attendance.db"
    ok "attendance.db backed up"
fi

# =============================================================================
# Step 3: Pull Latest Code
# =============================================================================
step "Step 3: Pull Latest Code from GitHub"

cd "$APP_DIR"
sudo -u helloclub git fetch origin
sudo -u helloclub git reset --hard origin/main
ok "Updated to: $(git log -1 --oneline)"

# =============================================================================
# Step 4: Install/Update Dependencies
# =============================================================================
step "Step 4: Update Dependencies"

sudo -u helloclub npm install --production --ignore-scripts
sudo -u helloclub npm rebuild better-sqlite3
ok "Dependencies updated"

# =============================================================================
# Step 5: Restore Configs
# =============================================================================
step "Step 5: Restore Configuration"

if [ -f "$BACKUP_PATH/.env" ]; then
    sudo -u helloclub cp "$BACKUP_PATH/.env" "$APP_DIR/.env"
    ok ".env restored"
fi

if [ -f "$BACKUP_PATH/config.json" ]; then
    sudo -u helloclub cp "$BACKUP_PATH/config.json" "$APP_DIR/config.json"
    ok "config.json restored"
fi

if [ -f "$BACKUP_PATH/attendance.db" ]; then
    sudo -u helloclub cp "$BACKUP_PATH/attendance.db" "$APP_DIR/attendance.db"
    ok "attendance.db restored"
fi

# =============================================================================
# Step 6: Update systemd Services (if changed)
# =============================================================================
step "Step 6: Update systemd Services"

cp "$APP_DIR/setup/helloclub.service" /etc/systemd/system/helloclub.service
cp "$APP_DIR/setup/helloclub-dashboard.service" /etc/systemd/system/helloclub-dashboard.service
systemctl daemon-reload
ok "systemd services updated"

# =============================================================================
# Step 7: Start Services
# =============================================================================
step "Step 7: Start Services"

systemctl start helloclub helloclub-dashboard
ok "Services started"

# Wait for services to stabilize
sleep 3

# =============================================================================
# Step 8: Verify Services
# =============================================================================
step "Step 8: Verify Services"

if systemctl is-active --quiet helloclub; then
    ok "helloclub.service is running"
else
    warn "helloclub.service failed to start — check: journalctl -u helloclub -n 50"
fi

if systemctl is-active --quiet helloclub-dashboard; then
    ok "helloclub-dashboard.service is running"
else
    warn "helloclub-dashboard.service failed to start — check: journalctl -u helloclub-dashboard -n 50"
fi

# =============================================================================
# Done
# =============================================================================
echo ""
echo "========================================================"
echo -e " ${GREEN}Upgrade Complete!${NC}"
echo "========================================================"
echo ""
echo "Updated to: $(cd $APP_DIR && git log -1 --oneline)"
echo "Backup saved: $BACKUP_PATH"
echo ""
echo "Dashboard: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Check logs:"
echo "  journalctl -u helloclub -f"
echo "  journalctl -u helloclub-dashboard -f"
echo ""
