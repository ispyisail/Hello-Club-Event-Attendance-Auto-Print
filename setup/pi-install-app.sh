#!/bin/bash
# =============================================================================
# Raspberry Pi 5 Application Installation Script
# Hello Club Event Attendance Auto-Print
#
# Run after pi-configure.sh. Installs Node.js system-wide via NodeSource,
# clones the repo, installs dependencies, and configures systemd.
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

REPO_URL="${1:-}"
APP_DIR="/opt/helloclub/app"
NODE_VERSION="20"

if [ -z "$REPO_URL" ]; then
    read -r -p "Git repository URL: " REPO_URL
fi

echo "========================================================"
echo " Hello Club App Installation"
echo "========================================================"
echo ""
echo "  Repository: $REPO_URL"
echo "  Install to: $APP_DIR"
echo "  Node.js:    v${NODE_VERSION} (LTS)"
echo ""
read -r -p "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# =============================================================================
# Step 1: Install Node.js System-Wide
# =============================================================================
step "Step 1: Install Node.js v${NODE_VERSION} System-Wide"

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    CURRENT_VERSION=$(node --version)
    warn "Node.js $CURRENT_VERSION already installed, skipping"
else
    # Install Node.js from NodeSource repository (accessible to all users/services)
    echo "Installing Node.js from NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node.js $(node --version) installed at /usr/bin/node"
fi

# Verify installation
if [ ! -x "/usr/bin/node" ]; then
    err "Node.js not found at /usr/bin/node - installation failed"
fi

# =============================================================================
# Step 2: Clone Repository
# =============================================================================
step "Step 2: Clone Repository"

if [ -d "$APP_DIR/.git" ]; then
    warn "$APP_DIR already contains a git repo"
    read -r -p "Pull latest instead of fresh clone? [Y/n] " PULL_CONFIRM
    if [[ ! "$PULL_CONFIRM" =~ ^[Nn]$ ]]; then
        sudo -u helloclub git -C "$APP_DIR" pull
        ok "Repository updated"
    fi
else
    sudo -u helloclub git clone "$REPO_URL" "$APP_DIR"
    ok "Repository cloned to $APP_DIR"
fi

# =============================================================================
# Step 3: Install Dependencies
# =============================================================================
step "Step 3: Install Node Dependencies"

cd "$APP_DIR"

# Install build tools for native modules (better-sqlite3)
sudo apt install -y build-essential python3

sudo -u helloclub npm install --production --ignore-scripts

# Rebuild better-sqlite3 for ARM64
sudo -u helloclub npm rebuild better-sqlite3
ok "Dependencies installed and native modules rebuilt for ARM64"

# =============================================================================
# Step 4: Configure Environment
# =============================================================================
step "Step 4: Configure Environment"

if [ -f "$APP_DIR/.env" ]; then
    warn ".env already exists, skipping"
else
    if [ -f "$APP_DIR/.env.example" ]; then
        sudo -u helloclub cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        warn ".env created from .env.example — edit it now with your API key and SMTP settings:"
        warn "  sudo -u helloclub nano $APP_DIR/.env"
    else
        err ".env.example not found — cannot create .env"
    fi
fi

# =============================================================================
# Step 5: Install systemd Services
# =============================================================================
step "Step 5: Install systemd Services"

sudo cp "$APP_DIR/setup/helloclub.service" /etc/systemd/system/helloclub.service
sudo cp "$APP_DIR/setup/helloclub-dashboard.service" /etc/systemd/system/helloclub-dashboard.service
sudo systemctl daemon-reload
sudo systemctl enable helloclub helloclub-dashboard
ok "helloclub.service and helloclub-dashboard.service installed and enabled"

# Configure passwordless sudo for dashboard service control
# (limited to start/stop/restart of the helloclub service only)
SUDOERS_FILE="/etc/sudoers.d/helloclub"
sudo tee "$SUDOERS_FILE" > /dev/null <<'EOF'
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl start helloclub, /usr/bin/systemctl stop helloclub, /usr/bin/systemctl restart helloclub
EOF
sudo chmod 440 "$SUDOERS_FILE"
ok "Passwordless sudo configured for helloclub service control"

# =============================================================================
# Step 6: Optional CUPS Local Printing
# =============================================================================
step "Step 6: Local Printing (Optional)"

echo ""
echo "Default print mode is 'email' (no extra setup needed)."
read -r -p "Install CUPS for local/USB printing? [y/N] " CUPS_CONFIRM
if [[ "$CUPS_CONFIRM" =~ ^[Yy]$ ]]; then
    sudo apt install -y cups
    sudo usermod -aG lpadmin helloclub
    # Allow CUPS web UI access from the local network
    sudo cupsctl --remote-admin --remote-any
    ok "CUPS installed — configure printer at http://$(hostname -I | awk '{print $1}'):631"
else
    warn "Skipped CUPS — using email print mode (set in config.json)"
fi

# =============================================================================
# Step 7: Verify Installation
# =============================================================================
step "Step 7: Verify Installation"

echo ""
echo "Running quick connectivity test..."
if sudo -u helloclub node "$APP_DIR/src/index.js" fetch-events 2>&1 | tail -5; then
    ok "fetch-events completed"
else
    warn "fetch-events had errors — check .env configuration"
fi

# =============================================================================
# Done
# =============================================================================
echo ""
echo "========================================================"
echo -e " ${GREEN}Installation Complete!${NC}"
echo "========================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Edit .env with your API key and SMTP settings:"
echo "       sudo -u helloclub nano $APP_DIR/.env"
echo ""
echo "  2. Start both services:"
echo "       sudo systemctl start helloclub"
echo "       sudo systemctl start helloclub-dashboard"
echo ""
echo "  3. Open the web dashboard:"
IP_ADDR=\$(hostname -I | awk '{print \$1}')
echo "       http://\${IP_ADDR}:3000"
echo ""
echo "  4. Check service status:"
echo "       sudo systemctl status helloclub"
echo "       sudo systemctl status helloclub-dashboard"
echo ""
echo "  5. Follow logs:"
echo "       journalctl -u helloclub -f"
echo ""
echo "  6. Test event processing:"
echo "       sudo -u helloclub node $APP_DIR/src/index.js fetch-events"
echo "       sudo -u helloclub node $APP_DIR/src/index.js process-schedule"
