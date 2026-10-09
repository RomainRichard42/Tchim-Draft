import type { Draft, Lang, Selection, Settings, SimulationContext, Teams } from './types';
import { ROLES } from './types';
import { validateSimulation } from './simulation';

/** A guided scrim must know both complete rosters, rather than inventing player pools. */
export function guidedRosterIssues(teams:Teams|undefined,language:Lang='fr'):string[] {
  const fr=language==='fr',issues:string[]=[];
  for(const key of ['ally','enemy'] as const){
    const team=teams?.[key],label=key==='ally'?(fr?'Notre équipe':'Our team'):(fr?'Équipe adverse':'Enemy team');
    let link=false;
    try{const url=new URL(team?.url??'');link=url.protocol==='https:'&&url.hostname==='op.gg'&&!url.username&&!url.password&&!url.port&&/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?lol\/multisearch\/[a-z]+\/?$/.test(url.pathname);}catch{/* Missing link. */}
    if(!link)issues.push(`${label} : ${fr?'importe un lien multi OP.GG.':'import a multi OP.GG link.'}`);
    if(team?.players.length!==5){issues.push(`${label} : ${fr?'il faut cinq joueurs.':'five players are required.'}`);continue;}
    if(new Set(team.players.map(p=>p.riotId.toLocaleLowerCase())).size!==5)issues.push(`${label} : ${fr?'un joueur apparaît plusieurs fois.':'a player appears more than once.'}`);
    if(!ROLES.every(role=>team.players.some(p=>p.role===role)))issues.push(`${label} : ${fr?'confirme les cinq rôles, une fois chacun.':'confirm all five roles, once each.'}`);
    for(const player of team.players)if(!player.pool.length)issues.push(`${player.riotId} : ${fr?'pool absent ; ajoute ses champions jouables avant de lancer.':'missing pool; add playable champions before starting.'}`);
  }
  return issues;
}

export function guidedContext(settings:Settings,teams:Teams):SimulationContext {
  const context=structuredClone({settings,teams});
  // Recorded pools constrain both opponents. A coach can still impose a manual exception.
  context.teams.ally.poolOnly=true;context.teams.enemy.poolOnly=true;
  return context;
}

export function appendGuidedChoice(draft:Draft,selection:Selection,known:Set<string>):Draft {
  const next={...draft,history:[...draft.history,selection],targetRole:'AUTO' as const};
  validateSimulation(next,[],known);
  return next;
}
