import { load } from 'cheerio';
import { z } from 'zod';
import type { Champion, ScoutedTeam, Role, ScoutedPlayer } from '../shared/types';
import { ROLES } from '../shared/types';
import { AccessError, type ScrapeHttp } from './http';

export function parseMultiUrl(value: string): { url: string; region: string; riotIds: string[] } {
  const u=new URL(value.trim());
  const match=/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?lol\/multisearch\/([a-z]+)\/?$/.exec(u.pathname);
  if(u.protocol!=='https:'||u.hostname!=='op.gg'||u.port||u.username||u.password||!match)throw new Error('Lien multi OP.GG HTTPS attendu.');
  const regions=new Set(['euw','eune','na','kr','jp','br','las','lan','oce','tr','ru','sea','tw','vn','me']);
  if(!regions.has(match[1]))throw new Error('Région OP.GG inconnue.');
  const riotIds=[...new Set((u.searchParams.get('summoners')??'').split(',').map(s=>s.trim()).filter(Boolean))];
  if(!riotIds.length||riotIds.length>5||riotIds.some(s=>!/^.{1,60}#[^#\s]{1,16}$/u.test(s)))throw new Error('Le multi doit contenir 1 à 5 Riot IDs complets (nom#tag).');
  return {url:u.href,region:match[1],riotIds};
}
/** Decode only JSON literals in Next's public HTML stream. No eval, scripts, QRLs or executable refs. */
export function nextRecords(html: string): unknown[] {
  const $=load(html);let stream='';const roots:unknown[]=[];
  for(const el of $('script').toArray()){
    const m=/^self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/.exec($(el).text().trim());
    if(!m)continue;try{const a=JSON.parse(m[1]);if(a[0]===1&&typeof a[1]==='string')stream+=a[1];}catch{/* Not a data literal */}
  }
  for(const line of stream.split('\n')){const m=/^[a-f0-9]+:([\[{].*)$/.exec(line);if(m){try{roots.push(JSON.parse(m[1]));}catch{/* Stream metadata */}}}
  return roots;
}
function objects(roots: unknown[]): Record<string,unknown>[] {
  const found:Record<string,unknown>[]=[];let budget=100000;
  const walk=(v:unknown,depth:number)=>{if(!v||typeof v!=='object'||depth>50||--budget<0)return;if(!Array.isArray(v))found.push(v as Record<string,unknown>);for(const child of Object.values(v))walk(child,depth+1);};
  roots.forEach(r=>walk(r,0));return found;
}
export function parsePlayer(html: string, champions: Champion[], riotId: string): ScoutedPlayer {
  const $=load(html), title=$('title').text();
  if(!title.toLowerCase().startsWith(riotId.toLowerCase()))throw new Error('OP.GG renvoie un autre joueur.');
  const records=objects(nextRecords(html));
  const record=records.find(r=>r.game_type==='RANKED'&&Array.isArray(r.my_champion_stats));
  if(!record)throw new Error('Statistiques classées OP.GG absentes ou format modifié.');
  const byKey=new Map(champions.map(c=>[c.key,c.id]));
  const row=z.object({champion_id:z.number().int(),play:z.number().int().min(0).max(100000),win:z.number().int().min(0),lose:z.number().int().min(0)});
  const pool=(record.my_champion_stats as unknown[]).flatMap(raw=>{
    const result=row.safeParse(raw);if(!result.success)return [];const r=result.data,id=byKey.get(r.champion_id);
    if(!id||!r.play)return [];if(r.win+r.lose!==r.play)throw new Error('Comptages OP.GG incohérents.');
    return [{championId:id,games:r.play,wins:r.win}];
  }).sort((a,b)=>b.games-a.games);
  const hints=records.find(r=>Array.isArray(r.summoner_profile_position_hints))?.summoner_profile_position_hints as {position:string;tag:string}[]|undefined;
  const hint=hints?.find(h=>h.tag==='MAIN')?.position;
  const role=ROLES.includes(hint as Role)?hint as Role:'AUTO';
  return {riotId,role,pool,status:pool.length?'loaded':'unavailable',message:`OP.GG · ranked · saison ${record.season_id} · ${pool.reduce((n,p)=>n+p.games,0)} parties. Pool de familiarité, pas statistiques sur trois patchs.`};
}
export async function scoutTeam(http: ScrapeHttp, champions:Champion[], url:string, prior?:ScoutedTeam, progress:(team:ScoutedTeam)=>void=()=>{}):Promise<ScoutedTeam>{
  const parsed=parseMultiUrl(url);
  const team:ScoutedTeam={url:parsed.url,region:parsed.region,poolOnly:prior?.poolOnly??false,players:parsed.riotIds.map(riotId=>({riotId,role:'AUTO',pool:[],status:'unavailable',message:'Chargement…'})),message:'Lecture des profils publics…'};
  progress(team);
  try{
    await http.page(parsed.url,undefined,3600000);
    for(let i=0;i<team.players.length;i++){
      const riotId=team.players[i].riotId,[name,tag]=riotId.split('#');
      try{const page=await http.page(`https://op.gg/lol/summoners/${parsed.region}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}/champions`,undefined,6*3600000);
        const player=parsePlayer(page.html,champions,riotId),previous=prior?.players.find(p=>p.riotId===riotId);
        if(previous?.role!=='AUTO'&&previous?.role)player.role=previous.role;
        // A duplicate inferred lane stays unassigned until the user resolves the team's lane allocation.
        if(player.role!=='AUTO'&&team.players.some((p,j)=>j!==i&&p.role===player.role))player.role='AUTO';
        team.players[i]=player;
      }catch(error){const previous=prior?.players.find(p=>p.riotId===riotId);team.players[i]={...(previous??team.players[i]),message:String(error).slice(0,900)};if(error instanceof AccessError)throw error;}
      progress({...team,players:[...team.players]});
    }
    team.fetchedAt=new Date().toISOString();team.message=`${team.players.filter(p=>p.status==='loaded').length}/${team.players.length} profils chargés. Vérifiez les rôles de votre équipe.`;
  }catch(error){team.message=`Import partiel : ${String(error).slice(0,900)}`;team.players=team.players.map(p=>({...p,message:p.message==='Chargement…'?team.message:p.message}));}
  progress(team);return team;
}
