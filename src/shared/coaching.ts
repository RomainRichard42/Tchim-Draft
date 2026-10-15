import {z} from 'zod';
import type {Draft,Role,Side} from './types';
export type ProFormat='standard'|'fearless'|'unknown';
export type ProView='auto'|'standard'|'fearless'|'opening'|'all';
export interface ProGameContext {seriesId:string;index:number;gameIds:string[];format:ProFormat;source:string}
export interface ProRule {format:Exclude<ProFormat,'unknown'>;source:string}
export interface MetaChampion {championId:string;games:number;wins:number;exposure:number;unknownExposure:number;picks:number;bans:number;presence:number;previousPresence:number|null;trend:number|null;rawWinrate:number|null;adjustedEdge:number;confidence:number;roles:{role:Role;games:number}[];firstPicks:number;blindPicks:number;earlyPicks:number;orderGames:number;status:'observed'|'emerging'|'limited'}
export interface CoachingMeta {requested:ProView;effective:Exclude<ProView,'auto'>;format:ProFormat;patches:string[];games:number;currentGames:number;knownFormats:{standard:number;fearless:number;unknown:number};excluded:number;incompleteSeries:number;teamCoverage:number;correctedGames:number;leagueCounts:Record<string,number>;warnings:string[];champions:MetaChampion[]}
export type DutyKind='priority'|'jungle'|'engage'|'follow'|'protect'|'side';
export interface CompositionDuty {kind:DutyKind;championId:string|null;role:Role|null;backup:string|null;instruction:string;condition:string;missing:boolean}
export interface CoachFeedback {author?:string;id:string;createdAt:string;championId:string;role:Role;side:Side;verdict:'good'|'unplayable'|'bad-matchup';reason:'comfort'|'lane'|'composition'|'execution'|'other';note:string;teamKey:string;matchId:string|null;draft:Draft;datasetRevision:string;pending?:boolean;deleted?:boolean}
export interface FeedbackRequest {draftKey:string;championId:string;role:Role;side:Side;verdict:CoachFeedback['verdict'];reason:CoachFeedback['reason'];note:string}
export interface FeedbackState {entries:CoachFeedback[];syncing:boolean;message:string;shared:boolean}
export interface CoachAdjustment {value:number;observations:number}
export const feedbackRequestSchema=z.object({draftKey:z.string().max(30000),championId:z.string().regex(/^[A-Za-z0-9_]+$/).max(80),role:z.enum(['TOP','JUNGLE','MID','ADC','SUPPORT']),side:z.enum(['blue','red']),verdict:z.enum(['good','unplayable','bad-matchup']),reason:z.enum(['comfort','lane','composition','execution','other']),note:z.string().trim().max(600)}).strict();
export function feedbackDraftKey(draft:Draft,matchId?:string,actor?:string,revision?:string){return JSON.stringify([draft,matchId??null,actor??'',revision??'']);}
const proContextEntrySchema=z.object({seriesId:z.string().min(1).max(100),index:z.number().int().min(1).max(7),gameIds:z.array(z.string().min(1).max(100)).min(1).max(7),format:z.enum(['standard','fearless','unknown']),source:z.string().url().max(1000).refine(value=>new URL(value).protocol==='https:')}).strict().refine(row=>row.index<=row.gameIds.length&&new Set(row.gameIds).size===row.gameIds.length);
export const proContextSchema=z.object({schema:z.literal(1),datasetRevision:z.string().regex(/^[a-f0-9]{64}$/).optional(),games:z.record(z.string().min(1).max(100),proContextEntrySchema).refine(rows=>Object.keys(rows).length<=20000),tournaments:z.record(z.string().max(150),z.object({format:z.enum(['standard','fearless','unknown']),source:z.string().url().max(1000)}).strict()).optional()}).strict().refine(context=>Object.entries(context.games).every(([id,row])=>row.gameIds[row.index-1]===id),'Game/series index mismatch');
