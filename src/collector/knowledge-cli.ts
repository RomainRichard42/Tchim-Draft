import { mkdir,writeFile,rename } from 'node:fs/promises';
import { collectKnowledge } from './champion-knowledge';
async function main(){
 const data=await collectKnowledge('data/local/knowledge-cache',process.argv.includes('--force'),console.log,!process.argv.includes('--basic'));
 await mkdir('resources',{recursive:true});await writeFile('resources/champion-knowledge.json.tmp',JSON.stringify(data));await rename('resources/champion-knowledge.json.tmp','resources/champion-knowledge.json');
 console.log('KNOWLEDGE_PREPARED_LOCALLY',JSON.stringify({revision:data.revision,patches:data.patches.map(p=>({patch:p.patch,champions:p.kits.length,changes:p.changes.length,parameters:p.kits.filter(k=>k.parameterSource).length,warnings:p.warnings}))}));
}
void main().catch(error=>{console.error(String(error).slice(0,1000));process.exitCode=1;});
