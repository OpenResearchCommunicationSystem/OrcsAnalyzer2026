import { z } from "zod";

// File types
export const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum(['txt', 'csv', 'orcs_card', 'metadata', 'entity', 'relationship', 'attribute', 'comment', 'kv_pair']),
  size: z.number(),
  created: z.string(),
  modified: z.string(),
  cardUuid: z.string().optional(), // Stable UUID for card files (never changes when content is modified)
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
  references: z.array(z.string()).default([]), // Array of references: ["filename@start-end", "filename[row,col]"]
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
  type: z.enum(['relationship', 'attribute', 'connection', 'co-occurrence']),
  direction: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional().default(0),
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

// Tag Connection Schema for linking entities with relationships and attributes
// Direction: 0=none, 1=source→target, 2=target→source, 3=bidirectional
export const connectionDirectionSchema = z.union([
  z.literal(0), // none
  z.literal(1), // forward (source → target)
  z.literal(2), // backward (target → source)
  z.literal(3), // bidirectional
]);

export const tagConnectionSchema = z.object({
  id: z.string(), // UUID
  sourceTagId: z.string(), // Entity tag ID (first selected)
  targetTagId: z.string(), // Entity tag ID (second selected)
  relationshipTagId: z.string().optional(), // Relationship tag ID (edge label)
  attributeTagIds: z.array(z.string()).default([]), // Attribute tag IDs
  connectionType: z.enum(['entity_relationship', 'entity_attribute', 'relationship_attribute']),
  direction: connectionDirectionSchema.default(0), // Edge directionality (0=none, 1=fwd, 2=bwd, 3=both)
  strength: z.number().min(0).max(1).default(1), // Connection strength (0-1)
  notes: z.string().optional(),
  created: z.string(),
  modified: z.string(),
});

export type ConnectionDirection = z.infer<typeof connectionDirectionSchema>;

export const insertTagConnectionSchema = tagConnectionSchema.omit({ id: true, created: true, modified: true });

export type TagConnection = z.infer<typeof tagConnectionSchema>;
export type InsertTagConnection = z.infer<typeof insertTagConnectionSchema>;
