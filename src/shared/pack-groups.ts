import type { DataStatus } from './types';

export function packGroups(packs:DataStatus['packs']):{packs:DataStatus['packs'];details:number} {
  const visible:DataStatus['packs']=[],groups=new Map<string,DataStatus['packs'][number]>();let details=0;
  for(const pack of packs) {
    if(/^lolalytics-\d+\.\d+-[A-Za-z0-9]+-(TOP|JUNGLE|MID|ADC|SUPPORT)$/.test(pack.id)){details++;continue;}
    const match=/^shared-(solo|pro)-(\d+\.\d+)-\d+$/.exec(pack.id);
    if(!match){visible.push(pack);continue;}
    const key=`${match[1]}-${match[2]}`,current=groups.get(key);
    if(current){current.rows+=pack.rows;if(pack.createdAt>current.createdAt)current.createdAt=pack.createdAt;}
    else {const row={...pack};groups.set(key,row);visible.push(row);}
  }
  return {packs:visible,details};
}
