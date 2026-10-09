import { AlertTriangle, CircleHelp, Target, Users } from 'lucide-react';
import type { Analysis, Champion, Recommendation, Snapshot } from '../shared/types';
import { opposite, picks } from '../shared/draft';
import { Portrait } from './ChampionPortrait';

export function FaceExplanation({ recommendation: r, snapshot, analysis, champions, pending, details }: {
  recommendation?: Recommendation; snapshot: Snapshot; analysis?: Analysis; champions: Map<string, Champion>; pending: boolean; details: () => void;
}) {
  const fr = snapshot.settings.language === 'fr', next = analysis?.next, isBan = next?.kind === 'ban';
  const actor = next?.side ?? snapshot.draft.side, team = actor === snapshot.draft.side ? snapshot.teams.ally : snapshot.teams.enemy;
  const c = r && champions.get(r.championId), opponents = picks(snapshot.draft, opposite(actor));
  const lane = opponents.find(p => p.role === r?.role), laneName = champions.get(lane?.championId ?? '')?.name;
  const bot = opponents.filter(p => p.role === 'ADC' || p.role === 'SUPPORT');
  const plan = r?.context?.parts.find(p => p.key === 'plan')?.score ?? r?.factors.composition;
  const gamePlan = isBan ? (actor === snapshot.draft.side ? (fr ? 'Le ban retire aussi ce champion de nos propres options.' : 'This ban also removes the champion from our own options.') : (fr ? 'Le ban retire aussi ce champion de leurs propres options.' : 'This ban also removes the champion from their own options.')) : r?.reasons.find(line => line.startsWith(fr ? 'Plan de jeu : ' : 'Game plan: '))?.replace(/^(Plan de jeu|Game plan)\s*: /, '');
  const traits = c?.curated ? [c.traits.frontline >= 2 && (fr ? 'Frontline' : 'Frontline'), c.traits.engage >= 2 && (fr ? 'Engage' : 'Engage'), c.traits.peel >= 2 && (fr ? 'Protection' : 'Peel'), c.traits.poke >= 2 && 'Poke', c.traits.scaling >= 2 && 'Scaling', c.traits.early >= 2 && (fr ? 'Présence early' : 'Early presence')].filter(Boolean).slice(0, 3).join(' · ') : '';
  const players = r ? team.players.filter(p => (p.role === r.role || p.role === 'AUTO') && p.pool.some(entry => entry.championId === r.championId && (!entry.role || entry.role === r.role))) : [];
  const scouting = r?.banScouting && r.banScouting.appliedWeight > 0 ? r.banScouting : undefined;
  const replacement = champions.get(r?.banImpact?.replacement?.championId ?? '')?.name;
  const threats = r?.blind?.threats.map(t => champions.get(t.championId)?.name ?? t.championId) ?? [];
  const opposition = r?.context?.parts.find(p => p.key === (r.role === 'SUPPORT' ? 'bot' : 'lane'));
  const poolTitle = isBan ? scouting?.riotId ?? (fr ? 'Non renseigné' : 'Not provided')
    : snapshot.draft.mode === 'solo' && r && snapshot.settings.pool[r.championId] ? `${fr ? 'Maîtrise déclarée' : 'Declared proficiency'} ${snapshot.settings.pool[r.championId]}/5`
    : players.length ? players.map(p => p.riotId).join(' · ') : (fr ? 'À confirmer' : 'Confirm with player');
  const poolText = isBan ? scouting ? scouting.games ? `${scouting.games} ${fr ? 'parties connues sur ce champion' : 'known games on this champion'}` : (fr ? 'Champion déclaré dans ce pool' : 'Champion declared in this pool') : (fr ? 'Aucun score OP.GG appliqué à ce ban' : 'No OP.GG score applied to this ban')
    : snapshot.draft.mode === 'solo' ? (r && snapshot.settings.pool[r.championId] ? (fr ? 'Champion présent dans votre pool personnel' : 'Champion recorded in your personal pool') : (fr ? 'Champion à renseigner dans votre pool personnel' : 'Record this champion in your personal pool'))
    : players.length ? (fr ? 'Champion présent dans le pool de ce rôle' : 'Champion recorded for this role') : team.players.length ? (fr ? 'Absent des pools renseignés pour ce rôle' : 'Not recorded in the pools for this role') : (fr ? 'Pool du joueur à renseigner' : 'Record the player’s pool');
  const matchupTitle = isBan && r?.banImpact ? `${fr ? 'Impact net' : 'Net impact'} ${r.banImpact.net > 0 ? '+' : ''}${r.banImpact.net}`
    : r?.role === 'SUPPORT' ? (bot.length === 2 ? bot.map(p => champions.get(p.championId ?? '')?.name).join(' + ') : (fr ? 'Duo adverse partiel' : 'Enemy duo incomplete'))
    : r?.blind ? (fr ? 'Vis-à-vis inconnu' : 'Opposing role unknown') : laneName ?? (fr ? 'Matchup à confirmer' : 'Confirm the matchup');
  const matchupText = isBan && r?.banImpact ? `${fr ? 'Remplacement' : 'Replacement'} : ${replacement ?? '—'} · ${actor === snapshot.draft.side ? (fr ? 'notre coût' : 'our cost') : (fr ? 'leur coût' : 'their cost')} ${r.banImpact.ownLoss}`
    : r?.blind ? threats.length ? `${fr ? 'Réponses à surveiller' : 'Responses to watch'} : ${threats.join(' / ')}` : (fr ? 'Aucun matchup exploitable parmi les réponses évaluées' : 'No usable matchup among the assessed responses')
    : opposition ? `${opposition.label} · ${opposition.score.toFixed(0)}/100` : (fr ? 'Vérifier les rôles et la composition adverse' : 'Check enemy roles and composition');
  return <section className={`face-explanation ${pending ? 'pending' : ''}`} data-testid="face-explanation" data-champion={r?.championId} aria-busy={pending}>
    <div className="face-explanation-heading"><h2>{c ? `${c.name} · ${isBan ? (fr ? 'Ce que ce ban change' : 'What this ban changes') : (fr ? 'Ce que ce pick change' : 'What this pick changes')}` : (fr ? 'Lecture de la draft' : 'Draft assessment')}</h2>
      {r && <span className={`face-confidence ${r.confidence < 20 ? 'limited' : ''}`}>{fr ? 'Fiabilité' : 'Reliability'} {r.confidence}%</span>}<button onClick={details} disabled={!r || pending}><CircleHelp size={17}/>{fr ? 'Détails des données' : 'Data details'}</button>
    </div>
    {r ? <div className="face-explanation-body"><Portrait champion={c} size="explanation"/>
      <div className="face-criterion face-plan" data-testid="face-plan"><Target size={27}/><div><h3>{isBan ? (actor === snapshot.draft.side ? (fr ? 'Notre coût' : 'Our cost') : (fr ? 'Leur coût' : 'Their cost')) : actor === snapshot.draft.side ? (fr ? 'Notre plan' : 'Our plan') : (fr ? 'Leur plan' : 'Their plan')}</h3><strong>{isBan && r.banImpact ? `${r.banImpact.ownLoss} ${fr ? 'points de coût' : 'cost points'}` : `${fr ? 'Apport au plan' : 'Plan contribution'} ${plan?.toFixed(0) ?? '—'}/100`}</strong><p title={gamePlan ?? traits}>{gamePlan ?? (traits || (fr ? 'Profil à confirmer' : 'Confirm the profile'))}</p></div></div>
      <div className="face-criterion face-matchup" data-testid="face-matchup"><AlertTriangle size={27}/><div><h3>{isBan ? (fr ? 'Conséquences du ban' : 'Ban consequences') : r.role === 'SUPPORT' ? (fr ? 'Duo et opposition' : 'Duo and opposition') : 'Matchup'}</h3><strong>{matchupTitle}</strong><p title={matchupText}>{matchupText}</p></div></div>
      <div className="face-criterion face-pool" data-testid="face-pool"><Users size={27}/><div><h3>{isBan ? (fr ? 'Pool ciblé · OP.GG' : 'Target pool · OP.GG') : (fr ? 'Pool du joueur' : 'Player pool')}</h3><strong title={poolTitle}>{poolTitle}</strong><p title={poolText}>{poolText}</p></div></div>
    </div> : <p className="face-empty-explanation">{pending ? (fr ? 'Analyse en cours…' : 'Analyzing…') : (fr ? 'Consultez les plans détaillés des deux compositions.' : 'Review the detailed plans for both compositions.')}</p>}
    {r?.lowSample && <p className="face-sample-alert"><AlertTriangle size={18}/>{fr ? `Échantillon insuffisant · ${r.games} parties · les statistiques de cet échantillon sont neutralisées.` : `Insufficient sample · ${r.games} games · statistics from this sample are neutralized.`}</p>}
  </section>;
}
