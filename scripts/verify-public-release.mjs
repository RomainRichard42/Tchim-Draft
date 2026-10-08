import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const config=JSON.parse(await readFile('resources/distribution.json','utf8')),pkg=JSON.parse(await readFile('package.json','utf8'));
const repository=`${config.owner}/${config.repo}`,base=`https://github.com/${repository}/releases/latest/download/`;
async function get(url,maxBytes){
  // Deliberately no GitHub CLI, token, Authorization header or cookie.
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  const final=new URL(response.url);if(final.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(final.hostname))throw Error('Unexpected release host');
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw Error('Release size exceeded');chunks.push(chunk);}return Buffer.concat(chunks);
}
const metadata=await get(`${base}latest.yml`,10000),text=metadata.toString('utf8');
const version=/^version: (.+)$/m.exec(text)?.[1],filename=/^path: (.+)$/m.exec(text)?.[1],checksum=/^sha512: (.+)$/m.exec(text)?.[1];
if(version!==pkg.version||filename!==`Tchim-Draft-${pkg.version}-win-x64.exe`||!checksum)throw Error('Unexpected release metadata');
const installer=await get(`${base}${filename}`,160*1024*1024),sha512=createHash('sha512').update(installer).digest('base64'),sha256=createHash('sha256').update(installer).digest('hex');
if(sha512!==checksum)throw Error('Published installer checksum mismatch');
const directory=path.resolve('release',pkg.version,'github');await mkdir(directory,{recursive:true});await writeFile(path.join(directory,filename),installer);await writeFile(path.join(directory,'latest.yml'),metadata);
await mkdir('artifacts',{recursive:true});const report={repository,version,url:`${base}${filename}`,withoutAuthentication:true,size:installer.length,sha256,sha512,metadataChecksumMatches:true};await writeFile('artifacts/public-release-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
