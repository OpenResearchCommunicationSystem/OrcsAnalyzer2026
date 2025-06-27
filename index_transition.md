# ORCS Card-Centric Architecture Transition Strategy

## Current State Analysis

### What's Working Well
- Colored tag highlighting system (visible in UI)
- ORCS metadata structure with UUID and hash integrity
- Tag file organization with Wikipedia-style extensions
- Search indexing and alias system
- Cross-file tag relationships

### Core Problems to Solve
- Fragile character offset positioning causing cascading failures
- Complex text highlighting maintenance
- Dependency on source file integrity for tag positioning
- Difficult export/packaging of analysis with source materials

## Target Architecture: Card-Centric Knowledge Management

### Cards as Primary Knowledge Objects
```
Structure: cards/analysis_uuid.card.txt
Content: Markdown with embedded original text + analysis
Format: Standard markdown with UUID references
```

### Two-Panel Display Architecture
**Panel 1 (Primary View)**: Clean original content extracted from card's "Original Content" section
- Displays HTML-rendered tables, formatted text, clean presentation
- Tag highlighting overlays for visual analysis
- Same user experience as before - select text, click cells, create tags
- Content sourced from card's embedded original data section

**Panel 2 (Metadata/Analysis View)**: Full ORCS card structure
- Complete card with metadata, analysis sections, tagged elements planning
- Raw markdown for editing analysis and metadata
- "Sausage making" view where users see/edit the structured format
- Source of truth for all card data

### Tag Files as Cross-Card Indexes
```
Structure: entities/TechCorp_uuid.entity.txt
Purpose: Index cards containing this entity
Content: Search aliases, entity type, description, KVP, card references
```

### Implemented Card Format ✓ COMPLETED
```markdown
=== ORCS CARD === 
version: "2025.003"
uuid: "card-uuid-here"
source_file: "original_document.txt"
source_reference: ""
classification: "Proprietary Information"
handling:
  - "Copyright 2025 TechWatch Intelligence"
  - "Distribution: Internal Use Only"
created: "timestamp"
modified: "timestamp"
source_hash: "sha256-of-original"

=== TAG INDEX START === 

=== TAG INDEX END ===

=== ORIGINAL CONTENT START ===
[Preserved original text section being analyzed]
=== ORIGINAL CONTENT END ===

## Analysis
The company [entity:TechCorp](uuid) announced their new [entity:AI platform](uuid) 
designed for [attribute:healthcare applications](uuid).

This establishes a [relationship:develops](uuid) relationship between TechCorp and the AI platform.

## Key Findings
- Market expansion into healthcare sector
- Technical capabilities in AI/ML
- Partnership potential with medical institutions
```

### Tag File Structure (Revised)
```
# Entity: TechCorp
UUID: techcorp-uuid
TYPE: entity
ENTITY_TYPE: organization
DESCRIPTION: Technology company specializing in AI platforms
SEARCH_ALIASES: ["tech corp", "technology corporation", "ai company"]
KEY_VALUE_PAIRS:
  industry: "artificial intelligence"
  sector: "healthcare technology"
  founded: "2020"
CARD_REFERENCES:
  - analysis_uuid1.card.txt
  - analysis_uuid2.card.txt
DIRECT_RELATIONSHIPS:
  - develops: platform-uuid
  - located_in: location-uuid
```

## Transition Strategy

### Phase 1: Dual System Implementation ✓ COMPLETED
**Objective**: Add card-centric workflow alongside existing system

**Technical Tasks**: ✓ COMPLETED
1. ✓ Create card creation workflow from selected source text
2. ✓ Implement markdown tag processing with entity linking
3. ✓ Build card content extraction system
4. ✓ Maintain existing tag highlighting for reference

**Implemented Features**:
- Clear delimiter-based card structure (`=== ORIGINAL CONTENT START/END ===`)
- DocumentViewer extracts original content from cards
- Markdown tag format: `[entity:TechCorp](uuid)`
- Color-coded tag highlighting by type
- Source file type detection from card metadata
- File sidebar prioritizes cards over original files

**User Experience**:
- Keep current interface functional
- Add "Create Analysis Card" option for text selections
- New card editor interface
- Maintain existing tag management

### Phase 2: Enhanced Card Management (Weeks 3-4)
**Objective**: Robust card-to-card and card-to-tag relationships

**Technical Tasks**:
1. Cross-card entity detection and linking
2. Enhanced tag file structure with card references
3. Card-based search and filtering
4. Export functionality for card collections

**User Experience**:
- Card-centric navigation
- Tag files show card references
- Search across cards and tags
- Export card collections with dependencies

### Phase 3: Migration Tools (Weeks 5-6)
**Objective**: Gradual migration from position-based to card-based

**Technical Tasks**:
1. Migration wizard for existing tags
2. Card generation from existing tag clusters
3. Verification tools for migration accuracy
4. Rollback mechanisms for failed migrations

**User Experience**:
- Optional migration prompts
- Preview migrations before execution
- Selective migration by file or tag type
- Maintain both systems during transition

### Phase 4: Unified Interface (Weeks 7-8)
**Objective**: Streamlined card-first workflow

**Technical Tasks**:
1. Card-first UI design
2. Simplified tag management
3. Optimized indexing for cards
4. Performance optimization

**User Experience**:
- Cards as primary workspace
- Source files as read-only reference
- Simplified tag creation/editing
- Faster search and navigation

## Special Considerations

### CSV File Handling
- Maintain current cell-based selection system
- Cards can reference specific CSV cells
- CSV structure is more stable than text highlighting
- Consider CSV-to-card extraction for complex analyses

### Indexing Strategy
**Startup Indexing Requirements**:
1. Scan all card files for entity references
2. Build cross-card relationship maps
3. Validate tag file references to existing cards
4. Detect orphaned tags or broken references
5. Generate search index from card content + metadata

**Index Structure**:
```
cards_index: {
  card_uuid: {
    entities: [entity-uuids],
    content_hash: sha256,
    last_modified: timestamp,
    source_file: original_file
  }
}

tags_index: {
  tag_uuid: {
    type: entity|relationship|attribute|comment|kv_pair,
    card_references: [card-uuids],
    search_aliases: [strings],
    relationships: [related-tag-uuids]
  }
}
```

### Migration Risk Mitigation
1. **Backup Strategy**: Full system backup before any migration
2. **Rollback Plan**: Maintain parallel systems until migration confirmed
3. **Validation**: Extensive testing of migrated data integrity
4. **User Training**: Clear documentation and examples
5. **Incremental Approach**: File-by-file or tag-by-tag migration options

## Current Implementation Status (June 27, 2025)

### ✓ COMPLETED - Phase 1: Card-Centric Foundation
**DocumentViewer Transformation**:
- Extracts original content using `=== ORIGINAL CONTENT START/END ===` delimiters
- Detects source file type (.txt/.csv) from card metadata `source_file:` field
- Processes markdown tags with format: `[entity:TechCorp](uuid)`
- Applies color-coded highlighting: entity (blue), relationship (green), attribute (yellow), comment (purple), kv_pair (orange)
- Maintains CSV table rendering and cell selection for card-embedded data

**File Management System**:
- Sidebar defaults to showing cards, hides UUID from display names
- Toggle button: "Show/Hide Original Files" 
- Clean card names: `news_clip_1.card.txt` instead of UUID versions
- Cards prioritized over original files in interface

**Card Structure Standardization**:
- Clear delimiter sections for metadata, tag index, and original content
- Consistent ORCS metadata format with version, UUID, source tracking
- Ready for tag storage in TAG INDEX sections

### 🔄 IN PROGRESS - Phase 2: Tag Integration
**Next Steps**:
1. Update tag creation workflow to reference cards instead of original files
2. Implement tag storage within card TAG INDEX sections
3. Build card-to-card relationship mapping through markdown links
4. Add error handling for missing content with re-import option
5. Create unified search across card content and embedded tags

## Implementation Priority

### Immediate (Current Phase 2)
- Tag creation integration with card system
- Card TAG INDEX section functionality
- Error handling for missing content scenarios
- Re-import workflow for incomplete cards

### Short-term (Phases 2-3)
- Enhanced indexing system for card-based tags
- Migration tools for existing tag files
- Cross-card relationships via markdown links
- Export capabilities preserving card structure

### Long-term (Phase 4+)
- Unified card-first interface
- Advanced search and filtering across cards
- Performance optimization for large card collections
- Mobile/offline capabilities

## Success Metrics
- Zero data loss during migration
- Improved tag creation speed
- Reduced highlighting errors
- Enhanced export capabilities
- User satisfaction with workflow

## Open Questions for Discussion
1. Should we maintain source file highlighting as a reference tool?
2. How granular should card creation be (sentence, paragraph, section)?
3. What's the preferred timeline for user migration?
4. Should we implement automated card suggestion from existing tags?
5. How do we handle collaborative editing of cards?