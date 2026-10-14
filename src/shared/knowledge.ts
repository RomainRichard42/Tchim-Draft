import { z } from 'zod';
import { latestPatches } from './patches';

export const capabilityNames=['dash','hardCC','slow','heal','shield','magicDamage','physicalDamage','trueDamage','percentHealth','antiDash','spellShield','projectileBlock','projectile','unstoppable','antiHeal','shieldBreak','untargetable','invulnerable'] as const;
export type Capability=typeof capabilityNames[number];
export const sourceUrlSchema=z.string().url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['ddragon.leagueoflegends.com','www.leagueoflegends.com','raw.communitydragon.org'].includes(u.hostname);});
const text=z.string().max(12000),numbers=z.array(z.number().finite()).max(20);
const localized=z.object({fr:text,en:text}).strict();
export const abilitySchema=z.object({slot:z.enum(['P','Q','W','E','R']),key:z.string().max(100),name:localized,description:localized,tooltip:localized,cooldown:numbers,cost:numbers,range:numbers,resource:localized,effects:z.array(numbers.nullable()).max(100),variables:z.array(z.object({key:z.string().max(100),link:z.string().max(100),coeff:numbers})).max(100),parameters:z.record(numbers),capabilities:z.array(z.enum(capabilityNames)).max(30),unresolved:z.array(z.string().max(100)).max(100)}).strict();
export type Ability=z.infer<typeof abilitySchema>;
export const kitSchema=z.object({id:z.string().regex(/^[A-Za-z0-9]+$/),name:localized,key:z.number().int().positive(),stats:z.record(z.number().finite()),resource:localized,abilities:z.array(abilitySchema).length(5),source:sourceUrlSchema,parameterSource:sourceUrlSchema.optional()}).strict();
export type ChampionKit=z.infer<typeof kitSchema>;
export const changeSchema=z.object({id:z.string().max(150),championId:z.string().optional(),subject:z.string().max(150),kind:z.enum(['champion','item','system']),section:z.string().max(180),slot:z.enum(['P','Q','W','E','R','base','other']),hotfix:z.boolean(),label:z.string().max(300),before:text,after:text,direction:z.enum(['buff','nerf','mixed','unknown']),axis:z.enum(['damage','physicalDefense','magicDefense','durability','health','sustain','shield','cooldown','resource','mobility','control','attackSpeed','range','jungle','other']),magnitude:z.number().min(0).max(1),confidence:z.enum(['numeric','interpretation','unclassified']),source:sourceUrlSchema}).strict();
export type PatchChange=z.infer<typeof changeSchema>;
export const knowledgePatchSchema=z.object({patch:z.string().regex(/^\d{1,2}\.\d{1,2}$/),displayPatch:z.string().max(20),version:z.string().regex(/^\d{1,2}\.\d{1,2}\.\d+$/),fetchedAt:z.string().datetime(),notesUrl:sourceUrlSchema,notesAvailable:z.boolean(),kits:z.array(kitSchema).min(1).max(300),changes:z.array(changeSchema).max(2000),warnings:z.array(z.string().max(500)).max(100)}).strict();
export type KnowledgePatch=z.infer<typeof knowledgePatchSchema>;
export const knowledgeSchema=z.object({schema:z.literal(1),revision:z.string().regex(/^[a-f0-9]{64}$/),createdAt:z.string().datetime(),patches:z.array(knowledgePatchSchema).min(1).max(3)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.patches.map(p=>p.patch)).size!==data.patches.length)ctx.addIssue({code:'custom',message:'Duplicate knowledge patch'});
 for(const patch of data.patches){if(patch.version.split('.').slice(0,2).join('.')!==patch.patch)ctx.addIssue({code:'custom',message:'Mismatched kit version'});if(new Set(patch.kits.map(k=>k.id)).size!==patch.kits.length)ctx.addIssue({code:'custom',message:'Duplicate champion kit'});if(patch.changes.some(c=>c.championId&&!patch.kits.some(k=>k.id===c.championId)))ctx.addIssue({code:'custom',message:'Unknown changed champion'});}
});
export type KnowledgeDataset=z.infer<typeof knowledgeSchema>;
export interface KnowledgeSummary {revision:string;patches:string[];champions:number;changes:number;staged:boolean;message:string}
export interface KnowledgeState {dataset:KnowledgeDataset|null;staged:KnowledgeDataset|null;message:string;collecting:boolean;shared:boolean}
export interface KnowledgeEvidence {kind:'matchup'|'champion';groups:{source:string;games:number;winrate:number;baseline:number;supported:boolean}[];confidence:number;interval:[number,number]|null;patches:string[]}
export interface MetaForecast {championId:string;role:string;adjustment:number;games:number;confidence:number;ambiguous:boolean}
export function patchNumber(patch:string){const [a,b]=patch.split('.').map(Number);return Number.isFinite(a)&&Number.isFinite(b)?a*100+b:0;}
export function knowledgePatch(data:KnowledgeDataset|undefined,patch:string):KnowledgePatch|undefined{return data?.patches.find(p=>p.patch===patch);}
const indexes=new WeakMap<KnowledgeDataset,Map<string,Map<string,ChampionKit>>>();
export function championKit(data:KnowledgeDataset|undefined,id:string,patch:string){if(!data)return;let index=indexes.get(data);if(!index){index=new Map(data.patches.map(p=>[p.patch,new Map(p.kits.map(k=>[k.id,k]))]));indexes.set(data,index);}return index.get(patch)?.get(id);}
export function knowledgeSummary(data:KnowledgeDataset|undefined,staged:boolean,message:string):KnowledgeSummary|undefined{return data?{revision:data.revision,patches:latestPatches(data.patches.map(p=>p.patch)),champions:data.patches[0].kits.length,changes:data.patches.reduce((n,p)=>n+p.changes.length,0),staged,message}:undefined;}
