# ORCS Phase 2 Implementation Plan
**Date:** 2025-12-16  
**Status:** In Progress

## Summary
Core drag-and-drop workflow is operational. Now stabilizing the system with proper cleanup, simplified taxonomy, and enhanced annotation capabilities.

---

## Simplified Tag Taxonomy (5 Primitives)

| Primitive | Purpose | Color |
|-----------|---------|-------|
| **Entity** | Node - Person, Org, Location, Object, Event | 🟢 Green |
| **Link** | Edge - Connects entities with predicates | 🟠 Orange |
| **Snip** | Highlight - Text selection with analyst notes | 🟡 Amber |
| **Pair** | Structured Data - Key:Value that attaches anywhere | 🟣 Purple |
| **Comment** | Analyst Insert - Zero-width text insertion, taggable like source | 🔵 Blue |

### Pair Attachment Points
| Attach To | Example |
|-----------|---------|
| Card (document-level) | `CrimeType: Murder`, `Priority: High` |
| Snip (enriches highlight) | `Time: 4pm`, `Location: Berlin` |
| Bullet (annotates relationship) | `Value: $3.2B`, `Date: Q3 2025` |
| Entity (as property) | `SSN: 123-456-789`, `DOB: 1985-03-15` |
| Link (as property) | `Confidence: High`, `Source: HUMINT` |
| Node position in Link | Entity → Pair (e.g., Person → `Grid:3PG123085`) |

### Pair Categories (for templates/validation)
- **Property** - color:blue, status:active
- **Meta** - devname:target1, caseid:2024-001
- **Geotemporal** - Grid:3PG123085, Time:1430Z, Date:2024-12-15 (ISO/MGRS standards)
- **Functional** - URL:https://..., Phone:(555)123-4567, URN:...

Pre-load ISO/USG standards for geotemporal and functional. Let users create property and meta on the fly.

---

## Priority Work Items

### Priority 1: Stabilization (Must Have)
These fix broken/missing functionality:

1. **Tag Deletion with Cascade Cleanup**
   - DELETE /api/tags/:id endpoint
   - Dry-run preview mode
   - Remove tag file
   - Clean TAG INDEX/LINK INDEX in affected cards
   - Update master index
   - Refresh caches

2. **Allow Selection of Already-Tagged Text**
   - Fix selection guard that blocks tagged text
   - Enable snippets across text containing entities
   - Parser handles nested/overlapping spans

3. **Deep Re-indexing / Garbage Collection**
   - Expand current reindex to full GC
   - Drop entries for missing files
   - Remove orphaned references
   - Status/progress reporting

### Priority 2: Taxonomy Alignment (High Value)
Align UI with the unified data model:

4. **Rename Relationship → Link in UI**
   - Update tag type labels
   - Update modal titles
   - Update filter options

5. **Simplify Tag Menu**
   - Entity (keep as-is)
   - Link (was Relationship)
   - Snip (was Snippet)
   - Pair (new - replaces Attribute/KVP)
   - Comment (zero-width snip with insertion)

### Priority 3: Enhanced Annotation (New Capabilities)

6. **Comment Insertion (Zero-Width Anchors)**
   - Allow snippets where start offset = end offset
   - Render as inline callouts
   - Taggable like source text
   - Consider "Analyst Notes" panel

7. **Pair System Implementation**
   - Schema for Pair with category field
   - Pre-loaded templates (MGRS, ISO datetime, phone)
   - Custom pair creation
   - Drag-and-drop onto snips/bullets/entities/links

### Priority 4: Architecture Evolution (Future)

8. **Retroactive Cleanup / Reconciliation**
   - Background job for orphan detection
   - Dependency map (card ↔ tag/link/snippet)
   - Automatic repair suggestions

9. **Middle Layer Operational Database**
   - SQLite/PostgreSQL write-through cache
   - Transactional edits with undo/redo
   - Diff tracking (track changes)
   - Cards remain export/storage format
   - Periodic materialization to disk

---

## Card Format v2025.005 (Proposed)

```
=== ORCS CARD ===
version: "2025.005"
uuid: "..."
source_file: "..."

=== ORIGINAL CONTENT START ===
[source text with [[wiki:links|display]] and <!-- comment:uuid --> markers]
=== ORIGINAL CONTENT END ===

=== TAG INDEX START ===
[Entity entries: uuid, name, type, pairs[]]
=== TAG INDEX END ===

=== LINK INDEX START ===
[Link entries: sourceId, targetId, predicate, direction, isRelationship, isAttribute, pairs[]]
=== LINK INDEX END ===

=== SNIPPET INDEX START ===
[Snip entries: uuid, text, offsets, comment, classification, pairs[]]
=== SNIPPET INDEX END ===

=== PAIR INDEX START ===
[Card-level pairs: uuid, key, value, category]
=== PAIR INDEX END ===

=== COMMENT INDEX START ===
[Inserted comments: uuid, offset, text, analyst]
=== COMMENT INDEX END ===

=== METADATA START ===
[Classification, handling, source reference, etc.]
=== METADATA END ===
```

---

## Execution Order

**Phase 2A: Stabilization**
- [x] Create planning document
- [ ] Tag deletion with cascade
- [ ] Selection overlap fix
- [ ] Deep reindex/GC

**Phase 2B: Taxonomy**
- [ ] Rename Relationship → Link
- [ ] Simplify tag menu UI

**Phase 2C: Pairs & Comments** (Future)
- [ ] Pair schema and API
- [ ] Comment insertion (zero-width)
- [ ] Drag-and-drop attachment

**Phase 2D: Architecture** (Future)
- [ ] Reconciliation job
- [ ] Evaluate operational database layer
