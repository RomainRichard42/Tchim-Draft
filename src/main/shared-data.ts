import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { datasetSchema, type DatasetManifest } from '../shared/dataset';
import type { Storage } from './storage';

export type Download = (url:string,maxBytes?:number,etag?:string)=>Promise<{body:Buffer;etag?:string}|null>;
export const sha256 = (buffer:Buffer|string) => createHash('sha256').update(buffer).digest('hex');
export async function refreshSharedDataset(storage:Storage, userData:string, url:string, download:Download, progress:(message:string)=>void):Promise<number> {
  const cache=storage.get<{url:string;etag?:string;manifest:DatasetManifest}>('sharedDataset');
  const response=await download(url,2*1024*1024,cache?.url===url?cache.etag:undefined);
  if(!response&&cache?.url!==url) throw new Error('Dataset manifest unavailable');
  const manifest=datasetSchema.parse(response?JSON.parse(response.body.toString('utf8')):cache!.manifest);
  const directory=path.join(userData,'shared-cache');await mkdir(directory,{recursive:true});
  const previous=cache?.url===url?(storage.get<Record<string,string>>('sharedParts')??{}):{};
  const present=new Set((storage.db.prepare('SELECT id FROM packs').all() as {id:string}[]).map(p=>p.id));
  const known=new Set([...storage.champions().map(c=>c.id),...manifest.champions.map(c=>c.id)]);
  const prepared:{id:string;raw:string}[]=[];
  for(const [index,part] of manifest.parts.entries()) {
    if(previous[part.id]===part.sha256&&present.has(part.id))continue;
    progress(`GitHub · ${index+1}/${manifest.parts.length}`);
    const filename=`${part.sha256}.json.gz`, file=path.join(directory,filename);
    let body:Buffer;
    try {body=await readFile(file);if(body.length!==part.bytes||sha256(body)!==part.sha256)throw new Error('Invalid cached part');}
    catch {
      const result=await download(new URL(filename,url).href,part.bytes);
      if(!result)throw new Error('Empty dataset part');body=result.body;
      if(body.length!==part.bytes||sha256(body)!==part.sha256)throw new Error(`Dataset checksum mismatch: ${part.id}`);
      await writeFile(`${file}.tmp`,body);await rename(`${file}.tmp`,file);
    }
    const pack=storage.validatePack(JSON.parse(gunzipSync(body,{maxOutputLength:48*1024*1024}).toString('utf8')),known);
    if(pack.id!==part.id||pack.provenance.demo||pack.stats.length!==part.stats||pack.pairs.length!==part.pairs||pack.games.length!==part.games)throw new Error('Dataset part metadata mismatch');
    prepared.push({id:pack.id,raw:JSON.stringify(pack)});
  }
  const old=storage.get<string[]>('sharedPackIds')??[];
  if(prepared.length||cache?.manifest.revision!==manifest.revision||old.some(id=>!manifest.parts.some(p=>p.id===id))) {
    storage.installSharedDataset(manifest,prepared,url,response?.etag??cache?.etag);
  } else if(response) storage.set('sharedDataset',{url,etag:response.etag,manifest});
  return prepared.length;
}
