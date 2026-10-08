import type { Champion, GamePlan, Role } from '../shared/types';
import { clamp } from './math';
import { damageShare } from './teamplay';

const group = (ids: string) => new Set(ids.split(' '));
const waveclear = group('Anivia Ahri Azir AurelionSol Caitlyn Cassiopeia Corki Hwei Jinx Karma Lux Malzahar MissFortune Orianna Ryze Seraphine Sivir Smolder Syndra Taliyah Tristana TwistedFate Varus Viktor Xerath Ziggs');
const sustained = group('Aphelios Ashe Azir Cassiopeia Corki Draven Ezreal Fiora Gwen Jax Jinx Kalista Kaisa KogMaw Lucian Sivir Smolder Tristana Twitch Varus Vayne Xayah Yasuo Yone Zeri');
const sidelane = group('Camille Fiora Gwen Irelia Jax Nasus Ryze Trundle Tryndamere TwistedFate Yone Yorick');
const access = group('Akali Alistar Camille Diana Hecarim JarvanIV Kennen Leona Malphite MonkeyKing Nautilus Nocturne Rakan Rell Vi Wukong Zac');
const zone = group('Anivia Azir Brand Cassiopeia Gangplank Heimerdinger Hwei Maokai MissFortune Orianna Rumble Taliyah Viktor Ziggs Zyra');
const demanding = group('Akali Aphelios Azir Camille Cassiopeia Fiora Gangplank Irelia Kalista Kennen Nidalee Rakan Riven Ryze Yasuo Yone Zeri');

// Qualitative mechanics, never a measured lane win rate or probability of winning.
// Scores use averages and capped tools so merely adding champions does not guarantee improvement.
export function gamePlan(team: Champion[], roles: Role[], enemy: Champion[], enemyRoles: Role[] = [], language = 'fr'): GamePlan {
  const fr = language === 'fr', tr = (a:string,b:string) => fr?a:b;
  const count = team.length;
  const avg = (key: keyof Champion['traits']) => count ? team.reduce((n,c)=>n+c.traits[key],0)/count : 0;
  const tools = (key: keyof Champion['traits']) => team.filter(c=>c.traits[key]>=2).length;
  const has = (ids:Set<string>) => team.filter(c=>ids.has(c.id)).length;
  const carries = team.filter((_,i)=>roles[i] !== 'SUPPORT');
  const dps = carries.some(c=>sustained.has(c.id)), side = has(sidelane), dive = has(access);
  const front = tools('frontline'), peel = tools('peel'), engage = tools('engage'), clear = has(waveclear);
  const enemyDive = enemy.filter(c=>access.has(c.id)).length, enemyFront = enemy.filter(c=>c.traits.frontline>=2).length;
  const kind:GamePlan['kind'] = count<2?'building':avg('poke')>=1.65?'poke':side&&count>=3&&avg('scaling')>=1.6?'side':dive>=2&&engage>=2?'dive':dps&&front&&peel?'front-to-back':'mixed';
  const titles = {building:tr('Plan à construire','Plan in progress'),poke:tr('Poke et contrôle de zone','Poke and zone control'),side:tr('Pression en side lane','Side lane pressure'),dive:tr('Dive et accès aux carries','Dive and carry access'),'front-to-back':tr('Combats prolongés autour des carries','Sustained fights around carries'),mixed:tr('Plan polyvalent à préciser','Flexible plan to refine')};
  let laneDelta = 0, laneMatches=0;
  team.forEach((c,i)=>{if(roles[i]==='JUNGLE'||roles[i]==='SUPPORT')return;const other=enemy.find((_,j)=>enemyRoles[j]===roles[i]);if(other){laneDelta+=c.traits.early-other.traits.early;laneMatches++;}});
  const lanes = count?clamp(28+avg('early')*16+Math.min(2,clear)*5+(laneMatches?laneDelta/laneMatches*5:0)):50;
  const objectives = count?clamp(25+lanes*.28+Math.min(2,has(zone))*8+(dps?12:0)+Math.min(2,engage)*5):50;
  let teamfight = count?35+(dps?15:0)+Math.min(2,front)*5+Math.min(2,peel)*5+Math.min(2,engage)*4:50;
  if(count>=3){if(enemyDive>=2&&!peel)teamfight-=15;if(enemyFront>=2&&!dps)teamfight-=15;
    const damage=damageShare(team,roles);if(damage>.82||damage<.18)teamfight-=10;}
  const sideLane = count?clamp(40+(side?20:0)+(side&&clear?10:0)-(side>=2&&clear===0?15:0)):50;
  const execution = count?clamp(85-has(demanding)/count*30-(kind==='dive'?10:0)-(side>=2?10:0)):50;
  const conditions:string[]=[], risks:string[]=[], needs:string[]=[];
  if(kind==='poke'){
    conditions.push(tr('Installer la vision et la zone avant l’objectif ; faire baisser les PV avant de s’engager.','Set vision and zone control before objectives; lower enemy health before committing.'));
    if(enemyDive>=2&&!peel){risks.push(tr('Plusieurs accès adverses peuvent contourner le poke.','Multiple enemy engage tools can bypass poke.'));needs.push(tr('Ajouter du disengage ou une protection fiable.','Add disengage or reliable protection.'));}
    if(!clear)needs.push(tr('Préparer une source de waveclear pour pouvoir se déplacer.','Prepare waveclear to enable rotations.'));
  } else if(kind==='side'){
    conditions.push(tr('Créer de la pression latérale pendant que le groupe tient les vagues et évite les engagements forcés.','Build side lane pressure while the group holds waves and avoids forced fights.'));
    if(!clear){risks.push(tr('Le groupe manque d’outils pour tenir les vagues.','The group lacks tools to hold waves.'));needs.push(tr('Compléter le groupe avec du waveclear.','Complete the group with waveclear.'));}
    if(enemyDive>=2&&!peel)risks.push(tr('Le groupe peut se faire engager avant que la pression latérale rapporte.','The group can be engaged before side pressure pays off.'));
  } else if(kind==='dive'){
    conditions.push(tr('Préparer un angle commun et coordonner l’entrée avec les dégâts de suivi.','Prepare a shared angle and coordinate entry with follow-up damage.'));
    if(enemy.filter(c=>c.traits.peel>=2).length>=2)risks.push(tr('La protection adverse peut faire échouer la première entrée.','Enemy protection can shut down the first entry.'));
    if(!has(zone))needs.push(tr('Sécuriser les dégâts de suivi après l’initiation.','Secure follow-up damage after initiation.'));
  } else if(kind==='front-to-back'){
    conditions.push(tr('Garder les carries en portée de leur protection et jouer les combats prolongés.','Keep carries within protection range and play sustained fights.'));
    if(enemy.filter(c=>c.traits.poke>=2).length>=2&&!engage){risks.push(tr('Le poke adverse peut empêcher un combat dans de bonnes conditions.','Enemy poke can deny a favorable fight.'));needs.push(tr('Préparer un moyen de forcer le combat ou de contourner le poke.','Prepare a way to force fights or bypass poke.'));}
  } else if(count){conditions.push(tr('Choisir une condition de victoire principale avec les prochains picks.','Choose a primary win condition with the next picks.'));}
  if(count>=2){
    if(!dps){needs.push(tr('Ajouter une source de dégâts soutenus jouable par l’équipe.','Add sustained damage your team can play.'));if(count>=4)risks.push(tr('Les combats longs et les objectifs risquent de manquer de dégâts.','Long fights and objectives may lack damage.'));}
    if(lanes<48)risks.push(tr('Peu de présence précoce estimée : vérifier les matchups et le trajet jungle.','Limited estimated early presence: verify matchups and jungle path.'));
    if(avg('scaling')>avg('early')+.6){conditions.push(tr('Prévoir comment traverser le début de partie avant les pics de puissance.','Plan how to survive early stages before power spikes.'));}
    if(enemyFront>=2&&!dps)risks.push(tr('Dégâts prolongés insuffisants face à la frontline révélée.','Insufficient sustained damage against revealed frontline.'));
    if(enemyDive>=2&&!peel&&!risks.some(r=>r.includes('poke')))needs.push(tr('Vérifier la protection des carries contre les accès adverses.','Check carry protection against enemy access.'));
  }
  const axes={lanes:Math.round(lanes),objectives:Math.round(objectives),teamfight:Math.round(clamp(teamfight)),sideLane:Math.round(sideLane),execution:Math.round(execution)};
  const primary=kind==='poke'?objectives:kind==='side'?sideLane:kind==='dive'?teamfight:kind==='front-to-back'?teamfight:(objectives+teamfight)/2;
  const score=count?clamp(primary*.4+lanes*.15+objectives*.15+clamp(teamfight)*.2+execution*.1):50;
  const timing=count?avg('early')>avg('scaling')+.4?tr('Créer un avantage tôt et convertir sur les objectifs.','Build an early lead and convert it into objectives.'):avg('scaling')>avg('early')+.4?tr('Atteindre les pics de puissance avec une économie stable.','Reach power spikes with stable economy.'):tr('Jouer les fenêtres de puissance et les rotations préparées.','Play prepared power windows and rotations.'):tr('Timings à définir.','Timings to define.');
  return {kind,title:titles[kind],score:Math.round(score*10)/10,partial:count<5,profiled:team.filter(c=>c.curated).length,axes,timing,conditions:[...new Set(conditions)],risks:[...new Set(risks)],needs:[...new Set(needs)]};
}
