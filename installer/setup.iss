; Hello Club Event Attendance - Installer Script
; Inno Setup Script for creating a professional Windows installer
;
; Requirements:
; - Inno Setup 6.x (Download from: https://jrsoftware.org/isdl.php)
; - Node.js installed on target machine
;
; To build: Open this file in Inno Setup Compiler and click "Compile"

#define MyAppName "Hello Club Event Attendance"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Your Organization"
#define MyAppURL "https://www.example.com/"
#define MyAppExeName "tray-monitor.exe"
#define ServiceName "HelloClubEventAttendance"

[Setup]
; Basic application info
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Installation directories
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output settings
OutputDir=..\dist
OutputBaseFilename=HelloClubEventAttendance-Setup-{#MyAppVersion}
;SetupIconFile=..\tray-app\icons\icon-green.ico  ; Disabled - using default icon

; Compression
Compression=lzma2
SolidCompression=yes

; Windows version requirements
MinVersion=10.0
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Appearance - Modern, clean design
WizardStyle=modern
DisableWelcomePage=no
WizardResizable=yes
WindowResizable=yes

; Uninstall
UninstallDisplayIcon={app}\tray-app\icons\icon-green.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
; Custom messages for a friendlier experience
WelcomeLabel1=Welcome to Hello Club Event Attendance Setup
WelcomeLabel2=This wizard will guide you through the installation and configuration of Hello Club Event Attendance - an automated system for printing event attendee lists.%n%nBefore continuing, please ensure you have:%n  • Your Hello Club API Key%n  • Node.js 14 or later installed%n  • Administrator privileges%n%nClick Next to continue.
FinishedLabel=Setup has successfully installed Hello Club Event Attendance!%n%nYour system tray monitor will launch automatically. You can:%n  • View logs and status from the tray icon%n  • Edit settings using the Settings menu%n  • Test your API and Email connections%n%nThe Windows service is ready to automatically process events.

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut for quick access"; GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "startupicon"; Description: "Launch tray monitor &automatically when Windows starts (Recommended)"; GroupDescription: "Startup options:"
Name: "installservice"; Description: "&Install Windows service for automatic event processing (Recommended)"; GroupDescription: "Service configuration:"

[Files]
; Copy all application files except node_modules, logs, and dist
Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs
Source: "..\service\*"; DestDir: "{app}\service"; Flags: ignoreversion recursesubdirs
Source: "..\tray-app\*"; DestDir: "{app}\tray-app"; Flags: ignoreversion recursesubdirs
Source: "..\migrations\*"; DestDir: "{app}\migrations"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme
Source: "..\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs

; Copy installer helper scripts
Source: "install-dependencies.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup-env.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Tray Monitor"; Filename: "{app}\tray-app\start-tray.bat"; IconFilename: "{app}\tray-app\icons\icon-green.ico"; WorkingDir: "{app}"
Name: "{group}\View Logs"; Filename: "notepad.exe"; Parameters: "{app}\activity.log"; WorkingDir: "{app}"
Name: "{group}\Open Project Folder"; Filename: "{app}"; WorkingDir: "{app}"
Name: "{group}\Service Status"; Filename: "cmd.exe"; Parameters: "/k cd /d ""{app}"" && npm run service:status"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName} Monitor"; Filename: "{app}\tray-app\start-tray.bat"; IconFilename: "{app}\tray-app\icons\icon-green.ico"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName} Monitor"; Filename: "{app}\tray-app\start-tray.bat"; IconFilename: "{app}\tray-app\icons\icon-green.ico"; WorkingDir: "{app}"; Tasks: startupicon

[Run]
; Check for Node.js
Filename: "{cmd}"; Parameters: "/c node --version"; StatusMsg: "✓ Verifying Node.js installation..."; Flags: runhidden waituntilterminated

; Install dependencies
Filename: "{app}\install-dependencies.bat"; StatusMsg: "📦 Installing application dependencies (this may take 3-5 minutes)..."; Flags: runhidden waituntilterminated; AfterInstall: CheckInstallResult

; Setup environment file
Filename: "{app}\setup-env.bat"; StatusMsg: "⚙️ Finalizing configuration..."; Flags: runhidden waituntilterminated shellexec postinstall skipifsilent

; Install and start service
Filename: "cmd.exe"; Parameters: "/c cd /d ""{app}"" && npm run service:install"; StatusMsg: "🔧 Installing and starting Windows service..."; Flags: runhidden waituntilterminated; Tasks: installservice

; Start tray monitor
Filename: "{app}\tray-app\start-tray.bat"; Description: "🚀 Launch Hello Club Tray Monitor now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Stop and uninstall service before removing files
Filename: "cmd.exe"; Parameters: "/c net stop {#ServiceName}"; Flags: runhidden
Filename: "cmd.exe"; Parameters: "/c cd /d ""{app}"" && npm run service:uninstall"; Flags: runhidden waituntilterminated

[UninstallDelete]
; Clean up generated files
Type: files; Name: "{app}\activity.log"
Type: files; Name: "{app}\error.log"
Type: files; Name: "{app}\events.db"
Type: filesandordirs; Name: "{app}\node_modules"
Type: dirifempty; Name: "{app}"

[Code]
var
  NodeJSInstalled: Boolean;
  DependenciesPage: TOutputProgressWizardPage;
  ConfigPage: TInputQueryWizardPage;
  ApiKeyPage: TInputQueryWizardPage;

// Check if Node.js is installed
function CheckNodeJS(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
  NodeJSInstalled := Result;
end;

// Initialize wizard with friendly setup checks
function InitializeSetup(): Boolean;
begin
  Result := True;

  // Check for Node.js with enhanced message
  if not CheckNodeJS() then
  begin
    if MsgBox('⚠️ Node.js Not Detected' + #13#10 + #13#10 +
              'Node.js is required to run Hello Club Event Attendance,' + #13#10 +
              'but it was not found on your system.' + #13#10 + #13#10 +
              '📥 To install Node.js:' + #13#10 +
              '   1. Visit https://nodejs.org/' + #13#10 +
              '   2. Download the LTS version (recommended)' + #13#10 +
              '   3. Run the installer' + #13#10 +
              '   4. Restart this installer' + #13#10 + #13#10 +
              'Continue installation without Node.js?' + #13#10 +
              '(The application will not work until Node.js is installed)',
              mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDNO then
    begin
      Result := False;
    end;
  end
  else
  begin
    // Node.js found - show success message
    MsgBox('✅ Node.js Detected' + #13#10 + #13#10 +
           'Node.js is installed and ready!' + #13#10 +
           'The installer will now continue.',
           mbInformation, MB_OK);
  end;
end;

// Custom pages with enhanced descriptions
procedure InitializeWizard();
begin
  // API Key configuration page
  ApiKeyPage := CreateInputQueryPage(wpSelectTasks,
    '🔑 Hello Club API Configuration',
    'Connect to your Hello Club account',
    'Your API key authenticates this application with Hello Club.' + #13#10 + #13#10 +
    '📍 Where to find your API key:' + #13#10 +
    '   1. Log in to your Hello Club account' + #13#10 +
    '   2. Go to Settings → API Access' + #13#10 +
    '   3. Copy your API key (starts with "hc_")' + #13#10 + #13#10 +
    'The printer email is optional - only needed if using email printing mode.');

  ApiKeyPage.Add('&API Key (Required):', False);
  ApiKeyPage.Add('&Printer Email (Optional):', False);

  // Email configuration page
  ConfigPage := CreateInputQueryPage(ApiKeyPage.ID,
    '📧 Email Printer Configuration',
    'Configure SMTP settings for email printing',
    'If you want to print via email (e.g., using Epson Email Print),' + #13#10 +
    'enter your SMTP credentials below.' + #13#10 + #13#10 +
    '💡 Gmail users:' + #13#10 +
    '   • Use an App Password (not your regular password)' + #13#10 +
    '   • Generate one at: myaccount.google.com/apppasswords' + #13#10 + #13#10 +
    'Leave blank to skip email printing (you can configure this later).');

  ConfigPage.Add('SMTP &Username (e.g., yourname@gmail.com):', False);
  ConfigPage.Add('SMTP &Password (App Password recommended):', True);
  ConfigPage.Add('SMTP &Host:', False);
  ConfigPage.Add('SMTP P&ort:', False);

  // Set defaults
  ConfigPage.Values[2] := 'smtp.gmail.com';
  ConfigPage.Values[3] := '587';
end;

// Validate API key page with helpful messages
function NextButtonClick(CurPageID: Integer): Boolean;
var
  ApiKey: String;
begin
  Result := True;

  if CurPageID = ApiKeyPage.ID then
  begin
    ApiKey := Trim(ApiKeyPage.Values[0]);

    // Check if API key is provided
    if ApiKey = '' then
    begin
      MsgBox('❌ API Key Required' + #13#10 + #13#10 +
             'You must enter your Hello Club API key to continue.' + #13#10 + #13#10 +
             '📍 How to get your API key:' + #13#10 +
             '   1. Visit your Hello Club dashboard' + #13#10 +
             '   2. Go to Settings → API Access' + #13#10 +
             '   3. Copy your API key' + #13#10 + #13#10 +
             'Need help? Contact Hello Club support.',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Validate API key format (should start with "hc_")
    if (Length(ApiKey) < 10) or (Copy(ApiKey, 1, 3) <> 'hc_') then
    begin
      if MsgBox('⚠️ API Key Format Warning' + #13#10 + #13#10 +
                'Your API key doesn''t match the expected format.' + #13#10 +
                'Hello Club API keys typically start with "hc_".' + #13#10 + #13#10 +
                'Do you want to continue anyway?',
                mbConfirmation, MB_YESNO) = IDNO then
      begin
        Result := False;
      end;
    end;
  end;
end;

// Save configuration after installation
procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvContent: AnsiString;
  ConfigContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Create .env file with user's configuration
    EnvContent :=
      '# Required for API access' + #13#10 +
      'API_KEY=' + ApiKeyPage.Values[0] + #13#10 + #13#10 +
      '# Required for Email Printing Mode' + #13#10 +
      'PRINTER_EMAIL=' + ApiKeyPage.Values[1] + #13#10 +
      'SMTP_USER=' + ConfigPage.Values[0] + #13#10 +
      'SMTP_PASS=' + ConfigPage.Values[1] + #13#10 +
      'EMAIL_FROM=' + ConfigPage.Values[0] + #13#10 +
      'SMTP_HOST=' + ConfigPage.Values[2] + #13#10 +
      'SMTP_PORT=' + ConfigPage.Values[3] + #13#10;

    SaveStringToFile(ExpandConstant('{app}\.env'), EnvContent, False);
  end;
end;

// Check if dependency installation succeeded with helpful guidance
procedure CheckInstallResult();
begin
  if not FileExists(ExpandConstant('{app}\node_modules')) then
  begin
    MsgBox('⚠️ Dependency Installation Issue' + #13#10 + #13#10 +
           'Some dependencies may not have installed correctly.' + #13#10 + #13#10 +
           '🔧 To fix this manually:' + #13#10 +
           '   1. Open Command Prompt as Administrator' + #13#10 +
           '   2. Navigate to: ' + ExpandConstant('{app}') + #13#10 +
           '   3. Run: npm install' + #13#10 + #13#10 +
           '💡 Common causes:' + #13#10 +
           '   • No internet connection' + #13#10 +
           '   • Antivirus blocking npm' + #13#10 +
           '   • Firewall restrictions' + #13#10 + #13#10 +
           'The application will not work until dependencies are installed.',
           mbInformation, MB_OK);
  end
  else
  begin
    MsgBox('✅ Installation Successful!' + #13#10 + #13#10 +
           'All dependencies have been installed correctly.' + #13#10 +
           'Hello Club Event Attendance is ready to use!',
           mbInformation, MB_OK);
  end;
end;
