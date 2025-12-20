# Release Process

This document describes how to create and publish a new release of Hello Club Event Attendance.

## Quick Release (Automated)

For most releases, use the automated script:

```bash
scripts\prepare-release.bat
```

This script will:
1. ✅ Check you're on main branch
2. ✅ Check for uncommitted changes
3. ✅ Prompt for version bump (patch/minor/major)
4. ✅ Update package.json version
5. ✅ Prompt to update CHANGELOG.md
6. ✅ Run tests and linting
7. ✅ Build portable package
8. ✅ Create git commit and tag
9. ✅ Push to GitHub
10. ✅ GitHub Actions builds and publishes release

## Manual Release Process

If you prefer manual control:

### 1. Prepare the Release

```bash
# Make sure you're on main branch
git checkout main
git pull origin main

# Ensure everything is committed
git status

# Run validation
npm run validate
```

### 2. Update Version

Choose the appropriate version bump:

- **Patch** (1.0.0 → 1.0.1): Bug fixes, no new features
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes

```bash
# Patch release
npm version patch

# Minor release
npm version minor

# Major release
npm version major

# Custom version
npm version 1.2.3
```

This updates `package.json` and `package-lock.json`.

### 3. Update CHANGELOG.md

Edit `CHANGELOG.md` and move items from `[Unreleased]` to a new version section:

```markdown
## [Unreleased]

## [1.2.0] - 2025-01-15

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix Z
```

### 4. Build and Test

```bash
# Run all tests
npm test

# Run linter
npm run lint

# Build portable package
npm run build:portable
```

Verify the ZIP was created in `dist/`.

### 5. Commit and Tag

```bash
# Commit version changes
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release vX.Y.Z"

# Create annotated tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### 6. Push to GitHub

```bash
# Push commit
git push origin main

# Push tag (this triggers the release workflow)
git push origin vX.Y.Z
```

### 7. GitHub Actions Takes Over

Once the tag is pushed, GitHub Actions automatically:

1. ✅ Runs tests and linting
2. ✅ Builds portable ZIP
3. ✅ Creates GitHub Release
4. ✅ Uploads ZIP to release
5. ✅ Uploads CHANGELOG.md to release
6. ✅ Generates release notes from commits

### 8. Verify Release

1. Go to: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases
2. Check that the release was created
3. Download and test the portable ZIP
4. Verify release notes are accurate

## Release Checklist

Before creating a release:

- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] CHANGELOG.md updated
- [ ] Version number follows semver
- [ ] On main branch
- [ ] No uncommitted changes
- [ ] Portable ZIP builds successfully
- [ ] Documentation is up to date
- [ ] All PRs merged
- [ ] No known critical bugs

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

**MAJOR.MINOR.PATCH**

- **MAJOR**: Breaking changes (e.g., config format changes, API changes)
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, no new features

Examples:
- `1.0.0` → `1.0.1`: Fixed a bug
- `1.0.1` → `1.1.0`: Added event categories feature
- `1.1.0` → `2.0.0`: Changed config.json structure (breaking)

## Pre-releases

For beta or release candidate versions:

```bash
# Create pre-release
npm version 1.2.0-beta.1

# Tag and push
git push origin main
git push origin v1.2.0-beta.1
```

Mark as pre-release in GitHub UI.

## Hotfix Releases

For urgent bug fixes:

```bash
# Create hotfix branch from tag
git checkout -b hotfix/v1.2.1 v1.2.0

# Make fixes
# Test thoroughly

# Bump patch version
npm version patch

# Commit, tag, and push
git commit -am "fix: critical bug in event processing"
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin hotfix/v1.2.1
git push origin v1.2.1

# Merge back to main
git checkout main
git merge hotfix/v1.2.1
git push origin main
```

## Manual Release Creation

If GitHub Actions fails, create the release manually:

```bash
# Build portable ZIP
npm run build:portable

# Create release using GitHub CLI
gh release create v1.2.0 \
  --title "Release v1.2.0" \
  --notes-file CHANGELOG.md \
  dist/HelloClubEventAttendance-Portable-v1.2.0.zip
```

Or use the GitHub web UI:
1. Go to: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/new
2. Select tag: v1.2.0
3. Enter title: "Release v1.2.0"
4. Copy relevant section from CHANGELOG.md
5. Upload ZIP file
6. Publish release

## Release Workflow Details

The `.github/workflows/release.yml` workflow:

### Triggers

- **Push to tag**: `v*.*.*` (e.g., v1.2.3)
- **Manual dispatch**: From GitHub Actions UI

### Steps

1. Checkout code
2. Setup Node.js 16.x
3. Extract version from tag
4. Verify version matches package.json
5. Install dependencies
6. Run tests
7. Run linter
8. Build portable ZIP
9. Generate changelog from commits
10. Create GitHub Release
11. Upload portable ZIP
12. Upload CHANGELOG.md

### Outputs

- **GitHub Release** with auto-generated notes
- **Portable ZIP** attached as asset
- **CHANGELOG.md** attached as asset

## Troubleshooting Releases

### "Version mismatch" error

The tag version doesn't match package.json:

```bash
# Fix package.json version
npm version 1.2.3 --no-git-tag-version

# Delete incorrect tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Create correct tag
git add package.json package-lock.json
git commit -m "chore: fix version"
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin main
git push origin v1.2.3
```

### Tests failing in workflow

```bash
# Run tests locally first
npm test

# Fix failing tests
# Commit and push fixes
# Re-tag if needed
```

### ZIP not created

```bash
# Build locally to debug
npm run build:portable

# Check portable/BUILD-PORTABLE-ZIP.bat for errors
# Fix issues and commit
```

### Release already exists

```bash
# Delete release on GitHub
gh release delete v1.2.3 --yes

# Delete tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Re-create with fixes
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

## Best Practices

1. **Test before releasing**: Always run full test suite
2. **Update CHANGELOG**: Keep users informed of changes
3. **Descriptive commits**: Use conventional commits format
4. **Test the release**: Download and test the portable ZIP
5. **Announce releases**: Post in relevant channels
6. **Monitor feedback**: Watch for issues in new release
7. **Have rollback plan**: Know how to revert if needed

## Rollback Process

If a release has critical issues:

```bash
# Create hotfix or revert
git checkout -b hotfix/v1.2.1 v1.2.0

# Fix issue
# Test thoroughly

# Release hotfix
npm version patch
git commit -am "fix: critical issue"
git tag -a v1.2.1 -m "Hotfix v1.2.1"
git push origin hotfix/v1.2.1
git push origin v1.2.1
```

Or mark release as pre-release and create new stable release.

## Post-Release Tasks

After creating a release:

- [ ] Test download and installation
- [ ] Update documentation if needed
- [ ] Announce to users
- [ ] Monitor GitHub issues for problems
- [ ] Start planning next release
- [ ] Update project board/roadmap

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
