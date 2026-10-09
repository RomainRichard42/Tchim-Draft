import type { Draft, SimulationPin } from './types';
import { fearlessUsed, order } from './draft';
import { validateDraft } from './series';

/** Validate the whole constraint set, including future reservations, before starting a search. */
export function validateSimulation(draft:Draft,pins:SimulationPin[],known:Set<string>):void {
  validateDraft(draft,known);
  const sequence=order(draft), indices=new Set<number>(), reserved=new Map<string,{kind:string;side:string}[]>(), roles=new Set<string>();
  const add=(index:number,selection:SimulationPin['selection'])=>{
    const action=sequence[index];
    if(!action)throw new Error('Étape hors de la draft / Step outside draft');
    if(action.kind==='pick'&&(!selection.championId||!selection.role))throw new Error('Un pick nécessite un champion et un rôle / Pick requires champion and role');
    if(action.kind==='ban'&&selection.role)throw new Error('Un ban ne porte pas de rôle / Ban has no role');
    if(selection.championId){
      if(!known.has(selection.championId))throw new Error('Champion inconnu / Unknown champion');
      if(fearlessUsed(draft).has(selection.championId))throw new Error('Champion indisponible en Fearless / Fearless champion unavailable');
      const previous=reserved.get(selection.championId)??[];
      if(previous.some(p=>!(draft.mode==='solo'&&action.kind==='ban'&&p.kind==='ban'&&p.side!==action.side)))throw new Error('Champion déjà utilisé ou réservé / Champion already used or reserved');
      reserved.set(selection.championId,[...previous,action]);
    }
    if(action.kind==='pick'){
      const key=`${action.side}:${selection.role}`;
      if(roles.has(key))throw new Error('Rôle déjà pris ou réservé dans cette équipe / Team role already occupied or reserved');
      roles.add(key);
    }
  };
  draft.history.forEach((selection,index)=>add(index,selection));
  for(const pin of pins){
    if(!Number.isInteger(pin.index)||pin.index<draft.history.length||indices.has(pin.index))throw new Error('Verrouillage invalide ou sur la draft réelle / Invalid lock or live draft step');
    indices.add(pin.index); add(pin.index,pin.selection);
  }
}
