import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { EventEmitter } from 'node:events';
import type { AppUpdater } from 'electron-updater';
import { Storage } from '../src/main/storage';
import { demoPack, download } from '../src/main/data';
import { exportDataset } from '../src/collector/export-dataset';
import { refreshSharedDataset, sha256, type Download } from '../src/main/shared-data';
import { appUpdates } from '../src/main/updates';
import type { DatasetManifest } from '../src/shared/dataset';
import { packGroups } from '../src/shared/pack-groups';

const opened:{storage:Storage;directory:string}[]=[];
async function fixture(){await mkdir('.test-data',{recursive:true});const directory=await mkdtemp(path.resolve('.test-data','distribution-')),storage=new Storage(path.join(directory,'tchim.sqlite'));opened.push({storage,directory});return{storage,directory};}
afterEach(async()=>{vi.unstubAllGlobals();for(const item of opened.splice(0)){item.storage.close();if(!item.directory.startsWith(path.resolve('.test-data')+path.sep))throw Error('Unsafe cleanup');await rm(item.directory,{recursive:true,force:true});}});
async function dataset(){
  const f=await fixture();f.storage.set('staticVersion','16.20.1');f.storage.set('teams',{private:'PRIVATE_SCOUT'});f.storage.saveSession('PRIVATE_SESSION');f.storage.set('secret','PRIVATE_TOKEN');
  f.storage.champions().forEach((c,i)=>f.storage.db.prepare('UPDATE champions SET json = ? WHERE id = ?').run(JSON.stringify({...c,key:i+1}),c.id));
  const base=demoPack(f.storage);
  for(const source of ['solo','pro'] as const)for(const patch of ['16.20','16.19','16.18','16.17']){
    const stat={...base.stats.find(s=>s.source===source)!,source,patch,rank:source==='solo'?'MASTER_PLUS':'all'};
    f.storage.importPack({...base,id:`${source==='solo'?'lolalytics':'golgg'}-${patch}`,stats:[stat],pairs:[],games:[],provenance:{...base.provenance,demo:false}});
  }
  const output=path.join(f.directory,'export'),manifest=await exportDataset(f.storage.db,output);
  const fetcher=vi.fn<Download>(async url=>({body:await readFile(path.join(output,new URL(url).pathname.split('/').at(-1)!)),etag:'"fixture"'}));
  return {...f,output,manifest,fetcher};
}
describe('Shared dataset distribution',()=>{
  it('exports only public data and three source patches, deterministically, without changing the editor database',async()=>{
    const f=await dataset(),signature=f.storage.db.prepare('SELECT * FROM packs ORDER BY id').all();
    const first=JSON.stringify(f.manifest),again=await exportDataset(f.storage.db,f.output);
    expect(again).toEqual(f.manifest);expect(first).not.toMatch(/PRIVATE_|settings|riotId|teams|sessions/);
    expect(f.manifest.coverage.every(c=>c.patches.join(',')==='16.20,16.19,16.18')).toBe(true);
    for(const part of f.manifest.parts){const bytes=await readFile(path.join(f.output,`${part.sha256}.json.gz`));expect(sha256(bytes)).toBe(part.sha256);}
    expect(f.storage.db.prepare('SELECT * FROM packs ORDER BY id').all()).toEqual(signature);
  });
  it('imports into fresh SQLite, preserves user data, and downloads only changed files on later clicks',async()=>{
    const f=await dataset(),client=await fixture();client.storage.settings.pool.Ahri=5;client.storage.draft.side='red';client.storage.draft.patch='16.20';client.storage.persist();client.storage.saveSession('My series');
    const state=JSON.stringify({settings:client.storage.settings,draft:client.storage.draft,teams:client.storage.teams,sessions:client.storage.snapshot().sessions});
    const url='https://github.com/owner/repo/releases/download/dataset/manifest.json';
    expect(await refreshSharedDataset(client.storage,client.directory,url,f.fetcher,()=>{})).toBe(6);
    expect(client.storage.engineInput().stats).toHaveLength(6);
    expect(JSON.stringify({settings:client.storage.settings,draft:client.storage.draft,teams:client.storage.teams,sessions:client.storage.snapshot().sessions})).toBe(state);
    f.fetcher.mockClear();expect(await refreshSharedDataset(client.storage,client.directory,url,f.fetcher,()=>{})).toBe(0);expect(f.fetcher).toHaveBeenCalledTimes(1);
    const changed=structuredClone(f.manifest),part=changed.parts[0],raw=client.storage.packs().find(p=>p.id===part.id)!;
    const bytes=gzipSync(JSON.stringify({...raw,stats:raw.stats.map(s=>({...s,wins:1}))}));part.sha256=sha256(bytes);part.bytes=bytes.length;changed.revision=sha256('new revision');
    const requests:string[]=[];
    const delta:Download=async u=>{requests.push(u);return{body:u.endsWith('manifest.json')?Buffer.from(JSON.stringify(changed)):bytes};};
    expect(await refreshSharedDataset(client.storage,client.directory,url,delta,()=>{})).toBe(1);expect(requests).toHaveLength(2);
    expect(client.storage.packs().find(p=>p.id===part.id)!.stats[0].wins).toBe(1);
  });
  it('keeps the previous complete dataset if a later part is corrupt',async()=>{
    const f=await dataset(),client=await fixture(),url='https://github.com/owner/repo/releases/download/dataset/manifest.json';
    await refreshSharedDataset(client.storage,client.directory,url,f.fetcher,()=>{});
    const before=client.storage.db.prepare('SELECT * FROM packs ORDER BY id').all(),saved=client.storage.get('sharedDataset');
    const manifest=structuredClone(f.manifest);manifest.revision=sha256('bad update');
    const original=client.storage.packs().find(p=>p.id===manifest.parts[0].id)!,bytes=gzipSync(JSON.stringify({...original,stats:original.stats.map(s=>({...s,wins:2}))}));
    manifest.parts[0].sha256=sha256(bytes);manifest.parts[0].bytes=bytes.length;
    manifest.parts[1].sha256=sha256('corrupt');manifest.parts[1].bytes=7;
    const broken:Download=async u=>({body:u.endsWith('manifest.json')?Buffer.from(JSON.stringify(manifest)):u.includes(manifest.parts[0].sha256)?bytes:Buffer.from('invalid')});
    await expect(refreshSharedDataset(client.storage,client.directory,url,broken,()=>{})).rejects.toThrow(/checksum/);
    expect(client.storage.db.prepare('SELECT * FROM packs ORDER BY id').all()).toEqual(before);expect(client.storage.get('sharedDataset')).toEqual(saved);
  });
  it('repairs a manually removed pack using a cached part after HTTP 304',async()=>{
    const f=await dataset(),client=await fixture(),url='https://github.com/owner/repo/releases/download/dataset/manifest.json';
    await refreshSharedDataset(client.storage,client.directory,url,f.fetcher,()=>{});client.storage.removePack(f.manifest.parts[0].id);
    const noChange=vi.fn<Download>(async()=>null);
    expect(await refreshSharedDataset(client.storage,client.directory,url,noChange,()=>{})).toBe(1);expect(noChange).toHaveBeenCalledTimes(1);expect(client.storage.engineInput().stats).toHaveLength(6);
  });
  it('groups download fragments by source and patch and removes that whole patch while keeping custom packs',async()=>{
    const f=await dataset(),client=await fixture(),url='https://github.com/owner/repo/releases/download/dataset/manifest.json';
    await refreshSharedDataset(client.storage,client.directory,url,f.fetcher,()=>{});
    const first=client.storage.packs()[0];client.storage.importPack({...first,id:first.id.replace(/-0$/,'-1'),stats:[{...first.stats[0],championId:'Ahri'}]});client.storage.importPack({...first,id:'custom-coach-pack'});
    const metadata=client.storage.snapshot().data.packs,grouped=packGroups(metadata);expect(grouped.packs).toHaveLength(7);expect(grouped.details).toBe(0);expect(grouped.packs.find(p=>p.id===first.id)!.rows).toBe(2);
    expect(metadata.find(p=>p.id===first.id)!.rows).toBe(1);
    client.storage.removePack(first.id);expect(client.storage.packs().some(p=>p.id.startsWith(first.id.slice(0,-1)))).toBe(false);expect(client.storage.packs().some(p=>p.id==='custom-coach-pack')).toBe(true);
  });
});
describe('Release download redirects',()=>{
  it('follows the GitHub asset redirect, bounds download bytes and does not forward ETags to another host',async()=>{
    const fetcher=vi.fn(async(url:string,_options?:RequestInit)=>url.startsWith('https://github.com/')?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/example/file'}}):new Response('ok'));
    vi.stubGlobal('fetch',fetcher);expect((await download('https://github.com/owner/repo/file',100,'old-etag'))!.body.toString()).toBe('ok');
    expect(fetcher.mock.calls[1][1]).toMatchObject({redirect:'manual',headers:{'User-Agent':expect.any(String)}});
    expect((fetcher.mock.calls[1][1] as {headers:Record<string,string>}).headers['If-None-Match']).toBeUndefined();
    await expect(download('https://github.com/owner/repo/file',1)).rejects.toThrow(/size limit/);
  });
  it('rejects unrelated and insecure redirects',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://untrusted.example/data'}})));
    await expect(download('https://github.com/owner/repo/file')).rejects.toThrow(/Untrusted/);
    await expect(download('http://github.com/owner/repo/file')).rejects.toThrow(/HTTPS/);
  });
});
describe('Automatic app updates',()=>{
  it('downloads automatically, installs on quit, excludes the data prerelease, and does not recheck while downloading',async()=>{
    const emitter=new EventEmitter(),check=vi.fn(async()=>{emitter.emit('update-available');return null;});
    const updater=Object.assign(emitter,{checkForUpdates:check}) as unknown as AppUpdater,status=vi.fn();
    const controller=appUpdates(updater,{packaged:true,disabled:false,hasConfig:async()=>{},status,log:()=>{}});
    await controller.start();expect(updater.autoDownload).toBe(true);expect(updater.autoInstallOnAppQuit).toBe(true);expect(updater.allowPrerelease).toBe(false);
    await controller.check();expect(check).toHaveBeenCalledTimes(1);emitter.emit('download-progress',{percent:51.5});expect(status).toHaveBeenLastCalledWith('downloading:52');
    emitter.emit('update-downloaded');await controller.check();expect(check).toHaveBeenCalledTimes(1);expect(status).toHaveBeenLastCalledWith('downloaded');
  });
  it('allows retry after offline errors and avoids network access for unpackaged or test launches',async()=>{
    const check=vi.fn(async()=>{throw Error('offline');}),updater=Object.assign(new EventEmitter(),{checkForUpdates:check}) as unknown as AppUpdater,status=vi.fn();
    const options={packaged:true,disabled:false,hasConfig:async()=>{},status,log:()=>{}};
    const controller=appUpdates(updater,options);await controller.start();expect(status).toHaveBeenLastCalledWith('error: offline');await controller.check();expect(check).toHaveBeenCalledTimes(2);
    await appUpdates(updater,{...options,disabled:true}).start();expect(check).toHaveBeenCalledTimes(2);
    await appUpdates(updater,{...options,packaged:false}).check();expect(check).toHaveBeenCalledTimes(2);expect(status).toHaveBeenLastCalledWith('development');
  });
});
