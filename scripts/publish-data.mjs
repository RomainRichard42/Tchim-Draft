import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const config=JSON.parse(await readFile('resources/distribution.json','utf8'));
const repository=`${config.owner}/${config.repo}`,directory=path.resolve(process.argv[2]||'data/shared');
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
if(manifest.kind!=='tchim-dataset'||manifest.schemaVersion!==2||!Array.isArray(manifest.parts))throw new Error('Run data:export first');
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:4*1024*1024});
const repo=JSON.parse(gh('repo','view',repository,'--json','visibility,nameWithOwner'));
if(repo.visibility!=='PUBLIC')throw new Error('The shared data repository must be public; never embed a GitHub access token in the app');
for(const part of manifest.parts) {
  if(!/^[a-f0-9]{64}$/.test(part.sha256))throw new Error('Invalid part hash');
  const body=await readFile(path.join(directory,`${part.sha256}.json.gz`));
  if(body.length!==part.bytes||createHash('sha256').update(body).digest('hex')!==part.sha256)throw new Error(`Corrupt export: ${part.id}`);
}
let release;
try{release=JSON.parse(gh('release','view',config.dataTag,'--repo',repository,'--json','assets,isPrerelease'));}
catch{gh('release','create',config.dataTag,'--repo',repository,'--prerelease','--latest=false','--title','Shared draft statistics','--notes','Normalized gol.gg / Lolalytics statistics. No user database, OP.GG profiles, settings or drafts.');release={assets:[],isPrerelease:true};}
if(!release.isPrerelease)throw new Error('The data release must remain a prerelease, separate from automatic app updates');
const published=new Map(release.assets.map(a=>[a.name,a.size]));
for(const part of manifest.parts) {
  const name=`${part.sha256}.json.gz`;
  if(published.has(name)) {if(published.get(name)!==part.bytes)throw new Error(`Remote asset size mismatch: ${name}`);continue;}
  gh('release','upload',config.dataTag,path.join(directory,name),'--repo',repository);console.log(`Published ${part.id}`);
}
// Publish the small manifest last: existing clients keep their old local database until every part validates.
gh('release','upload',config.dataTag,path.join(directory,'manifest.json'),'--clobber','--repo',repository);
console.log(`https://github.com/${repository}/releases/download/${config.dataTag}/manifest.json`);
