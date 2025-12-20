# Release Quick Reference

## 🚀 Create a Release (Easiest Way)

```bash
npm run release
```

This interactive script will guide you through the entire process!

## 📋 Quick Commands

### Automated Release (Recommended)
```bash
npm run release              # Interactive guided release
```

### Manual Release
```bash
npm run release:patch        # Bug fixes (1.0.0 → 1.0.1)
npm run release:minor        # New features (1.0.0 → 1.1.0)
npm run release:major        # Breaking changes (1.0.0 → 2.0.0)
```

### Build Portable Package Only
```bash
npm run build:portable       # Creates ZIP in dist/
```

## 🎯 What Happens When You Release

1. **You run** `npm run release`
2. **Script checks** for uncommitted changes
3. **You choose** version bump type (patch/minor/major)
4. **You update** CHANGELOG.md
5. **Script runs** tests and linting
6. **Script builds** portable ZIP
7. **Script creates** git commit and tag
8. **Script pushes** to GitHub
9. **GitHub Actions**:
   - ✅ Runs tests again
   - ✅ Builds portable ZIP
   - ✅ Creates GitHub Release
   - ✅ Uploads ZIP file
   - ✅ Adds changelog

## 📦 What Gets Released

The GitHub Release includes:
- ✅ **Portable ZIP** - Ready-to-use package
- ✅ **CHANGELOG.md** - Full changelog
- ✅ **Release notes** - Auto-generated from commits
- ✅ **Download links** - Direct download

## 🔍 Check Release Status

### See Workflow Progress
```
https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/actions
```

### See Releases
```
https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases
```

## ⚡ Quick Release Flow

```
1. Make changes → Commit
2. Run: npm run release
3. Follow prompts
4. Done! GitHub Actions handles the rest
```

## 🛠️ Manual Control

If you need more control, see [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md)

## 🆘 Common Issues

**"Version mismatch"**
- Delete the tag and fix package.json version

**"Tests failing"**
- Fix tests before releasing: `npm test`

**"ZIP not created"**
- Check: `npm run build:portable`

**"Release already exists"**
- Delete on GitHub and re-push tag

See [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md) for detailed troubleshooting.

## 📝 Version Types

| Type | Example | When to Use |
|------|---------|-------------|
| **Patch** | 1.0.0 → 1.0.1 | Bug fixes only |
| **Minor** | 1.0.0 → 1.1.0 | New features, backwards compatible |
| **Major** | 1.0.0 → 2.0.0 | Breaking changes |

## ✅ Pre-Release Checklist

- [ ] All tests pass
- [ ] No linting errors
- [ ] CHANGELOG.md updated
- [ ] On main branch
- [ ] All changes committed
- [ ] Docs up to date

## 🎉 That's It!

The automated workflow makes releases simple and reliable!
