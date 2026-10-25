import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import { knowledgeSchema,championKit } from '../src/shared/knowledge';
import { classifyChange,parsePatchNotes } from '../src/collector/patch-notes';
import { detectCapabilities,enrichKitParameters } from '../src/collector/champion-knowledge';
import { changeImplications,kitInteractions,relevantChanges } from '../src/engine/kit-matchups';
import {patchPrior} from '../src/engine/patch-prior';
import { evaluateMatch, members } from '../src/engine/evaluation';
import { DEFAULT_SETTINGS,SEED_CHAMPIONS } from '../src/shared/champions';
import { newDraft } from '../src/shared/draft';
import type { EngineInput,Stat } from '../src/shared/types';
const liveData=knowledgeSchema.parse(JSON.parse(readFileSync('resources/champion-knowledge.json','utf8')));
// Frozen 16.20 scenarios must not silently test a different patch after a data refresh.
const data=knowledgeSchema.parse(JSON.parse(readFileSync('tests/fixtures/knowledge-16.20.json','utf8')));
const kit=(id:string)=>championKit(data,id,'16.20')!;
const row=(patch:string,source:'pro'|'solo'):Stat=>({championId:'Swain',role:'MID',patch,source,rank:source==='pro'?'all':'MASTER_PLUS',league:'all',side:'all',games:1000,wins:500,pickRate:.1,banRate:.1,baseline:.5});
const input=():EngineInput=>({draft:{...newDraft('16.20'),mode:'pro'},settings:DEFAULT_SETTINGS,champions:SEED_CHAMPIONS,stats:[row('16.18','pro'),row('16.20','solo')],pairs:[],knowledge:data,demo:false});
describe('versioned champion facts',()=>{
 it('contains complete bilingual kits and base statistics for three distinct live patches',()=>{expect(liveData.patches).toHaveLength(3);for(const patch of liveData.patches){expect(patch.kits.length).toBeGreaterThanOrEqual(SEED_CHAMPIONS.length);for(const c of patch.kits){expect(c.abilities.map(a=>a.slot)).toEqual(['P','Q','W','E','R']);expect(c.stats.hp).toBeGreaterThan(0);expect(c.abilities.every(a=>a.description.fr&&a.description.en)).toBe(true);}}const current=liveData.patches[0],ahri=championKit(liveData,'Ahri',current.patch)!;expect(ahri.parameterSource).toContain('/'+current.patch+'/');expect(ahri.abilities.find(a=>a.slot==='Q')!.parameters.BaseDamage).toBeDefined();});
 it('refuses mislabeled versions and duplicate champion identities',()=>{const copy=structuredClone(data);copy.patches[0].version='16.19.1';expect(knowledgeSchema.safeParse(copy).success).toBe(false);copy.patches[0].version=data.patches[0].version;copy.patches[0].kits[1]=copy.patches[0].kits[0];expect(knowledgeSchema.safeParse(copy).success).toBe(false);});
 it('does not label shield breaking as its own shield or spell shields as ordinary shields',()=>{expect(detectCapabilities('Renekton','W','Destroys the enemy shields.')).toContain('shieldBreak');expect(detectCapabilities('Renekton','W','Destroys the enemy shields.')).not.toContain('shield');expect(detectCapabilities('Sivir','E','Creates a spell shield.')).not.toContain('shield');expect(detectCapabilities('Katarina','R','Applies Grievous Wounds reducing healing.')).not.toContain('heal');});
 it('retains named client parameters without guessing a damage formula or a rank offset',()=>{const c=structuredClone(kit('Ahri'));enrichKitParameters(c,{'Characters/Ahri/Spells/AhriQ':{mSpell:{DataValues:[{name:'BaseDamage',values:[0,40,65,90,115,140]}]}}},'https://raw.communitydragon.org/16.20/game/data/characters/ahri/ahri.bin.json');expect(c.abilities.find(a=>a.slot==='Q')!.parameters.BaseDamage).toEqual([0,40,65,90,115,140]);});
});
describe('Riot patch notes',()=>{
 it('separates armor, magic resistance, cooldown, damage reduction and resource costs',()=>{expect(classifyChange('Base Armor','25','23').direction).toBe('nerf');expect(classifyChange('Base Magic Resistance','31','34').axis).toBe('magicDefense');expect(classifyChange('Cooldown','22 / 21 / 20 / 19 / 18s','20 / 19 / 18 / 17 / 16s').direction).toBe('buff');expect(classifyChange('Damage Reduction','30%','45%').axis).toBe('durability');expect(classifyChange('Mana Cost','30','40').direction).toBe('nerf');expect(classifyChange('Slow stacking','stacks','does not stack').direction).toBe('unknown');expect(classifyChange('Health per 5','4 + .5/Level','5.5 + .4/Level').direction).toBe('mixed');});
 it('understands a ranked cost changed to one constant value',()=>{expect(classifyChange('Mana Cost','46 / 42 / 38 / 34 / 30','30').direction).toBe('buff');});
 it('excludes Classic and ARAM and preserves a hotfix instead of blending two game modes',()=>{const html='<h1>League of Legends Patch 26.20 Notes</h1><h2>Mid-Patch Updates</h2><h3>Swain</h3><h4>Base Stats</h4><ul><li>Base Armor: 25 ⇒ 22</li></ul><h2>Champions</h2><h3>Swain</h3><h4>Base Stats</h4><ul><li>Base Armor: 25 ⇒ 23</li></ul><h2>Classic</h2><h3>Swain</h3><ul><li>Damage Taken: 105% ⇒ 100%</li></ul><h2>ARAM</h2><h3>Swain</h3><ul><li>Damage Taken: 105% ⇒ 90%</li></ul>';const changes=parsePatchNotes(html,'16.20',[kit('Swain')],data.patches[0].notesUrl);expect(changes).toHaveLength(2);expect(changes[0].hotfix).toBe(true);const copy=structuredClone(data);copy.patches[0].changes=changes;expect(relevantChanges(copy,'Swain','16.20')[0].after).toBe('22');});
 it('fails closed when a patch page or HTML structure is not the requested version',()=>{expect(()=>parsePatchNotes('<h1>Patch 26.19</h1>','16.20',[kit('Swain')],data.patches[0].notesUrl)).toThrow(/version/);expect(()=>parsePatchNotes('<h1>Patch 26.20</h1>','16.20',[kit('Swain')],data.patches[0].notesUrl)).toThrow(/structure/);});
});
describe('conditional matchup and patch effects',()=>{
 it('connects Poppy W to a dash and keeps an explicit condition instead of declaring a hard counter',()=>{const edge=kitInteractions(kit('Poppy'),kit('Camille')).find(e=>e.kind==='antiDash');expect(edge).toBeDefined();expect(edge?.fromSlot).toBe('W');expect(edge?.condition).toContain('imparables');});
 it('does not make a wind wall block every spell: Ahri projectile yes, Lux beam no',()=>{expect(kitInteractions(kit('Yasuo'),kit('Ahri')).some(e=>e.kind==='projectileBlock')).toBe(true);const lux=structuredClone(kit('Lux'));lux.abilities= lux.abilities.filter(a=>a.slot==='R') as typeof lux.abilities;expect(kitInteractions(kit('Yasuo'),lux).some(e=>e.kind==='projectileBlock')).toBe(false);});
 it('does not apply a patch buff twice when both statistical sources already cover it',()=>{const state=input();state.stats=[row('16.20','pro'),row('16.20','solo')];expect(patchPrior(state,'Swain','MID').value).toBe(0);});
 it('does not let another champion or role mark this champion’s patch changes as absorbed',()=>{
  const state=input(),copy=structuredClone(data);
  copy.patches[0].changes=[{...copy.patches[0].changes[0],championId:'Swain',direction:'buff',axis:'damage',magnitude:.2}];state.knowledge=copy;
  state.stats=[row('16.18','pro'),{...row('16.20','pro'),championId:'Ahri'},{...row('16.20','pro'),role:'SUPPORT'}];
  expect(patchPrior(state,'Swain','MID').value).toBeGreaterThan(0);
  state.stats=[...state.stats,row('16.20','pro')];expect(patchPrior(state,'Swain','MID').value).toBe(0);
 });
 it('evaluates the exact same hypothetical picks, abilities and patch context through either entry point',()=>{
  const state=input();state.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Ahri',role:'MID'},{championId:'Tristana',role:'ADC'},{championId:'LeeSin',role:'JUNGLE'}];
  const lineups={blue:[...members(state,'blue'),{champion:state.champions.find(c=>c.id==='Poppy')!,role:'TOP' as const}],red:members(state,'red')};
  const hypothetical=evaluateMatch(state,lineups);
  state.draft.history.push({championId:'Poppy',role:'TOP'});
  expect(hypothetical).toEqual(evaluateMatch(state));
  expect(hypothetical.reasons.some(r=>r.includes('Interactions de sorts'))).toBe(true);
 });
 it('uses a bounded prior only for lagging sources and never for a future or missing kit patch',()=>{const state=input(),value=patchPrior(state,'Swain','MID');expect(value.unseenShare).toBeLessThanOrEqual(.55);expect(Math.abs(value.value)).toBeLessThanOrEqual(2);state.draft.patch='16.18';expect(patchPrior(state,'Swain','MID').value).toBe(0);state.draft.patch='16.17';expect(patchPrior(state,'Swain','MID').value).toBe(0);});
 it('limits a monster buff to jungle and explains that magic resistance does not stop true damage',()=>{const state=input();expect(patchPrior(state,'Kindred','ADC').changes.some(c=>c.axis==='jungle')).toBe(false);const mr=data.patches[0].changes.find(c=>c.championId==='Swain'&&c.axis==='magicDefense')!;expect(changeImplications(mr,kit('Ahri')).join(' ')).toContain('dégâts bruts');});
 it('changes the patch interpretation with the revealed damage type instead of treating MR as universally useful',()=>{const state=input(),copy=structuredClone(data),magic=copy.patches[0].kits.find(k=>k.id==='Ahri')!;for(const ability of magic.abilities)ability.capabilities=['magicDamage'];const physical=copy.patches[0].kits.find(k=>k.id==='Riven')!;for(const ability of physical.abilities)ability.capabilities=['physicalDamage'];copy.patches[0].changes=copy.patches[0].changes.filter(c=>c.championId==='Swain'&&c.axis==='magicDefense');state.knowledge=copy;state.draft.history=[...Array.from({length:6},()=>({championId:null})),{championId:'Swain',role:'MID'},{championId:'Ahri',role:'MID'}];const ap=patchPrior(state,'Swain','MID').value;state.draft.history[7]={championId:'Riven',role:'MID'};expect(patchPrior(state,'Swain','MID').value).toBeLessThan(ap);});
});
