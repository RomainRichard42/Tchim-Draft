import type {EngineInput,Role,Selection} from '../shared/types';
import {freeRoles,order,picks} from '../shared/draft';
import {teamAssignments} from './assignments';
import {appendWithRoleChanges,type RoleChange} from '../shared/placements';

/** Committing a decision checks legality, never recomputes recommendation scores. */
export function commitSelection(input:EngineInput,selection:Selection,preferred?:RoleChange[]){
 const action=order(input.draft)[input.draft.history.length];
 if(!action)throw Error('Draft is complete');
 if(action.kind==='ban')return appendWithRoleChanges(input.draft,{championId:selection.championId});
 if(!selection.championId||!selection.role)throw Error('Choose a role');
 if(freeRoles(input.draft,action.side).includes(selection.role)&&!preferred?.length)return appendWithRoleChanges(input.draft,selection);
 // Role feasibility needs champion/role evidence, not hundreds of thousands of matchups.
 const current=picks(input.draft,action.side),placements=teamAssignments({...input,pairs:[]},action.side);
 const choices=placements.filter(rows=>!rows.some(p=>p.role===selection.role)).map(rows=>rows.filter(p=>p.role!==current.find(c=>c.championId===p.championId)?.role).map(p=>({championId:p.championId!,role:p.role!})));
 const same=(a:RoleChange[],b:RoleChange[])=>a.length===b.length&&a.every(p=>b.some(q=>p.championId===q.championId&&p.role===q.role));
 const changes=choices.find(c=>preferred&&same(c,preferred))??choices.sort((a,b)=>a.length-b.length||JSON.stringify(a).localeCompare(JSON.stringify(b)))[0];
 if(!changes)throw Error('Ce rôle ne peut pas être libéré avec les flexs et pools connus / No feasible flex assignment for this role');
 return appendWithRoleChanges(input.draft,selection,changes);
}
