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

### Search Integration Points

#### Frontend Components
- **DocumentViewer**: `client/src/components/DocumentViewer.tsx`
- **TagMergeModal**: `client/src/components/TagMergeModal.tsx`
- **TagEditor**: `client/src/components/TagEditor.tsx`
- **FileManagerSidebar**: `client/src/components/FileManagerSidebar.tsx`

#### Backend Services
- **OrcsService**: `server/services/orcsService.ts`
- **FileService**: `server/services/fileService.ts`
- **Storage**: `server/storage.ts`

#### API Endpoints
- **Search Files**: `/api/search/files`
- **Search Content**: `/api/search/content`
- **Rebuild Index**: `/api/index/rebuild`

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

---

*Created: December 27, 2025*
*Industry Standards: Information Retrieval, Enterprise Search, Intelligence Analysis*
*Framework Status: Foundation Phase Complete*