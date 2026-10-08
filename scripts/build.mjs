import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('resources', { recursive: true });
const png = await sharp('resources/icon.svg').resize(256).png().toBuffer();
await writeFile('resources/icon.png', png);
// ICO supports PNG payloads on Windows Vista and later.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 0; header[7] = 0; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile('resources/icon.ico', Buffer.concat([header, png]));
await Promise.all([
  build({ entryPoints: ['src/main/index.ts', 'src/main/worker.ts', 'src/main/preload.ts'],
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', outdir: 'dist/main',
    outExtension: { '.js': '.cjs' }, external: ['electron', 'better-sqlite3', 'electron-updater'], sourcemap: true }),
  viteBuild(),
  build({ entryPoints: ['src/collector/index.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    outfile: 'dist/collector/index.cjs', external: ['better-sqlite3'] }),
  build({ entryPoints: ['src/collector/scrape-cli.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    outfile: 'dist/collector/scrape.cjs', external: ['better-sqlite3'] }),
  build({ entryPoints: ['src/collector/export-dataset.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    outfile: 'dist/collector/export-dataset.cjs', external: ['better-sqlite3'] })
]);
