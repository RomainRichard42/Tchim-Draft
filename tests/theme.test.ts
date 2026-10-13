import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/champions';
import { settingsSchema } from '../src/shared/validation';
import { Storage } from '../src/main/storage';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('desktop appearance persistence',()=>{
  it('opens legacy settings in dark mode without changing draft weights',()=>{
    const {theme,...legacy}=DEFAULT_SETTINGS;
    const settings=settingsSchema.parse(legacy);
    expect(settings.theme).toBe('dark'); expect(settings.weights).toEqual(legacy.weights);
    expect(settingsSchema.safeParse({...legacy,theme:'unknown'}).success).toBe(false);
  });
  it('keeps light mode through a SQLite restart and preserves personal settings',()=>{
    const directory=mkdtempSync(path.join(tmpdir(),'tchim-theme-')),file=path.join(directory,'theme.sqlite');
    let storage:Storage|undefined;
    try {
      storage=new Storage(file);const weights={...storage.settings.weights},draft=structuredClone(storage.draft);
      storage.settings=settingsSchema.parse({...storage.settings,theme:'light',pool:{Xayah:5},overlayOpacity:.8});storage.persist();storage.db.close();storage=undefined;
      storage=new Storage(file);expect(storage.settings.theme).toBe('light');expect(storage.settings.pool).toEqual({Xayah:5});
      expect(storage.settings.overlayOpacity).toBe(.8);expect(storage.settings.weights).toEqual(weights);expect(storage.draft).toEqual(draft);
    } finally {
      storage?.db.close();
      const relative=path.relative(path.resolve(tmpdir()),path.resolve(directory));
      if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(directory).startsWith('tchim-theme-'))rmSync(directory,{recursive:true,force:true});
    }
  });
});
