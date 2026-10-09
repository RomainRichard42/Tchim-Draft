import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/types';
const api: DesktopApi = {
  snapshot: () => ipcRenderer.invoke('draft:snapshot'),
  configure: value => ipcRenderer.invoke('draft:configure', value),
  select: (championId, role) => ipcRenderer.invoke('draft:select', { championId, role }),
  undo: toIndex => ipcRenderer.invoke('draft:undo', toIndex),
  reset: () => ipcRenderer.invoke('draft:reset'),
  series: (command,winner) => ipcRenderer.invoke('draft:series',{command,winner}),
  settings: value => ipcRenderer.invoke('draft:settings', value),
  analyze: () => ipcRenderer.invoke('draft:analyze'),
  simulate:request=>ipcRenderer.invoke('simulation:generate',request),
  simulationOptions:request=>ipcRenderer.invoke('simulation:options',request),
  cancelSimulation:id=>ipcRenderer.invoke('simulation:cancel',id),
  saveSimulation:document=>ipcRenderer.invoke('simulation:save',document),
  loadSimulation:id=>ipcRenderer.invoke('simulation:load',id),
  deleteSimulation:id=>ipcRenderer.invoke('simulation:delete',id),
  onSimulationProgress:callback=>{const listener=(_event:unknown,value:Parameters<typeof callback>[0])=>callback(value);ipcRenderer.on('simulation:progress',listener);return ()=>ipcRenderer.removeListener('simulation:progress',listener);},
  scout: (team,url) => ipcRenderer.invoke('draft:scout',{team,url}),
  teams: value => ipcRenderer.invoke('draft:teams',value),
  refresh: () => ipcRenderer.invoke('draft:refresh'),
  importPack: () => ipcRenderer.invoke('draft:import-pack'),
  demo: () => ipcRenderer.invoke('draft:demo'),
  removePack: id => ipcRenderer.invoke('draft:remove-pack', id),
  saveSession: name => ipcRenderer.invoke('draft:save-session', name),
  loadSession: id => ipcRenderer.invoke('draft:load-session', id),
  exportSession: () => ipcRenderer.invoke('draft:export-session'),
  importSession: () => ipcRenderer.invoke('draft:import-session'),
  overlay: () => ipcRenderer.invoke('draft:overlay'),
  checkUpdate: () => ipcRenderer.invoke('draft:check-update'),
  installUpdate: () => ipcRenderer.invoke('draft:install-update'),
  onChange: callback => { const listener = (_event: unknown, value: Parameters<typeof callback>[0]) => callback(value); ipcRenderer.on('draft:changed', listener); return () => ipcRenderer.removeListener('draft:changed', listener) }
};
contextBridge.exposeInMainWorld('draftApi', api);
