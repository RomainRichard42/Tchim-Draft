import type { BanScouting, Role, ScoutedTeam } from '../shared/types';
import { clamp } from './math';

/** Season familiarity, separate from patch win rates. Evidence reduces the configured maximum weight. */
export function scoutingBan(team: ScoutedTeam | undefined, championId: string, role: Role, weight: number): BanScouting | undefined {
  const players=team?.players.filter(p=>p.pool.length&&(p.role===role||(p.role==='AUTO'&&!team.players.some(other=>other.role===role))))??[];
  const threats=players.flatMap(player=>{
    const known=player.pool.filter(c=>!c.role||c.role===role);
    const total=known.reduce((sum,c)=>sum+c.games,0),wins=known.reduce((sum,c)=>sum+c.wins,0);
    const champion=known.find(c=>c.championId===championId),games=champion?.games??0;
    const declared=!!champion&&games===0&&player.status==='manual';
    if(!total&&!declared)return [];
    const share=total?games/total:0,baseline=total?wins/total:.5;
    const smoothed=games?(champion!.wins+baseline*20)/(games+20):null;
    const performance=smoothed===null?.5:clamp(50+(smoothed-baseline)*250)/100;
    const volume=Math.min(1,Math.log1p(games)/Math.log1p(300));
    const score=declared?70:champion?clamp(100*(.3*volume+.55*Math.sqrt(share)+.15*performance)):0;
    const evidence=declared?.5:total/(total+80)*(champion?games/(games+20):1);
    const confidence=evidence*(player.role==='AUTO'?.6:1)*(player.status==='unavailable'?.8:1);
    return [{riotId:player.riotId,games,wins:champion?.wins??0,share,winrate:games?champion!.wins/games:null,score,
      confidence:confidence*100,appliedWeight:weight*confidence,declared}];
  });
  // An unassigned player with no evidence for this champion must not mask another player's comfort pick.
  return threats.sort((a,b)=>b.score*b.confidence-a.score*a.confidence||b.confidence-a.confidence)[0];
}
