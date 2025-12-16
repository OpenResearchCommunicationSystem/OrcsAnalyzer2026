import { z } from "zod";

// File types
export const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum([
    // Current types
    'txt', 'csv', 'orcs_card', 'metadata', 'entity', 'link', 'label', 'data',
    // Legacy types (for backwards compatibility)
    'relationship', 'attribute', 'comment', 'kv_pair'
  ]),
  size: z.number(),
  created: z.string(),
  modified: z.string(),
  cardUuid: z.string().optional(),
});

export const insertFileSchema = fileSchema.omit({ id: true });

export type File = z.infer<typeof fileSchema>;
export type InsertFile = z.infer<typeof insertFileSchema>;

// Entity types (categories for tagged entities)
export const entityTypeSchema = z.enum(['person', 'org', 'location', 'selector', 'date', 'event', 'object', 'concept']);

// Entity schema - represents tagged items in documents
export const entitySchema = z.object({
  id: z.string(), // UUID
  type: entityTypeSchema,
  canonicalName: z.string(), // Normalized value (e.g., "Robert Richard Renasco")
  displayName: z.string().optional(), // Original text alias (e.g., "Bob") 
  aliases: z.array(z.string()).default([]), // Search aliases
  properties: z.record(z.string()).default({}), // Key-value properties on the entity
  created: z.string(),
  modified: z.string(),
});

export const insertEntitySchema = entitySchema.omit({ id: true, created: true, modified: true });

export type Entity = z.infer<typeof entitySchema>;
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;

// Link schema - unified model for relationships and attributes
// Replaces the old TagConnection and discrete tag types
export const linkSchema = z.object({
  id: z.string(), // UUID
  sourceId: z.string(), // Source entity UUID
  targetId: z.string(), // Target entity UUID
  predicate: z.string(), // Relationship label (e.g., "WORKS_FOR", "HAS_PHONE")
  
  // Visibility flags (not mutually exclusive)
  isRelationship: z.boolean().default(true), // Show in edge/relationship tables
  isAttribute: z.boolean().default(false), // Show in attribute tables
  isNormalization: z.boolean().default(false), // This is a normalization link (display → canonical)
  
  // Direction: 0=none, 1=source→target, 2=target→source, 3=bidirectional
  direction: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]).default(1),
  
  // Properties on the edge (e.g., { role: "CEO", since: "2020" })
  properties: z.record(z.string()).default({}),
  
  // Provenance
  sourceCardId: z.string(), // Card UUID where this was discovered
  offsets: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(), // Position in source text
  
  created: z.string(),
  modified: z.string(),
  analyst: z.string().optional(),
});

export const insertLinkSchema = linkSchema.omit({ id: true, created: true, modified: true });

export type Link = z.infer<typeof linkSchema>;
export type InsertLink = z.infer<typeof insertLinkSchema>;

// Snippet schema - text highlights with provenance
export const snippetSchema = z.object({
  id: z.string(), // UUID
  cardId: z.string(), // Source card UUID
  text: z.string(), // Highlighted text
  offsets: z.object({
    start: z.number(),
    end: z.number(),
  }),
  comment: z.string().optional(), // Analyst comment
  analyst: z.string().optional(), // Who created it
  classification: z.string().optional(), // Inherited from card or overridden
  created: z.string(),
});

export const insertSnippetSchema = snippetSchema.omit({ id: true, created: true });

export type Snippet = z.infer<typeof snippetSchema>;
export type InsertSnippet = z.infer<typeof insertSnippetSchema>;

// Bullet interface - DERIVED from Links, not stored
// This is a computed type for display/export purposes
export interface Bullet {
  subject: Entity;
  predicate: string;
  predicateProperties: Record<string, string>;
  object: Entity;
  isRelationship: boolean;
  isAttribute: boolean;
  direction: 0 | 1 | 2 | 3;
  
  // Provenance
  sourceCardId: string;
  sourceCardName: string;
  classification: string;
  
  // Link reference for tracing back
  linkId: string;
}

// ORCS Card structure (updated for v2)
export const orcsCardSchema = z.object({
  id: z.string(), // UUID
  title: z.string(),
  source: z.string(),
  sourceHash: z.string(),
  sourceReference: z.string().optional(), // URL or external ID
  classification: z.string().default('Unclassified'),
  handling: z.array(z.string()).default([]),
  created: z.string(),
  modified: z.string(),
  content: z.string(), // Original content with wiki-links
  analyst: z.string().optional(),
});

export const insertOrcsCardSchema = orcsCardSchema.omit({ id: true, created: true, modified: true });

export type OrcsCard = z.infer<typeof orcsCardSchema>;
export type InsertOrcsCard = z.infer<typeof insertOrcsCardSchema>;

// Dossier - aggregated view of an entity (computed, not stored)
export interface Dossier {
  entity: Entity;
  cards: OrcsCard[]; // All cards mentioning this entity
  snippets: Snippet[]; // All snippets involving this entity
  outgoingBullets: Bullet[]; // Entity as subject
  incomingBullets: Bullet[]; // Entity as object
  relationships: Bullet[]; // Bullets where isRelationship=true
  attributes: Bullet[]; // Bullets where isAttribute=true
}

// Graph data (updated for new model)
// Note: Graph nodes can be entities OR legacy tags during migration
export const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Support both new entity types and legacy tag types during migration
  type: z.enum([
    // New entity types
    'person', 'org', 'location', 'selector', 'date', 'event', 'object', 'concept',
    // Legacy tag types (for backwards compatibility)
    'entity', 'relationship', 'attribute', 'comment', 'kv_pair'
  ]),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  type: z.enum(['relationship', 'attribute', 'connection', 'co-occurrence']).optional(),
  direction: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(1),
  properties: z.record(z.string()).optional().default({}),
});

export const graphDataSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphData = z.infer<typeof graphDataSchema>;

// Text selection for tagging (simplified - no more cross-section)
export const textSelectionSchema = z.object({
  text: z.string(),
  startOffset: z.number(),
  endOffset: z.number(),
  filename: z.string(),
  reference: z.string(), // format: "uuid@start-end"
});

export type TextSelection = z.infer<typeof textSelectionSchema>;

// Stats schema for directory statistics
export const statsSchema = z.object({
  totalFiles: z.number(),
  totalEntities: z.number(),
  totalLinks: z.number(),
  totalSnippets: z.number(),
  entityCounts: z.record(z.string(), z.number()), // Count by entity type
});

export type Stats = z.infer<typeof statsSchema>;

// Master Index Types - IDE-style indexing system (updated for v2)
export const indexedFileSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  type: z.string(),
  hash: z.string(),
  timestamp: z.number(),
  cardUuid: z.string().optional(),
  sourceFile: z.string().optional(),
});

export const indexedEntitySchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  displayName: z.string().optional(),
  type: entityTypeSchema,
  filePath: z.string(),
  aliases: z.array(z.string()),
});

export const indexedLinkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  predicate: z.string(),
  direction: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  isRelationship: z.boolean(),
  isAttribute: z.boolean(),
  cardId: z.string(),
  filePath: z.string(),
});

export const indexedSnippetSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  text: z.string(),
  filePath: z.string(),
});

export const brokenReferenceSchema = z.object({
  referenceId: z.string(),
  reason: z.enum(['missing_source_entity', 'missing_target_entity', 'missing_card', 'orphaned_file']),
  details: z.string(),
  filePath: z.string(),
});

export const masterIndexSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  files: z.array(indexedFileSchema),
  entities: z.array(indexedEntitySchema),
  links: z.array(indexedLinkSchema),
  snippets: z.array(indexedSnippetSchema),
  brokenReferences: z.array(brokenReferenceSchema),
  stats: z.object({
    totalFiles: z.number(),
    totalEntities: z.number(),
    totalLinks: z.number(),
    totalSnippets: z.number(),
    brokenReferenceCount: z.number(),
  }),
});

export type IndexedFile = z.infer<typeof indexedFileSchema>;
export type IndexedEntity = z.infer<typeof indexedEntitySchema>;
export type IndexedLink = z.infer<typeof indexedLinkSchema>;
export type IndexedSnippet = z.infer<typeof indexedSnippetSchema>;
export type BrokenReference = z.infer<typeof brokenReferenceSchema>;
export type MasterIndex = z.infer<typeof masterIndexSchema>;

// Predicate catalog - common predicates for intelligence analysis
export const predicateCatalog = {
  // Employment
  WORKS_FOR: { category: 'employment', description: 'Subject works for object organization' },
  EMPLOYS: { category: 'employment', description: 'Subject organization employs object person' },
  ROLE_AT: { category: 'employment', description: 'Subject has role at object organization' },
  
  // Communication
  CALLED: { category: 'communication', description: 'Subject called object' },
  EMAILED: { category: 'communication', description: 'Subject emailed object' },
  MET_WITH: { category: 'communication', description: 'Subject met with object' },
  MESSAGED: { category: 'communication', description: 'Subject messaged object' },
  
  // Location
  LOCATED_AT: { category: 'location', description: 'Subject located at object location' },
  TRAVELED_TO: { category: 'location', description: 'Subject traveled to object location' },
  RESIDES_IN: { category: 'location', description: 'Subject resides in object location' },
  
  // Ownership
  OWNS: { category: 'ownership', description: 'Subject owns object' },
  CONTROLS: { category: 'ownership', description: 'Subject controls object' },
  INVESTED_IN: { category: 'ownership', description: 'Subject invested in object' },
  
  // Association
  KNOWS: { category: 'association', description: 'Subject knows object' },
  ASSOCIATED_WITH: { category: 'association', description: 'Subject associated with object' },
  MEMBER_OF: { category: 'association', description: 'Subject is member of object' },
  
  // Family
  SPOUSE_OF: { category: 'family', description: 'Subject is spouse of object' },
  PARENT_OF: { category: 'family', description: 'Subject is parent of object' },
  SIBLING_OF: { category: 'family', description: 'Subject is sibling of object' },
  
  // Attributes (entity → selector)
  HAS_PHONE: { category: 'attribute', description: 'Subject has phone number' },
  HAS_EMAIL: { category: 'attribute', description: 'Subject has email address' },
  HAS_ADDRESS: { category: 'attribute', description: 'Subject has address' },
  HAS_DOB: { category: 'attribute', description: 'Subject has date of birth' },
  
  // Document relations
  MENTIONS: { category: 'document', description: 'Card mentions entity' },
  REFERENCES: { category: 'document', description: 'Card references entity' },
} as const;

export type PredicateKey = keyof typeof predicateCatalog;

// ============================================================================
// LEGACY TYPES - Kept for backwards compatibility during migration
// These will be removed after migration is complete
// ============================================================================

// Tag types - updated for Phase 3 Label/Data taxonomy
export const tagTypeSchema = z.enum(['entity', 'relationship', 'attribute', 'comment', 'label', 'data']);
export type TagType = z.infer<typeof tagTypeSchema>;

// Canon data types for Data tags
export const canonDataTypeSchema = z.enum(['Generic', 'Geotemporal', 'Identifier', 'Quantity', 'Quality', 'Metadata']);
export type CanonDataType = z.infer<typeof canonDataTypeSchema>;

// @deprecated - kept for backwards compatibility during migration
export const pairSubtypeSchema = z.enum(['key', 'value', 'key_value']);
export type PairSubtype = z.infer<typeof pairSubtypeSchema>;

// Tag schema - updated for Phase 3 Label/Data taxonomy
export const tagSchema = z.object({
  id: z.string(),
  type: tagTypeSchema,
  entityType: z.string().optional(),
  name: z.string(),
  references: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  keyValuePairs: z.record(z.string()).default({}),
  description: z.string().optional(),
  created: z.string(),
  modified: z.string(),
  // Label-specific fields (for label type)
  normalization: z.string().optional(), // Wiki-link style normalization [[type:canonical|display]]
  comment: z.string().optional(), // Analyst comment
  // Data-specific fields (for data type)
  dataType: canonDataTypeSchema.optional(), // Canon type: Generic, Geotemporal, etc.
  dataKey: z.string().optional(), // Key field (default: "Tag" if blank)
  dataValue: z.string().optional(), // Value field
  // @deprecated - kept for backwards compatibility
  pairSubtype: pairSubtypeSchema.optional(),
  pairKey: z.string().optional(),
  pairValue: z.string().optional(),
  linkedPairId: z.string().optional(),
});

export const insertTagSchema = tagSchema.omit({ id: true, created: true, modified: true });
export type Tag = z.infer<typeof tagSchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;

// @deprecated Use linkSchema instead
export const connectionDirectionSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type ConnectionDirection = z.infer<typeof connectionDirectionSchema>;

export const tagConnectionSchema = z.object({
  id: z.string(),
  sourceTagId: z.string(),
  targetTagId: z.string(),
  relationshipTagId: z.string().optional(),
  attributeTagIds: z.array(z.string()).default([]),
  connectionType: z.enum(['entity_relationship', 'entity_attribute', 'relationship_attribute']),
  direction: connectionDirectionSchema.default(0),
  strength: z.number().min(0).max(1).default(1),
  notes: z.string().optional(),
  created: z.string(),
  modified: z.string(),
});

export const insertTagConnectionSchema = tagConnectionSchema.omit({ id: true, created: true, modified: true });
export type TagConnection = z.infer<typeof tagConnectionSchema>;
export type InsertTagConnection = z.infer<typeof insertTagConnectionSchema>;
