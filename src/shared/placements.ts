import type { Draft, Role, Selection, Side } from './types';
import { order } from './draft';

export interface RoleChange { championId:string; role:Role }

/** Changes seats, never the pick order, bans or the opposing team. */
export function applyRoleChanges(draft:Draft,side:Side,changes:RoleChange[]=[]):Draft {
 const roles=new Map(changes.map(p=>[p.championId,p.role])),sequence=order(draft);
 return {...draft,history:draft.history.map((p,index)=>{
  const role=p.championId&&roles.get(p.championId);
  if(!role||p.role===role||sequence[index]?.side!==side||sequence[index]?.kind!=='pick')return p;
  if(p.roleLocked)throw Error('Rôle verrouillé / Locked role');
  return {...p,role};
 })};
}

export function appendWithRoleChanges(draft:Draft,selection:Selection,changes:RoleChange[]=[]):Draft {
 const action=order(draft)[draft.history.length];
 if(!action)throw Error('Draft is complete');
 const previousRoles=action.kind==='pick'?draft.history.flatMap((p,index)=>p.championId&&p.role&&order(draft)[index]?.side===action.side&&changes.some(c=>c.championId===p.championId&&c.role!==p.role)?[{championId:p.championId,role:p.role}]:[]):[];
 const state=action.kind==='pick'?applyRoleChanges(draft,action.side,changes):draft;
 const {previousRoles:ignored,...clean}=selection;
 return {...state,targetRole:'AUTO',history:[...state.history,{...clean,...(previousRoles.length?{previousRoles}:{})}]};
}

/** Undo restores the seats before each removed decision as well as its pick. */
export function rewindDraft(draft:Draft,to:number):Draft {
 let history=[...draft.history];const sequence=order(draft);
 while(history.length>to){
  const at=history.length-1,removed=history.pop()!,restore=new Map(removed.previousRoles?.map(p=>[p.championId,p.role]));
  history=history.map((p,index)=>p.championId&&restore.has(p.championId)&&sequence[index]?.side===sequence[at]?.side?{...p,role:restore.get(p.championId)!}:p);
 }
 return {...draft,history};
}
