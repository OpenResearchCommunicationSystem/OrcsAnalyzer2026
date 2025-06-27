# Clean Content Architecture Standards

## Overview

This document establishes the fundamental principles for clean content extraction and display throughout the ORCS Intelligence System. The core principle is **strict separation of content from metadata** to prevent recursive contamination where metadata searches itself.

## Core Principles

### 1. Content vs. Metadata Classification

**Source Documents (Searchable Content)**:
- `.card.txt` files: Original content section only (`=== ORIGINAL CONTENT START/END ===`)
- `.txt` files: Raw text files (legacy/original uploads)
- `.csv` files: Raw data files (legacy/original uploads)

**Metadata Files (Never Searchable)**:
- `.entity.txt`: Entity definitions and properties
- `.relate.txt`: Relationship definitions
- `.attrib.txt`: Attribute definitions  
- `.comment.txt`: Analyst commentary
- `.kv.txt`: Key-value pair definitions

### 2. Clean Content Extraction Pipeline

```
Raw File Content → Content Classification → Clean Extraction → Display Processing
```

#### Stage 1: Content Classification
- Determine if file contains source content or metadata
- Card files: Extract original content section
- Original files: Use full content
- Metadata files: NEVER extract for content display

#### Stage 2: Clean Extraction
- Remove all YAML frontmatter
- Remove all metadata delimiters
- Remove all ORCS headers and versioning
- Preserve only original document text/data

#### Stage 3: Display Processing
- Apply markdown tag highlighting
- Process CSV table formatting
- Handle text selection boundaries
- Apply visual styling

## Standard Components Architecture

### ContentExtractor (Core Utility)

**Purpose**: Single source of truth for extracting clean content from any file type.

**Interface**:
```typescript
interface ContentExtractor {
  extractCleanContent(fileContent: string, filename: string): CleanContent;
  isSourceFile(filename: string): boolean;
  isMetadataFile(filename: string): boolean;
}

interface CleanContent {
  content: string;
  sourceType: 'text' | 'csv' | null;
  hasMetadata: boolean;
  originalFilename?: string;
}
```

**Rules**:
- Card files: Extract between `=== ORIGINAL CONTENT START/END ===` delimiters
- Original files: Return full content
- Metadata files: Return empty content with warning

### CleanContentDisplay (Reusable Component)

**Purpose**: Standardized component for displaying clean content with consistent formatting.

**Interface**:
```typescript
interface CleanContentDisplayProps {
  content: string;
  sourceType: 'text' | 'csv' | null;
  enableTagHighlighting?: boolean;
  onTagClick?: (tag: Tag) => void;
  onTextSelection?: (selection: TextSelection) => void;
  className?: string;
}
```

**Features**:
- Automatic tag highlighting with official color schema
- CSV table rendering with cell selection
- Text selection handling for tagging
- Consistent typography and spacing

### ContentViewer (High-Level Component)

**Purpose**: Complete document viewing experience with metadata sidebar.

**Interface**:
```typescript
interface ContentViewerProps {
  fileId: string;
  showMetadata?: boolean;
  onTagClick?: (tag: Tag) => void;
  onTextSelection?: (selection: TextSelection) => void;
}
```

**Layout**:
- Main panel: Clean content only
- Sidebar: Metadata form (when enabled)
- Header: File info and controls
- Footer: Actions and status

## Implementation Standards

### File Type Detection

```typescript
const FILE_PATTERNS = {
  SOURCE_DOCUMENTS: /\.(card|txt|csv)$/,
  METADATA_FILES: /\.(entity|relate|attrib|comment|kv)\.txt$/,
  CARD_FILES: /\.card\.txt$/
} as const;
```

### Content Delimiters

**Card File Structure**:
```
=== ORCS METADATA START ===
[YAML metadata section]
=== ORCS METADATA END ===

=== ORIGINAL CONTENT START ===
[Clean source content - this is what gets displayed]
=== ORIGINAL CONTENT END ===

=== TAG INDEX START ===
[Tagged elements list]
=== TAG INDEX END ===
```

**Extraction Rule**: Only content between `ORIGINAL CONTENT` delimiters is used for display and search.

### Tag Highlighting Standards

**Official ORCS Color Schema**:
- Entity: `bg-green-500/20 text-green-300 border-green-500/30`
- Relationship: `bg-orange-500/20 text-orange-300 border-orange-500/30`
- Attribute: `bg-purple-500/20 text-purple-300 border-purple-500/30`
- Comment: `bg-blue-500/20 text-blue-300 border-blue-500/30`
- Key-Value: `bg-amber-500/20 text-amber-300 border-amber-500/30`

**Markdown Tag Format**: `[type:DisplayName](uuid)`

### Error Handling

**Metadata Contamination Prevention**:
- Log warnings when metadata files are processed for content
- Return empty content with error message for metadata files
- Never include YAML, timestamps, or UUIDs in clean content

**Fallback Strategy**:
1. Try delimiter-based extraction
2. Fall back to full content if delimiters missing
3. Return error if file is metadata type
4. Log all extraction attempts for debugging

## Usage Guidelines

### DO: Clean Content Display
```typescript
// Correct: Extract clean content only
const cleanContent = ContentExtractor.extractCleanContent(rawContent, filename);
if (ContentExtractor.isSourceFile(filename)) {
  return <CleanContentDisplay content={cleanContent.content} />;
}
```

### DON'T: Raw Content Display
```typescript
// Wrong: Display raw file content with metadata
return <div>{rawFileContent}</div>; // Contains YAML, UUIDs, timestamps!
```

### DO: Proper File Filtering
```typescript
// Correct: Only analyze source documents
const sourceFiles = files.filter(f => ContentExtractor.isSourceFile(f.name));
sourceFiles.forEach(file => analyzeForReferences(file));
```

### DON'T: Analyze All Files
```typescript
// Wrong: Analyzes metadata files, creates infinite loops
files.forEach(file => analyzeForReferences(file)); // Includes .entity.txt files!
```

## Integration Points

### DocumentViewer Migration
- Replace inline content extraction with ContentExtractor
- Use CleanContentDisplay for main panel
- Maintain existing metadata sidebar functionality

### TagMergeModal Enhancement
- Use ContentExtractor for Tagged/Untagged reference analysis
- Apply CleanContentDisplay for context snippets
- Filter source files only in reference scanning

### Search System Updates
- Index only clean content from source files
- Exclude all metadata files from search index
- Use ContentExtractor for consistent processing

### Future Components
- ReportViewer: Clean content with citation formatting
- ComparisonView: Side-by-side clean content display
- ExportUtility: Clean content extraction for external formats

## Testing Requirements

### Unit Tests
- ContentExtractor accuracy across file types
- Proper metadata file rejection
- Delimiter-based extraction reliability
- Fallback behavior verification

### Integration Tests
- End-to-end clean content display
- Tag highlighting consistency
- Search index purity (no metadata contamination)
- Reference analysis source file filtering

### Performance Tests
- Large document extraction speed
- Memory usage with complex tag highlighting
- Search index efficiency

## Migration Strategy

### Phase 1: Core Components (Current)
- Implement ContentExtractor utility
- Create CleanContentDisplay component
- Document extraction standards

### Phase 2: Component Integration
- Migrate DocumentViewer to use standard components
- Update TagMergeModal reference analysis
- Standardize search index processing

### Phase 3: System-Wide Adoption
- Replace all raw content displays
- Implement consistent error handling
- Add comprehensive testing coverage

### Phase 4: Optimization
- Performance tuning for large documents
- Advanced tag highlighting features
- Export and reporting enhancements

## Security Considerations

### Information Leakage Prevention
- Never display UUIDs in content areas
- Strip analyst information from content display
- Remove classification markings from clean content
- Sanitize metadata before any content processing

### Access Control
- Content extraction respects file permissions
- Metadata access requires appropriate authorization
- Tag visibility based on user privileges
- Audit logging for content access patterns

## Maintenance Guidelines

### Regular Audits
- Monthly scan for metadata contamination in displays
- Quarterly review of content extraction accuracy
- Annual assessment of component reuse patterns
- Continuous monitoring of search index purity

### Documentation Updates
- Version control all extraction rules
- Document any new file type additions
- Maintain component interface stability
- Update integration examples as system evolves

---

**Document Version**: 1.0  
**Last Updated**: December 27, 2025  
**Next Review**: January 27, 2025  
**Maintainer**: ORCS Development Team