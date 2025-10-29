================================================================================
NSSM (Non-Sucking Service Manager) Installation Folder
================================================================================

This folder contains NSSM - a tool for running applications as Windows services.

HOW NSSM GOT HERE:
When you ran "NSSM - Step 1 - Download NSSM.bat", the download-nssm.ps1 script
downloaded NSSM v2.24 from https://nssm.cc/ and extracted it here.

FOLDER STRUCTURE:
nssm/
├── nssm-2.24/
│   ├── win64/
│   │   └── nssm.exe      ← The actual NSSM program
│   ├── win32/
│   │   └── nssm.exe      ← 32-bit version (not used)
│   └── README.txt
└── download-nssm.ps1     ← PowerShell download script

WHAT IS NSSM:
NSSM is a service manager that allows any Windows application to run as a
Windows service. It's the professional choice for running Node.js apps as
services.

Website: https://nssm.cc/
License: Public Domain

WHY NSSM:
- Reliable and battle-tested
- Used by thousands of companies
- Easy to configure
- Automatic restart on failure
- Log file rotation
- GUI configuration

YOU DON'T NEED TO TOUCH THIS FOLDER!
All NSSM operations are handled by the batch files in the parent folder:
- NSSM - Step 1 - Download NSSM.bat (already run)
- NSSM - Step 2 - Install Service.bat
- NSSM - Manage Service.bat

TROUBLESHOOTING:
If NSSM is corrupted or missing:
1. Delete this entire "nssm" folder
2. Run "NSSM - Step 1 - Download NSSM.bat" again

MANUAL DOWNLOAD:
If the download script fails, you can download manually:
1. Visit: https://nssm.cc/download
2. Download nssm-2.24.zip
3. Extract to this folder (keep the nssm-2.24 subfolder structure)

================================================================================
