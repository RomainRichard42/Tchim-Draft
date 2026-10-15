import {load} from 'cheerio';
import type {ProFormat,ProGameContext} from '../shared/coaching';

export function golDraftFormat(html:string):ProFormat{
 const dom=load(html);
 for(const row of dom('tr').toArray()){
  const cells=dom(row).children('td,th').toArray();
  const at=cells.findIndex(cell=>/^draft\s*mode\s*:$/i.test(dom(cell).text().trim()));
  if(at<0)continue;const value=dom(cells[at+1]).text().replace(/\s+/g,' ').trim();
  if(/^fearless(?: draft)?$/i.test(value))return 'fearless';
  if(/^(?:standard|classic)(?: draft)?$/i.test(value))return 'standard';
 }
 return 'unknown';
}
export function golSeriesContext(html:string,id:string,format:ProFormat,source:string):ProGameContext|undefined{
 const dom=load(html),tabs=new Map<number,string>();
 for(const anchor of dom('a[href]').toArray()){
  const label=/^Game\s+(\d+)$/i.exec(dom(anchor).text().trim()),game=/\/stats\/(\d+)\/page-game\//.exec(dom(anchor).attr('href')??'');
  if(label&&game){const index=Number(label[1]);if(tabs.has(index)&&tabs.get(index)!=='gol-'+game[1])return;tabs.set(index,'gol-'+game[1]);}
 }
 const ordered=[...tabs].sort((a,b)=>a[0]-b[0]);
 if(!ordered.length||ordered.length>7||ordered.some(([index],i)=>index!==i+1))return;
 const gameIds=ordered.map(([,id])=>id),index=gameIds.indexOf('gol-'+id)+1;
 if(!index)return;
 return {seriesId:'gol-series-'+gameIds[0].slice(4),index,gameIds,format,source};
}
