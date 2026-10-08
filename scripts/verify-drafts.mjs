import { build } from 'esbuild';
import { readFile,writeFile } from 'node:fs/promises';
await build({stdin:{contents:"export {analyze} from './src/engine';export {Storage} from './src/main/storage';",resolveDir:process.cwd()},bundle:true,format:'cjs',platform:'node',outfile:'artifacts/verify-module.cjs',external:['better-sqlite3']});
const {analyze,Storage}=(await import('../artifacts/verify-module.cjs')).default;
const storage=new Storage('data/local/tchim.sqlite');
try{
 const base=storage.engineInput();base.draft={...base.draft,mode:'pro',side:'blue',targetRole:'AUTO',history:Array.from({length:6},()=>({championId:null}))};
 base.settings.poolOnly=false;base.settings.pool={};
 const format=a=>a.picks.map(r=>({champion:r.championId,role:r.role,score:r.score,composition:r.factors.composition,source:r.source,why:r.reasons}));
 const cases=[];const start=performance.now();
 for(const [name,history] of [['First pick',[]],['Protect Jinx from dive',[['Jinx','ADC'],['Vi','JUNGLE'],['Akali','MID']]],['Engage against poke',[['Varus','ADC'],['Ashe','SUPPORT'],['Xerath','MID']]]]){
   const state={...base,draft:{...base.draft,history:[...base.draft.history,...history.map(([championId,role])=>({championId,role}))]}};
   const result=analyze(state);cases.push({name,picks:format(result),duos:result.duos.map(d=>[d.first.championId,d.second.championId,d.score]),warnings:result.warnings});
 }
 const team=JSON.parse(await readFile('artifacts/scouting-example.json','utf8'));
 const scouted=analyze({...base,teams:{ally:team,enemy:{url:'',region:'euw',players:[],poolOnly:false,message:''}}});cases.push({name:'OP.GG user team',picks:format(scouted)});
 const report={stats:base.stats.length,pairs:base.pairs.length,games:base.games.length,timeMs:Math.round(performance.now()-start),coverage:storage.snapshot().data.coverage,cases};
 await writeFile('artifacts/draft-regressions.json',JSON.stringify(report,null,2));
 console.log('PERFORMANCE',report.timeMs,'ms','rows',base.stats.length+base.pairs.length);console.log('COVERAGE',report.coverage);
 for(const c of cases)console.log(c.name,c.picks.map(p=>`${p.champion}/${p.role} ${p.score} comp=${p.composition}`).join(' | '));
}finally{storage.close();}
