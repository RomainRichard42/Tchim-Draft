import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractFile } from '@electron/asar';
import path from 'node:path';

const version=JSON.parse(await readFile('package.json','utf8')).version;
const manifest=JSON.parse(await readFile('resources/visuals/art-manifest.json','utf8'));
const packed=process.argv.includes('--packaged'),asar=path.resolve('release',version,'win-unpacked/resources/app.asar');
assert.equal(manifest.failures.length,0);
const champions=new Map(),keys=new Set();
for(const asset of manifest.assets){
  assert.match(asset.championId,/^[A-Za-z0-9_]{1,80}$/);assert.ok(['card','splash'].includes(asset.kind));
  const key=asset.championId+':'+asset.kind;assert.ok(!keys.has(key));keys.add(key);
  const file='art/'+asset.kind+'/'+asset.championId+'.webp';
  const bytes=packed?extractFile(asar,path.join('dist','renderer',file)):await readFile('resources/visuals/'+file);
  assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(new URL(asset.source).hostname,'ddragon.leagueoflegends.com');
  champions.set(asset.championId,(champions.get(asset.championId)??0)+1);
}
for(const count of champions.values())assert.equal(count,2);
assert.ok(champions.size>=170);
if(packed)assert.ok(extractFile(asar,path.join('dist','renderer','ART-NOTICE.txt')).toString('utf8').includes('Riot Games'));
console.log('CHAMPION_ART_VERIFIED',JSON.stringify({version,packed,champions:champions.size,images:manifest.assets.length,bytes:manifest.assets.reduce((n,a)=>n+a.bytes,0)}));
