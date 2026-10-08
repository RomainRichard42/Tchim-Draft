import { _electron as electron, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(`.test-data/pack-import-${Date.now()}`);await mkdir(root,{recursive:true});
const original=new Database('data/local/tchim.sqlite',{readonly:true});await original.backup(path.join(root,'tchim.sqlite'));original.close();
const packFile=path.resolve('data/local/scraping/exports/golgg-games-S16.json');
const bytes=(await stat(packFile)).size;
expect(bytes).toBeGreaterThan(30*1024*1024);
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_OFFLINE:'1',TCHIM_TEST_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE;
const executablePath=process.env.TCHIM_TEST_EXECUTABLE;
const desktop=await electron.launch({args:executablePath?[]:['.'],...(executablePath?{executablePath}:{}),env,timeout:30000});
try{
  const page=await desktop.firstWindow();await expect(page.getByTestId('app')).toBeVisible();
  await desktop.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},packFile);
  const snapshot=await page.evaluate(()=>window.draftApi.importPack());
  expect(snapshot.data.coverage.find(c=>c.source==='pro').games).toBeGreaterThan(1400);
  console.log('REAL_PRO_PACK_IMPORT_OK',bytes,'bytes',snapshot.data.coverage.find(c=>c.source==='pro').games,'games');
}finally{await desktop.close();}
