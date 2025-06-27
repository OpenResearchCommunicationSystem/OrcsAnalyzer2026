# Search and Discovery Framework
*ORCS Intelligence System - Foundational Architecture*

## Overview

This document establishes the architectural standards and implementation patterns for all search and discovery operations within the ORCS Intelligence System. Following industry best practices from information retrieval, enterprise search, and intelligence analysis domains.

## Industry Standards & Terminology

### Core Search Operations
Based on established information retrieval and enterprise search standards:

#### Text Search Standards
- **Literal Search**: Exact string matching with case sensitivity options
- **Wildcard Search**: Pattern matching using `*` (any characters) and `?` (single character)
- **Regular Expression Search**: PCRE-compatible pattern matching
- **Fuzzy Search**: Edit distance algorithms (Levenshtein, Damerau-Levenshtein)
- **Phonetic Search**: Soundex, Metaphone, Double Metaphone algorithms

#### Boolean Search Operations
Following traditional library science and database query standards:
- **AND**: All terms must be present
- **OR**: Any term can be present  
- **NOT**: Exclude terms
- **Parenthetical Grouping**: `(term1 OR term2) AND term3`
- **Phrase Search**: `"exact phrase"` matching
- **Field-Specific Search**: `field:value` syntax

#### Proximity Search Standards
- **Adjacent**: Terms must be next to each other
- **Within Sentence**: Terms within same sentence boundary
- **Within Paragraph**: Terms within same paragraph boundary
- **Near Operator**: `term1 NEAR/n term2` (within n words)
- **Ordered Proximity**: Terms must appear in specified order

### Reference Data Management Standards

#### Controlled Vocabularies (Authority Files)
Following library science and semantic web standards:
- **Authority Records**: Canonical forms with variant tracking
- **Cross-References**: See/See Also relationships
- **Hierarchical Relationships**: Broader/Narrower term structures
- **Scope Notes**: Usage guidance and definitions

#### Watch Lists and Indicator Libraries
Based on intelligence analysis and compliance standards:
- **OFAC Sanctions Lists**: Financial sanctions and restricted entities
- **PEP Lists**: Politically Exposed Persons databases
- **Geographic Gazetteers**: Standardized place name authorities
- **Industry Classification Systems**: NAICS, SIC, custom taxonomies

#### Pattern Libraries
Following software engineering and data validation standards:
- **Regular Expression Catalogs**: Reusable pattern collections
- **Validation Rulesets**: Format verification patterns
- **Extraction Templates**: Structured data extraction rules
- **Normalization Rules**: Data standardization patterns

### Search Alias Management
Professional terminology for query expansion:
- **Search Aliases**: Alternative terms for entity discovery (current ORCS implementation)
- **Synonyms**: Equivalent terms with same meaning
- **Variants**: Different forms of same entity (abbreviations, acronyms)
- **Alternative Labels**: SKOS-compliant terminology
- **Preferred Terms**: Canonical form selection

## Search Strategy Categories

### 1. Find and Replace Operations
**Purpose**: Text substitution with validation
**Industry Standard**: Similar to IDE/editor replace functions

#### Standard Options
- Case sensitivity control
- Whole word matching
- Regular expression support
- Scope limitation (selection, document, repository)
- Preview before execution
- Undo/rollback capability

#### ORCS Implementation Locations
- **Current**: Not yet implemented
- **Planned**: Document editor integration
- **Dependencies**: Text selection system, content modification API

### 2. Find and Rename Operations  
**Purpose**: Entity identifier changes with referential integrity
**Industry Standard**: Refactoring tools in IDEs

#### Standard Features
- Dependency analysis before rename
- Preview of all affected locations
- Atomic transaction (all or nothing)
- Rollback capability
- Cross-reference validation

#### ORCS Implementation Locations
- **Current**: Tag merge functionality in `TagMergeModal.tsx`
- **Backend**: `orcsService.mergeTags()` method
- **Related**: Reference analysis system

### 3. Boolean Search Operations
**Purpose**: Complex query construction
**Industry Standard**: Database query languages, search engines

#### Standard Operators
- **AND**: `entity1 AND entity2`
- **OR**: `entity1 OR entity2`
- **NOT**: `entity1 NOT entity2`
- **Grouping**: `(entity1 OR entity2) AND entity3`
- **Wildcards**: `entit*` or `entity?`

#### ORCS Implementation Locations
- **Current**: Basic keyword search in `storage.ts`
- **Planned**: Advanced query builder interface
- **Dependencies**: Query parser, result ranking

### 4. Proximity Search Operations
**Purpose**: Contextual relationship discovery
**Industry Standard**: Information retrieval systems

#### Standard Types
- **Same Sentence**: Terms within sentence boundaries
- **Same Paragraph**: Terms within paragraph boundaries
- **Within N Words**: Configurable distance limits
- **Ordered Proximity**: Terms in specified sequence

#### ORCS Implementation Locations
- **Current**: Reference analysis in `useReferenceAnalysis.ts`
- **Files**: `client/src/hooks/useReferenceAnalysis.ts`
- **Backend**: Content parsing in `orcsService.ts`

### 5. Semantic Search Operations
**Purpose**: Meaning-based discovery beyond literal matching
**Industry Standard**: Modern search engines, knowledge graphs

#### Standard Approaches
- **Concept Matching**: Related term discovery
- **Entity Recognition**: Automatic entity extraction
- **Relationship Inference**: Connection discovery
- **Context Analysis**: Meaning from surrounding text

#### ORCS Implementation Locations
- **Current**: Tag similarity analysis in `TagMergeModal.tsx`
- **Backend**: `orcsService.generateGraphData()` method
- **Planned**: Enhanced similarity algorithms

## Reference Data Library Architecture

### Library Types and Standards

#### 1. Normalization Libraries (Controlled Vocabularies)
**Purpose**: Standardize entity names and forms
**Industry Standard**: Library science authority control

##### Standard Components
- **Preferred Terms**: Canonical entity names
- **Alternative Forms**: Abbreviations, acronyms, variants
- **Cross-References**: Related entity connections
- **Scope Notes**: Usage guidance

##### ORCS Implementation
- **Current**: Search aliases in tag records
- **Storage**: `aliases` field in tag schema
- **Location**: `shared/schema.ts` - `tagSchema`

#### 2. Pattern Libraries (Regular Expression Catalogs)
**Purpose**: Automated entity recognition and validation
**Industry Standard**: Data validation and extraction systems

##### Standard Categories
- **Identification Numbers**: SSN, passport, license patterns
- **Contact Information**: Email, phone, address formats
- **Financial Data**: Account numbers, routing codes
- **Custom Patterns**: Organization-specific formats

##### ORCS Implementation
- **Current**: Not yet implemented
- **Planned**: Configurable pattern libraries
- **Dependencies**: Pattern matching engine

#### 3. Indicator Libraries (Watch Lists)
**Purpose**: Automated flagging of entities of interest
**Industry Standard**: Intelligence analysis and compliance systems

##### Standard Sources
- **Government Lists**: OFAC, terrorism watch lists
- **Commercial Data**: D&B, credit databases  
- **Industry Specific**: Medical codes, legal citations
- **Custom Lists**: Organization-specific indicators

##### ORCS Implementation
- **Current**: Not yet implemented
- **Planned**: External library integration
- **Dependencies**: API connectors, update mechanisms

### Library Management Standards

#### Configuration Control
- **Toggle Switches**: Enable/disable individual libraries
- **Precedence Rules**: Priority order for conflicting matches
- **Version Control**: Track library updates and changes
- **Audit Trails**: Record library influence on matches

#### Data Integration
- **Import Formats**: JSON, CSV, XML support
- **API Connections**: REST endpoints for external sources
- **Update Schedules**: Automated refresh mechanisms
- **Validation Rules**: Data quality assurance

## Search Scoping Architecture

### Scope Types and Standards

#### 1. Document-Level Search
**Purpose**: Search within current document only
**Industry Standard**: Text editor find functions

##### Standard Features
- **Current Document**: Active file content only
- **Selection-Based**: Within highlighted text
- **Field-Specific**: Metadata vs content distinction
- **Case Sensitivity**: Toggle option

##### ORCS Implementation
- **Current**: Document viewer search (basic)
- **Location**: `DocumentViewer.tsx`
- **Enhancement**: Needs advanced scoping

#### 2. Repository-Level Search
**Purpose**: Search across entire document collection
**Industry Standard**: Enterprise search systems

##### Standard Features
- **Full-Text Search**: All document content
- **Metadata Search**: Classification, dates, authors
- **Faceted Search**: Multiple simultaneous filters
- **Result Ranking**: Relevance scoring

##### ORCS Implementation
- **Current**: `storage.searchFiles()` and `storage.searchContent()`
- **Location**: `server/storage.ts`
- **Enhancement**: Needs faceted search capabilities

#### 3. Tag-Filtered Search
**Purpose**: Search within specific tag categories or relationships
**Industry Standard**: Knowledge graph queries

##### Standard Features
- **Tag Type Filtering**: By entity, relationship, attribute types
- **Connection Traversal**: Following tag relationships
- **Hierarchical Search**: Parent/child tag structures
- **Temporal Filtering**: By creation/modification dates

##### ORCS Implementation
- **Current**: `storage.getTagsByType()` method
- **Location**: `server/storage.ts`
- **Enhancement**: Needs relationship traversal

## Architectural Transition: From Location-Based to Card-Centric

### Historical Context
ORCS originally implemented location-based tag indexing using character offset positioning within source documents. This approach proved problematic due to:
- **Fragile positioning**: Character offsets broke when documents were edited
- **Cascading failures**: One broken reference could misalign all subsequent tags
- **Dual-file dependencies**: Required coordination between source files and metadata files
- **Complex maintenance**: Tag highlighting required constant position recalculation

### Current Card-Centric Architecture
The system transitioned to a card-centric model where:
- **Single source of truth**: Tags embedded as markdown within `.card.txt` files
- **Stable references**: Tags use UUID-based linking instead of character positions
- **Embedded content**: Original documents preserved within cards using delimited sections
- **Robust highlighting**: Visual tags rendered from markdown format `[entity:Name](uuid)`

### Entity Tag Baseline (Fully Transitioned)
**Status**: Complete implementation serving as foundation for other tag types
- **Color coding**: Green (`bg-green-500/20 text-green-300 border-green-500/30`)
- **Markdown format**: `[entity:TechCorp](uuid-reference)`
- **Card integration**: Embedded in both TAG INDEX and ORIGINAL CONTENT sections
- **Search integration**: Fully indexed and discoverable

### Pending Tag Type Transitions
**Status**: Following entity tag pattern once search/discovery baseline is established
- **Relationship**: Orange - `[relationship:develops](uuid)` 
- **Attribute**: Purple - `[attribute:healthcare_focus](uuid)`
- **Comment**: Blue - `[comment:analyst_observation](uuid)`
- **Key-Value**: Amber - `[kv_pair:industry=AI](uuid)`

*Note: All tag types use consistent color schema and markdown patterns. Migration follows entity tag proven approach.*

### Cross-Reference
*For detailed knowledge organization patterns, see: [knowledge-management-architecture.md](./knowledge-management-architecture.md)*

## Current Implementation Inventory

### Existing Search Capabilities

#### 1. Basic Text Search
**Location**: `server/storage.ts`
**Methods**: `searchFiles()`, `searchContent()`
**Features**: Keyword matching, relevance scoring
**Limitations**: No boolean operators, no proximity search

#### 2. Tag Similarity Analysis
**Location**: `client/src/components/TagMergeModal.tsx`
**Method**: `findSimilarTags()` function
**Features**: Name matching, alias comparison
**Limitations**: Simple string matching only

#### 3. Reference Analysis
**Location**: `client/src/hooks/useReferenceAnalysis.ts`
**Purpose**: Find tagged/untagged entity references
**Features**: Alias-based matching, configurable scope
**Limitations**: No proximity analysis, no pattern matching

#### 4. File Content Parsing
**Location**: `server/services/orcsService.ts`
**Method**: Content extraction from cards
**Features**: Delimiter-based parsing, format detection
**Limitations**: No structured content analysis

### Official Tag Color Schema for Search Results
Visual identity system ensuring consistent search result presentation:

| Tag Type | Color Theme | Tailwind Classes | Search Context |
|----------|-------------|------------------|----------------|
| **Entity** | Green | `bg-green-500/20 text-green-300 border-green-500/30` | Organizations, people, locations, objects |
| **Relationship** | Orange | `bg-orange-500/20 text-orange-300 border-orange-500/30` | Connections between entities |
| **Attribute** | Purple | `bg-purple-500/20 text-purple-300 border-purple-500/30` | Properties and characteristics |
| **Comment** | Blue | `bg-blue-500/20 text-blue-300 border-blue-500/30` | Analysis and observations |
| **Key-Value** | Amber | `bg-amber-500/20 text-amber-300 border-amber-500/30` | Structured data pairs |

**Implementation**: Colors maintain accessibility with sufficient contrast ratios, alpha transparency (20%) allows text readability, consistent across all search interfaces.

### Search Integration Points

#### Frontend Components
- **DocumentViewer**: `client/src/components/DocumentViewer.tsx` - Card content extraction, tag highlighting
- **TagMergeModal**: `client/src/components/TagMergeModal.tsx` - Reference analysis, similarity search
- **TagEditor**: `client/src/components/TagEditor.tsx` - Individual tag search operations
- **FileManagerSidebar**: `client/src/components/FileManagerSidebar.tsx` - File discovery interface

#### Backend Services
- **OrcsService**: `server/services/orcsService.ts` - Tag operations, graph generation
- **FileService**: `server/services/fileService.ts` - File content operations
- **Storage**: `server/storage.ts` - Core search implementation

#### API Endpoints
- **Search Files**: `/api/search/files` - Document-level search
- **Search Content**: `/api/search/content` - Full-text content search
- **Rebuild Index**: `/api/index/rebuild` - Search index maintenance

## Future Enhancement Roadmap

### Phase 1: Foundation (Current)
- ✅ Basic text search
- ✅ Tag similarity analysis
- ✅ Reference analysis framework
- ✅ Search alias management

### Phase 2: Advanced Search
- ⏳ Boolean search operators
- ⏳ Regular expression support
- ⏳ Proximity search capabilities
- ⏳ Fuzzy matching algorithms

### Phase 3: Reference Libraries
- ⏳ Configurable library management
- ⏳ External data source integration
- ⏳ Pattern library implementation
- ⏳ Watch list functionality

### Phase 4: Semantic Enhancement
- ⏳ Concept-based matching
- ⏳ Relationship inference
- ⏳ Context analysis
- ⏳ Machine learning integration

## Implementation Guidelines

### Code Organization Standards
- **Search Logic**: Centralized in service layer
- **UI Components**: Reusable search interface elements
- **Configuration**: Environment-based library management
- **Testing**: Comprehensive search scenario coverage

### Performance Standards
- **Response Time**: < 500ms for basic searches
- **Scalability**: Support for 10,000+ documents
- **Memory Usage**: Efficient indexing and caching
- **Concurrency**: Multi-user search capability

### Security Standards
- **Access Control**: User-based search permissions
- **Audit Logging**: Search query tracking
- **Data Protection**: Sensitive content handling
- **Library Security**: Trusted source validation

## Document Changelog

### December 27, 2025 - Foundation Document Created
- Established comprehensive search and discovery framework architecture
- Documented industry standards for Boolean, proximity, semantic search operations
- Integrated index transition lessons from location-based to card-centric architecture
- Created reference data library management standards (controlled vocabularies, pattern libraries, watch lists)
- Documented entity tag baseline implementation as foundation for other tag types
- Added official tag color schema for consistent search result presentation
- Cross-referenced with knowledge-management-architecture.md for unified documentation

### Current Implementation Status
- **Entity Tags**: Fully transitioned to card-centric model, serving as proven baseline
- **Search Integration**: Basic text search, tag similarity analysis, reference analysis functional
- **Color Schema**: Complete visual identity system implemented
- **Pending Migrations**: Relationship, attribute, comment, key-value tags following entity pattern

## UI/UX Design Patterns for Search & Discovery

### Visual Hierarchy Standards
- **Clean Name Priority**: Human-readable names prominently displayed over technical identifiers
- **UUID Visibility Policy**: Hidden from primary display, shown only when technically necessary for disambiguation
- **Progressive Disclosure**: Essential information first, detailed technical data expandable or secondary

### Similarity Search Interface Standards
Based on Find & Merge Modal implementation:

#### Match Quality Display
- **Perfect Matches (100%+)**: Gold "Perfect Match" badge with enhanced visual treatment
- **Partial Matches (50-99%)**: Muted percentage badges showing exact similarity score
- **Low Matches (<50%)**: Standard display with clear indication of limited relevance

#### Match Explanation Standards
- **Descriptive Reasons**: Specific explanations over generic percentages
  - Example: "Name contains 'TechCorp'" instead of "75% name match"
  - Example: "Alias match: technology" instead of "50% alias match"
- **Multiple Criteria**: Combined explanations when multiple factors contribute
- **User-Friendly Language**: Avoid technical terminology in match descriptions

#### Reference Display Guidelines
- **Context Over Location**: Show content snippets rather than file paths for relevance assessment
- **Clean File Names**: Remove UUIDs from displayed filenames in reference lists
- **Relevance Indicators**: Visual cues for reference strength and confidence

### Search Result Organization
- **Categorized Results**: Group by match type (exact, partial, alias, context)
- **Relevance Sorting**: Highest confidence matches first within each category
- **Quick Actions**: Immediate access to merge, edit, or navigate actions

### Implementation Cross-References
- **Find & Merge Modal**: Complete implementation in `client/src/components/TagMergeModal.tsx`
- **UI Standards**: Comprehensive guidelines in `replit.md` - UI Standards and Technical Guidelines
- **File Resilience**: Three-tier lookup strategy documented in `replit.md`

---

*Created: December 27, 2025*
*Updated: December 27, 2025 - Added UI/UX Design Patterns from Find & Merge Modal*
*Industry Standards: Information Retrieval, Enterprise Search, Intelligence Analysis*
*Framework Status: Foundation Phase Complete - Entity Baseline Established*