import { readFileSync } from 'node:fs'; import { load } from 'cheerio';
const q=load(readFileSync('artifacts/v3-probes/opgg-player.html','utf8'));let s='';
for(const e of q('script').toArray()){const m=/^self\.__next_f\.push\((.*)\)$/s.exec(q(e).text());if(m){const a=JSON.parse(m[1]);if(a[0]===1)s+=a[1];}}
for(const k of ['champion_stats','championStats','win_count','lose_count','total_play','mostChampions','champion_id','position_stats','most_champions']){const i=s.indexOf('"'+k+'"');console.log(k,i,i>=0?s.slice(Math.max(0,i-150),i+1100):'');}
const q2=load(readFileSync('artifacts/v3-probes/gol-matchlist.html','utf8'));console.log('games',q2('table').last().find('tr').slice(2,7).map((_,e)=>q2(e).text().replace(/\s+/g,' ')).get());
for(const line of s.split('\n')){const match=/^[a-f0-9]+:(.*)$/.exec(line);if(!match)continue;let root;try{root=JSON.parse(match[1])}catch{continue;}function walk(o){if(!o||typeof o!=='object')return;if('my_champion_stats' in o)console.log('DATA KEYS',Object.keys(o),JSON.stringify(o).slice(0,450));if('summoner_profile_position_hints' in o)console.log('HINT',o.summoner_profile_position_hints);for(const [k,v]of Object.entries(o))walk(v);}walk(root);}
