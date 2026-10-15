import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createTestUsers,cleanupTestUsers,cloudRequest} from './cloud-integration-test.mjs';
import {sql,adminConfig} from './supabase-admin.mjs';
const check=(value,message)=>{if(!value)throw Error(message);};
const report={};
try{
 const before=await sql("select revision from public.draft_channels where name='stable'"),[a,b,admin,unapproved]=await createTestUsers(),id=randomUUID();
 const draft={mode:'pro',side:'blue',role:'MID',patch:'16.20',rank:'MASTER_PLUS',league:'all',history:[],targetRole:'AUTO',teamNames:{ally:'Feedback team',enemy:'Opponent'},series:{format:'single',games:[]}};
 const document={id,createdAt:new Date().toISOString(),championId:'Ahri',role:'MID',side:'blue',verdict:'good',reason:'comfort',note:'Private coach observation',teamKey:'private-team',matchId:null,draft,datasetRevision:before[0].revision};
 let response=await cloudRequest('/rest/v1/draft_coach_feedback',{id,author:a.id,document},a.headers);check(response.ok,'Coach feedback insert failed '+response.status);
 check((await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id+'&select=document',undefined,a.headers)).data?.length===1,'Own review missing');
 check((await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id+'&select=document',undefined,b.headers)).data?.length===0,'Another coach read private feedback');
 check((await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id+'&select=document',undefined,admin.headers)).data?.length===1,'Administrator cannot inspect feedback');
 const forged=randomUUID();check(!(await cloudRequest('/rest/v1/draft_coach_feedback',{id:forged,author:b.id,document:{...document,id:forged}},a.headers)).ok,'Author spoof was accepted');
 await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id,{document:{...document,note:'changed by another coach'}},b.headers,'PATCH');
 check((await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id+'&select=document',undefined,a.headers)).data?.[0].document.note===document.note,'Another coach edited private feedback');
 check(!(await cloudRequest('/rest/v1/draft_coach_feedback?select=id')).ok,'Anonymous feedback access');
 check((await cloudRequest('/rest/v1/draft_coach_feedback?select=id',undefined,unapproved.headers)).data?.length===0,'Unapproved user read feedback');
 check(!(await cloudRequest('/rest/v1/draft_pro_context',{revision:before[0].revision,context:{schema:1,datasetRevision:before[0].revision,games:{}}},a.headers)).ok,'Coach published source context');
 check(!(await cloudRequest('/rest/v1/rpc/draft_publish_with_context',{new_manifest:{revision:before[0].revision},expected_revision:before[0].revision,new_context:{schema:0}},a.headers)).ok,'Coach accessed publisher');
 const config=await adminConfig(),secret={apikey:config.SUPABASE_SECRET_KEY,'Content-Type':'application/json',...(config.SUPABASE_SECRET_KEY.startsWith('eyJ')?{Authorization:'Bearer '+config.SUPABASE_SECRET_KEY}:{})};
 check(!(await cloudRequest('/rest/v1/rpc/draft_publish_with_context',{new_manifest:{revision:before[0].revision},expected_revision:before[0].revision,new_context:{schema:0}},secret)).ok,'Invalid source context accepted');
 response=await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id,{document:{...document,deleted:true}},a.headers,'PATCH');check(response.ok,'Review deletion tombstone failed');
 check((await cloudRequest('/rest/v1/draft_coach_feedback?id=eq.'+id+'&select=document',undefined,a.headers)).data?.[0].document.deleted===true,'Deletion not synced');
 const after=await sql("select revision from public.draft_channels where name='stable'");check(before[0].revision===after[0].revision,'Shared statistics changed during tests');
 Object.assign(report,{privateRead:true,privateUpdate:true,adminRead:true,authorSpoofDenied:true,anonymousDenied:true,unapprovedDenied:true,sourcePublicationDenied:true,invalidContextDenied:true,tombstoneSynced:true,datasetUnchanged:true,revision:after[0].revision});
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/coaching-cloud-report.json',JSON.stringify(report,null,2));console.log('COACHING_CLOUD_OK',JSON.stringify(report));
}finally{await cleanupTestUsers();}
