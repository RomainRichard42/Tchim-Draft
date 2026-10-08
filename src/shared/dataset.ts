import { z } from 'zod';
import { ROLES } from './types';

const id = z.string().regex(/^[A-Za-z0-9_]+$/).max(80);
const trait = z.number().finite().min(0).max(5);
export const publicChampionSchema = z.object({
  id, key: z.number().int().positive(), name: z.string().min(1).max(100),
  roles: z.array(z.enum(ROLES)).max(5), tags: z.array(z.string().max(50)).max(10), curated: z.boolean(),
  traits: z.object({ ad: trait, frontline: trait, engage: trait, peel: trait, poke: trait, scaling: trait, early: trait }).strict()
}).strict();
export const datasetSchema = z.object({
  schemaVersion: z.literal(2), kind: z.literal('tchim-dataset'),
  revision: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.string().datetime(),
  staticVersion: z.string().regex(/^\d{1,2}\.\d{1,2}\.\d{1,3}$/),
  champions: z.array(publicChampionSchema).min(100).max(300),
  coverage: z.array(z.object({source:z.enum(['solo','pro']),patches:z.array(z.string().regex(/^\d{1,2}\.\d{1,2}$/)).max(3),stats:z.number().int().nonnegative(),pairs:z.number().int().nonnegative(),games:z.number().int().nonnegative()}).strict()).length(2),
  parts: z.array(z.object({
    id: z.string().regex(/^shared-[a-z0-9.-]+$/).max(100), sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(64*1024*1024),
    stats: z.number().int().min(0).max(100000), pairs: z.number().int().min(0).max(100000), games: z.number().int().min(0).max(20000)
  }).strict()).min(1).max(100)
}).strict().refine(m=>new Set(m.parts.map(p=>p.id)).size===m.parts.length&&new Set(m.champions.map(c=>c.id)).size===m.champions.length,'Duplicate dataset entries');
export type DatasetManifest = z.infer<typeof datasetSchema>;
