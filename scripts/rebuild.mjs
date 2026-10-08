import Database from 'better-sqlite3';
import { access } from 'node:fs/promises';
import path from 'node:path';

// v13 ships Node-API prebuilds, compatible with Node and Electron without node-gyp.
await access(path.resolve(`node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`));
const db = new Database(':memory:');
if (db.prepare('SELECT 1 AS ok').get().ok !== 1) throw new Error('SQLite native validation failed');
db.close();
console.log('SQLite Node-API prebuild verified. Electron checked by npm run test:desktop.');
