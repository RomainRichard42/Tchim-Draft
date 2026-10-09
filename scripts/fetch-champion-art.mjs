import Database from 'better-sqlite3';
import sharp from 'sharp';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=path.resolve('resources/visuals'),database=path.resolve('data/local/tchim.sqlite');
const db=new Database(database,{readonly:true,fileMustExist:true});
const ids=db.prepare('SELECT id FROM champions ORDER BY id').all().map(r=>r.id);db.close();
if(!ids.length||ids.some(id=>!/^[A-Za-z0-9_]{1,80}$/.test(id)))throw new Error('Invalid local champion catalogue');
for(const kind of ['splash','card'])await mkdir(path.join(root,'art',kind),{recursive:true});
const assets=[],failures=[];let completed=0;
async function prepare(id,kind){
  const target=path.join(root,'art',kind,id+'.webp');
  try{if((await stat(target)).size>500)return;}catch{/* Only missing images are downloaded. */}
  const source='https://ddragon.leagueoflegends.com/cdn/img/champion/'+(kind==='card'?'loading':'splash')+'/'+id+'_0.jpg';
  const response=await fetch(source,{headers:{'User-Agent':'TchimDraft-AssetBuilder/1.0'},signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw new Error(id+' '+kind+' HTTP '+response.status);
  const raw=Buffer.from(await response.arrayBuffer());if(raw.length>8*1024*1024)throw new Error('Image too large');
  const image=await sharp(raw).resize({width:kind==='card'?320:1100,withoutEnlargement:true}).webp({quality:79,effort:5}).toBuffer();
  await writeFile(target,image);
}
const queue=ids.flatMap(id=>['splash','card'].map(kind=>({id,kind})));let cursor=0;
await Promise.all(Array.from({length:3},async()=>{
  while(cursor<queue.length){
    const {id,kind}=queue[cursor++];
    try{await prepare(id,kind);const image=await readFile(path.join(root,'art',kind,id+'.webp'));assets.push({championId:id,kind,bytes:image.length,sha256:createHash('sha256').update(image).digest('hex'),source:'https://ddragon.leagueoflegends.com/cdn/img/champion/'+(kind==='card'?'loading':'splash')+'/'+id+'_0.jpg'});}catch(e){failures.push(String(e));}
    completed++;if(completed%40===0)console.log('CHAMPION_ART',completed+'/'+queue.length);
    await new Promise(resolve=>setTimeout(resolve,120));
  }
}));
await writeFile(path.join(root,'art-manifest.json'),JSON.stringify({source:'Riot Games Data Dragon',preparedAt:new Date().toISOString(),assets:assets.sort((a,b)=>(a.championId+':'+a.kind).localeCompare(b.championId+':'+b.kind)),failures},null,2));
await writeFile(path.join(root,'ART-NOTICE.txt'),'Champion illustrations are Riot Games game-specific static assets from Data Dragon. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. Tchim Draft is not endorsed by Riot Games.\nSource documentation: https://developer.riotgames.com/docs/lol#data-dragon\nFiles are resized and encoded as WebP for offline display. No match statistics are downloaded by this script.\n');
console.log('CHAMPION_ART_READY',JSON.stringify({champions:ids.length,images:assets.length,bytes:assets.reduce((n,a)=>n+a.bytes,0),failures}));
if(failures.length)process.exitCode=1;
