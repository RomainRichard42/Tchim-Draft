/** A competition scope, not a claim that its leagues have equal strength. */
export const COACH_PRO_LEAGUES = ['LFL','EMEA MASTERS','LCK','LPL','LCS','LEC','WORLDS'] as const;
export type CoachProLeague = typeof COACH_PRO_LEAGUES[number];

export function coachProLeague(tournament:string):CoachProLeague|null {
  const name=tournament.normalize('NFKC').replace(/\s+/g,' ').trim();
  if(/^(?:EMEA|EU) Masters\s+20\d{2}\b/i.test(name))return 'EMEA MASTERS';
  if(/^(?:Worlds|World Championship)\s+20\d{2}\b/i.test(name))return 'WORLDS';
  if(/^LTA North\s+20\d{2}\b/i.test(name))return 'LCS';
  if(/^LCK Cup\s+20\d{2}\b/i.test(name))return 'LCK';
  for(const league of ['LFL','LCK','LPL','LCS','LEC'] as const)if(new RegExp(`^${league}\\s+20\\d{2}\\b`,'i').test(name))return league;
  return null;
}
