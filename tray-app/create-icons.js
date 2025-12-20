/**
 * Icon Creator Script
 *
 * This script creates simple colored square icons for the system tray.
 * Run this script once to generate the required icon files.
 *
 * Usage: node tray-app/create-icons.js
 */

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple PNG file manually (16x16 colored square)
function createSimpleIcon(filename, r, g, b) {
  // PNG file format: http://www.libpng.org/pub/png/spec/1.2/PNG-Structure.html
  // This creates a minimal 16x16 PNG with a solid color

  const width = 16;
  const height = 16;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (image header)
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace
  const ihdrCrc = crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk (image data)
  const pixelData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    pixelData[y * (1 + width * 3)] = 0; // Filter type
    for (let x = 0; x < width; x++) {
      const offset = y * (1 + width * 3) + 1 + x * 3;
      pixelData[offset] = r;
      pixelData[offset + 1] = g;
      pixelData[offset + 2] = b;
    }
  }

  // Compress pixel data with zlib (simplified - using uncompressed blocks)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(pixelData);

  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(idat.slice(4, 8 + compressed.length));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk (end of file)
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

  // Combine all chunks
  const png = Buffer.concat([signature, ihdr, idat, iend]);

  // Write to file
  fs.writeFileSync(path.join(iconsDir, filename), png);
  console.log(`Created ${filename}`);
}

// CRC32 calculation for PNG chunks
function crc32(buf) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create icons
console.log('Creating tray icons...\n');

try {
  // Green icon (service running)
  createSimpleIcon('icon-green.png', 40, 167, 69); // #28a745

  // Red icon (service stopped)
  createSimpleIcon('icon-red.png', 220, 53, 69); // #dc3545

  // Yellow icon (warning/unknown)
  createSimpleIcon('icon-yellow.png', 255, 193, 7); // #ffc107

  console.log('\n✓ All icons created successfully!');
  console.log('Icons location:', iconsDir);
  console.log('\nYou can replace these with custom icons if desired.');
  console.log('Icon requirements:');
  console.log('  - Format: PNG');
  console.log('  - Size: 16x16 pixels (recommended)');
  console.log('  - Files: icon-green.png, icon-red.png, icon-yellow.png');
} catch (error) {
  console.error('Error creating icons:', error);
  process.exit(1);
}
