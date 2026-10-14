import type { Champion, Mechanics, Role } from '../shared/types';

// These are qualitative descriptions of kits, not measured match statistics.
const sets={
 range:'Caitlyn Ashe Varus Jhin Jinx KogMaw Senna Xerath Velkoz Ziggs Lux Jayce Azir Orianna Hwei Seraphine',
 control:'Nautilus Leona Rell Alistar Braum Maokai Sejuani Lissandra Malzahar Annie TwistedFate Poppy Vi',
 waveclear:'Sivir Xayah Ziggs Hwei Viktor Orianna Anivia Azir Taliyah Malzahar AurelionSol Ahri Seraphine Smolder',
 access:'Camille Vi Nocturne JarvanIV Wukong Diana Rakan Rell Malphite Akali Irelia Renekton Kaisa Yone',
 disengage:'Janna Milio Lulu Braum Alistar Poppy Renata Gragas TahmKench Nami Tristana Xayah',
 sustained:'Jinx KogMaw Vayne Kaisa Xayah Aphelios Zeri Sivir Cassiopeia Azir Ryze Gwen Fiora Trundle',
 mobility:'Ezreal Zeri Kaisa Lucian Kalista Akali Ahri Leblanc Camille Fiora Irelia Yone Rakan LeeSin',
 demand:'Azir Aphelios Kalista Nidalee Jayce Riven Yasuo Yone Irelia Akali Draven Gangplank'
};
const membership=Object.fromEntries(Object.entries(sets).map(([key,ids])=>[key,new Set(ids.split(' '))])) as Record<keyof typeof sets,Set<string>>;
export function mechanics(c:Champion,role:Role):Mechanics {
 const t=c.traits,known=Object.values(membership).some(set=>set.has(c.id));
 return {range:membership.range.has(c.id)?3:Math.min(2,t.poke),control:membership.control.has(c.id)?3:Math.min(2,t.engage),
  waveclear:membership.waveclear.has(c.id)?3:1,
  access:membership.access.has(c.id)?3:Math.min(2,t.engage),disengage:membership.disengage.has(c.id)?3:Math.min(2,t.peel),
  sustained:membership.sustained.has(c.id)?3:role==='ADC'?2:1,mobility:membership.mobility.has(c.id)?3:1,
  demand:membership.demand.has(c.id)?3:1.5,provenance:known&&c.curated?'curated':'generic'};
}
