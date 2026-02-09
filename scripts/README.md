# Scripts Directory

Utility scripts for project maintenance and operations.

## Available Scripts

### cleanup.sh

One-time cleanup script used to reorganize the project structure (v1.3.0).

**Usage:**

```bash
bash scripts/cleanup.sh
```

**What it does:**

- Removes temporary and backup files
- Organizes assets into docs/assets/
- Moves release documentation to docs/releases/
- Moves Windows docs to docs/legacy/

**Note:** This script was used during the migration to Raspberry Pi focus. It's kept for reference but may not need to be run again unless resetting to a clean structure.

---

## Adding New Scripts

When adding new utility scripts:

1. **Name:** Use kebab-case (e.g., `backup-database.sh`)
2. **Documentation:** Add description here in README
3. **Executable:** Make executable with `chmod +x scripts/your-script.sh`
4. **Shebang:** Start with `#!/bin/bash`
5. **Help:** Include `--help` flag for usage instructions

### Template

```bash
#!/bin/bash
# Script Name: Description of what it does
# Usage: bash scripts/your-script.sh [options]

set -e  # Exit on error

# Your script here
```

---

## Best Practices

- ✅ Use `set -e` to exit on errors
- ✅ Add usage/help messages
- ✅ Validate inputs before destructive operations
- ✅ Log important actions
- ✅ Create backups before modifying files
- ✅ Test in a safe environment first

---

**Last Updated:** 2025-02-09
