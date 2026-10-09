import type { EngineInput, Recommendation, SimulationApproach, SimulationBatch, SimulationBranch, SimulationPin, SimulationRequest, SimulationStep } from '../shared/types';
import { opposite, order, picks } from '../shared/draft';
import { validateSimulation } from '../shared/simulation';
import { banCandidates, draftBalance, rankCandidates } from './index';
import { gamePlan } from './gameplan';

export function simulationOptions(input:EngineInput,pins:SimulationPin[]):Recommendation[] {
  const index=input.draft.history.length, sequence=order(input.draft), action=sequence[index];
  if(!action)return [];
  const reserved=new Set(pins.filter(p=>p.index>index).flatMap(p=>p.selection.championId?[p.selection.championId]:[]));
  const roles=new Set(pins.filter(p=>p.index>index&&sequence[p.index]?.side===action.side&&sequence[p.index]?.kind==='pick').map(p=>p.selection.role));
  const restrict=action.kind==='pick'?input.draft.targetRole:'AUTO';
  const options=action.kind==='pick'?rankCandidates(input,action.side,restrict,true):banCandidates(input,action.side);
  return options.filter(r=>!reserved.has(r.championId)&&(action.kind==='ban'||!roles.has(r.role)));
}

/** Diverse, score-weighted local rollouts. Branch scores are indices, never win probabilities.
 * Memoized shared prefixes keep 48 branches practical without recursive analyze() calls.
 * Hard locks reserve future champions and roles; explicit coach choices may override known pools.
 */
export function simulateDrafts(input:EngineInput,request:SimulationRequest,progress?:(completed:number)=>void):SimulationBatch {
  const started=Date.now(), context=request.context??{settings:input.settings,teams:input.teams};
  input={...input,...context,draft:request.draft};
  validateSimulation(input.draft,request.pins,new Set(input.champions.map(c=>c.id)));
  const fr=input.settings.language==='fr', sequence=order(input.draft), locked=new Map(request.pins.map(p=>[p.index,p.selection]));
  const branches:SimulationBranch[]=[], fingerprints=new Set<string>(), memo=new Map<string,Recommendation[]>();
  let randomState=request.seed||1, attempts=0;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const warnings:string[]=[];
  if(!input.stats.length)warnings.push(fr?'Sans statistiques : profils qualitatifs uniquement.':'No statistics: qualitative profiles only.');
  if(input.demo)warnings.push(fr?'DONNÉES FICTIVES : démonstration uniquement.':'SYNTHETIC DATA: demonstration only.');
  if(!sequence.length)return {branches,requested:request.count,attempts,elapsedMs:Date.now()-started,generatedAt:new Date().toISOString(),context,warnings:[...warnings,fr?'La série est terminée.':'The series is finished.']};
  const maxAttempts=request.count===1?1:request.count*3;
  // Return partial branches when restrictions prevent completion, instead of fabricating a lineup.
  while(branches.length<request.count&&attempts<maxAttempts){
    const attempt=attempts++;
    const approach:SimulationApproach=request.approach&&request.approach!=='varied'?request.approach:(['balanced','engage','poke','tempo','scaling'] as const)[attempt%5];
    const affinity=(r:Recommendation)=>{
      const traits=input.champions.find(c=>c.id===r.championId)?.traits;
      if(!traits||approach==='balanced')return 0;
      // Mild qualitative preference among credible options; statistical scores remain unchanged.
      return (approach==='engage'?(traits.engage+traits.frontline)/2:approach==='poke'?traits.poke:approach==='tempo'?traits.early:traits.scaling)/3*4;
    };
    let state:EngineInput={...input,draft:{...input.draft,history:[...input.draft.history]}}, firstChoice=true;
    const steps:SimulationStep[]=[], branchWarnings:string[]=[];
    let blockedAt:number|undefined;
    while(state.draft.history.length<sequence.length){
      const index=state.draft.history.length,action=sequence[index], pin=locked.get(index);
      const key=JSON.stringify([state.draft.history,state.draft.targetRole]);
      let options:Recommendation[];
      // Explicit manual locks do not require scoring every available option.
      if(pin)options=[];
      else {
        options=memo.get(key)??simulationOptions(state,request.pins);
        if(memo.size<1200)memo.set(key,options);
      }
      let selection=pin, choice:Recommendation|undefined;
      if(!selection){
        if(!options.length){
          if(action.kind==='pick'){
            blockedAt=index;branchWarnings.push(fr?`${action.label} : aucun pick jouable avec les pools, rôles et verrouillages restants. Élargissez le pool ou modifiez vos choix.`:`${action.label}: no playable pick within remaining pools, roles and locks. Broaden the pool or change your choices.`);break;
          }
          selection={championId:null};
        }else{
          // Bans use measured consequences. Vary picks and opponent answers among credible options.
          const candidates=options.filter(r=>r.score>=options[0].score-8).slice(0,40).sort((a,b)=>action.kind==='ban'||action.side!==input.draft.side?b.score-a.score:(b.score+affinity(b))-(a.score+affinity(a))).slice(0,8);
          let selected=0;
          if(action.kind==='pick'&&attempt>0){
            if(firstChoice)selected=attempt%candidates.length;
            else {
              const weights=candidates.map(r=>Math.exp((r.score-candidates[0].score)/4));
              let draw=random()*weights.reduce((sum,w)=>sum+w,0);
              selected=weights.findIndex(w=>(draw-=w)<=0);if(selected<0)selected=0;
            }
          }
          if(action.kind==='pick')firstChoice=false;
          choice=candidates[selected];selection={championId:choice.championId,...(action.kind==='pick'?{role:choice.role}:{})};
        }
      }
      steps.push({index,selection,automatic:!pin,score:choice?.score??null,reasons:pin?[fr?'Choix imposé par le coach ; peut dépasser le pool connu.':'Coach choice; may override the known pool.']:choice?.reasons.slice(0,3)??[fr?'Aucun ban compatible restant.':'No compatible ban remains.']});
      state={...state,draft:{...state.draft,history:[...state.draft.history,selection],targetRole:'AUTO'}};
    }
    const fingerprint=JSON.stringify(state.draft.history);
    if(fingerprints.has(fingerprint))continue;
    fingerprints.add(fingerprint);
    const members=(side:EngineInput['draft']['side'])=>picks(state.draft,side), allies=members(state.draft.side),enemies=members(opposite(state.draft.side));
    const champions=(list:typeof allies)=>list.flatMap(p=>input.champions.find(c=>c.id===p.championId)??[]);
    const ally=champions(allies),enemy=champions(enemies);
    branches.push({history:state.draft.history,steps,approach,status:blockedAt===undefined?'complete':'blocked',blockedAt,warnings:branchWarnings,balance:draftBalance(state),plans:{
      ally:gamePlan(ally,allies.map(p=>p.role),enemy,enemies.map(p=>p.role),input.settings.language),
      enemy:gamePlan(enemy,enemies.map(p=>p.role),ally,allies.map(p=>p.role),input.settings.language)
    }});
    progress?.(branches.length);
    if(input.draft.history.length===sequence.length)break;
    // A fully forced draft has only one continuation; no need to repeat the same search.
    if(sequence.length-input.draft.history.length===locked.size)break;
  }
  if(branches.length<request.count)warnings.push(fr?`${branches.length}/${request.count} branches distinctes trouvées avec ces contraintes.`:`${branches.length}/${request.count} distinct branches found within these constraints.`);
  return {branches,requested:request.count,attempts,elapsedMs:Date.now()-started,generatedAt:new Date().toISOString(),context,warnings};
}
