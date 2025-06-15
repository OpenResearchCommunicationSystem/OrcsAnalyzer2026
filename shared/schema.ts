import { z } from "zod";

// File types
export const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum(['txt', 'csv', 'orcs_card', 'metadata']),
  size: z.number(),
  created: z.string(),
  modified: z.string(),
});

export const insertFileSchema = fileSchema.omit({ id: true });

export type File = z.infer<typeof fileSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;

// Tag types
export const tagTypeSchema = z.enum(['entity', 'relationship', 'attribute', 'comment', 'kv_pair']);

export const tagSchema = z.object({
  id: z.string(), // UUID
  type: tagTypeSchema,
  entityType: z.string().optional(), // Subtype within the tag category (e.g., "person", "organization" for entities)
  name: z.string(),
  reference: z.string(), // filename@start-end or filename[row,col]
  aliases: z.array(z.string()).default([]),
  keyValuePairs: z.record(z.string()).default({}),
  description: z.string().optional(),
  created: z.string(),
  modified: z.string(),
});

export const insertTagSchema = tagSchema.omit({ id: true, created: true, modified: true });

export type Tag = z.infer<typeof tagSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type TagType = z.infer<typeof tagTypeSchema>;

// ORCS Card structure
export const orcsCardSchema = z.object({
  id: z.string(), // UUID
  title: z.string(),
  source: z.string(),
  sourceHash: z.string(),
  citation: z.string(),
  classification: z.string().default('Proprietary Information'),
  handling: z.array(z.string()).default(['Copyright 2025 TechWatch Intelligence', 'Distribution: Internal Use Only']),
  created: z.string(),
  modified: z.string(),
  content: z.string(),
  keyValuePairs: z.record(z.string()).default({}),
  tags: z.array(z.string()).default([]), // Tag IDs
});

export const insertOrcsCardSchema = orcsCardSchema.omit({ id: true, created: true, modified: true });

export type OrcsCard = z.infer<typeof orcsCardSchema>;
export type InsertOrcsCard = z.infer<typeof insertOrcsCardSchema>;

// Graph data
export const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: tagTypeSchema,
  x: z.number().optional(),
  y: z.number().optional(),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  type: z.enum(['relationship', 'attribute']),
});

export const graphDataSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphData = z.infer<typeof graphDataSchema>;

// Text selection for tagging
export const textSelectionSchema = z.object({
  text: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
  filename: z.string(),
  reference: z.string(),
});

export type TextSelection = z.infer<typeof textSelectionSchema>;

// Stats schema for directory statistics
export const statsSchema = z.object({
  totalFiles: z.number(),
  totalTags: z.number(),
  tagCounts: z.record(z.string(), z.number()),
});

export type Stats = z.infer<typeof statsSchema>;
