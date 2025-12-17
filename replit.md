# ORCS Intelligence System

## Overview

ORCS (Open Research Communication System) is a full-stack intelligence analysis and document management system designed to process, tag, and visualize relationships within intelligence documents via an interactive web interface. It aims to enhance analytical workflows, improve knowledge reuse, and facilitate cross-analyst collaboration by organizing intelligence data into structured formats like ORCS cards, tags, and relationship mappings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend**: React 18 with TypeScript, utilizing Shadcn/ui and Radix UI primitives.
- **Styling**: Tailwind CSS with a custom ORCS-themed color scheme.
- **6 Core Primitives**: Entity (green), Link (orange), Snip (amber), Label (cyan), Data (purple), Comment (blue).
- **Terminology**: "Link" is displayed instead of "Relationship".
- **UUID Display Policy**: UUIDs are hidden from primary display, favoring human-readable names.

### Technical Implementations
- **Frontend**: TanStack Query for server state, Wouter for routing, Vite for builds.
- **Backend**: Express.js with TypeScript, Node.js 20, Multer for file uploads, Zod for validation.
- **Data Storage**: Card-centric file system (`user_data/`), persistent JSON-based search index (`user_data/index.json`), with planned PostgreSQL integration using Drizzle ORM.
- **File Organization**: Hierarchical directory structure under `user_data/` for intelligence data.
- **ORCS Card System**: Structured intelligence document format including original content, tag index, link index, snippet index, and metadata, using delimiter-based content separation.
- **Unified Link Model**: Single model for all relationships with source/target IDs, predicate labels, boolean flags (isRelationship, isAttribute, isNormalization), direction, and optional properties.
- **Wiki-Link Syntax**: Tri-part inline normalization `[[type:normalized|display]]` for preserving original text while enabling normalized references.
- **Snippet System**: Manual text highlights with analyst attribution, tracking offsets for precise location.
- **IDE-Style Master Index**: Persistent JSON index (`user_data/index.json`) with hash-based change detection, incremental indexing, relationship graph tracking, orphaned reference detection, and garbage collection.
- **Search & Indexing**: Automatic indexing, keyword extraction, content-based search.
- **Graph Visualization**: Interactive, SVG-based relationship visualization.
- **File System Resilience**: Three-tier lookup strategy for UUIDs and file paths.
- **Content Architecture**: Standardized ContentExtractor for strict content/metadata separation.
- **Resizable Document Viewer**: Vertical resizable panels for content and metadata.

### Feature Specifications
- **File Management**: Supports `.txt` and `.csv` upload, automatic ORCS card generation, metadata tracking, content parsing, and deletion.
- **Tagging**: Text selection-based tagging with metadata (aliases, descriptions), and visual indicators.
- **Label System**: Card-local reusable vocabulary for faster tagging, used as dropdown options in Entity/Link creation.
- **Data System**: Structured data capture with canon types (Generic, Geotemporal, Identifier, Quantity, Quality, Metadata), key-value pairs, and optional normalization.
- **Modal Structure**: Layered dropdowns for canon types, card-local labels, and user input, with searchable inputs for large lists.
- **Analyst Attribution**: Critical system for comment tags with privacy-configurable user UUIDs.
- **CSV Tagging**: Full support for tagging CSV content with markdown insertion and visual highlighting.
- **Interactive Tag Buttons**: Tagged text functions as interactive buttons for navigation.
- **Entity Connection System**: Node-edge-node relationship patterns, supporting multi-select and custom relationship labels.
- **Metadata Modal on Upload**: Automated modal for capturing source reference, classification, handling instructions, and analyst name upon file upload.
- **Link & Snippet API**: Complete CRUD operations for intelligence relationships and highlights.
- **Snippet Creation UI**: Text selection workflow for creating highlights with optional comments and classification.
- **Link Creation UI**: Form for connecting entities within a card's LINK INDEX.
- **Bullet Generation**: Auto-generates subject-predicate-object triples from LINK INDEX for summaries.
- **Entity Dossiers**: Comprehensive entity views aggregating all mentions across cards, with dedicated pages and statistical overviews.
- **Inline Comment System**: Track-changes style comments inserted directly into document text with analyst attribution, stored in a COMMENT INDEX, and API support.
- **Text Selection Across Tags**: Allows users to select text spanning tagged elements for snippet creation, with UI feedback.

## External Dependencies

- **Frontend Libraries**: React, @tanstack/react-query, wouter, Radix UI, Tailwind CSS.
- **Backend Libraries**: Express.js, Multer, Zod.
- **Development Tools**: Vite, TypeScript, ESBuild.
- **Database**: PostgreSQL (planned).