import { evaluateMatch, matchBalance } from './evaluation';
import { choicePolicy } from './policy';
import { exploreStrategy } from './strategy';
import type { StrategyRequest } from '../shared/types';
import { prepare, aggregate, pairRows } from './evidence';
import type { Analysis, Champion, Composition, Draft, DraftBalance, Duo, EngineInput, PairStat, Prediction, Recommendation, Role, Scenario, Side, Stat, Weights } from '../shared/types';
import { fearlessUsed, freeRoles, opposite, order, picks, used, PRO_ORDER } from '../shared/draft';
import { clamp, patchDistance, posterior, softmax, wilson } from './math';
import { latestPatches } from '../shared/patches';
import { damageShare, teamplay } from './teamplay';
import { scoutingBan } from './scouting';
import { gamePlan } from './gameplan';
import { banConsequences } from './ban-impact';
import { contextualRisk, contextualScore, roleContext } from './role-context';
import { assessBlind, blindDevelopment } from './blind';
import { patchPrior } from './kit-matchups';
import { metaProfiles, playableFlex } from './meta';

function text(input: EngineInput, fr: string, en: string): string { return input.settings.language === 'fr' ? fr : en }
export function composition(champions: Champion[], language = 'fr',roles:Role[]=[]): Composition {
  const count = champions.length, sum = (key: keyof Champion['traits']) => champions.reduce((s, c) => s + c.traits[key], 0);
  const adShare = damageShare(champions,roles), frontline = sum('frontline'), engage = sum('engage'), peel = sum('peel'), poke = sum('poke');
  const early = count ? sum('early') / count / 3 * 100 : 0, scaling = count ? sum('scaling') / count / 3 * 100 : 0;
  const fr = language === 'fr', strengths: string[] = [], weaknesses: string[] = [];
  if (count) {
    (frontline >= 3 ? strengths : weaknesses).push(fr ? (frontline >= 3 ? 'Frontline disponible' : 'Frontline fragile') : (frontline >= 3 ? 'Frontline available' : 'Fragile frontline'));
    (engage >= 3 ? strengths : weaknesses).push(fr ? (engage >= 3 ? 'Initiation disponible' : 'Peu d’initiation fiable') : (engage >= 3 ? 'Engage available' : 'Limited reliable engage'));
    if (count >= 3 && (adShare > 0.8 || adShare < 0.2)) weaknesses.push(fr ? 'Dégâts trop homogènes' : 'Damage is too one-sided');
    if (scaling >= 70) strengths.push(fr ? 'Bonne montée en puissance' : 'Strong scaling');
    if (peel < 3 && count >= 3) weaknesses.push(fr ? 'Protection des carries limitée' : 'Limited carry protection');
  }
  const archetype = !count ? (fr ? 'À construire' : 'Not built yet') : poke >= count * 1.8 ? 'Poke / siege' : engage >= count * 1.9 ? (fr ? 'Engage / teamfight' : 'Engage / teamfight') : scaling > 72 ? 'Scaling / front-to-back' : (fr ? 'Composition mixte' : 'Mixed composition');
  const quality = count ? clamp(30 + Math.min(frontline, 6) * 3 + Math.min(engage, 6) * 3 + Math.min(peel, 6) * 2 + (1 - Math.abs(adShare - 0.5) * 2) * 18) : 50;
  return { count, adShare, frontline, engage, peel, poke, early, scaling, archetype, strengths, weaknesses, quality };
}
function team(input: EngineInput, side: Side): Champion[] { return picks(input.draft, side).flatMap(p => input.champions.find(c => c.id === p.championId) ?? []) }
export function rankCandidates(input: EngineInput, side: Side, restrictRole: Role | 'AUTO' = 'AUTO', usePool = true, useFamiliarity = true, candidateId?:string): Recommendation[] {
  const availableRoles = freeRoles(input.draft, side), locked = new Set([...used(input.draft),...fearlessUsed(input.draft)]), allies = picks(input.draft, side), enemies = picks(input.draft, opposite(side));
  const allyTeam = team(input, side), before = composition(allyTeam,'fr',allies.map(a=>a.role)), enemyTeam = team(input, opposite(side));
  const pickIndex = allies.length, early = pickIndex < 2, last = pickIndex === 4;
  const beforePlan=gamePlan(allyTeam,allies.map(a=>a.role),enemyTeam,enemies.map(e=>e.role),input.settings.language);
  const beforeOwnPlan=input.draft.mode==='pro'?gamePlan(allyTeam,allies.map(a=>a.role),[],[],input.settings.language):null;
  const results: Recommendation[] = [], prepared = prepare(input);
  const scout=input.teams?.[side===input.draft.side?'ally':'enemy'];
  const summary = (key: string, rows: (Stat | PairStat)[], targetSide:Side=side) => {
    const cacheKey = `${targetSide}|${input.draft.mode}|${input.draft.patch}|${input.draft.rank}|${input.draft.league}|${input.settings.oldPatchDecay}|${key}`;
    if (!prepared.aggregates.has(cacheKey)) prepared.aggregates.set(cacheKey, aggregate(rows, input, targetSide));
    return prepared.aggregates.get(cacheKey)!;
  };
  const responseCache=new Map<Role,{champion:Champion;popularity:number;familiarity:number}[]>();
  const replies=(role:Role)=>{
    if(responseCache.has(role))return responseCache.get(role)!;
    const opponent=opposite(side),enemyScout=input.teams?.[opponent===input.draft.side?'ally':'enemy'];
    const players=enemyScout?.players.filter(p=>p.role===role||(p.role==='AUTO'&&!enemyScout.players.some(other=>other.role===role)))??[];
    const restricted=enemyScout?.poolOnly&&players.length&&players.every(p=>p.pool.length>0);
    const options=input.champions.flatMap(champion=>{
      if(locked.has(champion.id))return [];
      const declared=players.some(p=>p.pool.some(ch=>ch.championId===champion.id&&(!ch.role||ch.role===role)&&(ch.games>=3||(ch.games===0&&p.status==='manual'))));
      if(restricted&&!declared)return [];
      // Response viability/popularity use the opponent's side, not the candidate's side.
      const stat=summary(`stat|${champion.id}|${role}`,prepared.stats.get(`${champion.id}|${role}`)??[],opponent);
      const roleStats=[...prepared.roles.get(champion.id)??[]].flatMap(r=>summary(`stat|${champion.id}|${r}`,prepared.stats.get(`${champion.id}|${r}`)??[],opponent)?.groups??[]);
      const observed=stat?.groups.some(g=>g.usable&&g.pickRate>=.005&&g.n/Math.max(1,roleStats.filter(s=>s.source===g.source).reduce((sum,s)=>sum+s.n,0))>=.1);
      const explicitRole=players.some(p=>p.pool.some(ch=>ch.championId===champion.id&&ch.role===role&&(ch.games>=3||(ch.games===0&&p.status==='manual'))));
      if(!observed&&!explicitRole)return [];
      const comfort=scoutingBan(enemyScout,champion.id,role,100);
      return [{champion,popularity:stat?.pickRate??.01,familiarity:comfort?comfort.score/100*comfort.appliedWeight/100:0}];
    });
    responseCache.set(role,options);return options;
  };
  for (const c of input.champions) {
    if (locked.has(c.id)||(candidateId&&c.id!==candidateId)) continue;
    for (const role of availableRoles.filter(r => (restrictRole === 'AUTO' || r === restrictRole) && (candidateId||c.roles.includes(r) || prepared.roles.get(c.id)?.has(r)))) {
      const players=scout?.players.filter(p=>p.role===role||(p.role==='AUTO'&&!scout.players.some(other=>other.role===role)))??[];
      const playerOptions=players.flatMap(p=>p.pool.filter(ch=>ch.championId===c.id&&(!ch.role||ch.role===role)&&(ch.games>=3||(ch.games===0&&p.status==='manual'))).map(ch=>({player:p,games:ch.games})));
      const familiarity=playerOptions.sort((a,b)=>b.games-a.games)[0];
      if(!candidateId&&scout?.poolOnly&&players.length&&players.every(p=>p.pool.length>0)&&!familiarity)continue;
      if (usePool && side === input.draft.side && input.draft.mode==='solo'&&input.settings.poolOnly && role === input.draft.role && !(input.settings.pool[c.id] > 0)) continue;
      const stats = summary(`stat|${c.id}|${role}`, prepared.stats.get(`${c.id}|${role}`) ?? []);
      const pro=stats?.groups.find(g=>g.source==='pro');
      const championPro=[...prepared.roles.get(c.id)??[]].reduce((n,r)=>n+(summary(`stat|${c.id}|${r}`,prepared.stats.get(`${c.id}|${r}`)??[])?.groups.find(g=>g.source==='pro')?.n??0),0);
      const championSolo=[...prepared.roles.get(c.id)??[]].reduce((n,r)=>n+(summary(`stat|${c.id}|${r}`,prepared.stats.get(`${c.id}|${r}`)??[])?.groups.find(g=>g.source==='solo')?.n??0),0);
      const observedRole=(s:typeof stats)=>s?.groups.some(g=>g.usable&&g.pickRate>=.005&&g.n/Math.max(1,g.source==='pro'?championPro:championSolo)>=.1);
      if(input.stats.length&&!candidateId){
        if(!observedRole(stats)&&!(familiarity?.player.pool.some(p=>p.championId===c.id&&p.role===role)))continue;
      }
      const matchups = enemies.flatMap(e => summary(`matchup|${c.id}|${role}|${e.championId}|${e.role}`, pairRows(input, c, role, e, 'matchup')) ?? []);
      const synergies = allies.flatMap(a => summary(`synergy|${c.id}|${role}|${a.championId}|${a.role}`, pairRows(input, c, role, a, 'synergy')) ?? []);
      const matchup = matchups.length ? clamp(50 + matchups.reduce((s, m) => s + m.delta, 0) / enemies.length * 400) : 50;
      const contextual=teamplay(c,role,allyTeam,allies.map(a=>a.role),enemyTeam,input.settings.language);
      const statisticalSynergy = synergies.length ? clamp(50 + synergies.reduce((s, m) => s + m.delta, 0) / allies.length * 450) : 50;
      const afterPlan=gamePlan([...allyTeam,c],[...allies.map(a=>a.role),role],enemyTeam,enemies.map(e=>e.role),input.settings.language);
      const planContribution=allies.length?clamp(50+(afterPlan.score-beforePlan.score)*1.5):50;
      const synergy=clamp(statisticalSynergy+(contextual.synergy-50)*.5),comp=clamp(contextual.score*.65+planContribution*.35);
      const opponentLane = enemies.find(e => e.role === role);
      const blind=input.draft.mode==='pro'&&role!=='SUPPORT'&&!opponentLane&&input.stats.length
        ?assessBlind(replies(role).filter(reply=>reply.champion.id!==c.id).map(reply=>({championId:reply.champion.id,
          popularity:reply.popularity,familiarity:reply.familiarity,
          evidence:summary(`matchup|${c.id}|${role}|${reply.champion.id}|${role}`,pairRows(input,c,role,{championId:reply.champion.id,role},'matchup'))})),role==='TOP'?1:role==='MID'?.625:.25):undefined;
      if(blind&&role==='TOP'){blind.developmentPenalty=blindDevelopment(c);blind.score=clamp(blind.score-blind.developmentPenalty);}
      const ownAfter=beforeOwnPlan?gamePlan([...allyTeam,c],[...allies.map(a=>a.role),role],[],[],input.settings.language):null;
      const context=ownAfter&&beforeOwnPlan?roleContext({candidate:c,role,allies,enemies,champions:input.champions,
        language:input.settings.language,weights:input.settings.weights,blind,
        ownPlan:allies.length?clamp(50+(ownAfter.score-beforeOwnPlan.score)*1.5):50,
        pair:(candidate,candidateRole,target,kind)=>summary(`${kind}|${candidate.id}|${candidateRole}|${target.championId}|${target.role}`,pairRows(input,candidate,candidateRole,target,kind))}):undefined;
      // Unseen lanes imply risk: early selections reward role ambiguity and protection.
      const flex=playableFlex(input,c.id,side),viableRoles=flex.roles;
      const meta=metaProfiles(input,side).get(c.id),priority=meta?.rolePriority[role]??35;
      const blindSafety=clamp((blind?.score??50)*.6+priority*.4+(flex.score-50)*.15);
      const historical = prepared.historical.get(`${c.id}|${role}|${side}`);
      const opening=historical&&historical.total>=10?{games:Math.round(historical.total),firstShare:posterior(historical.first,historical.total,.2,20),earlyShare:posterior(historical.early,historical.total,.6,20),blindShare:posterior(historical.blind,historical.total,.5,20)}:undefined;
      const historyPriority=opening?(pickIndex===0?(opening.firstShare-.2)*100:(opening.earlyShare-.6)*100):null;
      // Evaluate prospective lane counters before an early blind pick, when pair data exists.
      const potential = input.draft.mode==='solo'&&early && input.pairs.length > 0 && !opponentLane ? input.champions.filter(o => !locked.has(o.id) && o.id !== c.id && o.roles.includes(role))
        .flatMap(o => summary(`matchup|${c.id}|${role}|${o.id}|${role}`, pairRows(input, c, role, { championId: o.id, role }, 'matchup')) ?? []) : [];
      const blindCounterPenalty = potential.length ? Math.max(0, -Math.min(...potential.map(p => p.delta))) * 100 : 0;
      const orderValue = last && opponentLane ? clamp(50 + (matchup - 50) * 1.5) : early ? clamp(blindSafety - blindCounterPenalty + (input.draft.mode === 'pro' && historyPriority !== null ? clamp(historyPriority*.2,-4,10) : 0)) : opponentLane ? clamp(50 + (matchup - 50) * 1.2) : blindSafety;
      const mastery = input.draft.mode==='solo'?input.settings.pool[c.id]:undefined;
      const factors: Weights = { winrate: stats ? clamp(50 + stats.delta * 600) : 50, matchup, synergy,
        meta: priority,
        flex: early?flex.score:50, order: orderValue, composition: comp,
        mastery: !useFamiliarity?50:familiarity?(familiarity.games?clamp(40+Math.log2(1+familiarity.games)*9):80):players.some(p=>p.pool.length>0)?25:side === input.draft.side && mastery !== undefined ? mastery * 20 : 50 };
      const weights = { ...input.settings.weights };
      if (input.draft.mode === 'solo') { weights.mastery *= 2; weights.flex *= 0.4; weights.synergy *= 0.7 }
      else { weights.flex *= early?3:.2; weights.order *= 1.3;weights.meta*=early?1.5:1;if(useFamiliarity&&players.some(p=>p.pool.length>0))weights.mastery*=3; }
      const prior=patchPrior({...input,draft:{...input.draft,side}},c.id,role);
      const knownComfort=familiarity?.games?familiarity.games/(familiarity.games+40)*((familiarity.player.pool.find(p=>p.championId===c.id&&(!p.role||p.role===role))?.comfort??3)/5):0;
      // A well-covered pro dataset does not certify every strong solo offrole as an opening blind.
      // This is a disclosed uncertainty cost, never a fabricated negative matchup statistic.
      const openingUncertainty=input.draft.mode==='pro'&&early&&!opponentLane&&input.stats.some(s=>s.source==='pro'&&s.games>=100)
        ?6*(1-(pro?.usable?pro.support:0))*(1-knownComfort*.6):0;
      const score = clamp(contextualScore(factors, weights, context)+prior.value-openingUncertainty);
      const reasons: string[] = [];
      if(openingUncertainty>.5)reasons.push(text(input,`Ouverture : prudence de ${openingUncertainty.toFixed(1)} points pour une position encore peu étayée en pro ; le confort renseigné réduit ce coût. Ce n’est pas un malus de matchup mesuré.`,`Opening: ${openingUncertainty.toFixed(1)} points of caution for a role with limited pro support; known comfort reduces this cost. This is not a measured matchup penalty.`));
      if(input.draft.mode==='pro'&&meta&&(meta.proRoleGames[role]??0)<10)reasons.push(text(input,`Position ${role} peu documentée en pro (${Math.round(meta.proRoleGames[role]??0)} apparitions pondérées). La présence du champion dans ses autres rôles ne certifie pas ce blind ; les données Master+ restent une indication.`,`Limited pro evidence for ${role} (${Math.round(meta.proRoleGames[role]??0)} weighted appearances). Presence in other roles does not certify this blind; Master+ data remains an indication.`));
      if(input.draft.mode==='pro'&&opening)reasons.push(text(input,`Ordre pro connu : ${opening.games} apparitions pondérées · premier choix de ce camp ${(opening.firstShare*100).toFixed(0)} % · phase 1 ${(opening.earlyShare*100).toFixed(0)} %. Fréquences lissées, pas des taux de victoire en blind.`,`Known pro order: ${opening.games} weighted appearances · this side’s opening pick ${(opening.firstShare*100).toFixed(0)}% · phase 1 ${(opening.earlyShare*100).toFixed(0)}%. Smoothed frequencies, not blind-pick win rates.`));
      if(input.draft.mode==='pro'&&meta)reasons.push(text(input,`Priorité observée : présence pro ${meta.proPresence===null?'indisponible':(meta.proPresence*100).toFixed(1)+' %'} · Master+ ${meta.soloPresence===null?'indisponible':(meta.soloPresence*100).toFixed(1)+' %'}. Picks réunis par champion, bans comptés une fois. Ce n’est pas une fréquence de first pick.`,`Observed priority: pro presence ${meta.proPresence===null?'unavailable':(meta.proPresence*100).toFixed(1)+'%'} · Master+ ${meta.soloPresence===null?'unavailable':(meta.soloPresence*100).toFixed(1)+'%'}. Picks combined by champion, bans counted once. This is not a first-pick frequency.`));
      if(prior.value)reasons.push(text(input,`Patch : ajustement prudent ${prior.value>0?'+':''}${prior.value.toFixed(1)}, hypothèse sur les données encore décalées.`,`Patch: bounded adjustment ${prior.value>0?'+':''}${prior.value.toFixed(1)}, a hypothesis for lagging statistics.`));
      if (stats) reasons.push(text(input, `${(stats.estimate * 100).toFixed(1)} % lissé · ${Math.round(stats.n).toLocaleString('fr-FR')} parties pondérées${stats.old ? ' · anciens patchs inclus' : ''}`, `${(stats.estimate * 100).toFixed(1)}% smoothed · ${Math.round(stats.n)} weighted games${stats.old ? ' · older patches included' : ''}`));
      else reasons.push(text(input, 'Aucune statistique compatible : priorité qualitative uniquement.', 'No matching statistics: qualitative priority only.'));
      if (stats?.rounded) reasons.push(text(input, 'Lolalytics : victoires reconstituées à partir des taux publiés arrondis ; intervalle approximatif.', 'Lolalytics: wins reconstructed from rounded published rates; approximate interval.'));
      if (viableRoles.length > 1 && early) reasons.push(text(input, `Flex jouable ${viableRoles.join(' / ')} : rôles observés, encore libres et compatibles avec les pools renseignés.`, `${viableRoles.join(' / ')} playable flex: observed roles, still free and compatible with declared pools.`));
      reasons.push(...contextual.reasons);
      if(blind){
        const threats=blind.threats.map(t=>input.champions.find(ch=>ch.id===t.championId)?.name??t.championId).join(' / ');
        reasons.push(text(input,`Vis-à-vis ${role} inconnu : risque des réponses disponibles ${blind.score.toFixed(0)}/100 · ${blind.assessed}/${blind.available} matchups exploitables${threats?` · réponses à surveiller : ${threats}`:''}.`,`Unknown opposing ${role}: remaining-response assessment ${blind.score.toFixed(0)}/100 · ${blind.assessed}/${blind.available} usable matchups${threats?` · watch for: ${threats}`:''}.`));
        if(blind.coverage<.5)reasons.push(text(input,`Couverture des réponses faible : ce blind ne peut pas être déclaré sûr. Coût d’incertitude distinct : ${blind.uncertaintyPenalty.toFixed(1)} points dans le critère blind.`,`Low response coverage: this blind cannot be described as safe. Separate uncertainty cost: ${blind.uncertaintyPenalty.toFixed(1)} points in the blind criterion.`));
        if(blind.developmentPenalty>.5)reasons.push(text(input,`Développement du top : coût qualitatif ${blind.developmentPenalty.toFixed(1)} dans le critère blind. Son utilité dépend davantage de l’économie et du passage de lane ; ce n’est pas une statistique mesurée.`,`Top development: qualitative cost ${blind.developmentPenalty.toFixed(1)} in the blind criterion. Its utility depends more on economy and surviving lane; this is not a measured statistic.`));
      }
      if(context){
        reasons.push(text(input,`Contexte ${role} : ${context.parts.map(p=>`${p.label} ${p.weight.toFixed(0)} %`).join(' · ')}${context.partial?' · informations partielles':''}.`,`Context ${role}: ${context.parts.map(p=>`${p.label} ${p.weight.toFixed(0)}%`).join(' · ')}${context.partial?' · partial information':''}.`));
        if(role==='SUPPORT')reasons.push(text(input,'Botlane : approximation du 2v2 par les quatre paires adverses, la synergie ADC/support et des règles qualitatives. Les statistiques mesurent des victoires de partie, pas la domination de lane.','Bot lane: 2v2 approximated from four opposing pairs, ADC/support synergy and qualitative rules. Statistics measure game wins, not lane dominance.'));
      }
      if(allies.length>=2)reasons.push(text(input,`Plan de jeu : ${afterPlan.title}. ${afterPlan.conditions[0]??afterPlan.timing}`,`Game plan: ${afterPlan.title}. ${afterPlan.conditions[0]??afterPlan.timing}`));
      if(stats)for(const g of stats.groups.filter(g=>!g.usable))reasons.push(text(input,`${g.source} : ${Math.round(g.n)} parties pondérées, échantillon insuffisant (minimum ${g.source==='pro'?10:200}). Winrate et priorité méta neutralisés pour cette source.`,`${g.source}: ${Math.round(g.n)} weighted games, insufficient sample (minimum ${g.source==='pro'?10:200}). Win-rate and meta effects neutralized for this source.`));
      const unsupportedPairs=[...matchups,...synergies].filter(m=>!m.usable).length;
      if(unsupportedPairs)reasons.push(text(input,`${unsupportedPairs} matchup(s) ou synergie(s) sans échantillon suffisant : aucun bonus statistique.`,`${unsupportedPairs} matchup or synergy samples below the minimum: no statistical bonus.`));
      if(stats)reasons.push(text(input,`Écart au niveau moyen : ${(stats.delta*100).toFixed(2)} points ; mix ${stats.groups.map(g=>`${g.source} ${Math.round(100*g.mixture/stats.groups.reduce((s,x)=>s+x.mixture,0))}%`).join(' / ')} ajusté à la fiabilité.`,`Baseline-adjusted edge: ${(stats.delta*100).toFixed(2)} points; reliability-weighted source blend.`));
      if(useFamiliarity&&familiarity)reasons.push(familiarity.games?text(input,`${familiarity.player.riotId} : ${familiarity.games} parties sur ce champion.`,`${familiarity.player.riotId}: ${familiarity.games} games on this champion.`):text(input,`${familiarity.player.riotId} : champion déclaré jouable.`,`${familiarity.player.riotId}: declared playable champion.`));
      if (matchups.length) reasons.push(context?text(input,`Paires adverses observées : ${matchups.length}/${enemies.length} ennemis · effets répartis dans les critères du rôle.`,`Observed opposing pairs: ${matchups.length}/${enemies.length} enemies · effects allocated to role criteria.`):text(input, `Matchups observés : ${matchups.length}/${enemies.length} ennemis · effet ${matchup >= 50 ? 'favorable' : 'défavorable'}.`, `Observed matchups: ${matchups.length}/${enemies.length} enemies · ${matchup >= 50 ? 'favorable' : 'unfavorable'} effect.`));
      if (synergies.length) reasons.push(text(input, `Synergies observées : ${synergies.length}/${allies.length} alliés.`, `Observed synergies: ${synergies.length}/${allies.length} allies.`));
      if (last && opponentLane) reasons.push(text(input, 'Dernier pick : le matchup de lane est déjà révélé.', 'Last pick: the lane matchup is already revealed.'));
      if (blindCounterPenalty > 1) reasons.push(text(input, 'Attention : un counter statistique de lane reste disponible en face.', 'Caution: an observed lane counter is still available to the enemy.'));
      if (early && historyPriority !== null && input.draft.mode === 'pro') reasons.push(text(input, `Priorité de premier tour mesurée sur ${Math.round(historical!.total)} drafts pro pondérées.`, `Early-round priority measured across ${Math.round(historical!.total)} weighted pro drafts.`));
      if (useFamiliarity && mastery !== undefined && side === input.draft.side) reasons.push(text(input, `Maîtrise déclarée : ${mastery}/5.`, `Declared proficiency: ${mastery}/5.`));
      if (!c.curated) reasons.push(text(input, 'Profil de composition générique : à vérifier.', 'Generic composition profile: verify manually.'));
      const coverage = (1 + matchups.reduce((n,m)=>n+m.confidence,0) + synergies.reduce((n,m)=>n+m.confidence,0)) / Math.max(1, 1 + enemies.length + allies.length);
      const strongest=context?.parts.filter(p=>p.weight>0&&p.score>52).sort((a,b)=>(b.score-50)*b.weight-(a.score-50)*a.weight)[0];
      const blindBrief=blind&&blind.coverage<.5?text(input,'Blind : couverture des réponses insuffisante.','Blind: insufficient response coverage.'):blind&&blind.score<47?text(input,`Blind exposé${blind.threats.length?` : ${blind.threats.map(t=>input.champions.find(ch=>ch.id===t.championId)?.name??t.championId).join(' / ')} encore disponibles`:''}.`,`Exposed blind${blind.threats.length?`: ${blind.threats.map(t=>input.champions.find(ch=>ch.id===t.championId)?.name??t.championId).join(' / ')} still available`:''}.`):null;
      const brief=blindBrief??(strongest?text(input,`${strongest.label} : favorable${context?.partial?' · draft encore partielle':''}.`,`${strongest.label}: favorable${context?.partial?' · draft still partial':''}.`):contextual.reasons[0]??(useFamiliarity&&familiarity?(familiarity.games?text(input,`${familiarity.player.riotId} joue ce champion (${familiarity.games} parties connues).`,`${familiarity.player.riotId} plays this champion (${familiarity.games} known games).`):text(input,`Déclaré jouable par ${familiarity.player.riotId}.`,`Declared playable by ${familiarity.player.riotId}.`)):viableRoles.length>1&&early?text(input,'Un flex qui garde plusieurs options ouvertes.','A flex pick that keeps several options open.'):opponentLane&&matchup>52?text(input,'Matchup favorable face au rôle adverse déjà révélé.','Favorable matchup against the revealed enemy role.'):priority>55?text(input,'Champion prioritaire dans la méta sur les patchs analysés.','High-priority champion in the analyzed patch meta.'):stats&&stats.delta>0?text(input,'Résultats solides sur les derniers patchs.','Solid results across the latest patches.'):text(input,'À comparer avec les autres options pour votre composition.','Compare with the other options for your composition.')));
      results.push({ championId: c.id, role, viableRoles, opening, score: Math.round(score * 10) / 10, confidence: stats ? Math.round(stats.confidence * coverage * 100) : 0,
        games: stats ? Math.round(stats.n) : 0, winrate: stats?.usable ? stats.estimate : null, interval: stats?.usable ? stats.interval : null, factors, reasons,context,blind,meta,summary:stats&&!stats.usable?text(input,`Échantillon insuffisant (${Math.round(stats.n)} parties) · choix évalué sur son plan de jeu et le pool.`,`Insufficient sample (${Math.round(stats.n)} games) · evaluated through game plan and pool.`):brief,lowSample:!!stats&&!stats.usable,
        responseRisk: context?contextualRisk(context):enemyTeam.length ? clamp(50 + (50 - matchup)) : 50, source: stats ? (input.demo ? 'DEMO · ' : '') + stats.sources : 'heuristic' });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.championId.localeCompare(b.championId) || a.role.localeCompare(b.role));
}
function unique(recs: Recommendation[]): Recommendation[] { const seen = new Set<string>(); return recs.filter(r => !seen.has(r.championId) && !!seen.add(r.championId)).map(r=>({...r,alternatives:recs.filter(other=>other.championId===r.championId).map(other=>({role:other.role,score:other.score,blindScore:other.blind?.score}))})); }
function predict(input: EngineInput, side: Side): Prediction[] {
  return choicePolicy(input,side,rankCandidates(input,side,'AUTO',true)).slice(0,5);
}
function append(input: EngineInput, rec: Recommendation | Prediction): EngineInput {
  return { ...input, draft: { ...input.draft, targetRole: 'AUTO', history: [...input.draft.history, { championId: rec.championId, role: rec.role }] } };
}
export function banCandidates(input: EngineInput, side: Side, restrictRole: Role | 'AUTO' = 'AUTO'): Recommendation[] {
  // Bans target opponent options; the user's playable pool must never restrict them.
  const enemy = opposite(side);
  const scout=input.teams?.[enemy===input.draft.side?'ally':'enemy'];
  const candidates = rankCandidates(input, enemy, restrictRole, false, false);
  const impacts=banConsequences(input,side,candidates,rankCandidates(input,side,'AUTO',false,false));
  return unique(candidates.map(r => {
    const base=r.score*.8+r.factors.meta*.2,banScouting=scoutingBan(scout,r.championId,r.role,input.settings.banScoutingWeight??35);
    const weight=(banScouting?.appliedWeight??0)/100,impact=impacts.get(`${r.championId}:${r.role}`)!;
    const score=clamp(base*(1-weight)+(banScouting?.score??base)*weight+impact.net*2*(input.settings.banImpactWeight??40)/100);
    const reasons=[text(input, 'Retire une option bien adaptée aux rôles adverses encore libres.', 'Removes an option suited to the remaining enemy roles.'), ...r.reasons];
    const replacement=impact.replacement?input.champions.find(c=>c.id===impact.replacement!.championId)?.name??impact.replacement.championId:text(input,'aucune dans les filtres actuels','none in the current filters');
    const consequence=text(input,`Conséquence au prochain pick : alternative ${replacement} (${impact.alternatives} options dans ce rôle). Perte adverse ${impact.enemyLoss.toFixed(1)} ; coût pour notre équipe ${impact.ownLoss.toFixed(1)} ; gain net ${impact.net.toFixed(1)} points heuristiques.`,`Next-pick consequence: replacement ${replacement} (${impact.alternatives} role options). Enemy loss ${impact.enemyLoss.toFixed(1)}; our cost ${impact.ownLoss.toFixed(1)}; net gain ${impact.net.toFixed(1)} heuristic points.`);
    reasons.unshift(consequence);
    if(impact.poolExhausted)reasons.unshift(text(input,'Ce ban épuise le pool déclaré pour ce rôle ; le pool connu peut être incomplet.','This ban exhausts the declared pool for this role; the known pool may be incomplete.'));
    if(banScouting&&weight>0){
      const {riotId,games,share,winrate,declared,appliedWeight}=banScouting;
      const detail=declared?text(input,'champion déclaré jouable, sans parties mesurées','declared playable champion, no measured games'):games?text(input,`${games} parties · ${(share*100).toFixed(1)} % des parties connues · ${(winrate!*100).toFixed(1)} % de victoires sur la saison`,`${games} games · ${(share*100).toFixed(1)}% of known games · ${(winrate!*100).toFixed(1)}% season win rate`):text(input,'champion absent du pool connu ; priorité de ban réduite','champion absent from known pool; ban priority reduced');
      reasons.unshift(text(input,`Ciblage OP.GG : ${riotId} · ${detail}. Poids effectif ${appliedWeight.toFixed(1)} % (maximum ${input.settings.banScoutingWeight??35} %, réduit selon les données).`,`OP.GG target: ${riotId} · ${detail}. Effective weight ${appliedWeight.toFixed(1)}% (maximum ${input.settings.banScoutingWeight??35}%, evidence-adjusted).`));
    }
    const summary=banScouting&&weight>0?(banScouting.declared?text(input,`Ciblage de pool : ${banScouting.riotId} déclare ce champion jouable.`,`Pool target: ${banScouting.riotId} declares this champion playable.`):banScouting.games?text(input,`Ciblage OP.GG : ${banScouting.riotId} · ${banScouting.games} parties · ${(banScouting.share*100).toFixed(1)} % du pool connu.`,`OP.GG target: ${banScouting.riotId} · ${banScouting.games} games · ${(banScouting.share*100).toFixed(1)}% of known pool.`):text(input,'Champion absent du pool adverse connu.','Champion absent from the known enemy pool.')):r.summary;
    return {...r,score:Math.round(score*10)/10,reasons,banScouting,banImpact:impact,summary:impact.net>1?text(input,`Réduit leurs options ${r.role} · remplacement : ${replacement}.`,`Reduces their ${r.role} options · replacement: ${replacement}.`):impact.net< -1?text(input,`Coût pour notre plan : ${impact.ownLoss.toFixed(1)} points · alternative adverse : ${replacement}.`,`Cost to our plan: ${impact.ownLoss.toFixed(1)} points · enemy replacement: ${replacement}.`):summary};
  }).sort((a,b)=>b.score-a.score||a.championId.localeCompare(b.championId)||a.role.localeCompare(b.role)));
}
function duos(input: EngineInput, recs: Recommendation[]): Duo[] {
  const index = input.draft.history.length, sequence = order(input.draft), current = sequence[index], next = sequence[index + 1];
  if (input.draft.mode !== 'pro' || current?.kind !== 'pick' || next?.kind !== 'pick' || current.side !== next.side || current.side !== input.draft.side) return [];
  const combos: Duo[] = [];
  for (const first of recs.slice(0, 10)) {
    const afterFirst = append(input, first);
    for (const second of unique(rankCandidates(afterFirst, current.side)).slice(0, 4)) {
      const afterBoth = append(afterFirst, second), response = predict(afterBoth, opposite(current.side))[0] ?? null;
      const bestReply = unique(rankCandidates(afterBoth, opposite(current.side), 'AUTO', false))[0];
      const leaf=bestReply?append(afterBoth,bestReply):afterBoth;const confrontation=evaluateMatch(leaf).value*(current.side==='blue'?1:-1);
      const score=clamp(50+confrontation*1.3+((first.score+second.score)/2-50)*.25);
      combos.push({ first, second, score: Math.round(score * 10) / 10, response });
    }
  }
  const seen = new Set<string>();
  return combos.sort((a, b) => b.score - a.score).filter(d => { const key = [d.first.championId, d.second.championId].sort().join('|'); if (seen.has(key)) return false; seen.add(key); return true }).slice(0, 3);
}
function simulate(input: EngineInput, current: Recommendation[]): Scenario[] {
  if (input.draft.history.length >= 20) return [];
  return current.slice(0, 3).map((seed, branch) => {
    let state = input;
    const start = order(state.draft)[state.draft.history.length];
    state = start.kind === 'pick' ? append(state, seed) : { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: seed.championId }] } };
    while (state.draft.history.length < 20) {
      const action = order(state.draft)[state.draft.history.length];
      const ranked = action.kind === 'ban' ? banCandidates(state, action.side) : unique(rankCandidates(state, action.side, 'AUTO', true));
      const choice = ranked[0];
      if (!choice) {
        if (action.kind === 'pick') break; // Incomplete pools cannot be silently advertised as complete branches.
        state = { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: null }] } }; continue;
      }
      state = action.kind === 'pick' ? append(state, choice) : { ...state, draft: { ...state.draft, history: [...state.draft.history, { championId: choice.championId }] } };
    }
    const allyMembers=picks(state.draft,input.draft.side),enemyMembers=picks(state.draft,opposite(input.draft.side));
    const ally = gamePlan(team(state,input.draft.side),allyMembers.map(p=>p.role),team(state,opposite(input.draft.side)),enemyMembers.map(p=>p.role)), enemy = gamePlan(team(state,opposite(input.draft.side)),enemyMembers.map(p=>p.role),team(state,input.draft.side),allyMembers.map(p=>p.role));
    return { title: `${text(input, 'Scénario', 'Scenario')} ${branch + 1}`, history: state.draft.history, advantage: Math.round(ally.score - enemy.score), winProbability: null,
      explanation: text(input, 'Continuation gloutonne après ce choix. Indice de composition non calibré ; aucune probabilité de victoire validée.', 'Greedy continuation after this choice. Uncalibrated composition index; no validated win probability.') };
  });
}
/** Rates actual revealed picks, normalized per champion. Missing teams start at a neutral 50.
 * Popularity, pick order and personal mastery are not outcome probabilities and are excluded.
 */
export function draftBalance(input:EngineInput):DraftBalance {
  return matchBalance(input);
}
export function analyze(input: EngineInput): Analysis {
  const { draft } = input, next = order(draft)[draft.history.length] ?? null;
  const role = draft.targetRole !== 'AUTO' ? draft.targetRole : draft.mode === 'solo' && next?.side === draft.side && freeRoles(draft, draft.side).includes(draft.role) ? draft.role : 'AUTO';
  const side = next?.side ?? draft.side;
  const all = next?rankCandidates(input, side, role, next.side === draft.side):[];
  let recommendations = unique(all); const bans = next?banCandidates(input, side, next.kind === 'ban' ? draft.targetRole : 'AUTO'):[];
  const strategy=next?.kind==='pick'&&draft.mode==='pro'?strategyAnalysis(input):undefined;
  if(strategy?.options.length){const checked=new Set(strategy.options.map(r=>r.championId));recommendations=[...strategy.options,...recommendations.filter(r=>!checked.has(r.championId))].sort((a,b)=>b.score-a.score);}
  const warnings: string[] = [];
  if (!input.stats.length) warnings.push(text(input, 'Mode heuristique : importez un pack autorisé pour utiliser les winrates, counters et synergies statistiques.', 'Heuristic mode: import an authorized pack to use statistical win rates, counters and synergies.'));
  else if (next && !recommendations.some(r => r.games)) warnings.push(text(input, 'Aucune donnée compatible avec ces filtres et rôles. Les scores restent qualitatifs.', 'No data matches these filters and roles. Scores remain qualitative.'));
  if (input.demo) warnings.push(text(input, 'DONNÉES FICTIVES : démonstration uniquement, aucune valeur prédictive.', 'SYNTHETIC DATA: demonstration only, no predictive validity.'));
  const windows=prepare(input).windows;
  if(draft.league!=='all'&&!input.stats.some(s=>s.source==='pro'&&s.league===draft.league))warnings.push(text(input,'Winrates et priorité pro : agrégats toutes ligues. Le filtre de ligue concerne les paires et drafts disponibles.','Pro win rates and priority use all-league aggregates. The league filter applies to available pairs and drafts.'));
  if(windows.solo.length&&windows.pro.length&&windows.solo[0]!==windows.pro[0])warnings.push(text(input,`Fenêtres distinctes : Master+ ${windows.solo.join(' / ')} ; pro ${windows.pro.join(' / ')}. Le patch pro est décalé, les recommandations peuvent subir les changements de méta.`,`Different source windows: Master+ ${windows.solo.join(' / ')}; pro ${windows.pro.join(' / ')}. Pro data lags and can be affected by meta changes.`));
  if (draft.mode === 'solo') warnings.push(text(input, 'Les 10 bans sont saisis par équipe ; en ranked ils sont simultanés et les doublons adverses sont autorisés.', 'Enter the 10 bans by team; ranked bans are simultaneous and opposing duplicates are allowed.'));
  const scenarios = simulate(input, next?.kind === 'ban' ? bans : recommendations);
  if (scenarios.some(s => s.history.length < 20)) warnings.push(text(input, 'Le pool restreint ne permet pas de terminer certaines simulations : élargissez les rôles couverts.', 'The restricted pool cannot complete some simulations: broaden its role coverage.'));
  return { picks: recommendations, bans: bans.slice(0, 5), enemies: next?predict(input, opposite(draft.side)):[],
    duos: duos(input, all), scenarios,
    ally: composition(team(input, draft.side), input.settings.language,picks(draft,draft.side).map(p=>p.role)), enemy: composition(team(input, opposite(draft.side)), input.settings.language,picks(draft,opposite(draft.side)).map(p=>p.role)),
    plans:{ally:gamePlan(team(input,draft.side),picks(draft,draft.side).map(p=>p.role),team(input,opposite(draft.side)),picks(draft,opposite(draft.side)).map(p=>p.role),input.settings.language),
      enemy:gamePlan(team(input,opposite(draft.side)),picks(draft,opposite(draft.side)).map(p=>p.role),team(input,draft.side),picks(draft,draft.side).map(p=>p.role),input.settings.language)},balance:draftBalance(input),evaluation:evaluateMatch(input),strategy, warnings, next };
}

export function strategyAnalysis(input:EngineInput,request?:StrategyRequest){
 return exploreStrategy(input,(state,side,kind,restrict='AUTO')=>{
  const base=kind==='ban'?banCandidates(state,side):rankCandidates(state,side,restrict,true);
  if(request?.roots.length&&state.draft.history.length===request.draft.history.length&&kind==='pick'){
   for(const root of request.roots)if(root.championId&&root.role&&freeRoles(state.draft,side).includes(root.role)&&!used(state.draft).has(root.championId)&&!fearlessUsed(state.draft).has(root.championId)){
    const forced=rankCandidates(state,side,root.role,false,true,root.championId)[0];if(forced&&!base.some(r=>r.championId===forced.championId&&r.role===forced.role))base.push(forced);
   }
  }
  return base;
 },request);
}
