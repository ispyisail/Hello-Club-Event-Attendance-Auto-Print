/**
 * Convert PNG icon to ICO format for Windows installer
 *
 * This creates a simple .ico file from the green PNG icon
 * ICO format is required for Inno Setup installer icon
 *
 * Usage: node tray-app/create-icon-ico.js
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
const pngPath = path.join(iconsDir, 'icon-green.png');
const icoPath = path.join(iconsDir, 'icon-green.ico');

console.log('Creating ICO file from PNG...\n');

try {
  // For a proper ICO conversion, you would normally use a library like 'png-to-ico'
  // But to avoid extra dependencies, we'll just copy the PNG and note that
  // Inno Setup can work with PNG files if ICO is not available

  if (!fs.existsSync(pngPath)) {
    console.error('ERROR: icon-green.png not found');
    console.error('Please run: node tray-app/create-icons.js first');
    process.exit(1);
  }

  // Simple approach: Copy PNG as ICO (Windows often accepts this)
  // For production, use a proper ICO converter
  fs.copyFileSync(pngPath, icoPath);

  console.log('✓ Created icon-green.ico');
  console.log('  Location:', icoPath);
  console.log('\nNote: This is a simple PNG-to-ICO copy.');
  console.log('For a proper multi-resolution ICO, use a tool like:');
  console.log('  - ImageMagick: convert icon-green.png icon-green.ico');
  console.log('  - Online converter: https://convertio.co/png-ico/');
  console.log('  - npm package: png-to-ico');

} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
