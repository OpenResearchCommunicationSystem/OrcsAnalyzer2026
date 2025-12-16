# ORCS Intelligence System

## Overview

ORCS (Open Research Communication System) is a full-stack intelligence analysis and document management system. Its primary purpose is to help analysts process, tag, and visualize relationships within intelligence documents through an interactive web interface. The system leverages a React frontend, an Express.js backend, and a file-based storage system to organize intelligence data into structured formats, including ORCS cards, tags, and relationship mappings. The long-term vision is to enhance analytical workflows, improve knowledge reuse, and facilitate cross-analyst collaboration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend**: React 18 with TypeScript, utilizing Shadcn/ui components and Radix UI primitives.
- **Styling**: Tailwind CSS with a custom ORCS-themed color scheme.
- **5 Core Primitives** (Phase 2 simplified taxonomy):
  - **Entity** (node): Green (`bg-green-500/20 text-green-300 border-green-500/30`)
  - **Link** (edge, was "relationship"): Orange (`bg-orange-500/20 text-orange-300 border-orange-500/30`)
  - **Snip** (text highlight): Amber (`bg-amber-500/20 text-amber-300 border-amber-500/30`)
  - **Pair** (key:value metadata, was "kv_pair"): Amber (`bg-amber-500/20 text-amber-300 border-amber-500/30`)
  - **Comment** (analyst notes): Blue (`bg-blue-500/20 text-blue-300 border-blue-500/30`)
- **Terminology**: UI displays "Link" instead of "Relationship" throughout; internal data type remains `relationship`
- **UUID Display Policy**: Hide UUIDs from primary display unless specifically needed for technical operations; use clean, human-readable names primarily.

### Technical Implementations
- **Frontend**: TanStack Query for server state, Wouter for routing, Vite for builds.
- **Backend**: Express.js with TypeScript, Node.js 20, Multer for file uploads, Zod for validation.
- **Data Storage**: Card-centric file system (`user_data/`), persistent JSON-based search index (`user_data/index.json`), PostgreSQL 16 (planned with Drizzle ORM).
- **File Organization**: Hierarchical directory structure under `user_data/` for `.card.txt` files and various tag files (`.entity.txt`, `.relate.txt`, etc.).
- **ORCS Card System v2025.004**: Structured intelligence document format with:
  - ORIGINAL CONTENT section for source documents
  - TAG INDEX for entity definitions (uuid, name, type)
  - LINK INDEX for unified relationships (unified Link model with isAttribute/isRelationship flags)
  - SNIPPET INDEX for manual text highlights with analyst comments
  - Metadata section with classification, handling instructions, and source references
  - Uses clear delimiter-based format (`=== SECTION START/END ===`) for content separation
- **Unified Link Model**: Single model for all relationships:
  - Connects sourceId to targetId with predicate labels
  - Boolean flags: isRelationship, isAttribute, isNormalization
  - Direction: 0=none, 1=forward, 2=backward, 3=bidirectional
  - Optional offsets for text provenance
  - Properties object for extensible metadata
- **Wiki-Link Syntax**: Tri-part inline normalization `[[type:normalized|display]]`:
  - Preserves original source text while enabling normalized references
  - Supports: `[[value]]`, `[[type:value]]`, `[[type:canonical|display]]`
  - Parser utility in shared/wikiLinkParser.ts
- **Snippet System**: Manual text highlights with analyst attribution:
  - Offsets for precise text location tracking
  - Comment field for analyst notes
  - Classification levels (unclassified, proprietary, confidential, restricted, secret)
- **IDE-Style Master Index**: Persistent JSON-based master index (`user_data/index.json`) with:
  - Hash-based change detection using SHA256 for efficient file modification tracking
  - Incremental indexing: file/tag changes trigger targeted reindexing, not full rebuilds
  - Connection/relationship graph tracking with broken connection detection
  - **Orphaned Reference Detection**: Identifies tags that reference non-existent files (CARD_REFERENCES validation)
  - **ORCS Tag Format Parsing**: Parses ORCS-style tag files (UUID:, NAME:, TAG_TYPE:, CARD_REFERENCES:, SEARCH_ALIASES:)
  - Startup indexing on server start, manual refresh via UI button
  - API endpoints: `GET /api/system/index`, `POST /api/system/reindex`, `GET /api/system/broken-connections`
  - **Garbage Collection**: `POST /api/system/reindex?gc=true` cleans orphaned references; `?dryRun=true` for preview
- **Search & Indexing**: Persistent index, automatic indexing, keyword extraction, content-based search.
- **Graph Visualization**: Interactive, SVG-based relationship visualization.
- **File System Resilience**: Three-tier lookup strategy (Default Location, Repository-Wide, Content Search) for UUIDs and file paths, with user recovery options for misplaced files.
- **Clean Content Architecture**: Standardized ContentExtractor utility for strict content/metadata separation, preventing metadata loops.
- **Resizable Document Viewer**: Uses react-resizable-panels for vertical resizable layout:
  - Card files: 2 panels - Original Content (70%), Metadata (30%)
  - Non-card files: 2 panels - Original Content (70%), Metadata (30%)
  - Each panel has independent vertical scrolling for long content
  - Drag handles between panels for user-adjustable sizing
  - Proper flex/min-h-0/overflow constraints for nested scrollable containers

### Feature Specifications
- **File Management**: Supports `.txt` and `.csv` upload, automatic ORCS card generation, metadata tracking, content parsing with highlighting, and complete file deletion.
- **Tagging**: Text selection-based tagging, tag metadata (aliases, descriptions, Pairs), visual indicators. Selection guard allows tagging text that already contains tags.
- **Tag Deletion**: `DELETE /api/tags/:id` with cascade cleanup (removes tag file, cleans card markdown references, updates index); `?dryRun=true` for preview of affected items.
- **Enhanced Pair System**: Flexible key-value annotation for document metadata:
  - **Simplified Two-Button UI**: TagToolbar shows "Pair:Key" and "Pair:Value" buttons instead of a single "Pair" button
  - **Pair Subtypes**: Key-only (orphan key), Value-only (orphan value), Key:Value (complete pair)
  - **Preset Modal Behavior**: Clicking Pair:Key/Pair:Value opens modal with subtype already selected; hides redundant type/subtype selectors
  - **Drag-to-Connect**: Drag an orphan key onto an orphan value to link them (or vice versa)
  - **Visual Indicators**: Orphan pairs show dashed amber border; connected pairs show solid amber border
  - **Delimiter Detection**: For Key:Value subtype, specify delimiter (default `:`) to parse key and value
  - Schema fields: `pairSubtype`, `pairKey`, `pairValue`, `linkedPairId`
  - API: `POST /api/tags/:id/link-pair` to connect two pair tags
  - **Implementation**: TagToolbar emits `kv_pair_key`/`kv_pair_value` types; TagCreationModal normalizes to `kv_pair` with preset subtype
- **Search and Indexing**: Persistent JSON index, automatic indexing, keyword extraction, content-based search, API endpoints for search and index rebuild.
- **Analyst Attribution**: Critical analyst attribution system for comment tags with privacy-configurable user UUID management.
- **CSV Tagging**: Full support for tagging CSV content with proper markdown insertion into card files and visual highlighting.
- **Interactive Tag Buttons**: Tagged text functions as interactive buttons for navigation.
- **Entity Connection System**: Node-edge-node relationship pattern connecting entities. Supports Ctrl+click multi-select for entity connection, RelationshipConnectionModal for selecting relationship labels (existing, document-based, or custom), and numeric direction values (0=none, 1=forward, 2=backward, 3=bidirectional). Custom labels create "manual link" relationship tags appended to documents.
- **Metadata Modal on Upload**: When uploading a new file, a metadata modal automatically appears allowing the analyst to fill in:
  - Source Reference (URL or external ID)
  - Classification (dropdown: Unclassified, Proprietary Information, Confidential, Restricted, Secret)
  - Handling Instructions (multiple lines)
  - Analyst name
  - All fields start blank rather than using placeholder values
- **Link & Snippet API**: Complete CRUD operations for managing intelligence relationships and highlights:
  - Links API: `GET/POST /api/cards/:cardId/links`, `GET/PATCH/DELETE /api/cards/:cardId/links/:linkId`
  - Snippets API: `GET/POST /api/cards/:cardId/snippets`, `GET/PATCH/DELETE /api/cards/:cardId/snippets/:snippetId`
  - Null-safe updates that preserve immutable fields (id, created, sourceCardId/cardId)
  - Shared schema validation using Zod from @shared/schema
- **Snippet Creation UI**: Text selection workflow for creating highlights:
  - Select text in Original Content area to trigger creation UI
  - Amber-styled panel shows selected text preview with character offsets
  - Optional comment input for analyst notes
  - Creates snippet via API with text, offsets, comment, and classification
  - All interactive elements have data-testid attributes for testing
- **Link Creation UI**: Form for connecting entities in card's LINK INDEX:
  - Click + button next to Links header to show form
  - Source/Target entity dropdowns populated from card's TAG INDEX entities
  - Predicate text input for relationship label
  - Relationship/Attribute toggle (mutually exclusive)
  - Direction toggle (Forward or Bidirectional)
  - Creates link via API with sourceId, targetId, predicate, flags, direction
- **Bullet Generation**: Auto-generates subject-predicate-object triples from LINK INDEX for quick summaries:
  - Displayed in collapsible cyan-themed section in DocumentViewer metadata panel
  - Format: Subject → [Predicate] → Object with REL/ATTR badges
  - Auto-refreshes when links are created or deleted (cache invalidation)
  - API: `GET /api/cards/:cardId/bullets`
- **Entity Dossiers**: Comprehensive entity view aggregating all mentions across cards:
  - Dedicated page at `/dossier/:entityId` route
  - Entity header with type icon, name, type badge, and aliases
  - Stats grid showing counts for Cards, Relationships, Attributes, Snippets
  - Collapsible sections for Relationships (orange), Attributes (purple), All Bullets (cyan), Snippets (amber), Source Cards (blue)
  - Navigation from Tagged Elements via BookOpen icon button on entity hover
  - API: `GET /api/entities/:entityId/dossier`

## External Dependencies

- **Frontend Libraries**: React, @tanstack/react-query, wouter, Radix UI, Tailwind CSS.
- **Backend Libraries**: Express.js, Multer, Zod.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Database**: PostgreSQL (planned).