import {randomUUID} from 'node:crypto';
import {createTestUsers,cleanupTestUsers,cloudRequest,completedDraft} from './cloud-integration-test.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
function check(value,message){if(!value)throw new Error(message);}
try{
 const [a,b,admin,unapproved]=await createTestUsers();
 const draft={...completedDraft(),history:[],series:{format:'bo3',fearless:false,games:[]}};
 const team={url:'',region:'euw',players:[],poolOnly:false,message:''};
 const document={name:'Ephemeral preparation test',kind:'scrim',draft,teams:{ally:team,enemy:team},archived:false,results:[]},id=randomUUID();
 const writeHeaders={...a.headers,Prefer:'return=representation'};
 const created=await cloudRequest('/rest/v1/draft_preparations',{id,author:a.id,document},writeHeaders);check(created.ok&&created.data[0].revision===1,'Create preparation');
 for(const [user,count] of [[a,1],[b,0],[admin,1],[unapproved,0]]){const read=await cloudRequest('/rest/v1/draft_preparations?id=eq.'+id,undefined,user.headers);check(read.ok&&read.data.length===count,'Read privacy '+user.role);}
 const anonymous=await cloudRequest('/rest/v1/draft_preparations?id=eq.'+id);check(anonymous.status===401,'Anonymous denied');
 for(const user of [b,admin]){const denied=await cloudRequest('/rest/v1/draft_preparations?id=eq.'+id,{document:{...document,name:'Must not overwrite'}},{...user.headers,Prefer:'return=representation'},'PATCH');check(denied.ok&&denied.data.length===0,'Another user cannot edit');}
 const badOwner=await cloudRequest('/rest/v1/draft_preparations',{id:randomUUID(),author:b.id,document},a.headers);check(!badOwner.ok,'Owner impersonation denied');
 const updated=await cloudRequest('/rest/v1/draft_preparations?id=eq.'+id+'&revision=eq.1',{document:{...document,name:'Updated'}},writeHeaders,'PATCH');check(updated.ok&&updated.data[0].revision===2,'Version increment');
 const stale=await cloudRequest('/rest/v1/draft_preparations?id=eq.'+id+'&revision=eq.1',{document},writeHeaders,'PATCH');check(stale.ok&&stale.data.length===0,'Stale edit cannot overwrite');
 const malformed=await cloudRequest('/rest/v1/draft_preparations',{id:randomUUID(),author:a.id,document:{...document,draft:{...draft,history:Array(21).fill({championId:null})}}},a.headers);check(!malformed.ok,'Invalid preparation rejected');
 await mkdir('artifacts',{recursive:true});const report={creation:true,ownOnly:true,adminReadOnly:true,anonymousDenied:true,unapprovedDenied:true,ownerImpersonationDenied:true,conflictGuard:true,invalidDraftDenied:true};await writeFile('artifacts/matches-cloud-report.json',JSON.stringify(report,null,2));console.log('MATCH_PRIVACY_OK',JSON.stringify(report));
}finally{await cleanupTestUsers();}
