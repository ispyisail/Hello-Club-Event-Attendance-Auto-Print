# Raspberry Pi 5 Setup Guide

Complete setup guide for running Hello Club Event Attendance Auto-Print on a Raspberry Pi 5.

---

## Hardware Shopping List

| Item                                | Notes                                             |
| ----------------------------------- | ------------------------------------------------- |
| Raspberry Pi 5 (8GB)                | 8GB recommended for headroom                      |
| NVMe HAT (official or Pimoroni)     | M.2 M-key slot                                    |
| M.2 NVMe SSD (128GB+)               | 2230 or 2242 form factor                          |
| Official Raspberry Pi 27W USB-C PSU | Pi 5 requires 27W; cheaper PSUs cause throttling  |
| Compatible case with NVMe access    | e.g. Argon NEO 5 M.2, official active cooler case |
| Ethernet cable                      | Recommended over WiFi for reliability             |

---

## Step 1: Flash Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your PC

2. Open Imager and click **Choose Device** → **Raspberry Pi 5**

3. Click **Choose OS** → **Raspberry Pi OS (other)** → **Raspberry Pi OS Lite (64-bit)**
   - "Lite" = no desktop, smaller image, perfect for a headless service

4. Click **Choose Storage** → select your NVMe drive (connect via USB adapter if flashing externally, or use the Pi's USB port with the HAT installed)

5. Click **Next** → **Edit Settings** and configure:
   - **Hostname:** `helloclub-pi`
   - **Username:** `pi` (or your preferred username)
   - **Password:** strong password (remember this!)
   - **Enable SSH:** checked, **Use password authentication** (simpler, still secure with fail2ban)
   - **Timezone:** your local timezone
   - **Locale:** your locale

6. Click **Save** → **Yes** to apply → **Yes** to confirm flash

7. Insert NVMe into Pi HAT, connect ethernet and power

---

## Step 2: First Boot & SSH

Wait ~60 seconds for first boot, then connect:

**From Linux/Mac:**

```bash
ssh pi@helloclub-pi.local
```

**From Windows:**

```powershell
# Open PowerShell or Command Prompt
ssh pi@helloclub-pi.local

# Or use PuTTY: enter helloclub-pi.local as hostname, port 22
```

**If `.local` doesn't work:**

- Windows may need [Bonjour](https://support.apple.com/downloads/bonjour-for-windows) for `.local` resolution
- Or find the IP from your router and use: `ssh pi@192.168.1.X`

Verify you're on a Pi 5 with 64-bit OS:

```bash
uname -m        # Should show: aarch64
cat /proc/cpuinfo | grep "Model"  # Should show: Raspberry Pi 5
```

---

## Step 3: Run the Configuration Script

The `setup/pi-configure.sh` script handles everything from here:

```bash
# Clone the repo to get the script
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git ~/helloclub-setup
cd ~/helloclub-setup

# Run the configuration script
bash setup/pi-configure.sh
```

**What the script does:**

- ✅ System update (apt full-upgrade)
- ✅ UFW firewall (ports 22, 3000)
- ✅ fail2ban for brute-force protection
- ✅ Automatic security updates
- ✅ Creates helloclub service user
- ✅ Sets up /opt/helloclub directory structure

**What it DOESN'T do (kept simple):**

- ❌ No static IP configuration (uses DHCP + hostname)
- ❌ Keeps SSH password authentication enabled (user-friendly)

Just press `y` when prompted and let it run!

---

## Step 4: Verify Setup

After the script completes, you'll still be connected via SSH. Verify everything worked:

```bash
# Check hostname and IP
hostname
hostname -I
```

Check everything is running:

```bash
# Firewall
sudo ufw status

# fail2ban
sudo fail2ban-client status

# Service user
id helloclub

# Application directory
ls -la /opt/helloclub/
```

---

## What the Script Configures

| Component                     | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| System update                 | Latest packages (full-upgrade)                   |
| Network                       | DHCP (access via hostname.local)                 |
| UFW firewall                  | Allow only SSH (22) and dashboard (3000)         |
| SSH hardening                 | Disable root login, keep password auth enabled   |
| fail2ban                      | Block brute-force SSH attempts                   |
| unattended-upgrades           | Automatic security patches                       |
| `helloclub` service user      | Runs the Node.js service with minimal privileges |
| `/opt/helloclub/` directories | App, backups, logs                               |

---

---

## Printing Setup

### Option A: Email Printing (Recommended — zero extra setup)

The default `printMode: "email"` in `config.json` sends the PDF as an email attachment to your network printer's email address. Nodemailer works identically on Linux. No additional configuration needed beyond the SMTP settings already in `.env`.

### Option B: Local Printing via CUPS (Optional)

If your printer is physically connected to the Pi or reachable over the network:

```bash
# Install CUPS
sudo apt install -y cups

# Add your user to the lpadmin group (to manage printers)
sudo usermod -aG lpadmin pi

# Open CUPS web UI from another machine on the network
# http://helloclub-pi.local:631
```

**Add the printer via CUPS web UI:**

1. Navigate to `http://helloclub-pi.local:631`
2. Click **Administration** → **Add Printer**
3. Select your printer from the list
4. Note the printer name (e.g. `HP_LaserJet_Pro`)

**Or add via command line:**

```bash
# USB printer (replace /dev/usb/lp0 with your device)
sudo lpadmin -p MyPrinter -E -v usb://... -m everywhere

# Network printer (IPP)
sudo lpadmin -p MyPrinter -E -v ipp://192.168.1.XX/ipp/print -m everywhere
```

**Configure the app to use local printing:**

1. In `.env`, set: `PRINTER_NAME=MyPrinter` (or leave blank for system default)
2. In `config.json`, set: `"printMode": "local"`
3. Restart the service: `sudo systemctl restart helloclub`

**Test local printing:**

```bash
# List printers
lpstat -p

# Test print a file
lp -d MyPrinter /opt/helloclub/app/attendees.pdf
```

---

## Next Steps

Once Phase 1 is complete, proceed to `setup/pi-install-app.sh` to install Node.js, clone the repo, and configure systemd.

See the deployment checklist:

1. `npm test` passes on ARM64
2. `node src/index.js fetch-events` confirms API connectivity
3. systemd service starts/stops/restarts cleanly
4. Web dashboard accessible at `http://helloclub-pi.local:3000`
