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

### Tag Files as Cross-Card Indexes
```
Structure: entities/TechCorp_uuid.entity.txt
Purpose: Index cards containing this entity
Content: Search aliases, entity type, description, KVP, card references
```

### Proposed Card Format
```markdown
# Analysis Card: Document Name
UUID: card-uuid-here
SOURCE_HASH: sha256-of-original
SOURCE_FILE: original_document.txt
CREATED: timestamp
MODIFIED: timestamp

## Original Content Extract
[Preserved original text section being analyzed]

## Analysis
The company [TechCorp](entity:techcorp-uuid) announced their new [AI platform](entity:platform-uuid) 
designed for [healthcare applications](attribute:healthcare-focus-uuid).

This establishes a [develops](relationship:develops-uuid) relationship between TechCorp and the AI platform.

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

### Phase 1: Dual System Implementation (Weeks 1-2)
**Objective**: Add card-centric workflow alongside existing system

**Technical Tasks**:
1. Create card creation workflow from selected source text
2. Implement markdown editor with entity linking
3. Build card indexing system
4. Maintain existing tag highlighting for reference

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

## Implementation Priority

### Immediate (Phase 1)
- Card creation from text selection
- Basic markdown editor with entity linking
- Card file management
- Dual-system UI

### Short-term (Phases 2-3)
- Enhanced indexing system
- Migration tools
- Cross-card relationships
- Export capabilities

### Long-term (Phase 4+)
- Unified card-first interface
- Advanced search and filtering
- Performance optimization
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