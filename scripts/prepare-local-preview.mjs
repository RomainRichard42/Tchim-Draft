import Database from 'better-sqlite3';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, access, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

// A new, isolated profile. Never opens the user's profile for writing or calls a remote service.
const flags=Object.fromEntries(process.argv.slice(2).map(a=>{const [key,...rest]=a.replace(/^--/,'').split('=');return [key,rest.join('=')];}));
const version=JSON.parse(await readFile('package.json','utf8')).version;
const source=path.resolve(flags.from??'data/local'),dataset=path.resolve(flags.dataset??'data/shared-worlds-20261016');
const target=path.resolve(flags.output??`data/local-preview-${version}`),file=path.join(target,'tchim.sqlite');
if(!target.startsWith(path.resolve('data')+path.sep)||target===source)throw Error('The preview must use a separate directory inside data/');
try{await access(file);throw Error('Preview already exists; reuse it or choose another --output. No profile was overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(target,{recursive:true});await mkdir('artifacts',{recursive:true});
await build({stdin:{contents:"export {Storage} from './src/main/storage';export {readDatasetManifest} from './src/collector/export-dataset';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'artifacts/local-preview-tools.cjs',external:['better-sqlite3']});
const require=createRequire(import.meta.url),{Storage,readDatasetManifest}=require('../artifacts/local-preview-tools.cjs');
const manifest=await readDatasetManifest(path.join(dataset,'manifest.json'));
const original=new Database(path.join(source,'tchim.sqlite'),{readonly:true,fileMustExist:true});
try{await original.backup(file);}finally{original.close();}
const storage=new Storage(file);
try{
 const prepared=[];
 for(const part of manifest.parts){
  const body=await readFile(path.join(dataset,part.sha256+'.json.gz'));
  if(body.length!==part.bytes||createHash('sha256').update(body).digest('hex')!==part.sha256)throw Error('Invalid dataset part');
  const raw=gunzipSync(body,{maxOutputLength:48*1024*1024}).toString('utf8'),pack=storage.validatePack(JSON.parse(raw));
  if(pack.id!==part.id)throw Error('Dataset part identity mismatch');prepared.push({id:part.id,raw});
 }
 storage.db.prepare("DELETE FROM packs WHERE id LIKE 'golgg-%' OR id LIKE 'lolalytics-%' OR id LIKE 'shared-%' OR id='demo'").run();
 storage.installSharedDataset(manifest,prepared,'local-preview','local-preview');
 storage.set('staticVersion',manifest.staticVersion);
 storage.set('staticPatches',manifest.coverage.find(c=>c.source==='solo').patches);
 storage.set('golProPatches',manifest.coverage.find(c=>c.source==='pro').patches);
 storage.settings={...storage.settings,scrapingEnabled:false};
 storage.set('previewDataset',manifest.revision);storage.persist();
 await cp(path.resolve(flags.icons??'data/refresh-20261016-worlds/icons'),path.join(target,'icons'),{recursive:true});
 const report={version,target,revision:manifest.revision,coverage:manifest.coverage,remoteWrites:false};
 await writeFile(path.join(target,'preview.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{storage.close();}
