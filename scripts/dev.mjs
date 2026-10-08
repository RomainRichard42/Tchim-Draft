import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { createServer } from 'vite';
import electron from 'electron';
await build({ entryPoints: ['src/main/index.ts', 'src/main/worker.ts', 'src/main/preload.ts'], bundle: true,
  platform: 'node', format: 'cjs', target: 'node22', outdir: 'dist/main', outExtension: { '.js': '.cjs' },
  external: ['electron', 'better-sqlite3', 'electron-updater'] });
const server = await createServer(); await server.listen();
const env = { ...process.env, TCHIM_DEV_URL: 'http://127.0.0.1:5173' }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env, windowsHide: true });
child.on('exit', async code => { await server.close(); process.exit(code ?? 0); });
console.log('Electron desktop running. Renderer hot reload enabled; restart for main/preload edits.');
