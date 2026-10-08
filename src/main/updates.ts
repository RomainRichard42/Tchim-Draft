import type { AppUpdater } from 'electron-updater';

export function appUpdates(updater:AppUpdater, options:{packaged:boolean;disabled:boolean;hasConfig:()=>Promise<unknown>;status:(value:string)=>void;log:(message:string)=>void}) {
  let checking=false,ready=false,downloading=false;
  updater.autoDownload=true;updater.autoInstallOnAppQuit=true;updater.allowPrerelease=false;
  updater.on('error',error=>{downloading=false;options.status(`error: ${error.message}`);options.log(error.message)});
  updater.on('checking-for-update',()=>options.status('checking'));
  updater.on('update-available',()=>{downloading=true;options.status('downloading:0')});
  updater.on('update-not-available',()=>options.status('current'));
  updater.on('download-progress',p=>options.status(`downloading:${Math.round(p.percent)}`));
  updater.on('update-downloaded',()=>{downloading=false;ready=true;options.status('downloaded')});
  async function check() {
    if(options.disabled){options.status('disabled');return;}
    if(!options.packaged){options.status('development');return;}
    if(checking||downloading||ready)return;
    checking=true;
    try {await options.hasConfig();await updater.checkForUpdates();}
    catch(error){options.status(`error: ${error instanceof Error?error.message:String(error)}`)}
    finally{checking=false;}
  }
  async function start() {
    if(!options.packaged||options.disabled)return;
    try {await options.hasConfig();} catch{options.status('disabled');return;}
    await check();
  }
  return {check,start};
}
