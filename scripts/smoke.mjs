import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import electron from 'electron';
await mkdir('.test-data/smoke', { recursive: true });
const env = { ...process.env, TCHIM_DATA_DIR: path.resolve('.test-data/smoke'), TCHIM_OFFLINE: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', '--smoke-test'], { env, stdio: 'inherit', windowsHide: true });
const timer = setTimeout(() => { child.kill(); process.exit(1) }, 45000);
child.on('exit', code => { clearTimeout(timer); process.exit(code ?? 1) });
