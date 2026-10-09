import { dismissReleaseNotes } from './ui-helpers.mjs';
import { _electron as electron,expect } from '@playwright/test';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const pkg=JSON.parse(await readFile('package.json','utf8')),config=JSON.parse(await readFile('resources/distribution.json','utf8'));
const metadataResponse=await fetch(`https://github.com/${config.owner}/${config.repo}/releases/latest/download/latest.yml`);if(!metadataResponse.ok)throw Error('Release metadata unavailable');
const metadata=await metadataResponse.text(),checksum=/^sha512: (.+)$/m.exec(metadata)?.[1];if(!metadata.includes(`version: ${pkg.version}`)||!checksum)throw Error('Wait for the target release');
const root=path.resolve(`.test-data/update-download-${Date.now()}`);await mkdir(root,{recursive:true});await mkdir('artifacts',{recursive:true});
const executablePath=path.resolve(process.env.TCHIM_TEST_EXECUTABLE||'release/0.6.0/win-unpacked/Tchim Draft.exe');
const env={...process.env,TCHIM_DATA_DIR:root,TCHIM_TEST_HEADLESS:'1',TCHIM_DISABLE_APP_UPDATES:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.TCHIM_OFFLINE;
const desktop=await electron.launch({args:[],executablePath,env,timeout:30000}),errors=[];
try {
  const setup=await desktop.evaluate(({app},directory)=>{
    const updater=process.mainModule.require('electron-updater').autoUpdater;
    const defaultInstallOnQuit=updater.autoInstallOnAppQuit;
    // Test-only isolation: prevent the NSIS installer from changing the user's installation/registry.
    updater.autoInstallOnAppQuit=false;Object.defineProperty(updater.app,'baseCachePath',{value:directory,configurable:true});
    return {currentVersion:app.getVersion(),defaultInstallOnQuit};
  },path.join(root,'update-cache'));
  expect(setup.currentVersion).not.toBe(pkg.version);expect(setup.defaultInstallOnQuit).toBe(true);
  const page=await desktop.firstWindow();page.on('pageerror',e=>errors.push(e.message));await expect(page.getByTestId('app')).toBeVisible();
  await dismissReleaseNotes(page);
  const before=await page.evaluate(()=>window.draftApi.snapshot());
  const result=await desktop.evaluate(async()=>{
    const updater=process.mainModule.require('electron-updater').autoUpdater,result=await updater.checkForUpdates();
    if(!result?.downloadPromise)throw Error('No update download');
    return {targetVersion:result.updateInfo.version,files:await result.downloadPromise,autoDownload:updater.autoDownload,autoInstallOnQuit:updater.autoInstallOnAppQuit};
  });
  expect(result.targetVersion).toBe(pkg.version);expect(result.autoDownload).toBe(true);expect(result.autoInstallOnQuit).toBe(false);
  const file=path.resolve(result.files[0]);expect(file.startsWith(root+path.sep)).toBe(true);
  const installer=await readFile(file);expect(createHash('sha512').update(installer).digest('base64')).toBe(checksum);
  const after=await page.evaluate(()=>window.draftApi.snapshot());expect(after.update).toBe('downloaded');expect(after.data.packs).toEqual(before.data.packs);expect(after.data.lastRefresh).toBe(before.data.lastRefresh);expect(after.draft).toEqual(before.draft);expect(after.teams).toEqual(before.teams);expect(after.settings).toEqual(before.settings);expect(errors).toEqual([]);
  await expect(page.getByRole('button',{name:'Mise à jour prête',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Paramètres',exact:true}).click();await expect(page.getByText('Version téléchargée : installation automatique à la fermeture.',{exact:true})).toBeVisible();
  await writeFile('artifacts/update-download-report.json',JSON.stringify({from:setup.currentVersion,to:result.targetVersion,installerBytes:installer.length,sha256:createHash('sha256').update(installer).digest('hex'),nativeUpdaterDownloadVerified:true,checksumMatchesMetadata:true,defaultInstallOnQuit:setup.defaultInstallOnQuit,installationDisabledInTest:true,userDataPreserved:true,statisticsRemainIdle:true,rendererErrors:errors},null,2));
  console.log(`UPDATE_DOWNLOAD_OK ${setup.currentVersion} -> ${result.targetVersion}, ${installer.length} bytes, checksum verified, ready UI visible, installer not executed`);
} finally {await desktop.close();}
