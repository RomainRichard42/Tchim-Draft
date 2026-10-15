import Database from 'better-sqlite3';
import { mkdir, writeFile, copyFile, readdir,access } from 'node:fs/promises';
import path from 'node:path';
const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...rest]=arg.replace(/^--/,'').split('=');return [key,rest.join('=')];}));
const source=path.resolve(flags.from??'data/local'),target=path.resolve(flags.directory??`data/refresh-${new Date().toISOString().slice(0,10).replaceAll('-','')}`);
if(source===target)throw new Error('Use a separate collection directory');
let exists=false;try{await access(path.join(target,'tchim.sqlite'));exists=true;}catch{}
if(exists)throw new Error('Collection database already exists; choose a fresh directory or resume it directly');
await mkdir(target,{recursive:true});
const db=new Database(path.join(source,'tchim.sqlite'),{readonly:true,fileMustExist:true});
console.log('Before refresh',JSON.stringify(db.prepare('SELECT id,imported_at FROM packs WHERE id LIKE ? OR id LIKE ? ORDER BY imported_at DESC LIMIT 6').all('golgg-%','lolalytics-%')));
console.log('Window',JSON.stringify(db.prepare('SELECT key,value FROM kv WHERE key IN (?,?,?)').all('staticVersion','staticPatches','scrapeWindow')));
await db.backup(path.join(target,'tchim.sqlite'));db.close();
await mkdir(path.join(target,'icons'),{recursive:true});
for(const name of await readdir(path.join(source,'icons')))if(name.endsWith('.png'))await copyFile(path.join(source,'icons',name),path.join(target,'icons',name));
await writeFile(path.join(target,'prepared.json'),JSON.stringify({source:path.join(source,'tchim.sqlite'),cache:path.join(source,'scraping'),createdAt:new Date().toISOString()}));
console.log('Isolated collection ready',target);
