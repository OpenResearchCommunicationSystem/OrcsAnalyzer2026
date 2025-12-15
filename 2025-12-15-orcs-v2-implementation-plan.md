# ORCS v2 Implementation Plan

**Date:** 2025-12-15  
**Status:** Design Complete, Ready for Implementation

---

## Executive Summary

ORCS v2 represents a fundamental restructuring of the intelligence analysis system around the "Discover Once, Use Many" philosophy. This plan outlines the migration from the current tag-based system to a unified Link model with automatic bullet generation, snippet capture, and dossier aggregation.

---

## Core Philosophy

**"Discover Once, Use Many Ways"**

Analysts mark up source documents once. The system automatically generates:
- **Snippets** - Unstructured text highlights for reports
- **Bullets** - Structured S-P-O statements for analysis
- **Dossiers** - Entity-centric aggregations
- **Graph Exports** - Node/edge tables for visualization tools

---

## Part 1: New Data Model

### 1.1 Unified Link Schema

Replace separate relationship/attribute tags with a single Link concept:

```typescript
interface Link {
  id: string;                    // UUID
  sourceId: string;              // Source entity UUID
  targetId: string;              // Target entity UUID
  predicate: string;             // Relationship label (e.g., "WORKS_FOR", "HAS_PHONE")
  
  // Visibility flags (not mutually exclusive)
  isRelationship: boolean;       // Show in edge/relationship tables
  isAttribute: boolean;          // Show in attribute tables
  isNormalization: boolean;      // This is a normalization link (display → canonical)
  
  // Properties on the edge
  properties: Record<string, string | number | boolean>;
  // e.g., { role: "CEO", since: 2020, confidence: 0.9 }
  
  // Provenance
  sourceCardId: string;          // Card UUID where this was discovered
  offsets?: { start: number; end: number };  // Position in source text
  
  // Metadata
  created: string;
  modified: string;
  analyst?: string;
}
```

### 1.2 Entity Schema (Updated)

```typescript
interface Entity {
  id: string;                    // UUID
  type: string;                  // Category: "person", "org", "location", "selector", "date"
  canonicalName: string;         // Normalized value (e.g., "Robert Richard Renasco")
  displayName?: string;          // Original text alias (e.g., "Bob")
  aliases: string[];             // Search aliases
  properties: Record<string, string | number | boolean>;
  created: string;
  modified: string;
}
```

### 1.3 Snippet Schema (New)

```typescript
interface Snippet {
  id: string;                    // UUID
  cardId: string;                // Source card UUID
  text: string;                  // Highlighted text
  offsets: { start: number; end: number };
  comment?: string;              // Analyst comment
  analyst?: string;              // Who created it
  classification?: string;       // Inherited from card or overridden
  created: string;
}
```

### 1.4 Bullet Schema (Derived, Not Stored)

Bullets are **computed** from Links, not stored separately:

```typescript
interface Bullet {
  // Derived from Link
  subject: Entity;
  predicate: string;
  object: Entity;
  properties: Record<string, string>;
  
  // Provenance (from Link)
  sourceCard: Card;
  classification: string;
  
  // Formatted output
  toText(): string;
  // Returns: "(U) Bob [works for, role: CEO] Acme Corp. Source: social_post.card.txt"
}
```

---

## Part 2: New Card File Format

### 2.1 Card Structure

```
=== ORCS CARD ===
version: "2025.004"
uuid: "4aebb51e-875a-4351-aba3-99174f17c394"
source_file: "intel_report.txt"
source_reference: "https://source.url"
classification: "Unclassified"
handling:
  - "Distribution: Internal Use Only"
created: "2025-12-15T10:00:00Z"
modified: "2025-12-15T10:30:00Z"
analyst: "JD"

=== TAG INDEX START ===
[entity:person:Robert Richard Renasco](uuid1) {display: "Bob", aliases: ["R. Renasco"]}
[entity:person:Gary Greg Ganu](uuid2) {display: "Gary"}
[entity:org:Acme Corp](uuid3)
[entity:selector:+18001234567](uuid4) {display: "123-4567"}
=== TAG INDEX END ===

=== LINK INDEX START ===
# Format: (SourceUUID) --[PREDICATE:prop=value]--> (TargetUUID) {flags}
(uuid1) --[WORKS_FOR:role=CEO]--> (uuid3) {rel: true, attr: false}
(uuid1) --[CALLED:date=2025-10-03,time=13:20]--> (uuid2) {rel: true}
(uuid1) --[HAS_PHONE]--> (uuid4) {rel: true, attr: true}
(card-uuid) --[MENTIONS]--> (uuid1)
(card-uuid) --[MENTIONS]--> (uuid2)
=== LINK INDEX END ===

=== SNIPPET INDEX START ===
# Format: [start-end] "text" | {comment: "...", analyst: "..."}
[45-89] "Bob was seen at the conference with Gary" | {comment: "Key sighting", analyst: "JD"}
[120-156] "discussing the upcoming merger" | {comment: "Verify with HUMINT"}
=== SNIPPET INDEX END ===

=== ORIGINAL CONTENT START ===
In a report dated Thursday, [[person:Robert Richard Renasco|Bob]] of [[org:Acme Corp]] 
was seen at the conference with [[person:Gary Greg Ganu|Gary]]. They were discussing 
the upcoming merger. Bob can be reached at [[selector:+18001234567|123-4567]].
=== ORIGINAL CONTENT END ===
```

### 2.2 Wiki-Link Syntax

**Full Syntax:**
```
[[type:NormalizedValue|DisplayText]]
```

**Examples:**
```
[[person:Robert Richard Renasco|Bob]]           → Person entity, normalized name, displays as "Bob"
[[org:Acme Corporation]]                         → Org entity, no display alias
[[selector:+18001234567|123-4567]]              → Selector (phone/email), normalized format
[[date:2025-10-03|last Thursday]]               → Date entity, ISO format normalized
[[location:New York, NY, USA|the city]]         → Location entity, normalized address
```

**Parsing Rules:**
1. `[[value]]` → Entity with inferred type, value is both canonical and display
2. `[[type:value]]` → Entity with explicit type, value is both canonical and display
3. `[[type:canonical|display]]` → Entity with type, normalized value, and display alias

---

## Part 3: Dossier System

### 3.1 Dossier Aggregation Query

When user requests dossier for entity UUID:

```typescript
async function buildDossier(entityId: string): Promise<Dossier> {
  // 1. Get entity details
  const entity = await getEntity(entityId);
  
  // 2. Find all cards mentioning this entity
  const cards = await findCardsWithLink({
    predicate: "MENTIONS",
    targetId: entityId
  });
  
  // 3. Find all snippets from those cards that include this entity
  const snippets = await findSnippetsForEntity(entityId);
  
  // 4. Find all links where entity is SOURCE (outgoing relationships)
  const outgoingLinks = await findLinks({ sourceId: entityId });
  
  // 5. Find all links where entity is TARGET (incoming relationships)
  const incomingLinks = await findLinks({ targetId: entityId });
  
  // 6. Generate bullets from links
  const bullets = [...outgoingLinks, ...incomingLinks].map(linkToBullet);
  
  return {
    entity,
    cards,
    snippets,
    bullets,
    relationships: bullets.filter(b => b.isRelationship),
    attributes: bullets.filter(b => b.isAttribute)
  };
}
```

### 3.2 Dossier Export Format

```
================================================================================
ENTITY DOSSIER: Robert Richard Renasco
Type: Person
Aliases: Bob, R. Renasco
Generated: 2025-12-15T14:30:00Z
================================================================================

SNIPPETS (2):
--------------------------------------------------------------------------------
(U) "Bob was seen at the conference with Gary discussing the deal"
    Comment: Key sighting, verify with HUMINT
    Source: intel_report.card.txt (2025-12-10)

(U) "Robert mentioned he would be traveling to London next week"
    Source: social_media_post.card.txt (2025-12-12)

RELATIONSHIPS (Outgoing):
--------------------------------------------------------------------------------
(U) Bob [works for] Acme Corp [role: CEO, since: 2020]
    Source: corporate_filing.card.txt

(U) Bob [called] Gary [date: 2025-10-03, time: 13:20]
    Source: phone_records.card.txt

(U) Bob [met with] Sarah Chen [location: London, date: 2025-10-05]
    Source: travel_intel.card.txt

RELATIONSHIPS (Incoming):
--------------------------------------------------------------------------------
(U) Gary [called] Bob [date: 2025-10-04]
    Source: phone_records.card.txt

(U) Acme Corp [employs] Bob
    Source: corporate_filing.card.txt

ATTRIBUTES:
--------------------------------------------------------------------------------
(U) Bob [has phone] +18001234567
    Source: contact_list.card.txt

(U) Bob [has email] bob@acme.com
    Source: email_headers.card.txt

================================================================================
SOURCES: 6 cards analyzed
CLASSIFICATION: UNCLASSIFIED
================================================================================
```

---

## Part 4: Export Formats

### 4.1 Snippet List Export

For copy/paste into documents:

```
SNIPPET LIST
Entity: Robert Richard Renasco (Bob)
Generated: 2025-12-15

1. (U) "Bob was seen at the conference with Gary" (Key sighting). 
   Source: intel_report.card.txt

2. (U) "Robert mentioned he would be traveling to London"
   Source: social_media_post.card.txt
```

### 4.2 Bullet List Export

For copy/paste into documents:

```
BULLET LIST
Entity: Robert Richard Renasco (Bob)
Generated: 2025-12-15

1. (U) Bob [works for] Acme Corp [role: CEO]. Source: corporate_filing.card.txt
2. (U) Bob [called] Gary [date: 2025-10-03]. Source: phone_records.card.txt
3. (U) Bob [has phone] +18001234567. Source: contact_list.card.txt
```

### 4.3 Relationship Table Export (CSV/Graph)

For graph database import:

```csv
source_id,source_name,source_type,predicate,predicate_props,target_id,target_name,target_type,source_card,classification
uuid1,Robert Richard Renasco,person,WORKS_FOR,role=CEO,uuid3,Acme Corp,org,corporate_filing.card.txt,U
uuid1,Robert Richard Renasco,person,CALLED,date=2025-10-03,uuid2,Gary Greg Ganu,person,phone_records.card.txt,U
```

### 4.4 Attribute Table Export (CSV/Graph)

For graph database node properties:

```csv
entity_id,entity_name,entity_type,attribute,value,source_card,classification
uuid1,Robert Richard Renasco,person,HAS_PHONE,+18001234567,contact_list.card.txt,U
uuid1,Robert Richard Renasco,person,HAS_EMAIL,bob@acme.com,email_headers.card.txt,U
```

---

## Part 5: Migration Plan

### 5.1 Remove Legacy Systems

| Component | Action |
|-----------|--------|
| USER ADDED section | Remove entirely |
| `sectionIdSchema` | Remove from schema |
| `append-text` API | Delete route |
| `user-added` API | Delete route |
| `appendUserText()` | Delete function |
| `clearUserAddedText()` | Delete function |
| Cross-section tagging | Remove (no longer needed) |

### 5.2 Update Existing Components

| Component | Changes |
|-----------|---------|
| `shared/schema.ts` | Add Link, Snippet, Entity schemas; remove SectionId |
| `contentExtractor.ts` | Parse new TAG/LINK/SNIPPET indexes; remove USER ADDED |
| `orcsService.ts` | Implement Link CRUD; bullet generation; dossier aggregation |
| `DocumentViewer.tsx` | Render wiki-links; show snippets; remove USER ADDED UI |
| `routes.ts` | Add dossier, snippet, bullet export endpoints |

### 5.3 New API Endpoints

```
GET  /api/entities/:id                    → Get entity by ID
GET  /api/entities/:id/dossier            → Get full dossier for entity
GET  /api/entities/:id/snippets           → Get snippets mentioning entity
GET  /api/entities/:id/bullets            → Get bullets for entity (derived from links)
GET  /api/entities/:id/links              → Get links to/from entity

POST /api/cards/:id/snippets              → Create snippet in card
POST /api/cards/:id/links                 → Create link in card

GET  /api/export/dossier/:entityId        → Export dossier as text
GET  /api/export/relationships            → Export all relationships as CSV
GET  /api/export/attributes               → Export all attributes as CSV
```

---

## Part 6: Implementation Tasks

### Phase 1: Schema & Data Model (Foundation)
- [ ] Define Link schema in `shared/schema.ts`
- [ ] Define Snippet schema in `shared/schema.ts`
- [ ] Update Entity schema with canonicalName/displayName
- [ ] Remove SectionId and cross-section types
- [ ] Define Bullet interface (computed, not stored)

### Phase 2: Backend Services
- [ ] Remove `appendUserText()` and `clearUserAddedText()`
- [ ] Remove USER ADDED API routes
- [ ] Implement Link CRUD in `orcsService.ts`
- [ ] Implement Snippet CRUD in `orcsService.ts`
- [ ] Implement wiki-link parser
- [ ] Implement LINK INDEX parser/writer
- [ ] Implement SNIPPET INDEX parser/writer
- [ ] Implement bullet generation from links
- [ ] Implement dossier aggregation

### Phase 3: Card File Format
- [ ] Update card generator to use new format
- [ ] Implement TAG INDEX with display aliases
- [ ] Implement LINK INDEX section
- [ ] Implement SNIPPET INDEX section
- [ ] Remove USER ADDED section handling

### Phase 4: Frontend Updates
- [ ] Remove USER ADDED UI components
- [ ] Remove appendTextMutation and clearUserAddedMutation
- [ ] Implement wiki-link rendering
- [ ] Implement snippet creation UI (text highlight → snippet)
- [ ] Implement link creation UI (entity → predicate → entity)
- [ ] Update tag creation modal for new entity format

### Phase 5: Dossier & Export
- [ ] Create Dossier page/component
- [ ] Implement dossier aggregation UI
- [ ] Implement snippet list export
- [ ] Implement bullet list export
- [ ] Implement relationship table CSV export
- [ ] Implement attribute table CSV export
- [ ] Implement copy-to-clipboard with provenance

### Phase 6: Migration & Cleanup
- [ ] Create migration script for existing cards (strip USER ADDED)
- [ ] Update existing tags to new entity format
- [ ] Update documentation (replit.md)
- [ ] Remove legacy code and dead imports
- [ ] End-to-end testing

---

## Part 7: UI Mockups

### 7.1 Document Viewer (Updated)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ORIGINAL CONTENT                                           [Restore]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ In a report dated Thursday, [Bob] of [Acme Corp] was seen at the   │
│ conference with [Gary]. They were discussing the upcoming merger.   │
│                                                                     │
│ ─────────────────────────────────────────────────────────────────  │
│ SNIPPETS (2)                                            [+ Snippet] │
│ ─────────────────────────────────────────────────────────────────  │
│ • "Bob was seen at the conference with Gary" - Key sighting        │
│ • "discussing the upcoming merger"                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ METADATA                                                            │
│ Source: intel_report.txt | Classification: U | Analyst: JD         │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Entity Dossier View

```
┌─────────────────────────────────────────────────────────────────────┐
│ DOSSIER: Robert Richard Renasco (Bob)                    [Export ▼] │
│ Type: Person | Aliases: R. Renasco                                  │
├─────────────────────────────────────────────────────────────────────┤
│ SNIPPETS (2)                                                        │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Bob was seen at the conference with Gary"                      │ │
│ │ Comment: Key sighting | Source: intel_report.card.txt     [Copy]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ RELATIONSHIPS                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ → works for Acme Corp [role: CEO]                         [Copy]│ │
│ │ → called Gary [date: 2025-10-03]                          [Copy]│ │
│ │ ← called by Gary [date: 2025-10-04]                       [Copy]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ATTRIBUTES                                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ has phone: +18001234567                                   [Copy]│ │
│ │ has email: bob@acme.com                                   [Copy]│ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ SOURCES (3 cards)                                                   │
│ • intel_report.card.txt                                             │
│ • phone_records.card.txt                                            │
│ • contact_list.card.txt                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

1. ✅ Analysts can highlight text and create snippets with comments
2. ✅ Analysts can create links between entities with predicates and properties
3. ✅ Bullets are automatically generated from links (no manual creation)
4. ✅ Dossiers aggregate all data for an entity across cards
5. ✅ All exports include full provenance (classification, source, analyst)
6. ✅ Copy/paste produces properly formatted text with citations
7. ✅ Card files are human-readable AND machine-parseable
8. ✅ Wiki-link syntax allows inline normalization without destroying source
9. ✅ Legacy USER ADDED system completely removed
10. ✅ Index is stable and self-repairing

---

## Appendix: Predicate Catalog (Initial)

Common predicates for intelligence analysis:

| Category | Predicates |
|----------|------------|
| Employment | WORKS_FOR, EMPLOYS, ROLE_AT |
| Communication | CALLED, EMAILED, MET_WITH, MESSAGED |
| Location | LOCATED_AT, TRAVELED_TO, RESIDES_IN |
| Ownership | OWNS, CONTROLS, INVESTED_IN |
| Association | KNOWS, ASSOCIATED_WITH, MEMBER_OF |
| Family | SPOUSE_OF, PARENT_OF, SIBLING_OF |
| Attributes | HAS_PHONE, HAS_EMAIL, HAS_ADDRESS, HAS_DOB |
| Document | MENTIONS, REFERENCES, QUOTES |

---

*End of Implementation Plan*
