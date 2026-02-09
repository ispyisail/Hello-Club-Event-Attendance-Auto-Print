#!/bin/bash
# Project Cleanup Script
# This script removes unused files and organizes the project structure

set -e

echo "🧹 Starting project cleanup..."

# Create organization directories
echo "📁 Creating organization directories..."
mkdir -p docs/assets
mkdir -p docs/releases

# Remove backup files (not needed in repository)
echo "🗑️  Removing backup files..."
rm -f .env.backup
rm -f config.json.backup

# Remove temporary log files
echo "🗑️  Removing temporary files..."
rm -f tray-app.log
rm -f project_map.txt

# Move assets to proper location
echo "📦 Organizing assets..."
if [ -f "logo.jpg" ]; then
    mv logo.jpg docs/assets/
    echo "  ✓ Moved logo.jpg to docs/assets/"
fi

# Move release documentation
echo "📄 Organizing release documentation..."
if [ -f "RELEASE-NOTES-v1.1.0.md" ]; then
    mv RELEASE-NOTES-v1.1.0.md docs/releases/
    echo "  ✓ Moved RELEASE-NOTES-v1.1.0.md"
fi

if [ -f "RELEASE-QUICK-REF.md" ]; then
    mv RELEASE-QUICK-REF.md docs/releases/
    echo "  ✓ Moved RELEASE-QUICK-REF.md"
fi

if [ -f "GITHUB-RELEASE-DRAFT.md" ]; then
    mv GITHUB-RELEASE-DRAFT.md docs/releases/
    echo "  ✓ Moved GITHUB-RELEASE-DRAFT.md"
fi

# Remove duplicate migrations folder (migrations are in src/core/migrations/)
echo "🗑️  Removing duplicate migrations folder..."
if [ -d "migrations" ]; then
    rm -rf migrations/
    echo "  ✓ Removed duplicate migrations/ directory"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Summary of changes:"
echo "  • Removed backup files (.env.backup, config.json.backup)"
echo "  • Removed temporary files (tray-app.log, project_map.txt)"
echo "  • Moved logo.jpg to docs/assets/"
echo "  • Moved release docs to docs/releases/"
echo "  • Removed duplicate migrations/ folder"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Update README.md logo path if needed"
echo "  3. Commit the changes: git add -A && git commit -m 'chore: clean up project structure'"
