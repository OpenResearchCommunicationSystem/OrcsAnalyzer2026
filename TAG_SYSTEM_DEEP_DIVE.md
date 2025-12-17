# ORCS Tag System Deep Dive

This document provides a comprehensive technical reference for understanding how tags are created, stored, connected, and deleted throughout the ORCS system. Use this as a guide for safely removing tags without crashing the system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Tag Types](#tag-types)
3. [Storage Locations](#storage-locations)
4. [Data Structures](#data-structures)
5. [Tag Creation Flow](#tag-creation-flow)
6. [Tag Deletion Flow](#tag-deletion-flow)
7. [Reset All Tags Flow](#reset-all-tags-flow)
8. [Connection System](#connection-system)
9. [Cache Invalidation](#cache-invalidation)
10. [Safe Deletion Checklist](#safe-deletion-checklist)

---

## 1. System Overview

The ORCS tag system has **three tiers of storage**:

```
┌─────────────────────────────────────────────────────────────┐
│                      TIER 1: TAG FILES                       │
│  Individual .txt files in user_data/{type}/ directories     │
│  (entities/, relationships/, labels/, data/, comments/)     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    TIER 2: CARD FILES                        │
│  .card.txt files in user_data/raw/ containing:              │
│  - TAG INDEX (entity references)                             │
│  - LINK INDEX (relationships between entities)               │
│  - SNIPPET INDEX (text highlights)                           │
│  - Tag markup in ORIGINAL CONTENT section                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 TIER 3: IN-MEMORY CONNECTIONS                │
│  TagConnection objects stored in MemStorage                  │
│  (volatile - reset on server restart)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tag Types

| Type | File Extension | Directory | Color Theme | Purpose |
|------|---------------|-----------|-------------|---------|
| entity | `.entity.txt` | `user_data/entities/` | Green | Named entities (people, orgs, places) |
| relationship | `.relate.txt` | `user_data/relationships/` | Orange | Connections between entities |
| label | `.label.txt` | `user_data/labels/` | Cyan | Reusable vocabulary for tagging |
| data | `.data.txt` | `user_data/data/` | Purple | Structured key-value data |
| comment | `.comment.txt` | `user_data/comments/` | Blue | Analyst notes |
| attribute | `.attrib.txt` | `user_data/attributes/` | (legacy) | Deprecated, use data instead |

---

## 3. Storage Locations

### 3.1 Tag File Directory Structure

```
user_data/
├── raw/                          # Card files (.card.txt)
├── entities/                     # Entity tag files
│   └── {Name}_{UUID}.entity.txt
├── relationships/                # Relationship tag files
│   └── {Name}_{UUID}.relate.txt
├── labels/                       # Label tag files
│   └── {Name}_{UUID}.label.txt
├── data/                         # Data tag files
│   └── {Name}_{UUID}.data.txt
├── comments/                     # Comment tag files
│   └── {Name}_{UUID}.comment.txt
└── index.json                    # Master search index
```

### 3.2 Tag File Format (ORCS Format)

```
=== ORCS ENTITY ===
VERSION: 1.0
UUID: 7586f6f3-5fea-4d98-9095-3f3cc4726926
TAG_TYPE: entity
NAME: John Smith
ENTITY_TYPE: person
DESCRIPTION:
CEO of TechCorp

CARD_REFERENCES:
- news_clip_11_test_152e1e9e-2e2e-4c0d-8b58-cb6564c987e8#original@45-55

SEARCH_ALIASES:
- J. Smith
- Johnny

CREATED: 2025-12-17T10:30:00.000Z
MODIFIED: 2025-12-17T10:30:00.000Z
```

**Key Fields:**
- `UUID`: Unique identifier for the tag
- `TAG_TYPE`: One of: entity, relationship, label, data, comment
- `NAME`: Display name
- `CARD_REFERENCES`: List of card UUIDs with section and offset info
- `SEARCH_ALIASES`: Alternative names for search

### 3.3 Card File Structure

```
=== ORCS CARD ===
SOURCE: https://example.com/article
CLASSIFICATION: Unclassified
HANDLING: None
ANALYST: John Doe
CREATED: 2025-12-17T10:00:00.000Z

=== TAG INDEX START ===
[entity:John Smith](7586f6f3-5fea-4d98-9095-3f3cc4726926)
[entity:TechCorp](c99e12bd-6baa-4327-950c-841759cc495c)
=== TAG INDEX END ===

=== LINK INDEX START ===
# Format: (SourceUUID) --[PREDICATE:prop=value]--> (TargetUUID) {flags} |id:uuid
(7586f6f3-5fea-4d98-9095-3f3cc4726926) --[CEO OF]--> (c99e12bd-6baa-4327-950c-841759cc495c) {rel: true, attr: false, dir: 1} |id:abc123
=== LINK INDEX END ===

=== SNIPPET INDEX START ===
# Format: [start-end] "text" | {comment: "...", analyst: "...", class: "..."} |id:uuid
[45-67] "important quote" | {comment: "Key finding", analyst: "Jane"} |id:def456
=== SNIPPET INDEX END ===

=== ORIGINAL CONTENT START ===
CEO [entity:John Smith](7586f6f3-5fea-4d98-9095-3f3cc4726926) announced that [entity:TechCorp](c99e12bd-6baa-4327-950c-841759cc495c) will expand operations.
=== ORIGINAL CONTENT END ===

=== USER ADDED START ===
Additional analyst notes here.
=== USER ADDED END ===
```

---

## 4. Data Structures

### 4.1 Tag Schema (shared/schema.ts)

```typescript
const tagSchema = z.object({
  id: z.string(),                           // UUID
  type: tagTypeSchema,                      // entity | relationship | label | data | comment
  entityType: z.string().optional(),        // person, org, place, etc.
  name: z.string(),                         // Display name
  references: z.array(z.string()),          // Card references with offsets
  aliases: z.array(z.string()),             // Search aliases
  keyValuePairs: z.record(z.string()),      // Metadata
  description: z.string().optional(),
  created: z.string(),                      // ISO timestamp
  modified: z.string(),                     // ISO timestamp
  // Label-specific
  normalization: z.string().optional(),     // Wiki-link [[type:canonical|display]]
  comment: z.string().optional(),
  // Data-specific
  dataType: canonDataTypeSchema.optional(), // Generic, Geotemporal, etc.
  dataKey: z.string().optional(),
  dataValue: z.string().optional(),
});
```

### 4.2 Link Schema (shared/schema.ts)

```typescript
const linkSchema = z.object({
  id: z.string(),                           // UUID
  sourceId: z.string(),                     // Source entity UUID
  targetId: z.string(),                     // Target entity UUID
  predicate: z.string(),                    // Relationship label
  isRelationship: z.boolean(),              // Is this a relationship?
  isAttribute: z.boolean(),                 // Is this an attribute?
  isNormalization: z.boolean(),             // Is this a normalization?
  direction: z.union([0, 1, 2, 3]),         // 0=none, 1=forward, 2=backward, 3=bidirectional
  properties: z.record(z.string()),         // Additional properties
  sourceCardId: z.string(),                 // Card where link is defined
  offsets: z.object({ start, end }).optional(),
  created: z.string(),
  modified: z.string(),
});
```

### 4.3 Snippet Schema (shared/schema.ts)

```typescript
const snippetSchema = z.object({
  id: z.string(),                           // UUID
  cardId: z.string(),                       // Source card UUID
  text: z.string(),                         // Highlighted text
  offsets: z.object({
    start: z.number(),
    end: z.number(),
  }),
  comment: z.string().optional(),           // Analyst comment
  analyst: z.string().optional(),           // Who created it
  classification: z.string().optional(),    // Security classification
  created: z.string(),
});
```

### 4.4 TagConnection Schema (shared/schema.ts)

```typescript
const tagConnectionSchema = z.object({
  id: z.string(),
  sourceTagId: z.string(),                  // Source entity
  targetTagId: z.string(),                  // Target entity
  relationshipTagId: z.string().optional(), // Relationship tag linking them
  attributeTagIds: z.array(z.string()),     // Associated attributes
  connectionType: z.enum(['entity_relationship', 'entity_attribute', 'relationship_attribute']),
  direction: connectionDirectionSchema,
  strength: z.number(),
  notes: z.string().optional(),
  created: z.string(),
  modified: z.string(),
});
```

---

## 5. Tag Creation Flow

### 5.1 Frontend → Backend → Storage

```
┌──────────────────┐
│ User selects text│
│ in DocumentViewer│
└────────┬─────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ TagCreationModal.tsx                                          │
│ - Collects: name, type, entityType, references (with offsets)│
│ - Calls: createTag mutation from useTagOperations hook        │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ useTagOperations.ts - createTagMutation                       │
│ - POST /api/tags with tag data                                │
│ - On success: invalidates caches                              │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ server/routes.ts - POST /api/tags                             │
│ - Validates with insertTagSchema                              │
│ - Calls orcsService.createTag()                               │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ orcsService.createTag() - CREATES 2 THINGS:                   │
│                                                               │
│ 1. TAG FILE:                                                  │
│    saveTagToFile() → user_data/{type}/{Name}_{UUID}.txt      │
│                                                               │
│ 2. CARD MARKUP:                                               │
│    updateCardContent() →                                      │
│    - Adds [type:name](uuid) to TAG INDEX                     │
│    - Inserts [type:text](uuid) at offset in ORIGINAL CONTENT │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 What Gets Created (Entity Example)

When you create an entity tag for "John Smith" at offset 45-55 in card abc123:

**1. Tag File: `user_data/entities/John Smith_7586f6f3-5fea-4d98-9095-3f3cc4726926.entity.txt`**
```
=== ORCS ENTITY ===
VERSION: 1.0
UUID: 7586f6f3-5fea-4d98-9095-3f3cc4726926
TAG_TYPE: entity
NAME: John Smith
CARD_REFERENCES:
- abc123#original@45-55
CREATED: 2025-12-17T10:30:00.000Z
MODIFIED: 2025-12-17T10:30:00.000Z
```

**2. Card File Updates:**
```
=== TAG INDEX START ===
[entity:John Smith](7586f6f3-5fea-4d98-9095-3f3cc4726926)   ← ADDED
=== TAG INDEX END ===

=== ORIGINAL CONTENT START ===
CEO [entity:John Smith](7586f6f3-5fea-4d98-9095-3f3cc4726926) announced...   ← MARKUP INSERTED
=== ORIGINAL CONTENT END ===
```

---

## 6. Tag Deletion Flow

### 6.1 Single Tag Deletion

```
┌──────────────────┐
│ User clicks      │
│ delete on tag    │
└────────┬─────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ useTagOperations.ts - deleteTagMutation                       │
│ - DELETE /api/tags/:id                                        │
│ - On success: invalidates caches                              │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ server/routes.ts - DELETE /api/tags/:id                       │
│ - Calls orcsService.deleteTag(id)                             │
│ - Calls indexService.removeTagFromIndex(id)                   │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ orcsService.deleteTag() - PERFORMS 4 CLEANUP STEPS:           │
│                                                               │
│ STEP 1: removeTagFromCards(tag)                               │
│   - Find all cards referencing this tag                       │
│   - Remove [type:text](uuid) from ORIGINAL CONTENT            │
│   - Remove [type:name](uuid) from TAG INDEX                   │
│   - Keep original text, just strip the markup                 │
│                                                               │
│ STEP 2: removeLinksReferencingTag(tagId)                      │
│   - Scan all card LINK INDEX sections                         │
│   - Remove any links where sourceId or targetId = tagId       │
│                                                               │
│ STEP 3: deleteConnectionsReferencingTag(tagId)                │
│   - Get all TagConnections from storage                       │
│   - Delete connections where source/target/relationship = tag │
│   - Remove tag from attributeTagIds arrays                    │
│                                                               │
│ STEP 4: Delete tag file                                       │
│   - fs.unlink(user_data/{type}/{Name}_{UUID}.txt)            │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Code Locations for Each Step

| Step | File | Function | Lines |
|------|------|----------|-------|
| Delete tag | server/services/orcsService.ts | `deleteTag()` | 249-278 |
| Remove from cards | server/services/orcsService.ts | `removeTagFromCards()` | 855-928 |
| Remove links | server/services/orcsService.ts | `removeLinksReferencingTag()` | 281-324 |
| Delete connections | server/services/orcsService.ts | `deleteConnectionsReferencingTag()` | 327-342 |
| Update index | server/services/indexService.ts | `removeTagFromIndex()` | 630-658 |

### 6.3 Regex Patterns Used for Cleanup

**Tag markup in content:**
```javascript
// Pattern to find tag by ID in any section
const tagByIdRegex = new RegExp(`\\[${tag.type}:([^\\]]+?)\\]\\(${tag.id}\\)`, 'g');

// In ORIGINAL CONTENT: replace [type:text](uuid) with just "text"
content.replace(tagByIdRegex, '$1');

// In TAG INDEX: completely remove the tag entry
content.replace(tagByIdRegex, '');
```

**Links in LINK INDEX:**
```javascript
// Check if line references the deleted tag
if (line.includes(`sourceId:"${tagId}"`) || line.includes(`targetId:"${tagId}"`)) {
  // Skip this line (don't include in output)
}
```

---

## 7. Reset All Tags Flow

The reset function (`POST /api/system/reset-tags`) performs a complete cleanup in the correct order to avoid orphaned references.

### 7.1 Reset Sequence

```
┌──────────────────────────────────────────────────────────────┐
│ orcsService.resetAllTags()                                    │
│                                                               │
│ PHASE 1: Reset Card Files (MUST BE FIRST)                     │
│ ─────────────────────────────────────────                     │
│ For each .card.txt in user_data/raw/:                        │
│   - Clear TAG INDEX section (keep delimiters)                 │
│   - Clear LINK INDEX section (keep delimiters)                │
│   - Clear SNIPPET INDEX section (keep delimiters)             │
│   - Remove markup from ORIGINAL CONTENT                       │
│     Replace [type:text](uuid) → text                         │
│   - Remove markup from USER ADDED                             │
│   - PRESERVE: metadata (source, classification, etc.)         │
│                                                               │
│ PHASE 2: Delete Tag Files                                     │
│ ─────────────────────────────                                 │
│ For each directory in TAG_DIRECTORIES:                        │
│   - Delete all *.entity.txt                                   │
│   - Delete all *.relate.txt                                   │
│   - Delete all *.label.txt                                    │
│   - Delete all *.data.txt                                     │
│   - Delete all *.comment.txt                                  │
│   - Delete all *.orcs files                                   │
│                                                               │
│ PHASE 3: Clear In-Memory Connections                          │
│ ────────────────────────────────────                          │
│ For each TagConnection in storage:                            │
│   - storage.deleteTagConnection(id)                           │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Why Order Matters

1. **Cards first**: If you delete tag files first, the card cleanup code can't find tag info to properly strip markup
2. **Tags second**: With cards already cleaned, we can safely delete the source files
3. **Connections last**: These reference tag IDs; deleting them after tags ensures no dangling pointer issues

### 7.3 resetCardContent() Helper Function

```javascript
private resetCardContent(content: string): string {
  // Track which section we're in
  let inTagIndex = false;
  let inLinkIndex = false;
  let inSnippetIndex = false;
  let inOriginalContent = false;
  let inUserAdded = false;
  
  for (const line of lines) {
    // Skip content in TAG INDEX, LINK INDEX, SNIPPET INDEX (clearing them)
    if (inTagIndex || inLinkIndex || inSnippetIndex) {
      if (line.startsWith('#')) keep(line);  // Keep format comments
      continue;
    }
    
    // Remove tag markup from content sections
    if (inOriginalContent || inUserAdded) {
      // Replace [type:text](uuid) with just text
      const cleanedLine = line.replace(/\[([^\]:]+):([^\]]+)\]\([^)]+\)/g, '$2');
      keep(cleanedLine);
      continue;
    }
    
    // Keep all other lines (metadata, delimiters, etc.)
    keep(line);
  }
}
```

---

## 8. Connection System

### 8.1 TagConnections vs Links

| Feature | TagConnection | Link (LINK INDEX) |
|---------|--------------|-------------------|
| Storage | In-memory (MemStorage) | In card file |
| Persistence | Lost on server restart | Persisted in file |
| Purpose | Graph visualization | Document relationships |
| Created by | Ctrl+click entity selection | Link Creation UI |

### 8.2 Connection Creation Flow

```
┌──────────────────┐
│ User Ctrl+clicks │
│ two entities     │
└────────┬─────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ RelationshipConnectionModal.tsx                               │
│ - User selects relationship label                             │
│ - POST /api/connections                                       │
└────────┬─────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────┐
│ server/routes.ts - POST /api/connections                      │
│ - If customLabel provided, create relationship tag first      │
│ - storage.createTagConnection(data)                           │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Connection Storage (server/storage.ts)

```typescript
class MemStorage {
  private tagConnections: Map<string, TagConnection> = new Map();
  
  async createTagConnection(insert: InsertTagConnection): Promise<TagConnection> {
    const connection = {
      id: crypto.randomUUID(),
      ...insert,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    this.tagConnections.set(connection.id, connection);
    return connection;
  }
  
  async deleteTagConnection(id: string): Promise<boolean> {
    return this.tagConnections.delete(id);
  }
}
```

---

## 9. Cache Invalidation

### 9.1 Frontend Query Keys to Invalidate

After any tag operation, these caches must be refreshed:

| Query Key | Purpose | When to Invalidate |
|-----------|---------|-------------------|
| `/api/tags` | All tags list | Create, delete, update tag |
| `/api/files` | File list | Create, delete tag (file counts change) |
| `/api/stats` | Statistics | Any tag operation |
| `/api/connections` | Tag connections | Create, delete tag or connection |
| `/api/system/index` | Master index | Any tag operation |
| `/api/system/broken-connections` | Orphaned refs | Delete tag |
| `/api/graph` | Visualization data | Any tag or connection change |
| `/api/files/:id/content` | Card content | Tag create/delete affecting that card |

### 9.2 Cache Invalidation Code

```typescript
// After tag deletion (useTagOperations.ts)
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
  queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
  queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
  queryClient.invalidateQueries({ queryKey: ['/api/files'] });
  
  // Force refetch file content
  queryClient.refetchQueries({ queryKey: ['/api/files'] }).then(() => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return key.includes('/api/files/') && 
               (key.includes('/content') || key.includes('/metadata'));
      }
    });
  });
}

// After reset (FileManagerSidebar.tsx)
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['/api/files'] });
  queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
  queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
  queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
  queryClient.invalidateQueries({ queryKey: ['/api/system/index'] });
  queryClient.invalidateQueries({ queryKey: ['/api/system/broken-connections'] });
}
```

---

## 10. Safe Deletion Checklist

Use this checklist when manually cleaning up tags:

### Single Tag Deletion

- [ ] **Step 1**: Remove tag markup from card ORIGINAL CONTENT
  - Find: `[type:text](uuid)` → Replace with: `text`
- [ ] **Step 2**: Remove tag entry from card TAG INDEX
  - Find: `[type:name](uuid)` → Delete entire line
- [ ] **Step 3**: Remove links referencing this tag from all LINK INDEX sections
  - Delete lines containing `sourceId:"uuid"` or `targetId:"uuid"`
- [ ] **Step 4**: Delete in-memory TagConnections
  - Call `storage.deleteTagConnection()` for each connection referencing this tag
- [ ] **Step 5**: Delete the tag file
  - `user_data/{type}/{Name}_{UUID}.{ext}.txt`
- [ ] **Step 6**: Update master index
  - Call `indexService.removeTagFromIndex(tagId)`
- [ ] **Step 7**: Invalidate frontend caches
  - All query keys listed in section 9.1

### Full Reset

- [ ] **Phase 1**: For each `.card.txt` file:
  - [ ] Clear TAG INDEX (keep delimiters)
  - [ ] Clear LINK INDEX (keep delimiters)
  - [ ] Clear SNIPPET INDEX (keep delimiters)
  - [ ] Strip `[type:text](uuid)` → `text` in ORIGINAL CONTENT
  - [ ] Strip markup in USER ADDED section
  - [ ] PRESERVE: all metadata before indexes
- [ ] **Phase 2**: Delete all tag files:
  - [ ] All `.entity.txt` files
  - [ ] All `.relate.txt` files
  - [ ] All `.label.txt` files
  - [ ] All `.data.txt` files
  - [ ] All `.comment.txt` files
  - [ ] All `.orcs` files
- [ ] **Phase 3**: Clear all TagConnections from MemStorage
- [ ] **Phase 4**: Rebuild search index
  - Call `POST /api/system/reindex`
- [ ] **Phase 5**: Invalidate all frontend caches

---

## File Reference

| Layer | File | Key Functions |
|-------|------|---------------|
| Frontend | `client/src/hooks/useTagOperations.ts` | createTagMutation, deleteTagMutation |
| Frontend | `client/src/components/FileManagerSidebar.tsx` | resetMutation |
| Frontend | `client/src/components/DocumentViewer.tsx` | Text selection, tag display |
| Backend | `server/routes.ts` | API endpoints |
| Backend | `server/services/orcsService.ts` | Tag CRUD, card updates, reset |
| Backend | `server/services/indexService.ts` | Index management |
| Backend | `server/storage.ts` | In-memory connection storage |
| Shared | `shared/schema.ts` | Type definitions |

---

*Document generated: December 2025*
*ORCS Card System v2025.004*
