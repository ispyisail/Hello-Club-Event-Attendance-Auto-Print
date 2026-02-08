#!/bin/bash
# =============================================================================
# Raspberry Pi 5 Post-Boot Configuration Script
# Hello Club Event Attendance Auto-Print
#
# Run after first SSH login on a fresh Raspberry Pi OS Lite (64-bit) install.
# Handles: system update, static IP, firewall, SSH hardening, fail2ban,
#          unattended-upgrades, helloclub service user, /opt/helloclub dirs.
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
echo "  • Static IP address"
echo "  • UFW firewall (SSH + dashboard port)"
echo "  • SSH hardening (disable password auth)"
echo "  • fail2ban"
echo "  • Automatic security updates"
echo "  • helloclub service user"
echo "  • /opt/helloclub directory structure"
echo ""
warn "IMPORTANT: SSH key authentication must already be working."
warn "Password auth will be disabled. If you get locked out,"
warn "connect a keyboard/monitor to re-enable it."
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
# Step 2: Static IP
# =============================================================================
step "Step 2: Static IP Configuration"

# Detect active interface and connection
IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $5; exit}' || echo "eth0")
CONN_NAME=$(nmcli -t -f NAME,DEVICE con show --active 2>/dev/null | grep ":${IFACE}$" | cut -d: -f1 || echo "Wired connection 1")
CURRENT_IP=$(ip -4 addr show "$IFACE" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "unknown")
CURRENT_GW=$(ip route | grep default | awk '{print $3}' | head -1 || echo "unknown")

echo "Detected interface: $IFACE"
echo "Detected connection: $CONN_NAME"
echo "Current IP: $CURRENT_IP"
echo "Current gateway: $CURRENT_GW"
echo ""

read -r -p "Desired static IP (e.g. 192.168.1.50): " STATIC_IP
read -r -p "Subnet prefix (e.g. 24 for 255.255.255.0): " PREFIX
read -r -p "Gateway (e.g. $CURRENT_GW): " GATEWAY
read -r -p "DNS servers (e.g. 8.8.8.8 8.8.4.4): " DNS_SERVERS

sudo nmcli con modify "$CONN_NAME" \
    ipv4.method manual \
    ipv4.addresses "${STATIC_IP}/${PREFIX}" \
    ipv4.gateway "$GATEWAY" \
    ipv4.dns "$DNS_SERVERS"
sudo nmcli con up "$CONN_NAME" 2>/dev/null || true

ok "Static IP configured: ${STATIC_IP}/${PREFIX} via ${GATEWAY}"
warn "If SSH disconnects, reconnect to: ssh $(whoami)@${STATIC_IP}"

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

# Disable password authentication
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
# Disable root login
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONFIG"
# Disable empty passwords
sudo sed -i 's/^#\?PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"

# Verify the settings took effect
grep -E "^PasswordAuthentication|^PermitRootLogin|^PermitEmptyPasswords" "$SSHD_CONFIG"

sudo systemctl restart ssh
ok "SSH hardened (password auth disabled, root login disabled)"

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
echo "  Static IP:  ${STATIC_IP}"
echo "  SSH:        $(whoami)@${STATIC_IP}"
echo "  Firewall:   UFW enabled (ports 22, 3000)"
echo "  fail2ban:   active"
echo "  Service user: helloclub"
echo "  App dir:    /opt/helloclub/app"
echo ""
echo "Next: Phase 2 - Software Migration"
echo "  See: setup/pi-install-node.sh"
echo ""
warn "If you've been disconnected, reconnect to: ssh $(whoami)@${STATIC_IP}"
