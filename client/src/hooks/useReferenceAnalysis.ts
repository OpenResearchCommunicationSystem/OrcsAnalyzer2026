import { useQuery } from '@tanstack/react-query';
import { Tag, File } from '@shared/schema';
import { ContentExtractor } from '@/lib/contentExtractor';

export interface TaggedReference {
  tag: Tag;
  filename: string;
  context: string;
  exactText: string;
  position: {
    start: number;
    end: number;
  };
  type: 'text' | 'csv';
  location: string;
}

export interface UntaggedReference {
  text: string;
  filename: string;
  context: string;
  position: {
    start: number;
    end: number;
  };
  type: 'text' | 'csv';
  confidence: number; // How likely this is to be the target entity
  reasons: string[]; // Why this was identified as a potential match
}

export interface ReferenceAnalysis {
  taggedReferences: TaggedReference[];
  untaggedReferences: UntaggedReference[];
  totalTaggedCount: number;
  totalUntaggedCount: number;
}

interface AliasSettings {
  similaritySearch: boolean;
  documentSearch: boolean;
  repositorySearch: boolean;
}

export function useReferenceAnalysis(targetTag: Tag | null, aliasSettings?: AliasSettings) {
  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  // Get file contents for analysis
  const fileContents = useQuery({
    queryKey: ['/api/files/contents', targetTag?.id],
    queryFn: async () => {
      if (!targetTag) return {};
      
      console.log('Fetching file contents for analysis:', targetTag.name);
      const contents: Record<string, string> = {};
      
      for (const file of files) {
        try {
          const response = await fetch(`/api/files/${file.id}/content`);
          if (response.ok) {
            const data = await response.json();
            contents[file.name] = data.content;
            console.log(`Fetched content for ${file.name}:`, data.content.substring(0, 100) + '...');
          }
        } catch (error) {
          console.warn(`Failed to fetch content for ${file.name}:`, error);
        }
      }
      
      console.log('Total files fetched:', Object.keys(contents).length);
      return contents;
    },
    enabled: !!targetTag && files.length > 0,
  });

  // Analyze references when data is available
  const analysisResult = useQuery({
    queryKey: ['/api/reference-analysis', targetTag?.id, fileContents.data, aliasSettings],
    queryFn: async (): Promise<ReferenceAnalysis> => {
      if (!targetTag || !fileContents.data) {
        console.log('Analysis skipped - missing data:', { targetTag: !!targetTag, fileContents: !!fileContents.data });
        return {
          taggedReferences: [],
          untaggedReferences: [],
          totalTaggedCount: 0,
          totalUntaggedCount: 0,
        };
      }

      console.log('Starting analysis for:', targetTag.name, 'with alias settings:', aliasSettings);
      const result = analyzeReferences(targetTag, fileContents.data, files, tags, aliasSettings);
      console.log('Analysis result:', result);
      return result;
    },
    enabled: !!targetTag && !!fileContents.data,
  });

  return {
    ...analysisResult,
    isLoading: analysisResult.isLoading || fileContents.isLoading,
  };
}

function analyzeReferences(
  targetTag: Tag,
  fileContents: Record<string, string>,
  files: File[],
  tags: Tag[],
  aliasSettings?: AliasSettings
): ReferenceAnalysis {
  console.log('Starting analyzeReferences for:', targetTag.name);
  const taggedReferences: TaggedReference[] = [];
  const untaggedReferences: UntaggedReference[] = [];

  // Create search patterns for the target tag based on alias settings
  const searchTerms = [targetTag.name];
  
  // Add aliases based on context - for reference analysis, use both document and repository settings
  if (aliasSettings?.documentSearch || aliasSettings?.repositorySearch) {
    searchTerms.push(...(targetTag.aliases || []));
  }
  
  const filteredSearchTerms = searchTerms.filter(term => term.trim().length > 0);
  console.log('Search terms:', filteredSearchTerms, 'alias settings:', aliasSettings);
  console.log('Files to analyze:', files.length);
  console.log('File contents available:', Object.keys(fileContents).length);

  for (const file of files) {
    // Use ContentExtractor to determine if this is a source file (never analyze metadata files)
    if (!ContentExtractor.isSourceFile(file.name)) {
      console.log(`Skipping metadata file: ${file.name}`);
      continue;
    }

    const content = fileContents[file.name];
    if (!content) {
      console.log('No content for file:', file.name);
      continue;
    }

    console.log(`Analyzing file: ${file.name}`);
    
    // Use standardized content extraction
    const cleanContentResult = ContentExtractor.extractCleanContent(content, file.name);
    const cleanContent = cleanContentResult.content;
    
    // Validate content is truly clean
    if (!ContentExtractor.validateCleanContent(cleanContentResult, file.name)) {
      console.warn(`Skipping file with contaminated content: ${file.name}`);
      continue;
    }
    
    console.log(`Clean content length: ${cleanContent.length}`);
    
    // Find all tagged references to this entity
    const taggedRefs = findTaggedReferences(targetTag, cleanContent, file.name, tags);
    console.log(`Found ${taggedRefs.length} tagged references in ${file.name}`);
    taggedReferences.push(...taggedRefs);

    // Find potential untagged references
    const untaggedRefs = findUntaggedReferences(targetTag, cleanContent, file.name, filteredSearchTerms, tags);
    console.log(`Found ${untaggedRefs.length} untagged references in ${file.name}`);
    untaggedReferences.push(...untaggedRefs);
  }

  const result = {
    taggedReferences,
    untaggedReferences,
    totalTaggedCount: taggedReferences.length,
    totalUntaggedCount: untaggedReferences.length,
  };

  console.log('Final analysis result:', result);
  return result;
}

function extractOriginalContent(content: string, filename: string): string {
  // If this is a card file, extract the original content section
  if (filename.includes('.card.txt')) {
    const startMarker = '=== ORIGINAL CONTENT START ===';
    const endMarker = '=== ORIGINAL CONTENT END ===';
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
      return content.substring(startIndex + startMarker.length, endIndex).trim();
    }
  }
  
  return content;
}

function findTaggedReferences(
  targetTag: Tag,
  content: string,
  filename: string,
  tags: Tag[]
): TaggedReference[] {
  const references: TaggedReference[] = [];
  
  // Extract clean content first (remove metadata if this is a card file)
  const cleanContent = extractOriginalContent(content, filename);
  
  // Look for markdown-style tags: [entity:TechCorp](uuid) format
  const tagRegex = /\[([^:]+):([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = tagRegex.exec(cleanContent)) !== null) {
    const [fullMatch, type, text, uuid] = match;
    
    if (uuid === targetTag.id) {
      const position = match.index;
      const context = extractContext(cleanContent, position, fullMatch.length);
      
      references.push({
        tag: targetTag,
        filename,
        context,
        exactText: text,
        position: {
          start: position,
          end: position + fullMatch.length,
        },
        type: filename.includes('.csv') ? 'csv' : 'text',
        location: `Characters ${position}-${position + fullMatch.length}`,
      });
    }
  }
  
  return references;
}

function findUntaggedReferences(
  targetTag: Tag,
  content: string,
  filename: string,
  searchTerms: string[],
  tags: Tag[]
): UntaggedReference[] {
  const references: UntaggedReference[] = [];
  
  // Extract clean content first (remove metadata if this is a card file)
  const originalContent = extractOriginalContent(content, filename);
  
  // Remove existing tagged content to avoid duplicate detection
  const cleanContent = originalContent.replace(/\[([^:]+):([^\]]+)\]\(([^)]+)\)/g, '$2');
  
  for (const searchTerm of searchTerms) {
    if (searchTerm.length < 2) continue; // Skip very short terms
    
    // Create case-insensitive regex with word boundaries for better matching
    const regex = new RegExp(`\\b${escapeRegExp(searchTerm)}\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(cleanContent)) !== null) {
      const position = match.index;
      const matchedText = match[0];
      const context = extractContext(cleanContent, position, matchedText.length);
      
      // Check if this location is already tagged by looking at original content
      const isAlreadyTagged = isPositionTagged(originalContent, position, matchedText.length);
      
      if (!isAlreadyTagged) {
        const confidence = calculateConfidence(searchTerm, matchedText, context, targetTag);
        const reasons = getMatchReasons(searchTerm, matchedText, context, targetTag);
        
        references.push({
          text: matchedText,
          filename,
          context,
          position: {
            start: position,
            end: position + matchedText.length,
          },
          type: filename.includes('.csv') ? 'csv' : 'text',
          confidence,
          reasons,
        });
      }
    }
  }
  
  // Remove duplicates and sort by confidence
  return deduplicateReferences(references)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // Limit to top 20 matches
}

function extractContext(content: string, position: number, matchLength: number): string {
  const contextRadius = 100; // Characters before and after
  const start = Math.max(0, position - contextRadius);
  const end = Math.min(content.length, position + matchLength + contextRadius);
  
  let context = content.substring(start, end);
  
  // Try to break at sentence boundaries if possible
  const beforeMatch = context.substring(0, position - start);
  const afterMatch = context.substring(position - start + matchLength);
  
  // Find sentence boundaries
  const sentenceStart = beforeMatch.lastIndexOf('.') + 1;
  const sentenceEnd = afterMatch.indexOf('.');
  
  if (sentenceStart > 0 && sentenceEnd > 0) {
    context = beforeMatch.substring(sentenceStart) + 
              context.substring(position - start, position - start + matchLength) + 
              afterMatch.substring(0, sentenceEnd + 1);
  }
  
  return context.trim();
}

function isPositionTagged(content: string, position: number, length: number): boolean {
  // Check if the position falls within any existing tag markup
  const tagRegex = /\[([^:]+):([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const tagStart = match.index;
    const tagEnd = match.index + match[0].length;
    
    // Check if our position overlaps with this tag
    if (position >= tagStart && position + length <= tagEnd) {
      return true;
    }
  }
  
  return false;
}

function calculateConfidence(searchTerm: string, matchedText: string, context: string, targetTag: Tag): number {
  let confidence = 0.5; // Base confidence
  
  // Exact match bonus
  if (searchTerm.toLowerCase() === matchedText.toLowerCase()) {
    confidence += 0.3;
  }
  
  // Context relevance (very basic)
  if (context.toLowerCase().includes(targetTag.entityType || '')) {
    confidence += 0.1;
  }
  
  // Length penalty for very short matches
  if (matchedText.length < 3) {
    confidence -= 0.2;
  }
  
  // Capitalization bonus (proper nouns)
  if (/^[A-Z]/.test(matchedText)) {
    confidence += 0.1;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

function getMatchReasons(searchTerm: string, matchedText: string, context: string, targetTag: Tag): string[] {
  const reasons: string[] = [];
  
  if (searchTerm.toLowerCase() === matchedText.toLowerCase()) {
    reasons.push('Exact name match');
  } else {
    reasons.push('Alias match');
  }
  
  if (/^[A-Z]/.test(matchedText)) {
    reasons.push('Proper noun formatting');
  }
  
  if (context.toLowerCase().includes(targetTag.entityType || '')) {
    reasons.push(`Context mentions ${targetTag.entityType}`);
  }
  
  return reasons;
}

function deduplicateReferences(references: UntaggedReference[]): UntaggedReference[] {
  const seen = new Set<string>();
  return references.filter(ref => {
    const key = `${ref.filename}:${ref.position.start}:${ref.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}