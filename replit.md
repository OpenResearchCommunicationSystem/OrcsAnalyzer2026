# ORCS Intelligence System

## Overview

This is a sophisticated intelligence analysis and document management system called ORCS (Open Research Communication System). The application is designed to help analysts process, tag, and visualize relationships within intelligence documents through an interactive web interface.

The system uses a full-stack architecture with a React frontend, Express.js backend, and file-based storage system that organizes intelligence data into structured formats including ORCS cards, tags, and relationship mappings.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom ORCS-themed color scheme
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **File Processing**: Multer for file uploads
- **API Design**: RESTful API with JSON responses
- **Validation**: Zod schemas for type-safe data validation

### Data Storage Solutions
- **Primary Storage**: File-based system organized in structured directories
- **Search Index**: Persistent JSON-based index stored in `user_data/index.json`
- **Database**: PostgreSQL 16 (configured but not yet implemented with Drizzle ORM)
- **File Organization**: Hierarchical directory structure under `user_data/`
  - `raw/` - Original uploaded files (.txt, .csv) with companion .yaml.txt metadata files
  - `entities/`, `relationships/`, `attributes/`, `comments/`, `kv_pairs/` - Categorized tags
  - `index.json` - Search index with keywords, content hashes, and metadata

## Key Components

### File Management System
- Supports upload and processing of .txt and .csv files
- Automatic generation of ORCS cards from uploaded content
- File metadata tracking (size, creation date, modification date)
- Content parsing and display with syntax highlighting
- Complete file deletion with automatic cleanup of related files (source + ORCS card)

### Tagging and Annotation System
- Five tag types: Entity, Relationship, Attribute, Comment, Key-Value Pair
- Text selection-based tagging with precise character offset tracking
- Tag metadata includes search aliases, descriptions, and custom key-value pairs
- Visual tag indicators with color-coded representations
- **Search Aliases System**: Aliases field is designed for finding untagged content in documents, not for report aliases (which go in attributes/key-value pairs)

### Graph Visualization
- Interactive visualization of relationships between tagged elements
- Node-based representation of entities and their connections
- Real-time updates as new tags and relationships are created
- SVG-based rendering for scalability

### Search and Indexing System
- Persistent search index stored in `user_data/index.json`
- Automatic indexing on startup and file changes
- Keyword extraction with stop-word filtering
- Content-based search with relevance scoring
- API endpoints: `/api/search/files`, `/api/search/content`, `/api/index/rebuild`
- Index includes file names, content, tags, and metadata

### ORCS Card System
- Structured intelligence document format with standardized metadata
- Classification and handling instructions for sensitive information
- Citation tracking and source verification
- Automatic hash generation for content integrity

## Data Flow

1. **File Upload**: Users upload .txt or .csv files through the web interface
2. **Processing**: Server processes files, generates metadata, and creates initial ORCS cards
3. **Storage**: Files stored in structured directory system with JSON metadata
4. **Analysis**: Users select text and create tags (entities, relationships, attributes)
5. **Visualization**: Tag data feeds into graph visualization system
6. **Export**: Tagged data can be exported or further processed

## External Dependencies

### Core Dependencies
- React ecosystem (@tanstack/react-query, wouter)
- Radix UI components for accessible interface elements
- Tailwind CSS for styling
- Express.js for server-side API
- Multer for file upload handling
- Zod for schema validation and type safety

### Development Dependencies
- Vite for build tooling and development server
- TypeScript for type safety
- ESBuild for server bundling
- Various Replit-specific plugins for development environment

## Deployment Strategy

### Development Environment
- Replit-based development with hot module replacement
- Vite dev server for frontend development
- Express server with TypeScript compilation via TSX
- PostgreSQL database provisioning through Replit modules

### Production Deployment
- Static frontend build served by Express server
- Server bundling with ESBuild for optimized Node.js deployment
- Replit autoscale deployment target
- Port configuration: Internal 5000 → External 80

### File System Requirements
- Persistent storage for user_data directory structure
- Write permissions for file uploads and ORCS card generation
- Directory creation capabilities for organizing tag categories

## Changelog
```
Changelog:
- June 15, 2025. Initial setup
- June 15, 2025. Added complete file deletion functionality with automatic cleanup of related files
- June 15, 2025. Implemented YAML metadata system with .yaml.txt companion files
- June 15, 2025. Created unified document viewer showing raw content + editable metadata
- June 15, 2025. Added CSV table viewer with click-to-select cell functionality
- June 15, 2025. Implemented content search indexing with persistent storage
- June 15, 2025. Completed expandable/collapsible folder tree structure for tag directories
- June 15, 2025. Removed obsolete cards folder, tags now displayed as individual files within type folders
- June 15, 2025. Added entity type system with subtypes for all tag categories
- June 15, 2025. Implemented tag editor dropdown for entity types (person, organization, location, etc.)
- June 15, 2025. Added entity type selection to tag creation modal
- June 15, 2025. Connected tag clicking from file sidebar to tag editor for seamless editing
- June 16, 2025. Replaced raw text metadata editor with structured ORCS form
- June 16, 2025. Added professional metadata form with classification levels and handling instructions
- June 16, 2025. Fixed metadata saving issues and file locking problems with form-based approach
- June 16, 2025. Implemented safe handling instruction add/remove with bounds checking
- June 27, 2025. Fixed complete tag merge functionality with proper backend implementation
- June 27, 2025. Added auto-populate identifier field in tag creation modal with selected text
- June 27, 2025. Implemented comprehensive tag highlighting in document viewer with color-coded types
- June 27, 2025. Implemented Wikipedia-style file extensions (.entity.txt, .relate.txt, .attrib.txt, .comment.txt, .kv.txt)
- June 27, 2025. Added UUID-based ORCS cards with .card.txt extension replacing .yaml.txt
- June 27, 2025. Completed location-agnostic file system - tags and cards can be moved anywhere and system finds them
- June 27, 2025. Fixed array-based reference system migration - all tag files updated from REFERENCE: to REFERENCES: format
- June 27, 2025. Resolved tag highlighting issues caused by comma-separated reference strings in merged tags
- June 27, 2025. Implemented clickable tag navigation system - tags in documents open TagEditor, references in TagEditor navigate to files
- June 27, 2025. Enhanced TagEditor with prominent name display, copyable UUID, scrollable content, and edit name modal
- June 27, 2025. Redesigned aliases field as "Search Aliases" for finding untagged content in documents (not report aliases)
- June 27, 2025. Streamlined TagEditor by removing redundant UUID, Name, and References fields - now only shown where needed
- June 27, 2025. Reorganized TagEditor layout: Search Aliases at top, action buttons always accessible, collapsible Tag Details middle section, expandable KVP/References at bottom with vertical scroll
- June 27, 2025. Fixed critical text selection offset calculation bug that caused misaligned tag highlighting using TreeWalker API
- June 27, 2025. Added "Fix Misaligned References" feature in References section to recalculate and repair broken tag offset positions
- June 27, 2025. Fixed TagCreationModal not closing after successful tag creation
- June 27, 2025. CRITICAL FIX: Implemented automatic offset adjustment system to prevent cascading tag misalignment when tags are deleted
- June 27, 2025. Added adjustOffsetsAfterDeletion() function that recalculates character positions for all subsequent tags in affected files
```

## Future Enhancements

### Advanced Disambiguation System
- **Search term management**: Check/uncheck individual search terms during disambiguation
- **Temporary/permanent modifications**: Add/remove search terms for current session or permanently
- **Document resolution**: Resolve multiple analyst views of same document with automatic future resolution
- **Import library system**: Imported content staged in separate library for selective integration
- **Negative match tracking**: Store explicit rejections alongside positive matches in same format
- **Cross-entity correlation**: Pre-computed index showing entities sharing search terms

### UUID Architecture & Cross-Analyst Collaboration
- **Namespace UUIDs**: Include analyst identifier in UUID generation
- **Cross-analyst mapping**: Map foreign UUIDs to local UUIDs for entity resolution
- **Import inheritance**: Future imports from mapped analysts automatically resolve
- **Conflict detection**: Handle UUID collisions and entity conflicts through merge workflows
- **User precedence**: User's own tags always take priority over imported content

### Organizational Features
- **Individual analyst UUIDs**: Future addition for user identification
- **Repository UUIDs**: Allow organizations to track and merge multiple repositories
- **Export capabilities**: MS Office, Google Office, node/edge tables, ORCS-to-ORCS
- **Supervisor merge tools**: Higher-level users combine multiple analyst repositories
- **Security boundary**: ORCS stops at shared drive level for access control

### Human Decision Capture
- **Rejection reasons**: Track why entities were not merged
- **Merge confidence**: Analyst certainty levels
- **Decision history**: Who made what choices when
- **Conflicting opinions**: Handle disagreements between analysts
- **Audit trail**: Track all decision changes for accountability

### Knowledge Reuse System - "The Common Problem" Solution
- **Enhanced clipboard functionality**: Copy snippets and bulletpoints with automatic metadata preservation
- **Risk reduction**: Automatic classification and citation inclusion prevents spillage during copy/paste operations
- **Drafting tool focus**: Designed for initial document creation, not final products
- **Cross-platform compatibility**: MS Office integration first, maximum forward compatibility strategy

#### Snippets - Direct Content Extraction
- **Text selection with metadata**: Copy document content with embedded classification, citation, and handling instructions
- **Generic copy/paste**: Plain text format with automatic metadata inclusion
- **MS Office integration**: Automatic footnote/endnote citation formatting
- **RTF template support**: Future rich text formatting for output (system remains plain text internally)
- **Clipboard-first approach**: Transient items by default, save/delete without formal tracking

#### Bulletpoints - Generated Relationship Statements
- **Tag-to-tag relationships**: Generate natural language sentences from stored entity connections
- **Universal connectivity**: Any tag can connect to any other tag for sentence generation
- **Template flexibility**: User-configurable citation systems, support any format
- **AI assistance ready**: Designed for future artificial intelligence integration
- **Iterative complexity**: Start simple, build sophistication over time

#### Implementation Strategy
- **Generic classification terminology**: Use corporate/proprietary markings only, avoid actual intelligence classifications
- **Maximum compatibility**: Plain text foundation, no rich text in system to prevent word processor temptation
- **Forward compatibility**: Framework designed for ICD 206 and other marking systems
- **Comment integration**: Future formal storage within existing comment system
- **Separation of concerns**: Clear distinction between unanalyzed clipboard items and formal knowledge objects

## User Preferences

Preferred communication style: Simple, everyday language.