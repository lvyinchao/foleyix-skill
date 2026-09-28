#!/usr/bin/env node
/** Deterministic, allowlisted ZIP release using only Node built-ins. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repository, 'skills', 'foleyix');
const files = ['LICENSE', 'SKILL.md', 'agents/openai.yaml', 'references/cli.md', 'scripts/foleyix.mjs'];
const args = process.argv.slice(2);
let output = path.join(repository, 'public', 'downloads'), publicReleased = false, qoder = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out-dir' && args[i + 1]) output = path.resolve(args[++i]);
  else if (args[i] === '--public-released') publicReleased = true;
  else if (args[i] === '--qoder') qoder = true;
  else throw new Error('Usage: node scripts/package-foleyix-skill.mjs [--out-dir directory] [--public-released] [--qoder]');
}
const artifactName = qoder ? 'foleyix-qoder' : 'foleyix-skill';
const entryPrefix = qoder ? '' : 'foleyix/';
const table = Array.from({ length: 256 }, (_, n) => {
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function validateTree(directory, relative = '') {
  for (const name of await fs.readdir(directory)) {
    const location = path.join(directory, name), entry = relative ? relative + '/' + name : name, stat = await fs.lstat(location);
    if (stat.isSymbolicLink()) throw new Error('Skill packaging refuses symlinks: ' + entry);
    if (stat.isDirectory()) await validateTree(location, entry);
    else if (!stat.isFile() || !files.includes(entry)) throw new Error('Unexpected skill file; review before packaging: ' + entry);
  }
}
await validateTree(source);
const markdown = await fs.readFile(path.join(source, 'SKILL.md'), 'utf8');
const version = markdown.match(/^  version: "(\d+\.\d+\.\d+)"$/m)?.[1];
if (!version) throw new Error('Skill metadata must include a release version.');
const pieces = [], central = [];
let offset = 0;
for (const relative of files) {
  const bytes = await fs.readFile(path.join(source, relative)), name = Buffer.from(entryPrefix + relative), crc = crc32(bytes);
  if (bytes.length > 1024 * 1024) throw new Error('A skill file exceeds the reviewed size limit.');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x2821, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
  pieces.push(local, name, bytes);
  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x0800, 8);
  record.writeUInt16LE(0, 10); record.writeUInt16LE(0, 12); record.writeUInt16LE(0x2821, 14);
  record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE(((relative.endsWith('.mjs') ? 0o100755 : 0o100644) << 16) >>> 0, 38); record.writeUInt32LE(offset, 42);
  central.push(record, name); offset += local.length + name.length + bytes.length;
}
const centralBytes = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...pieces, centralBytes, end]), sha256 = createHash('sha256').update(zip).digest('hex');
const manifest = { name: 'foleyix', version, zip: '/downloads/' + artifactName + '.zip', sha256, bytes: zip.length, publicReleased };
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, artifactName + '.zip'), zip);
await fs.writeFile(path.join(output, artifactName + '.sha256'), sha256 + '  ' + artifactName + '.zip\n');
await fs.writeFile(path.join(output, artifactName + '-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({ ...manifest, directory: output, files }) + '\n');
