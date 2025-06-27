import { useQuery } from '@tanstack/react-query';
import { Tag, File } from '@shared/schema';

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

export function useReferenceAnalysis(targetTag: Tag | null) {
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
      
      const contents: Record<string, string> = {};
      for (const file of files) {
        try {
          const response = await fetch(`/api/files/${file.id}/content`);
          if (response.ok) {
            const data = await response.json();
            contents[file.name] = data.content;
          }
        } catch (error) {
          console.warn(`Failed to fetch content for ${file.name}`);
        }
      }
      return contents;
    },
    enabled: !!targetTag && files.length > 0,
  });

  // Analyze references when data is available
  const analysisResult = useQuery({
    queryKey: ['/api/reference-analysis', targetTag?.id, fileContents.data],
    queryFn: async (): Promise<ReferenceAnalysis> => {
      if (!targetTag || !fileContents.data) {
        return {
          taggedReferences: [],
          untaggedReferences: [],
          totalTaggedCount: 0,
          totalUntaggedCount: 0,
        };
      }

      return analyzeReferences(targetTag, fileContents.data, files, tags);
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
  tags: Tag[]
): ReferenceAnalysis {
  const taggedReferences: TaggedReference[] = [];
  const untaggedReferences: UntaggedReference[] = [];

  // Create search patterns for the target tag
  const searchTerms = [
    targetTag.name,
    ...(targetTag.aliases || []),
  ].filter(term => term.trim().length > 0);

  for (const file of files) {
    const content = fileContents[file.name];
    if (!content) continue;

    const cleanContent = extractOriginalContent(content, file.name);
    
    // Find all tagged references to this entity
    const taggedRefs = findTaggedReferences(targetTag, cleanContent, file.name, tags);
    taggedReferences.push(...taggedRefs);

    // Find potential untagged references
    const untaggedRefs = findUntaggedReferences(targetTag, cleanContent, file.name, searchTerms, tags);
    untaggedReferences.push(...untaggedRefs);
  }

  return {
    taggedReferences,
    untaggedReferences,
    totalTaggedCount: taggedReferences.length,
    totalUntaggedCount: untaggedReferences.length,
  };
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
  
  // Look for markdown-style tags: [entity:TechCorp](uuid) format
  const tagRegex = /\[([^:]+):([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const [fullMatch, type, text, uuid] = match;
    
    if (uuid === targetTag.id) {
      const position = match.index;
      const context = extractContext(content, position, fullMatch.length);
      
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
  
  // Remove existing tagged content to avoid duplicate detection
  const cleanContent = content.replace(/\[([^:]+):([^\]]+)\]\(([^)]+)\)/g, '$2');
  
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
      const isAlreadyTagged = isPositionTagged(content, position, matchedText.length);
      
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