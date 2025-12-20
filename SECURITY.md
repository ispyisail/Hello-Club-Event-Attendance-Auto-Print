# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Hello Club Event Attendance Auto-Print seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainer through GitHub
3. Use [GitHub Security Advisories](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/security/advisories/new) to privately report vulnerabilities

### What to Include

Please provide as much information as possible:

- Type of vulnerability (e.g., SQL injection, XSS, credential exposure)
- Full paths of affected source files
- Location of the affected code (tag/branch/commit)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact assessment and potential attack scenarios

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 5 business days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next scheduled release

### What to Expect

1. **Acknowledgment**: We'll confirm receipt of your report
2. **Assessment**: We'll evaluate the vulnerability and severity
3. **Updates**: We'll keep you informed of our progress
4. **Fix**: We'll develop and test a fix
5. **Disclosure**: We'll coordinate public disclosure with you
6. **Credit**: We'll credit you in the security advisory (if desired)

## Security Best Practices

When using this application:

### API Keys and Secrets

- **NEVER** commit your `.env` file to version control
- Store API keys in environment variables only
- Rotate API keys regularly
- Use different API keys for development and production

### Email Configuration

- Use app-specific passwords for SMTP (not your main password)
- Enable 2FA on email accounts used for SMTP
- Restrict printer email addresses to trusted recipients only

### Windows Service

- Run the service with minimum required permissions
- Regularly update dependencies using `npm audit` and Dependabot
- Review logs regularly for suspicious activity

### Database

- The SQLite database (`events.db`) contains event and attendee data
- Ensure proper file permissions on the database file
- Backup the database regularly
- Delete old event data periodically

### Electron Tray App

- Only run the tray app from trusted sources
- Verify checksums when downloading releases
- Keep Electron updated to the latest secure version

## Known Security Considerations

### Known Vulnerabilities

#### pkg (Development Dependency Only)

**Status**: MODERATE severity - No fix available
**CVE**: GHSA-22r3-9w55-cj54 (Local Privilege Escalation)
**Impact**: Development tool only, not used in production

The `pkg` package (used experimentally for creating standalone executables) has a known local privilege escalation vulnerability with no fix available. This is a **development-only dependency** and poses no risk to production deployments because:

- pkg is not used in the main build process
- The production application uses electron-builder for packaging
- pkg is never executed in production environments
- The vulnerability requires local access (not remotely exploitable)

**Mitigation**:
- pkg is isolated to development use only
- Consider removing if standalone executable builds are not needed
- Use electron-builder (secure, actively maintained) for production builds

### Current Mitigations

- Environment variable isolation for secrets
- Input validation using Joi schema
- Winston logging for audit trails
- Automated dependency updates via Dependabot
- npm audit checks in CI/CD pipeline
- Production dependencies fully patched and secure

### Planned Improvements

- Enhanced Electron security (context isolation)
- Database encryption at rest
- Rate limiting for API requests
- Automated security scanning with CodeQL

## Security-Related Configuration

### Recommended `.env` Settings

```env
# Production environment
NODE_ENV=production

# Use strong, unique API keys
API_KEY=your_secure_api_key_here

# Use app-specific passwords
SMTP_PASS=your_app_specific_password
```

### File Permissions

Ensure restrictive permissions on sensitive files:

```bash
# Windows (PowerShell)
icacls .env /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
icacls events.db /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
```

## Dependency Security

We use multiple layers to ensure dependency security:

1. **Dependabot**: Automated weekly dependency updates
2. **npm audit**: Runs in CI/CD pipeline
3. **package-lock.json**: Locked dependency versions
4. **Manual Review**: Critical dependencies reviewed before updates

## Disclosure Policy

We follow coordinated disclosure:

1. Security researchers have 90 days to report vulnerabilities before public disclosure
2. We aim to patch critical vulnerabilities within 7 days
3. Public disclosure occurs after a fix is available
4. Security advisories are published on GitHub

## Contact

- **Security Issues**: Use [GitHub Security Advisories](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/security/advisories/new)
- **General Issues**: [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)
- **Maintainer**: ispyisail (via GitHub)

## Acknowledgments

We appreciate the security research community's efforts to improve this project. Security researchers who responsibly disclose vulnerabilities will be acknowledged in:

- This SECURITY.md file
- GitHub Security Advisories
- Release notes

Thank you for helping keep Hello Club Event Attendance Auto-Print secure!
