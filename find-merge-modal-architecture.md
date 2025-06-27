# Find & Merge Modal Architecture Documentation

## Overview
The Find & Merge Modal is a complex feature that allows users to identify and merge similar tags, analyze tagged references, and find untagged references across the repository. This document provides comprehensive architectural details for understanding, modifying, and duplicating this functionality.

## Entry Point & Trigger

### TagEditor Component
**File**: `client/src/components/TagEditor.tsx`
**Lines**: 498-504
**Function**: Renders the "Find & Merge Similar Tags" button
```typescript
<Button
  onClick={() => setIsMergeModalOpen(true)}
  variant="outline"
  size="sm"
  className="text-blue-300 border-blue-600 hover:bg-blue-600/20"
>
  <Merge className="w-4 h-4 mr-2" />
  Find & Merge Similar Tags
</Button>
```

**State Management**: 
- `setIsMergeModalOpen(true)` - Opens the modal
- Modal controlled by `isMergeModalOpen` state in TagEditor

## Core Modal Component

### TagMergeModal Component
**File**: `client/src/components/TagMergeModal.tsx`
**Primary Component**: Lines 44-400+

#### Props Interface
**Lines**: 26-31
```typescript
interface TagMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterTag: Tag | null;
  onMergeComplete?: () => void;
}
```

#### Key State Variables
**Lines**: 45-51
- `selectedForMerge`: Set<string> - Tracks which tags are selected for merging
- `activeTab`: string - Controls which tab is currently active
- `aliasSettings`: Object - Controls alias search behavior across different contexts

## Data Fetching & Dependencies

### Primary Data Sources

#### 1. All Tags Query
**Lines**: 57-59
```typescript
const { data: allTags = [] } = useQuery<Tag[]>({
  queryKey: ['/api/tags'],
});
```
**Purpose**: Provides all tags for similarity comparison
**API Endpoint**: `/api/tags` (GET)

#### 2. Reference Analysis Hook
**Lines**: 62
```typescript
const { data: referenceAnalysis, isLoading: isAnalysisLoading } = useReferenceAnalysis(masterTag, aliasSettings);
```
**Purpose**: Provides tagged/untagged reference analysis
**Custom Hook**: `useReferenceAnalysis` (detailed below)

## Similar Tags Algorithm

### Core Logic
**File**: `client/src/components/TagMergeModal.tsx`
**Function**: `findSimilarTags()`
**Lines**: 98-150

#### Scoring System
1. **Exact name match**: +100 points
2. **Partial name match**: +75 points
3. **Alias matches**: +50 points per match (if similarity search enabled)
4. **Same tag type**: +25 points
5. **Same entity type**: +25 points

#### Algorithm Steps
1. Filter out the master tag from comparison
2. For each remaining tag, calculate similarity score
3. Apply alias matching only if `aliasSettings.similaritySearch` is true
4. Filter results (similarity > 0)
5. Sort by highest similarity first

### Alias Integration
**Lines**: 124-134
```typescript
if (aliasSettings.similaritySearch) {
  const aliasMatches = tagAliases.filter(alias => 
    masterAliases.includes(alias) || 
    alias.includes(masterName) ||
    masterName.includes(alias)
  );
  // ... scoring logic
}
```

## Reference Analysis System

### useReferenceAnalysis Hook
**File**: `client/src/hooks/useReferenceAnalysis.ts`

#### Interface Definition
**Lines**: 37-41
```typescript
interface AliasSettings {
  similaritySearch: boolean;
  documentSearch: boolean;
  repositorySearch: boolean;
}
```

#### Hook Function
**Lines**: 43
```typescript
export function useReferenceAnalysis(targetTag: Tag | null, aliasSettings?: AliasSettings)
```

#### Data Fetching Pipeline
1. **Files Query**: Fetches all files from `/api/files`
2. **Tags Query**: Fetches all tags from `/api/tags`
3. **File Contents Query**: Fetches content for each file via `/api/files/${id}/content`
4. **Analysis Query**: Processes all data through `analyzeReferences()`

#### Key Functions

##### File Content Fetching
**Lines**: 52-77
- Iterates through all files
- Fetches content via individual API calls
- Builds `Record<string, string>` mapping filenames to content
- Includes extensive logging for debugging

##### Analysis Function
**Lines**: 108-165
```typescript
function analyzeReferences(
  targetTag: Tag,
  fileContents: Record<string, string>,
  files: File[],
  tags: Tag[],
  aliasSettings?: AliasSettings
): ReferenceAnalysis
```

##### Search Terms Generation
**Lines**: 119-128
- Always includes tag name
- Conditionally includes aliases based on `documentSearch` or `repositorySearch` settings
- Filters empty/whitespace-only terms

##### Content Processing Pipeline
For each file:
1. Extract clean content using `extractOriginalContent()`
2. Find tagged references using `findTaggedReferences()`
3. Find untagged references using `findUntaggedReferences()`
4. Aggregate results

## UI Structure & Layout

### Modal Layout
**File**: `client/src/components/TagMergeModal.tsx`

#### Dialog Container
**Lines**: 202-209
```typescript
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900 border-gray-700">
    <DialogHeader>
      <DialogTitle className="text-slate-200 flex items-center">
        <Merge className="w-5 h-5 mr-2" />
        Merge Tags: {masterTag?.name}
      </DialogTitle>
    </DialogHeader>
```

#### Alias Toggle Controls
**Lines**: 211-285
- Three toggle switches for different alias contexts
- Visual display of current aliases
- Responsive grid layout (1 column mobile, 3 columns desktop)

#### Tab System
**Lines**: 287-300
```typescript
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <TabsList className="grid w-full grid-cols-3 bg-gray-800">
    <TabsTrigger value="similar-tags">Similar Tags ({similarTags.length})</TabsTrigger>
    <TabsTrigger value="tagged-refs">Tagged ({referenceAnalysis?.totalTaggedCount || 0})</TabsTrigger>
    <TabsTrigger value="untagged-refs">Untagged ({referenceAnalysis?.totalUntaggedCount || 0})</TabsTrigger>
  </TabsList>
```

### Tab Content Sections

#### Similar Tags Tab
**Lines**: 302-400+
- Master tag display (blue background)
- List of similar tags with scoring
- Checkbox selection for merge candidates
- Match reason display

#### Tagged/Untagged Reference Tabs
**Lines**: 500+ (approximate)
- Display reference analysis results
- File location information
- Context snippets
- Navigation links

## Backend Integration

### API Endpoints Used

#### 1. Tags Endpoint
**URL**: `/api/tags` (GET)
**File**: `server/routes.ts`
**Purpose**: Fetch all tags for similarity comparison

#### 2. Files Endpoint
**URL**: `/api/files` (GET)
**File**: `server/routes.ts`
**Purpose**: Fetch file metadata for reference analysis

#### 3. File Content Endpoint
**URL**: `/api/files/{id}/content` (GET)
**File**: `server/routes.ts`
**Purpose**: Fetch individual file content for text analysis

#### 4. Tag Merge Endpoint
**URL**: `/api/tags/{id}/merge` (POST)
**File**: `server/routes.ts`
**Payload**: `{ tagIdsToMerge: string[] }`
**Purpose**: Execute tag merge operation

### Data Schema

#### Tag Schema
**File**: `shared/schema.ts`
**Lines**: 27-40 (approximate)
```typescript
export const tagSchema = z.object({
  id: z.string(),
  type: tagTypeSchema,
  name: z.string(),
  entityType: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  // ... other fields
});
```

#### File Schema
**File**: `shared/schema.ts`
**Lines**: 1-15 (approximate)
```typescript
export const fileSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... other fields
});
```

## Styling & Visual Design

### Color Scheme
- **Master Tag**: Blue theme (`bg-blue-900/30 border-blue-600/50`)
- **Selected Tags**: Amber theme (`bg-amber-900/30 border-amber-600/50`)
- **Modal Background**: Dark gray (`bg-gray-900 border-gray-700`)
- **Alias Badges**: Amber outline (`border-amber-600/50 text-amber-300`)

### Key CSS Classes
- **Modal**: `max-w-4xl max-h-[90vh]`
- **Scroll Areas**: `h-[500px] pr-4`
- **Tab Layout**: `grid w-full grid-cols-3`
- **Card Styling**: `border rounded-lg p-4`

## State Management & Cache

### React Query Integration
- **Query Keys**: Used for proper cache invalidation
- **Automatic Refetching**: On data dependency changes
- **Loading States**: Handled throughout UI

### Cache Invalidation
**Lines**: 166-169 (in merge handler)
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
queryClient.invalidateQueries({ queryKey: ['/api/files'] });
queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
```

## Key Dependencies

### External Libraries
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui/react-dialog**: Modal foundation
- **@radix-ui/react-tabs**: Tab system
- **@radix-ui/react-switch**: Alias toggle controls
- **lucide-react**: Icons throughout UI

### Internal Dependencies
- **useTagOperations**: For tag manipulation
- **useReferenceAnalysis**: For content analysis
- **shared/schema**: Type definitions

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Reference analysis only runs when needed
2. **Memoization**: Query results cached by React Query
3. **Conditional Rendering**: Expensive operations only when data available
4. **Batched API Calls**: File content fetched in parallel

### Potential Bottlenecks
1. **File Content Fetching**: Multiple API calls for large repositories
2. **Text Analysis**: CPU-intensive for large documents
3. **UI Rendering**: Large lists of similar tags or references

## Error Handling

### Frontend Error States
- **Loading States**: Displayed during data fetching
- **Empty States**: Handled for no results scenarios
- **API Errors**: Logged to console, user feedback via UI

### Backend Error Handling
- **File Access Errors**: Graceful degradation
- **Merge Operation Failures**: Error responses to frontend
- **Data Validation**: Zod schema validation

## Future Extension Points

### Modular Architecture
- **Hook Separation**: Reference analysis is isolated and reusable
- **Component Composition**: Modal structure easily modified
- **Configuration Options**: Alias settings demonstrate extensibility

### Potential Enhancements
- **Custom Scoring Algorithms**: Similarity calculation is isolated
- **Additional Analysis Types**: Reference analysis framework is extensible
- **UI Customization**: Tab system and layout are flexible

---

*Generated: December 27, 2025*
*Phase 0 Documentation Complete*