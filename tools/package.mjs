import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const DEFLATE_METHOD = 8;

// Standard zip CRC-32 table (polynomial 0xEDB88320), built once at load.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(n, 0);
  return buf;
}

function u32(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

/** Recursively lists files under `dir`, relative to `base`, with forward-slash paths. */
function walk(dir, base) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full, base));
    } else if (stat.isFile()) {
      files.push({ full, rel: relative(base, full).split('\\').join('/') });
    }
  }
  return files;
}

if (!existsSync(DIST)) {
  console.error('dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const outPath = resolve(ROOT, `totopdf-${pkg.version}.zip`);

// Sorted so the archive's entry order does not depend on filesystem readdir
// order, which is not guaranteed to be stable across platforms.
const files = walk(DIST, DIST).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

if (files.length === 0) {
  console.error('dist/ is empty. Run `npm run build` first.');
  process.exit(1);
}

const localChunks = [];
const centralChunks = [];
let offset = 0;

for (const file of files) {
  const data = readFileSync(file.full);
  const compressed = deflateRawSync(data);
  const crc = crc32(data);
  const nameBuf = Buffer.from(file.rel, 'utf8');
  // Bit 11 (0x0800) tells a reader the name is UTF-8; without it, a name
  // with any non-ASCII byte must be decoded as CP437 per APPNOTE 6.3.x and
  // would come out corrupted. All current entry names are ASCII, so this is
  // set defensively for whatever ships later.
  const utf8Flag = nameBuf.some((b) => b > 0x7f) ? 0x0800 : 0;

  // No data descriptor: sizes and CRC are known up front since the whole
  // file is already in memory, so they go straight into the local header.
  const localHeader = Buffer.concat([
    u32(LOCAL_FILE_HEADER_SIGNATURE),
    u16(VERSION_NEEDED),
    u16(utf8Flag), // general purpose bit flag
    u16(DEFLATE_METHOD),
    u16(0), // DOS last mod file time -- deterministic archive, no clock read
    u16(0), // DOS last mod file date
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0), // extra field length
    nameBuf,
  ]);

  const localHeaderOffset = offset;
  localChunks.push(localHeader, compressed);
  offset += localHeader.length + compressed.length;

  const centralEntry = Buffer.concat([
    u32(CENTRAL_DIRECTORY_SIGNATURE),
    u16(VERSION_NEEDED), // version made by
    u16(VERSION_NEEDED), // version needed to extract
    u16(utf8Flag), // general purpose bit flag -- must match the local header
    u16(DEFLATE_METHOD),
    u16(0), // DOS last mod file time
    u16(0), // DOS last mod file date
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0), // extra field length
    u16(0), // file comment length
    u16(0), // disk number start
    u16(0), // internal file attributes
    u32(0), // external file attributes
    u32(localHeaderOffset),
    nameBuf,
  ]);
  centralChunks.push(centralEntry);
}

const centralDirectoryOffset = offset;
const centralDirectory = Buffer.concat(centralChunks);

const endOfCentralDirectory = Buffer.concat([
  u32(END_OF_CENTRAL_DIRECTORY_SIGNATURE),
  u16(0), // number of this disk
  u16(0), // disk with the start of the central directory
  u16(files.length), // central directory entries on this disk
  u16(files.length), // total central directory entries
  u32(centralDirectory.length),
  u32(centralDirectoryOffset),
  u16(0), // .zip file comment length
]);

const zip = Buffer.concat([...localChunks, centralDirectory, endOfCentralDirectory]);
writeFileSync(outPath, zip);

console.log(`wrote ${relative(ROOT, outPath)} (${files.length} entries, ${zip.length} bytes)`);
