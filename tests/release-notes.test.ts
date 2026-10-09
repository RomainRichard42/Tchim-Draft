import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '../src/main/storage';
import { RELEASE_NOTES, compareVersions, releaseNotesStatus } from '../src/shared/release-notes';
import pkg from '../package.json';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0)){if(!root.startsWith(path.resolve('.test-data')+path.sep))throw new Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});}});
describe('release introductions',()=>{
  it('has useful bilingual notes for the installed version and unique versions',()=>{
    const notes=RELEASE_NOTES.find(note=>note.version===pkg.version);
    expect(notes).toBeDefined();expect(new Set(RELEASE_NOTES.map(n=>n.version)).size).toBe(RELEASE_NOTES.length);
    for(const note of RELEASE_NOTES){
      expect(note.sections.length).toBeGreaterThan(0);expect(note.title.fr.length).toBeGreaterThan(10);expect(note.title.en.length).toBeGreaterThan(10);
      for(const section of note.sections)for(const item of section.items){expect(item.fr.length).toBeGreaterThan(20);expect(item.en.length).toBeGreaterThan(20);expect(item.fr+' '+item.en).not.toMatch(/IPC|SQLite|renderer|preload|worker|TypeScript|\bAPI\b/);}
    }
  });
  it('shows the current introduction on first launch, then only newly installed versions',()=>{
    expect(releaseNotesStatus('0.10.1').pending).toBe(true);
    expect(releaseNotesStatus('0.10.1').entries.map(n=>n.version)).toEqual(['0.10.1']);
    expect(releaseNotesStatus('0.10.1','0.10.1').pending).toBe(false);
    expect(releaseNotesStatus('0.10.1','0.10.0').entries.map(n=>n.version)).toEqual(['0.10.1']);
    expect(releaseNotesStatus('0.10.1','0.9.0').entries.map(n=>n.version)).toEqual(['0.10.1','0.10.0']);
    expect(releaseNotesStatus('0.10.1','0.9.0').history.map(n=>n.version)).toEqual(['0.10.1','0.10.0','0.9.0']);
    expect(releaseNotesStatus('0.10.0','0.10.1').pending).toBe(false);
    expect(compareVersions('0.10.0','0.9.0')).toBeGreaterThan(0);
    expect(releaseNotesStatus('0.10.1',{bad:'value'}).lastSeenVersion).toBeNull();
  });
  it('persists acknowledgement across restarts without changing draft, teams, settings or data',async()=>{
    await mkdir('.test-data',{recursive:true});const root=await mkdtemp(path.resolve('.test-data','release-notes-'));roots.push(root);
    const file=path.join(root,'tchim.sqlite');let storage=new Storage(file);
    try{
      const before=storage.snapshot();expect(storage.releaseNotes('0.10.1').pending).toBe(true);
      // Merely reading the notes never acknowledges them.
      expect(storage.releaseNotes('0.10.1').pending).toBe(true);
      expect(()=>storage.acknowledgeReleaseNotes('0.10.1','0.11.0')).toThrow(/mismatch/);
      storage.acknowledgeReleaseNotes('0.10.1','0.10.1');expect(storage.snapshot()).toEqual(before);
      storage.close();storage=new Storage(file);expect(storage.releaseNotes('0.10.1').pending).toBe(false);
      storage.acknowledgeReleaseNotes('0.10.0','0.10.0');expect(storage.get('releaseNotesSeenVersion')).toBe('0.10.1');
      expect(storage.releaseNotes('0.11.0').pending).toBe(true);
    }finally{storage.close();}
  });
  it('never publishes a release on code or tag pushes',async()=>{
    const workflow=await readFile('.github/workflows/release.yml','utf8');
    const triggers=workflow.split('permissions:')[0];expect(triggers).toContain('workflow_dispatch:');expect(triggers).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(workflow).toContain("ref: ${{ format('refs/tags/v{0}', inputs.version) }}");
    expect(workflow).toContain('$env:REQUESTED_VERSION -ne $version');
  });
});
