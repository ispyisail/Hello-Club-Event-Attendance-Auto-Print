#!/usr/bin/env node
/**
 * Simple icon generator for tray application
 * Creates minimal but valid PNG files for the system tray
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, 'tray-app', 'icons');

// Ensure directory exists
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Create a minimal valid 16x16 PNG with a solid color
// PNG file structure: signature + IHDR chunk + IDAT chunk + IEND chunk
function createSolidColorPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (image header)
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Chunk length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8); // Width
  ihdr.writeUInt32BE(height, 12); // Height
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt8(0, 18); // Compression
  ihdr.writeUInt8(0, 19); // Filter
  ihdr.writeUInt8(0, 20); // Interlace

  // Calculate CRC for IHDR
  const crc32 = (buf) => {
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }

    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const ihdrData = ihdr.slice(4, 21);
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk (image data) - minimal single-color image
  const pixelData = Buffer.alloc(1 + width * height * 3);
  let pos = 1; // Skip filter type byte
  for (let i = 0; i < width * height; i++) {
    pixelData[pos++] = r;
    pixelData[pos++] = g;
    pixelData[pos++] = b;
  }

  // Simple zlib compression (minimal deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(pixelData);

  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0); // Chunk length
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);

  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iend = Buffer.from([
    0,
    0,
    0,
    0, // Length
    73,
    69,
    78,
    68, // "IEND"
    174,
    66,
    96,
    130, // CRC
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Create icons
const icons = [
  { name: 'icon-green.png', r: 34, g: 197, b: 94 },
  { name: 'icon-yellow.png', r: 255, g: 193, b: 7 },
  { name: 'icon-red.png', r: 244, g: 67, b: 54 },
];

icons.forEach(({ name, r, g, b }) => {
  try {
    const pngData = createSolidColorPNG(16, 16, r, g, b);
    const filePath = path.join(ICONS_DIR, name);
    fs.writeFileSync(filePath, pngData);
    console.log(`✓ Created ${name} (${pngData.length} bytes)`);
  } catch (error) {
    console.error(`✗ Failed to create ${name}:`, error.message);
  }
});

console.log('\nIcon creation complete!');
