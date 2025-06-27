# Knowledge Management Architecture
*ORCS Intelligence System - Structural Foundation*

## Overview

This document establishes the architectural standards and implementation patterns for organizing, maintaining, and structuring discovered information within the ORCS Intelligence System. Following industry best practices from knowledge management, semantic web standards, and intelligence analysis methodologies.

## Industry Standards & Terminology

### Knowledge Organization Standards
Based on established library science, semantic web, and enterprise knowledge management practices:

#### Taxonomic Organization
- **Controlled Vocabularies**: Standardized term lists with defined relationships
- **Hierarchical Classifications**: Parent/child organizational structures
- **Faceted Classification**: Multiple simultaneous categorization schemes
- **Cross-References**: Bidirectional relationship indicators
- **Authority Control**: Canonical form management with variant tracking

#### Semantic Web Standards
- **RDF (Resource Description Framework)**: Triple-based relationship modeling
- **SKOS (Simple Knowledge Organization System)**: Vocabulary organization standard
- **Dublin Core**: Metadata element standardization
- **JSON-LD**: Linked data serialization format
- **OWL (Web Ontology Language)**: Formal relationship definitions

#### Entity-Relationship Modeling
- **Entities**: Discrete objects or concepts (persons, organizations, locations)
- **Relationships**: Connections between entities (works_for, located_in, affiliated_with)
- **Attributes**: Properties of entities (age, founded_date, classification_level)
- **Cardinality**: Relationship constraints (one-to-one, one-to-many, many-to-many)

### Content Structure Standards

#### Document Architecture
Following technical writing and information architecture standards:
- **Structured Content**: Hierarchical organization with clear delimiters
- **Metadata Schemas**: Standardized descriptive information
- **Version Control**: Change tracking and historical preservation
- **Content Lifecycle**: Creation → Review → Approval → Archive → Disposal

#### Markdown Standards
Based on CommonMark specification with intelligence analysis extensions:
- **Semantic Markup**: Meaning-based rather than presentation-based tagging
- **Link Structures**: Internal cross-references and external citations
- **Metadata Blocks**: YAML frontmatter for structured information
- **Extension Compatibility**: GitHub Flavored Markdown compliance

## Architectural Evolution: Location-Based to Card-Centric Knowledge

### Transition from Fragile Positioning to Robust Structure
ORCS knowledge management evolved from a location-based indexing system to a card-centric architecture due to fundamental structural problems:

#### Original Location-Based Challenges
- **Character offset fragility**: Tags positioned by character counts broke when documents were edited
- **Cascading reference failures**: One misaligned tag could break all subsequent tag positioning
- **Dual-file complexity**: Required constant synchronization between source documents and metadata files
- **Export difficulties**: Packaging analysis with source materials was complex and error-prone

#### Current Card-Centric Solution
- **Embedded knowledge**: Original content preserved within structured cards using delimiter sections
- **Markdown-based tagging**: Tags embedded as `[entity:Name](uuid)` format within content
- **Single source of truth**: Cards contain both original content and analysis in unified format
- **Stable cross-references**: UUID-based linking immune to content changes

### Entity-First Implementation Strategy
**Current Status**: Entity tags fully transitioned, serving as proven baseline for other tag types

#### Entity Tag Structure (Complete)
```markdown
=== ORCS CARD ===
[Card metadata with classification, handling, timestamps]

=== TAG INDEX START ===
[entity:TechCorp](uuid-reference)
=== TAG INDEX END ===

=== ORIGINAL CONTENT START ===
The company [entity:TechCorp](uuid-reference) announced their new platform.
=== ORIGINAL CONTENT END ===
```

#### Official Tag Color Schema
**Industry Standard**: Consistent visual identity system for knowledge classification

| Tag Type | Color Theme | Tailwind Classes | Knowledge Domain |
|----------|-------------|------------------|------------------|
| **Entity** | Green | `bg-green-500/20 text-green-300 border-green-500/30` | Organizations, people, locations, objects |
| **Relationship** | Orange | `bg-orange-500/20 text-orange-300 border-orange-500/30` | Connections between entities |
| **Attribute** | Purple | `bg-purple-500/20 text-purple-300 border-purple-500/30` | Properties and characteristics |
| **Comment** | Blue | `bg-blue-500/20 text-blue-300 border-blue-500/30` | Analysis and observations |
| **Key-Value** | Amber | `bg-amber-500/20 text-amber-300 border-amber-500/30` | Structured data pairs |

#### Pending Tag Type Migrations
Following entity tag proven patterns:
- **Relationship tags**: `[relationship:develops](uuid)` - Orange visual theme
- **Attribute tags**: `[attribute:healthcare_focus](uuid)` - Purple visual theme  
- **Comment tags**: `[comment:analyst_observation](uuid)` - Blue visual theme
- **Key-Value tags**: `[kv_pair:industry=AI](uuid)` - Amber visual theme

**Implementation Status**: 
- **Entity tags**: Fully implemented across all components
- **Other tag types**: Color schema defined, following entity pattern for transition
- **Accessibility**: Sufficient contrast ratios, alpha transparency for readability

### Cross-Reference
*For search and discovery implementation details, see: [search-and-discovery-framework.md](./search-and-discovery-framework.md)*

## ORCS Knowledge Structure

### Core Data Model Architecture

#### Entity Schema Standards
**File**: `shared/schema.ts`
**Industry Standard**: Dublin Core + Custom Intelligence Extensions

##### Primary Entity Types
Following intelligence community standards:
- **Entity**: Discrete objects (persons, organizations, locations, events)
- **Relationship**: Connections between entities
- **Attribute**: Properties and characteristics
- **Comment**: Analysis and observations
- **Key-Value Pair**: Structured metadata

##### Schema Implementation
```typescript
// Current ORCS Schema Structure
tagSchema = {
  id: UUID (RFC 4122 compliant),
  name: string (canonical form),
  tagType: enum ['entity', 'relationship', 'attribute', 'comment', 'kv_pair'],
  entityType: string (subtype classification),
  aliases: string[] (search aliases for discovery),
  description: string (scope notes),
  keyValuePairs: Record<string, string> (structured metadata),
  references: string[] (document connections),
  created: timestamp (ISO 8601),
  modified: timestamp (ISO 8601)
}
```

#### Relationship Management Standards
**Industry Standard**: Graph database relationship modeling

##### Connection Types
- **Direct References**: Explicit entity mentions in documents
- **Inferred Relationships**: Derived from proximity or context
- **Hierarchical Relationships**: Parent/child entity structures
- **Temporal Relationships**: Time-based connections
- **Spatial Relationships**: Geographic or locational connections

##### ORCS Implementation
- **Current**: Basic tag-to-document references
- **Storage**: `references` array in tag schema
- **Enhancement**: Needs typed relationship support

### Document Structure Standards

#### ORCS Card Format
**Industry Standard**: Intelligence Community Directive (ICD) 206 compliance concepts
**File Extension**: `.card.txt`

##### Standard Structure
```
=== ORCS CARD ===
CLASSIFICATION: [LEVEL]
HANDLING: [INSTRUCTIONS]
SOURCE: [CITATION]
HASH: [CONTENT_INTEGRITY]
CREATED: [ISO_DATE]
MODIFIED: [ISO_DATE]

=== TAG INDEX ===
[entity:EntityName](uuid-reference)
[relationship:ConnectionType](uuid-reference)
[attribute:PropertyName](uuid-reference)

=== ORIGINAL CONTENT START ===
[Source document content with embedded tag markup]
=== ORIGINAL CONTENT END ===

=== ANALYSIS NOTES ===
[Analyst observations and interpretations]
```

##### ORCS Implementation
- **Current**: Delimiter-based parsing in `DocumentViewer.tsx`
- **Backend**: Content extraction in `orcsService.ts`
- **Standard**: Consistent YAML metadata format

#### Tag File Format
**Industry Standard**: SKOS-compliant authority records
**File Extensions**: `.entity.txt`, `.relate.txt`, `.attrib.txt`, `.comment.txt`, `.kv.txt`

##### Standard Structure
```
=== ORCS ENTITY ===
VERSION: 1.0
TAG_TYPE: entity
ENTITY_TYPE: person
SEARCH_ALIASES:
  - John Smith
  - J. Smith
  - Johnny
DESCRIPTION: Primary analyst contact
KEY_VALUE_PAIRS:
  title: Senior Analyst
  department: Intelligence
  clearance: Top Secret
CARD_REFERENCES:
  - document-uuid-1.card.txt
  - document-uuid-2.card.txt
CREATED: 2025-12-27T16:30:00Z
MODIFIED: 2025-12-27T16:30:00Z
```

##### ORCS Implementation
- **Current**: YAML format parsing in `orcsService.parseTagFromOrcsFile()`
- **Storage**: Individual files per tag with location-agnostic discovery
- **Standard**: Consistent field naming and list format

### Knowledge Graph Architecture

#### Graph Data Model
**Industry Standard**: Property graph model (Neo4j, Amazon Neptune)
**ORCS Implementation**: `graphDataSchema` in `shared/schema.ts`

##### Node Structure
```typescript
GraphNode = {
  id: string (entity UUID),
  name: string (display name),
  type: TagType (entity classification),
  entityType?: string (subtype),
  x?: number (visualization coordinate),
  y?: number (visualization coordinate)
}
```

##### Edge Structure
```typescript
GraphEdge = {
  source: string (source node UUID),
  target: string (target node UUID),
  type: string (relationship type),
  weight?: number (connection strength)
}
```

#### Visualization Standards
**Industry Standard**: Force-directed graph layouts (D3.js, Cytoscape)

##### Layout Algorithms
- **Force-Directed**: Natural clustering and separation
- **Hierarchical**: Tree-like organizational structures
- **Circular**: Centrality-based positioning
- **Manual**: User-controlled positioning

##### ORCS Implementation
- **Current**: Basic node/edge generation in `orcsService.generateGraphData()`
- **Visualization**: SVG-based rendering (planned)
- **Enhancement**: Needs advanced layout algorithms

### Metadata Management Standards

#### Classification and Handling
**Industry Standard**: Information Security classification schemes
**ORCS Implementation**: Card-level metadata

##### Classification Levels
Following generic corporate/proprietary marking standards:
- **Public**: No restrictions
- **Internal**: Organization use only
- **Confidential**: Limited distribution
- **Restricted**: Highly sensitive
- **Proprietary**: Trade secret level

##### Handling Instructions
- **Distribution Controls**: Who can access/share
- **Retention Policies**: How long to maintain
- **Destruction Requirements**: Secure disposal methods
- **Derivative Classification**: Marking for extracted content

#### Temporal Metadata
**Industry Standard**: ISO 8601 timestamp formats

##### Standard Fields
- **Created**: Initial entity/document creation
- **Modified**: Last substantive change
- **Accessed**: Last view/interaction (optional)
- **Expires**: Retention policy date (optional)

##### ORCS Implementation
- **Current**: Created/modified timestamps in all schemas
- **Format**: ISO 8601 UTC timestamps
- **Enhancement**: Needs access tracking and retention policies

### Version Control and Change Management

#### Change Tracking Standards
**Industry Standard**: Audit trail and provenance tracking

##### Change Types
- **Content Changes**: Substantive information updates
- **Metadata Changes**: Classification or handling updates
- **Relationship Changes**: Connection additions/removals
- **Structure Changes**: Format or organization modifications

##### Audit Requirements
- **Who**: User identification (future enhancement)
- **What**: Specific changes made
- **When**: Precise timestamp
- **Why**: Change justification (optional)
- **Where**: System location/context

#### Version Management
**Industry Standard**: Semantic versioning concepts adapted for knowledge

##### Version Strategies
- **Document Versions**: Major.Minor.Patch for significant changes
- **Entity Versions**: Incremental for relationship changes
- **Schema Versions**: Compatibility tracking for format changes
- **System Versions**: Overall platform versioning

##### ORCS Implementation
- **Current**: Basic modification timestamps
- **Planned**: Formal version tracking
- **Enhancement**: Change diff capabilities

## Knowledge Organization Patterns

### Tag Taxonomy Management

#### Type Hierarchy Standards
**Industry Standard**: Faceted classification with controlled vocabularies

##### Primary Classifications
- **Entity Types**: Person, Organization, Location, Event, Object
- **Relationship Types**: Hierarchical, Associative, Temporal, Spatial
- **Attribute Types**: Physical, Logical, Temporal, Qualitative
- **Comment Types**: Analysis, Observation, Hypothesis, Question
- **KV Types**: Technical, Administrative, Descriptive, Security

##### ORCS Implementation
- **Current**: `tagTypeSchema` enum with 5 core types
- **Enhancement**: Needs hierarchical subtypes
- **Location**: `shared/schema.ts`

#### Entity Subtype Management
**Industry Standard**: Extensible classification schemes

##### Standard Subtypes
```
Entity Types:
  - Person: individual, role, persona
  - Organization: government, commercial, non-profit, informal
  - Location: geographic, facility, virtual, conceptual
  - Event: meeting, transaction, incident, milestone
  - Object: document, device, vehicle, weapon
```

##### ORCS Implementation
- **Current**: `entityType` string field in tag schema
- **Enhancement**: Needs controlled vocabulary validation
- **Configuration**: Extensible through reference libraries

### Cross-Reference Management

#### Reference Types and Standards
**Industry Standard**: Bibliographic and hyperlink standards

##### Reference Categories
- **Direct Citations**: Explicit document sources
- **Cross-References**: Related entity connections
- **External Links**: URLs and external identifiers
- **Internal Links**: System-internal connections

##### Link Integrity
- **Validation**: Automatic broken link detection
- **Updates**: Cascade changes through references
- **Versioning**: Historical link preservation
- **Cleanup**: Automatic orphan removal

#### ORCS Reference Implementation
**Current**: Basic document reference arrays
**Location**: `references` field in tag schema
**Format**: Card filename arrays

##### Reference Structure
```
CARD_REFERENCES:
  - document-uuid-1.card.txt
  - analysis-uuid-2.card.txt
  - report-uuid-3.card.txt
```

##### Enhancement Needs
- **Typed References**: Specify relationship nature
- **Bidirectional Links**: Automatic reverse reference maintenance
- **Link Validation**: Integrity checking and repair
- **Reference Metrics**: Usage and importance scoring

### Content Lifecycle Management

#### Lifecycle Stages
**Industry Standard**: Information lifecycle management

##### Standard Phases
1. **Creation**: Initial entity or document generation
2. **Development**: Content addition and refinement
3. **Review**: Quality assurance and validation
4. **Publication**: Release for operational use
5. **Maintenance**: Updates and corrections
6. **Archive**: Long-term preservation
7. **Disposal**: Secure destruction

##### ORCS Implementation
- **Current**: Creation and modification tracking only
- **Planned**: Full lifecycle status tracking
- **Enhancement**: Workflow integration

#### Content Quality Standards
**Industry Standard**: Data quality frameworks

##### Quality Dimensions
- **Accuracy**: Correctness of information
- **Completeness**: Thoroughness of coverage
- **Consistency**: Internal logical coherence
- **Currency**: Timeliness and freshness
- **Accessibility**: Usability and findability

##### ORCS Quality Controls
- **Current**: Basic format validation
- **Planned**: Content quality scoring
- **Enhancement**: Automated quality assessment

## Current Implementation Inventory

### Existing Knowledge Structures

#### 1. Tag Management System
**Location**: `server/services/orcsService.ts`
**Capabilities**: CRUD operations, file-based storage, location-agnostic discovery
**Standards Compliance**: Basic entity-relationship modeling

##### Key Methods
- `createTag()`: Entity creation with validation
- `updateTag()`: Modification with timestamp tracking
- `deleteTag()`: Removal with reference cleanup
- `mergeTags()`: Entity consolidation with reference preservation

#### 2. Card Management System
**Location**: `server/services/fileService.ts`
**Capabilities**: Structured document creation, metadata management
**Standards Compliance**: Delimiter-based parsing, YAML metadata

##### Key Methods
- `createMetadataFile()`: ORCS card generation
- `getMetadataForFile()`: Content extraction
- `updateMetadataFile()`: Modification handling

#### 3. Graph Data Generation
**Location**: `server/services/orcsService.ts`
**Method**: `generateGraphData()`
**Capabilities**: Node/edge extraction from tag relationships
**Standards Compliance**: Property graph model

#### 4. Search Integration
**Location**: `server/storage.ts`
**Capabilities**: Content indexing, keyword extraction
**Standards Compliance**: Inverted index with relevance scoring

### Frontend Knowledge Management

#### 1. Tag Editor Interface
**Location**: `client/src/components/TagEditor.tsx`
**Capabilities**: Entity editing, relationship management
**Standards Compliance**: Form-based metadata editing

#### 2. Document Viewer
**Location**: `client/src/components/DocumentViewer.tsx`
**Capabilities**: Structured content display, tag highlighting
**Standards Compliance**: Delimiter-based content parsing

#### 3. Tag Creation Modal
**Location**: `client/src/components/TagCreationModal.tsx`
**Capabilities**: Entity creation with type selection
**Standards Compliance**: Controlled vocabulary selection

#### 4. Merge Management
**Location**: `client/src/components/TagMergeModal.tsx`
**Capabilities**: Entity consolidation with reference analysis
**Standards Compliance**: Authority control with cross-reference management

## Integration Architecture

### Data Flow Patterns

#### Entity Creation Flow
1. **User Selection**: Text highlighting in DocumentViewer
2. **Type Classification**: TagCreationModal type selection
3. **Metadata Entry**: Form-based attribute collection
4. **Validation**: Schema compliance checking
5. **Storage**: File system persistence
6. **Indexing**: Search index updates
7. **Reference Creation**: Document link establishment

#### Entity Modification Flow
1. **Entity Selection**: TagEditor activation
2. **Content Editing**: Form-based updates
3. **Validation**: Schema and constraint checking
4. **Version Tracking**: Change timestamp updates
5. **Reference Updates**: Cross-reference synchronization
6. **Index Updates**: Search system synchronization

#### Entity Merging Flow
1. **Similarity Detection**: TagMergeModal analysis
2. **Reference Analysis**: Cross-document impact assessment
3. **User Confirmation**: Merge operation approval
4. **Content Consolidation**: Master entity creation
5. **Reference Migration**: Link updates to merged entities
6. **Cleanup**: Orphaned entity removal
7. **Index Rebuilding**: Search system synchronization

### API Integration Points

#### Core Knowledge APIs
- **Entity Management**: `/api/tags/*` endpoints
- **Content Management**: `/api/files/*` endpoints
- **Graph Operations**: `/api/graph/*` endpoints
- **Search Integration**: `/api/search/*` endpoints

#### Data Synchronization
- **Real-time Updates**: WebSocket connections (planned)
- **Batch Operations**: Bulk import/export capabilities
- **Conflict Resolution**: Multi-user edit handling
- **Backup/Restore**: System state preservation

## Future Enhancement Roadmap

### Phase 1: Foundation (Current)
- ✅ Basic entity-relationship model
- ✅ File-based persistence
- ✅ Structured content format
- ✅ Basic cross-referencing

### Phase 2: Enhanced Structure
- ⏳ Hierarchical entity types
- ⏳ Typed relationships
- ⏳ Advanced metadata schemas
- ⏳ Version control integration

### Phase 3: Quality Management
- ⏳ Content quality scoring
- ⏳ Automated validation
- ⏳ Lifecycle management
- ⏳ Audit trail implementation

### Phase 4: Advanced Integration
- ⏳ External vocabulary integration
- ⏳ Semantic web compliance
- ⏳ Machine learning enhancement
- ⏳ Collaborative workflow support

## Implementation Guidelines

### Code Organization Standards
- **Schema Centralization**: All data models in `shared/schema.ts`
- **Service Layer**: Business logic in dedicated service classes
- **Component Separation**: UI logic separate from data management
- **API Consistency**: RESTful endpoint patterns

### Performance Standards
- **Response Time**: < 200ms for entity operations
- **Scalability**: Support for 100,000+ entities
- **Memory Efficiency**: Lazy loading and caching strategies
- **Concurrent Access**: Multi-user capability

### Security Standards
- **Access Control**: Entity-level permissions (planned)
- **Audit Logging**: Complete change tracking
- **Data Encryption**: Sensitive content protection
- **Backup Security**: Encrypted state preservation

### Quality Assurance
- **Schema Validation**: Zod-based type checking
- **Integration Testing**: End-to-end workflow validation
- **Performance Testing**: Load and stress testing
- **User Acceptance**: Workflow usability validation

## Document Changelog

### December 27, 2025 - Foundation Document Created
- Established comprehensive knowledge management architecture framework
- Documented industry standards for entity-relationship modeling, semantic web compliance
- Integrated architectural evolution from location-based to card-centric knowledge structure
- Created ORCS card format standards with delimiter-based content organization
- Documented entity-first implementation strategy as proven baseline for other tag types
- Added official tag color schema with implementation status tracking
- Cross-referenced with search-and-discovery-framework.md for unified documentation

### Current Implementation Status
- **Entity Knowledge Structure**: Fully implemented with card-centric architecture
- **Tag Color Schema**: Complete visual identity system defined
- **Card Format**: Standardized structure with metadata, index, content, and analysis sections
- **Pending Tag Migrations**: Relationship, attribute, comment, key-value following entity patterns

---

*Created: December 27, 2025*
*Updated: December 27, 2025 - Integrated Index Transition Documentation*
*Industry Standards: Knowledge Management, Semantic Web, Intelligence Analysis*
*Architecture Status: Foundation Phase Complete - Entity Knowledge Baseline Established*