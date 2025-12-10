# ORCS Intelligence System

## Overview

ORCS (Open Research Communication System) is a full-stack intelligence analysis and document management system. Its primary purpose is to help analysts process, tag, and visualize relationships within intelligence documents through an interactive web interface. The system leverages a React frontend, an Express.js backend, and a file-based storage system to organize intelligence data into structured formats, including ORCS cards, tags, and relationship mappings. The long-term vision is to enhance analytical workflows, improve knowledge reuse, and facilitate cross-analyst collaboration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend**: React 18 with TypeScript, utilizing Shadcn/ui components and Radix UI primitives.
- **Styling**: Tailwind CSS with a custom ORCS-themed color scheme.
- **Tag Color Schema**:
  - **Entity**: Green (`bg-green-500/20 text-green-300 border-green-500/30`)
  - **Relationship**: Orange (`bg-orange-500/20 text-orange-300 border-orange-500/30`)
  - **Attribute**: Purple (`bg-purple-500/20 text-purple-300 border-purple-500/30`)
  - **Comment**: Blue (`bg-blue-500/20 text-blue-300 border-blue-500/30`)
  - **Key-Value**: Amber (`bg-amber-500/20 text-amber-300 border-amber-500/30`)
- **UUID Display Policy**: Hide UUIDs from primary display unless specifically needed for technical operations; use clean, human-readable names primarily.

### Technical Implementations
- **Frontend**: TanStack Query for server state, Wouter for routing, Vite for builds.
- **Backend**: Express.js with TypeScript, Node.js 20, Multer for file uploads, Zod for validation.
- **Data Storage**: Card-centric file system (`user_data/`), persistent JSON-based search index (`user_data/index.json`), PostgreSQL 16 (planned with Drizzle ORM).
- **File Organization**: Hierarchical directory structure under `user_data/` for `.card.txt` files and various tag files (`.entity.txt`, `.relate.txt`, etc.).
- **ORCS Card System**: Structured intelligence document format with embedded original content, analysis, metadata, classification, handling instructions, and citation tracking. Uses a clear delimiter-based format for content separation.
- **Tagging System**: Five types (Entity, Relationship, Attribute, Comment, Key-Value Pair) with text selection-based tagging, character offset tracking, and visual indicators. Includes search aliases.
- **IDE-Style Master Index**: Persistent JSON-based master index (`user_data/index.json`) with:
  - Hash-based change detection using SHA256 for efficient file modification tracking
  - Incremental indexing: file/tag changes trigger targeted reindexing, not full rebuilds
  - Connection/relationship graph tracking with broken connection detection
  - **Orphaned Reference Detection**: Identifies tags that reference non-existent files (CARD_REFERENCES validation)
  - **ORCS Tag Format Parsing**: Parses ORCS-style tag files (UUID:, NAME:, TAG_TYPE:, CARD_REFERENCES:, SEARCH_ALIASES:)
  - Startup indexing on server start, manual refresh via UI button
  - API endpoints: `GET /api/system/index`, `POST /api/system/reindex`, `GET /api/system/broken-connections`
- **Search & Indexing**: Persistent index, automatic indexing, keyword extraction, content-based search.
- **Graph Visualization**: Interactive, SVG-based relationship visualization.
- **File System Resilience**: Three-tier lookup strategy (Default Location, Repository-Wide, Content Search) for UUIDs and file paths, with user recovery options for misplaced files.
- **Clean Content Architecture**: Standardized ContentExtractor utility for strict content/metadata separation, preventing metadata loops.
- **Resizable Document Viewer**: Uses react-resizable-panels for vertical resizable layout:
  - Card files: 3 panels - Original Content (55%), User Added (25%), Metadata (20%)
  - Non-card files: 2 panels - Original Content (70%), Metadata (30%)
  - Each panel has independent vertical scrolling for long content
  - Drag handles between panels for user-adjustable sizing
  - Proper flex/min-h-0/overflow constraints for nested scrollable containers

### Feature Specifications
- **File Management**: Supports `.txt` and `.csv` upload, automatic ORCS card generation, metadata tracking, content parsing with highlighting, and complete file deletion.
- **Tagging**: Text selection-based tagging, tag metadata (aliases, descriptions, KVP), visual indicators.
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
- **USER ADDED Section**: Card files support a separate "USER ADDED" section (delimited by `=== USER ADDED START/END ===`) for analyst-added content that maintains separation from original source documents. Features include:
  - Cyan-styled separator and content area for visual distinction
  - "Add Text" button in document viewer (works for both TXT and CSV card views)
  - API endpoint `POST /api/files/:id/append-text` for appending text
  - Tagging support for user-added content using existing workflows
  - Clean audit trail separating source content from analyst additions

## External Dependencies

- **Frontend Libraries**: React, @tanstack/react-query, wouter, Radix UI, Tailwind CSS.
- **Backend Libraries**: Express.js, Multer, Zod.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Database**: PostgreSQL (planned).