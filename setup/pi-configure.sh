#!/bin/bash
# =============================================================================
# Raspberry Pi 5 Post-Boot Configuration Script
# Hello Club Event Attendance Auto-Print
#
# Run after first SSH login on a fresh Raspberry Pi OS Lite (64-bit) install.
# Handles: system update, firewall, SSH hardening, fail2ban,
#          unattended-upgrades, helloclub service user, /opt/helloclub dirs.
#
# Network: Uses DHCP (access via hostname.local)
# SSH: Password authentication enabled (kept simple)
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Must run as non-root (uses sudo internally)
if [ "$EUID" -eq 0 ]; then
    err "Do not run as root. Run as the pi user: bash pi-configure.sh"
fi

echo "========================================================"
echo " Hello Club Pi Configuration"
echo "========================================================"
echo ""
echo "This script will configure:"
echo "  • System update"
echo "  • UFW firewall (SSH + dashboard port)"
echo "  • fail2ban (brute-force protection)"
echo "  • Automatic security updates"
echo "  • helloclub service user"
echo "  • /opt/helloclub directory structure"
echo ""
echo "Network: DHCP (using hostname)"
echo "SSH: Password authentication enabled"
echo ""
read -r -p "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# =============================================================================
# Step 1: System Update
# =============================================================================
step "Step 1: System Update"
sudo apt update
sudo apt full-upgrade -y
ok "System updated"

# =============================================================================
# Step 2: Network Configuration
# =============================================================================
step "Step 2: Network Configuration"

# Get current hostname and IP
HOSTNAME=$(hostname)
CURRENT_IP=$(hostname -I | awk '{print $1}')

echo "Current hostname: $HOSTNAME"
echo "Current IP (DHCP): $CURRENT_IP"
echo ""
ok "Using DHCP - connect via: ssh $(whoami)@${HOSTNAME}.local or ssh $(whoami)@${CURRENT_IP}"

# =============================================================================
# Step 3: UFW Firewall
# =============================================================================
step "Step 3: Firewall (UFW)"

sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 3000/tcp comment 'Hello Club Web Dashboard'
sudo ufw --force enable

ok "Firewall enabled"
sudo ufw status verbose

# =============================================================================
# Step 4: SSH Hardening
# =============================================================================
step "Step 4: SSH Hardening"

SSHD_CONFIG="/etc/ssh/sshd_config"

# Keep password authentication enabled for simplicity
# Disable root login for security
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONFIG"
# Disable empty passwords
sudo sed -i 's/^#\?PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"

# Verify the settings took effect
grep -E "^PermitRootLogin|^PermitEmptyPasswords" "$SSHD_CONFIG"

sudo systemctl restart ssh
ok "SSH hardened (root login disabled, password auth enabled)"

# =============================================================================
# Step 5: fail2ban
# =============================================================================
step "Step 5: fail2ban (Brute-Force Protection)"

sudo apt install -y fail2ban

# Create local jail config
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
ok "fail2ban configured and running"

# =============================================================================
# Step 6: Automatic Security Updates
# =============================================================================
step "Step 6: Automatic Security Updates"

sudo apt install -y unattended-upgrades apt-listchanges

sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

ok "Automatic security updates configured"

# =============================================================================
# Step 7: Create helloclub Service User
# =============================================================================
step "Step 7: Create helloclub Service User"

if id "helloclub" &>/dev/null; then
    warn "helloclub user already exists, skipping"
else
    # System user (no login shell, no home login) for running the service
    sudo useradd -r -m -d /opt/helloclub -s /usr/sbin/nologin helloclub
    ok "Created helloclub system user"
fi

# =============================================================================
# Step 8: Application Directories
# =============================================================================
step "Step 8: Application Directories"

sudo mkdir -p /opt/helloclub/{app,backups,logs}
sudo chown -R helloclub:helloclub /opt/helloclub
ok "Created /opt/helloclub/{app,backups,logs}"
ls -la /opt/helloclub/

# =============================================================================
# Done
# =============================================================================
echo ""
echo "========================================================"
echo -e " ${GREEN}Phase 1 Complete!${NC}"
echo "========================================================"
echo ""
echo "Summary:"
echo "  Hostname:   $(hostname)"
echo "  IP (DHCP):  $(hostname -I | awk '{print $1}')"
echo "  SSH:        $(whoami)@$(hostname).local or $(whoami)@$(hostname -I | awk '{print $1}')"
echo "  Firewall:   UFW enabled (ports 22, 3000)"
echo "  fail2ban:   active"
echo "  Service user: helloclub"
echo "  App dir:    /opt/helloclub/app"
echo ""
echo "Next: Phase 2 - Application Installation"
echo "  Run: bash setup/pi-install-app.sh"
echo ""
ok "Connect via hostname: ssh $(whoami)@$(hostname).local"
