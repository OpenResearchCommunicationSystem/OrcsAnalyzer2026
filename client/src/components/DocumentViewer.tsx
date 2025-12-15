import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Edit, Table, RefreshCw, AlertTriangle, CheckCircle, RotateCcw, MessageSquare, Link2, Trash2, ChevronDown, ChevronRight, Plus, ArrowRight, ArrowLeftRight, X, Zap } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Tag, TextSelection, File, Snippet, Link as LinkType, Bullet } from '@shared/schema';
import { MetadataForm } from './MetadataForm';
import { renderContentWithTables } from '@/lib/markdownTableRenderer';

interface DocumentViewerProps {
  selectedFile: string | null;
  onTextSelection: (selection: TextSelection) => void;
  onTagClick: (tag: Tag, isCtrlClick?: boolean) => void;
  onFileNotFound?: (staleFileId: string) => void;
  onEntityDragConnection?: (sourceEntity: Tag, targetEntity: Tag) => void;
  onSelectFileByCardUuid?: (cardUuid: string) => void;
}

export function DocumentViewer({ selectedFile, onTextSelection, onTagClick, onFileNotFound, onEntityDragConnection, onSelectFileByCardUuid }: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [metadataContent, setMetadataContent] = useState<string>('');
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Mutation to restore original content
  const restoreContentMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest('POST', `/api/files/${fileId}/restore-content`);
      return response.json();
    },
    onSuccess: async (data: { success: boolean; cardUuid: string; message: string }) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      // Invalidate the verify query to refresh integrity status
      await queryClient.invalidateQueries({ queryKey: ['/api/files', selectedFile, 'verify-content'] });
      if (data.cardUuid && onSelectFileByCardUuid) {
        onSelectFileByCardUuid(data.cardUuid);
      }
    },
  });

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  // Auto-resolve stale file references by finding current file with similar name
  const resolvedFileId = selectedFile && files.length > 0 ? (() => {
    const currentFile = files.find(f => f.id === selectedFile);
    if (currentFile) return selectedFile;
    
    // If selected file doesn't exist, we need to find the matching document
    // This happens when tag operations invalidate the current file ID
    // We'll defer to the parent component's handleFileNotFound logic
    return selectedFile;
  })() : selectedFile;

  const { data: fileContent, isLoading: isContentLoading, refetch: refetchContent, error: contentError } = useQuery<{ content: string }>({
    queryKey: [`/api/files/${resolvedFileId}/content`],
    enabled: !!resolvedFileId,
    retry: (failureCount, error: any) => {
      // If we get 404, don't retry - the file doesn't exist
      if (error?.status === 404) return false;
      return failureCount < 3;
    },
    retryDelay: 200,
  });

  const { data: metadataResponse, isLoading: isMetadataLoading, error: metadataError } = useQuery<{ metadata: string }>({
    queryKey: [`/api/files/${resolvedFileId}/metadata`],
    enabled: !!resolvedFileId,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 3;
    },
  });

  const selectedFileData = files.find(f => f.id === resolvedFileId);
  const fileType = selectedFileData?.type;
  const isCardFile = selectedFileData?.name.endsWith('.card.txt');

  // Query to verify content integrity for card files
  interface VerifyResult {
    isValid: boolean;
    missingText: string[];
    sourceFile: string | null;
    cardUuid: string | null;
  }
  
  const { data: verifyResult, isLoading: isVerifying, refetch: refetchVerify } = useQuery<VerifyResult>({
    queryKey: ['/api/files', resolvedFileId, 'verify-content'],
    queryFn: async () => {
      const response = await fetch(`/api/files/${resolvedFileId}/verify-content`);
      if (!response.ok) throw new Error('Failed to verify');
      return response.json();
    },
    enabled: !!resolvedFileId && isCardFile,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Extract card UUID from filename for snippet/link queries
  const getCardUuidFromFilename = (filename: string | undefined): string | null => {
    if (!filename || !filename.includes('.card.txt')) return null;
    const match = filename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.card\.txt$/);
    return match ? match[1] : null;
  };
  
  const cardUuidForQueries = getCardUuidFromFilename(selectedFileData?.name);

  // Query snippets for current card - only when cardUuidForQueries is valid
  const { data: snippets = [], refetch: refetchSnippets } = useQuery<Snippet[]>({
    queryKey: ['/api/cards', cardUuidForQueries, 'snippets'],
    queryFn: async () => {
      if (!cardUuidForQueries) return [];
      const response = await fetch(`/api/cards/${cardUuidForQueries}/snippets`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!cardUuidForQueries,
  });

  // Query links for current card - only when cardUuidForQueries is valid
  const { data: links = [], refetch: refetchLinks } = useQuery<LinkType[]>({
    queryKey: ['/api/cards', cardUuidForQueries, 'links'],
    queryFn: async () => {
      if (!cardUuidForQueries) return [];
      const response = await fetch(`/api/cards/${cardUuidForQueries}/links`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!cardUuidForQueries,
  });

  // Query bullets for current card - only when cardUuidForQueries is valid
  const { data: bullets = [] } = useQuery<Bullet[]>({
    queryKey: ['/api/cards', cardUuidForQueries, 'bullets'],
    queryFn: async () => {
      if (!cardUuidForQueries) return [];
      const response = await fetch(`/api/cards/${cardUuidForQueries}/bullets`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!cardUuidForQueries,
  });

  // State for collapsible sections
  const [showSnippets, setShowSnippets] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showBullets, setShowBullets] = useState(true);
  
  // State for link creation form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkPredicate, setLinkPredicate] = useState('');
  const [linkIsRelationship, setLinkIsRelationship] = useState(true);
  const [linkDirection, setLinkDirection] = useState<number>(1); // 0=none, 1=forward, 2=backward, 3=bidirectional

  // State for pending snippet creation
  const [pendingSnippet, setPendingSnippet] = useState<{ text: string; start: number; end: number } | null>(null);
  const [snippetComment, setSnippetComment] = useState('');

  // Mutation to create a snippet
  const createSnippetMutation = useMutation({
    mutationFn: async (snippetData: { text: string; offsets: { start: number; end: number }; comment?: string }) => {
      const response = await apiRequest('POST', `/api/cards/${cardUuidForQueries}/snippets`, snippetData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuidForQueries, 'snippets'] });
      setPendingSnippet(null);
      setSnippetComment('');
    },
  });

  // Handler to create snippet from pending selection
  const handleCreateSnippet = () => {
    if (!pendingSnippet || !cardUuidForQueries) return;
    createSnippetMutation.mutate({
      text: pendingSnippet.text,
      offsets: { start: pendingSnippet.start, end: pendingSnippet.end },
      comment: snippetComment.trim() || undefined,
    });
  };

  // Mutation to delete a snippet
  const deleteSnippetMutation = useMutation({
    mutationFn: async (snippetId: string) => {
      await apiRequest('DELETE', `/api/cards/${cardUuidForQueries}/snippets/${snippetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuidForQueries, 'snippets'] });
    },
  });

  // Mutation to delete a link
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await apiRequest('DELETE', `/api/cards/${cardUuidForQueries}/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuidForQueries, 'links'] });
    },
  });

  // Mutation to create a link
  const createLinkMutation = useMutation({
    mutationFn: async (data: { sourceId: string; targetId: string; predicate: string; isRelationship: boolean; isAttribute: boolean; direction: number }) => {
      if (!cardUuidForQueries) return;
      await apiRequest('POST', `/api/cards/${cardUuidForQueries}/links`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuidForQueries, 'links'] });
      setShowLinkForm(false);
      setLinkSourceId('');
      setLinkTargetId('');
      setLinkPredicate('');
      setLinkIsRelationship(true);
      setLinkDirection(1);
    },
  });

  // Handler for creating a link
  const handleCreateLink = () => {
    if (!linkSourceId || !linkTargetId || !linkPredicate.trim()) return;
    createLinkMutation.mutate({
      sourceId: linkSourceId,
      targetId: linkTargetId,
      predicate: linkPredicate.trim(),
      isRelationship: linkIsRelationship,
      isAttribute: !linkIsRelationship,
      direction: linkDirection,
    });
  };

  // Detect when selected file becomes invalid and notify parent
  useEffect(() => {
    if (selectedFile && files.length > 0) {
      const fileExists = files.some(f => f.id === selectedFile);
      if (!fileExists && onFileNotFound) {
        onFileNotFound(selectedFile);
      }
    }
  }, [files, selectedFile, onFileNotFound]);

  // Handle 404 errors by notifying parent component
  useEffect(() => {
    if (contentError && selectedFile && onFileNotFound) {
      // Check if error is a 404 by examining the error message or response
      const isNotFoundError = contentError.message?.includes('404') || 
                              contentError.message?.includes('Not found');
      if (isNotFoundError) {
        onFileNotFound(selectedFile);
      }
    }
  }, [contentError, selectedFile, onFileNotFound]);

  // Update metadata content when data loads
  useEffect(() => {
    if (metadataResponse?.metadata) {
      setMetadataContent(metadataResponse.metadata);
    } else if (selectedFileData && metadataResponse?.metadata === '') {
      // Create default metadata if none exists
      const defaultMetadata = [
        '# ORCS Metadata Card',
        `version: "2025.003"`,
        `uuid: ""`,
        `source_file: "${selectedFileData.name}"`,
        `source_reference: ""  # External URL or reference`,
        `classification: "Proprietary Information"`,
        `handling:`,
        `  - "Copyright 2025 TechWatch Intelligence"`,
        `  - "Distribution: Internal Use Only"`,
        `created: "${new Date().toISOString()}"`,
        `modified: "${new Date().toISOString()}"`,
        ``,
        `metadata:`,
        `  file_type: "${selectedFileData.type}"`,
        `  file_size: ${selectedFileData.size}`,
        `  analyst: ""`,
        `  confidence: ""`,
        ``,
        `tag_index: []`,
        ``
      ].join('\n');
      setMetadataContent(defaultMetadata);
    }
  }, [metadataResponse, selectedFileData]);

  const handleMetadataSave = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/files/${selectedFile}/metadata`] });
  };

  // Extract original content from card file using clear delimiters
  const extractOriginalContent = (cardContent: string): string => {
    // Look for content between "=== ORIGINAL CONTENT START ===" and "=== ORIGINAL CONTENT END ==="
    const match = cardContent.match(/=== ORIGINAL CONTENT START ===\n([\s\S]*?)\n=== ORIGINAL CONTENT END ===/);
    
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: return full content if delimiters not found
    return cardContent;
  };


  // Extract source file info from card metadata
  const getSourceFileInfo = (cardContent: string): { filename: string; type: 'txt' | 'csv' | null } => {
    const sourceFileMatch = cardContent.match(/source_file:\s*"([^"]+)"/);
    
    if (sourceFileMatch) {
      const filename = sourceFileMatch[1];
      const type = filename.endsWith('.csv') ? 'csv' : filename.endsWith('.txt') ? 'txt' : null;
      return { filename, type };
    }
    
    return { filename: '', type: null };
  };

  // Detect and process markdown tags in content
  const processMarkdownTags = (content: string): string => {
    // Look for markdown-style tags: [entity:TechCorp](uuid) format
    return content.replace(/\[([^:]+):([^\]]+)\]\(([^)]+)\)/g, (match, type, text, uuid) => {
      const colorClass = getTagColorClass(type);
      // Make entity tags draggable for connection workflow
      const draggableAttrs = type === 'entity' 
        ? `draggable="true" data-entity-draggable="true"` 
        : '';
      const dragStyles = type === 'entity'
        ? 'cursor: grab;'
        : 'cursor: pointer;';
      return `<button class="${colorClass} hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50" data-tag-id="${uuid}" data-tag-type="${type}" ${draggableAttrs} type="button" style="${dragStyles} border: none; font: inherit; padding: 2px 4px; position: relative; z-index: 10;">${text}</button>`;
    });
  };

  // Get CSS class for tag type colors - Official ORCS Color Schema
  const getTagColorClass = (tagType: string): string => {
    switch (tagType) {
      case 'entity': return 'bg-green-500/20 text-green-300 border border-green-500/30 rounded px-1';
      case 'relationship': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded px-1';
      case 'attribute': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded px-1';
      case 'comment': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded px-1';
      case 'kv_pair': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded px-1';
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded px-1';
    }
  };

  // Check if current file is a card file and extract original content
  const getDisplayContent = (): { 
    content: string; 
    rawContent: string; 
    sourceType: 'txt' | 'csv' | null 
  } => {
    if (!fileContent?.content) return { content: '', rawContent: '', sourceType: null };
    
    // If this is a card file (.card.txt), extract the original content section
    if (selectedFileData?.name.includes('.card.txt')) {
      const originalContent = extractOriginalContent(fileContent.content);
      const sourceInfo = getSourceFileInfo(fileContent.content);
      
      // For CSV content, DON'T process markdown tags here - do it per-cell after parsing
      // For TXT content, process markdown tags for highlighting
      const isCSV = sourceInfo.type === 'csv';
      const processedContent = isCSV ? originalContent : processMarkdownTags(originalContent);
      
      return { 
        content: processedContent,
        rawContent: originalContent, // Keep raw content for CSV parsing and offset calculation
        sourceType: sourceInfo.type 
      };
    }
    
    // For original files, return content as-is
    return { 
      content: fileContent.content,
      rawContent: fileContent.content,
      sourceType: selectedFileData?.type as 'txt' | 'csv' | null 
    };
  };







  // Function to render content with tag highlighting
  const renderHighlightedContent = (content: string) => {
    // First, process markdown tags
    let processedContent = processMarkdownTags(content);
    
    if (!selectedFileData || !tags.length) {
      // Return processed content with line breaks converted to JSX
      return processedContent.split('\n').map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: line }} />
        </span>
      ));
    }

    // Helper function to escape special regex characters
    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Get tags that reference this file (check both card UUID and filename)
    const cardUuid = extractCardUuid(selectedFileData.name);
    const fileTags = tags.filter(tag => {
      if (!tag.references || tag.references.length === 0) return false;
      return tag.references.some(ref => {
        // Check if reference matches card UUID or filename
        return ref.includes(selectedFileData.name) || (cardUuid && ref.includes(cardUuid));
      });
    });

    if (fileTags.length === 0) {
      return content;
    }

    type TagSegment = {
      tag: Tag;
      start: number;
      end: number;
      text: string;
    };

    // Parse references and sort by start position (latest first to avoid offset issues)
    // Supports both uuid@start-end and filename@start-end formats
    const tagSegments: TagSegment[] = fileTags
      .flatMap(tag => {
        return tag.references
          .filter((ref: string) => {
            // Match if reference contains card UUID or filename
            return ref.includes(selectedFileData.name) || (cardUuid && ref.includes(cardUuid));
          })
          .map((ref: string) => {
            // Try matching uuid@start-end format first
            let match = cardUuid ? ref.match(new RegExp(`${escapeRegExp(cardUuid)}@(\\d+)-(\\d+)`)) : null;
            // Fall back to filename@start-end format
            if (!match) {
              match = ref.match(new RegExp(`${escapeRegExp(selectedFileData.name)}@(\\d+)-(\\d+)`));
            }
            if (match) {
              const start = parseInt(match[1]);
              const end = parseInt(match[2]);
              return {
                tag,
                start,
                end,
                text: content.substring(start, end)
              };
            }
            return null;
          })
          .filter((segment): segment is TagSegment => segment !== null);
      })
      .sort((a, b) => b.start - a.start); // Sort by start position (descending)

    let highlightedContent = content;

    // Apply highlights from end to beginning to maintain character positions
    tagSegments.forEach(segment => {
      const tagType = segment.tag.type;
      const tagName = segment.tag.name;
      const beforeText = highlightedContent.substring(0, segment.start);
      const taggedText = highlightedContent.substring(segment.start, segment.end);
      const afterText = highlightedContent.substring(segment.end);

      const highlightClass = getTagHighlightClass(tagType);
      // Add draggable attributes for entity tags to support drag-and-drop connections
      const draggableAttrs = tagType === 'entity' 
        ? `draggable="true" data-entity-draggable="true"` 
        : '';
      const dragCursor = tagType === 'entity' ? 'cursor: grab;' : 'cursor: pointer;';
      const highlightedSpan = `<span class="${highlightClass}" data-tag-id="${segment.tag.id}" data-tag-type="${tagType}" data-tag-name="${tagName}" title="${tagName} (${tagType})" ${draggableAttrs} style="${dragCursor}">${taggedText}</span>`;

      highlightedContent = beforeText + highlightedSpan + afterText;
    });

    return <div dangerouslySetInnerHTML={{ __html: highlightedContent }} />;
  };

  // Get CSS classes for tag highlighting
  const getTagHighlightClass = (tagType: string) => {
    const baseClasses = "px-1 py-0.5 rounded-sm border transition-colors hover:opacity-80";
    
    switch (tagType) {
      case 'entity':
        return `${baseClasses} bg-green-900/30 border-green-600 text-green-300`;
      case 'relationship':
        return `${baseClasses} bg-red-900/30 border-red-600 text-red-300`;
      case 'attribute':
        return `${baseClasses} bg-purple-900/30 border-purple-600 text-purple-300`;
      case 'comment':
        return `${baseClasses} bg-orange-900/30 border-orange-600 text-orange-300`;
      case 'kv_pair':
        return `${baseClasses} bg-cyan-900/30 border-cyan-600 text-cyan-300`;
      default:
        return `${baseClasses} bg-gray-900/30 border-gray-600 text-gray-300`;
    }
  };

  // CSV parsing function
  const parseCSV = (csvText: string): string[][] => {
    const lines = csvText.trim().split('\n');
    return lines.map(line => {
      const cells = [];
      let currentCell = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      
      cells.push(currentCell.trim());
      return cells;
    });
  };

  const handleCellSelection = (row: number, col: number, cellValue: string) => {
    if (selectedFileData && cellValue.trim().length > 0) {
      // Extract card UUID from filename for card-based references
      const cardUuid = extractCardUuid(selectedFileData.name);
      
      const textSelection: TextSelection = {
        text: cellValue,
        startOffset: 0,
        endOffset: cellValue.length,
        filename: selectedFileData.name,
        reference: cardUuid ? `${cardUuid}[${row},${col}]` : `${selectedFileData.name}[${row},${col}]`
      };
      onTextSelection(textSelection);
      setSelectedCell({ row, col });
    }
  };

  // Extract card UUID from card filename
  const extractCardUuid = (filename: string): string | null => {
    if (filename.includes('.card.txt')) {
      // Extract UUID from card filename pattern: name_uuid.card.txt
      const match = filename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.card\.txt$/);
      return match ? match[1] : null;
    }
    return null;
  };

  // Track if we're clicking on a tag to prevent text selection interference
  const [isTagClick, setIsTagClick] = useState(false);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      // Check if the mousedown is on a tag element
      const target = event.target as HTMLElement;
      const tagElement = target.closest('[data-tag-id]');
      setIsTagClick(!!tagElement);
    };

    const handleMouseUp = () => {
      // Don't process text selection if we clicked on a tag
      if (isTagClick) {
        setIsTagClick(false);
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.toString().trim().length === 0 || !selectedFileData) {
        return;
      }

      const selectedText = selection.toString();
      const range = selection.getRangeAt(0);
      const displayData = getDisplayContent();
      
      // Find the section container by checking for data-section attribute or use contentRef
      const container = range.commonAncestorContainer;
      const containerElement = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container as HTMLElement;
      
      const originalSection = containerElement?.closest('[data-section="original"]') as HTMLElement | null;
      let targetElement: HTMLElement | null = originalSection;
      let sectionContent = displayData.rawContent;
      
      // Fallback to ref-based detection
      if (!targetElement && contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
        targetElement = contentRef.current;
        sectionContent = displayData.rawContent;
      }
      
      if (!targetElement || !sectionContent) {
        return;
      }
      
      // Calculate offset by counting characters from the beginning of the section element
      const walker = document.createTreeWalker(
        targetElement,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let currentOffset = 0;
      let startOffset = -1;
      let node;
      
      // Walk through all text nodes to find the precise offset
      while (node = walker.nextNode()) {
        const nodeText = node.textContent || '';
        
        if (node === range.startContainer) {
          startOffset = currentOffset + range.startOffset;
          break;
        }
        
        currentOffset += nodeText.length;
      }
      
      if (startOffset !== -1) {
        const endOffset = startOffset + selectedText.length;
        
        // Verify the selection matches the content at these offsets
        const contentAtOffsets = sectionContent.substring(startOffset, endOffset);
        
        // Extract card UUID for card-based references
        const cardUuid = extractCardUuid(selectedFileData.name);
        const referenceBase = cardUuid || selectedFileData.name;
        
        if (contentAtOffsets === selectedText) {
          const textSelection: TextSelection = {
            text: selectedText,
            startOffset,
            endOffset,
            filename: selectedFileData.name,
            reference: `${referenceBase}@${startOffset}-${endOffset}`
          };
          onTextSelection(textSelection);
          // Also set pending snippet for card files
          if (isCardFile) {
            setPendingSnippet({ text: selectedText, start: startOffset, end: endOffset });
          }
        } else {
          // If offsets don't match, try to find the text in the section content
          const actualStartIndex = sectionContent.indexOf(selectedText);
          if (actualStartIndex !== -1) {
            const actualEndIndex = actualStartIndex + selectedText.length;
            const textSelection: TextSelection = {
              text: selectedText,
              startOffset: actualStartIndex,
              endOffset: actualEndIndex,
              filename: selectedFileData.name,
              reference: `${referenceBase}@${actualStartIndex}-${actualEndIndex}`
            };
            onTextSelection(textSelection);
            // Also set pending snippet for card files
            if (isCardFile) {
              setPendingSnippet({ text: selectedText, start: actualStartIndex, end: actualEndIndex });
            }
          }
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectedFileData, onTextSelection, fileContent?.content, isTagClick, isCardFile]);

  // Handle entity drag-and-drop for connection workflow
  useEffect(() => {
    // Helper to find the closest entity element from any target (handles text nodes)
    const findEntityElement = (target: EventTarget | null): HTMLElement | null => {
      if (!target) return null;
      const element = target as HTMLElement;
      // Handle text nodes by getting parent
      const el = element.nodeType === Node.TEXT_NODE ? element.parentElement : element;
      if (!el) return null;
      // Find closest element with entity data
      return el.closest('[data-tag-type="entity"]') as HTMLElement | null;
    };

    const handleDragStart = (event: DragEvent) => {
      const entityEl = findEntityElement(event.target);
      if (entityEl && entityEl.hasAttribute('data-entity-draggable')) {
        const tagId = entityEl.getAttribute('data-tag-id');
        if (tagId) {
          setDraggedEntityId(tagId);
          event.dataTransfer?.setData('text/plain', tagId);
          event.dataTransfer!.effectAllowed = 'link';
          entityEl.style.opacity = '0.5';
        }
      }
    };

    const handleDragEnd = (event: DragEvent) => {
      const entityEl = findEntityElement(event.target);
      if (entityEl) {
        entityEl.style.opacity = '1';
      }
      // Reset all entity outlines
      document.querySelectorAll('[data-tag-type="entity"]').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
      setDraggedEntityId(null);
    };

    const handleDragOver = (event: DragEvent) => {
      const entityEl = findEntityElement(event.target);
      if (draggedEntityId && entityEl) {
        const targetTagId = entityEl.getAttribute('data-tag-id');
        if (targetTagId && targetTagId !== draggedEntityId) {
          event.preventDefault();
          event.dataTransfer!.dropEffect = 'link';
          entityEl.style.outline = '2px solid #f97316';
          entityEl.style.outlineOffset = '2px';
        }
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      const entityEl = findEntityElement(event.target);
      if (entityEl) {
        entityEl.style.outline = '';
        entityEl.style.outlineOffset = '';
      }
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const entityEl = findEntityElement(event.target);
      
      // Reset outline on drop target
      if (entityEl) {
        entityEl.style.outline = '';
        entityEl.style.outlineOffset = '';
      }

      if (entityEl && draggedEntityId) {
        const targetTagId = entityEl.getAttribute('data-tag-id');
        if (targetTagId && targetTagId !== draggedEntityId && onEntityDragConnection) {
          const sourceEntity = tags.find(t => t.id === draggedEntityId);
          const targetEntity = tags.find(t => t.id === targetTagId);
          if (sourceEntity && targetEntity) {
            onEntityDragConnection(sourceEntity, targetEntity);
          }
        }
      }
      setDraggedEntityId(null);
    };

    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('dragend', handleDragEnd, true);
    document.addEventListener('dragover', handleDragOver, true);
    document.addEventListener('dragleave', handleDragLeave, true);
    document.addEventListener('drop', handleDrop, true);

    return () => {
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('dragend', handleDragEnd, true);
      document.removeEventListener('dragover', handleDragOver, true);
      document.removeEventListener('dragleave', handleDragLeave, true);
      document.removeEventListener('drop', handleDrop, true);
    };
  }, [draggedEntityId, tags, onEntityDragConnection]);

  // Handle clicks on highlighted tags with improved event delegation
  useEffect(() => {
    const handleTagClickEvent = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as HTMLElement;
      
      // Check if clicked element is a tag button or contains tag data
      if (target.hasAttribute('data-tag-id') || target.closest('[data-tag-id]')) {
        const tagElement = target.hasAttribute('data-tag-id') ? target : target.closest('[data-tag-id]') as HTMLElement;
        
        if (tagElement) {
          event.preventDefault();
          event.stopPropagation();
          
          const tagId = tagElement.getAttribute('data-tag-id');
          const tag = tags.find(t => t.id === tagId);
          
          if (tag) {
            // Clear any text selection that might interfere
            window.getSelection()?.removeAllRanges();
            setIsTagClick(true);
            
            // Pass Ctrl/Meta key state to support entity connection workflow
            const isCtrlClick = mouseEvent.ctrlKey || mouseEvent.metaKey;
            onTagClick(tag, isCtrlClick);
            
            // Reset tag click flag after a short delay
            setTimeout(() => setIsTagClick(false), 100);
          }
        }
      }
    };

    // Use document-level event delegation for more reliable click handling
    document.addEventListener('click', handleTagClickEvent, { capture: true });
    
    return () => {
      document.removeEventListener('click', handleTagClickEvent, { capture: true });
    };
  }, [tags, onTagClick]);

  const renderContent = () => {

    if (!selectedFile) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Select a document to view</div>
        </div>
      );
    }

    if (isContentLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading document...</div>
        </div>
      );
    }

    if (!fileContent?.content) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Document not found or empty.</div>
        </div>
      );
    }

    const displayData = getDisplayContent();
    const effectiveFileType = displayData.sourceType || fileType;

    // Handle text files  
    if (effectiveFileType === 'txt') {
      return (
        <>
          <div className="mb-6 pb-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-slate-200">
                {selectedFileData?.name}
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="border-gray-600 text-slate-300">
                  TEXT
                </Badge>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <span className="font-medium">Size:</span> 
                <span className="ml-1">{selectedFileData?.size} bytes</span>
              </div>
              <div>
                <span className="font-medium">Modified:</span> 
                <span className="ml-1">{selectedFileData?.modified ? new Date(selectedFileData.modified).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Content Integrity Check Banner - Loading State */}
          {isCardFile && isVerifying && !verifyResult && (
            <div 
              className="mb-4 p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center gap-2"
              data-testid="integrity-loading"
            >
              <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-slate-400 text-xs">Verifying content integrity...</span>
            </div>
          )}

          {/* Content Integrity Check Banner - Warning */}
          {isCardFile && verifyResult && !verifyResult.isValid && (
            <div 
              className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3"
              data-testid="integrity-warning"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-amber-300 font-medium text-sm">Content Integrity Issue Detected</div>
                <div className="text-amber-200/70 text-xs mt-1">
                  The card content doesn't match the original source file.
                  {verifyResult.missingText.length > 0 && (
                    verifyResult.missingText[0] === '(content order mismatch)' 
                      ? <span> Content structure or order has changed.</span>
                      : <span> Differences: <span className="font-mono">{verifyResult.missingText.slice(0, 5).join(', ')}{verifyResult.missingText.length > 5 ? '...' : ''}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedFile && confirm('This will restore the original content from the source file. Tag markup will be removed but your USER ADDED section will be preserved. Continue?')) {
                        restoreContentMutation.mutate(selectedFile);
                      }
                    }}
                    disabled={restoreContentMutation.isPending}
                    className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-7"
                    data-testid="button-restore-content"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore from Original
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => refetchVerify()}
                    disabled={isVerifying}
                    className="text-amber-400/70 hover:text-amber-300 text-xs h-7"
                    data-testid="button-recheck-integrity"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isVerifying ? 'animate-spin' : ''}`} />
                    Re-check
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Content Valid Badge (optional - shown briefly or on hover) */}
          {isCardFile && verifyResult?.isValid && (
            <div 
              className="mb-4 p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"
              data-testid="integrity-valid"
            >
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs">Content matches original source file</span>
            </div>
          )}

          <div 
            ref={contentRef}
            data-section="original"
            className="text-sm leading-relaxed bg-gray-800 p-6 rounded-lg border border-gray-700 select-text text-slate-300 mb-4 min-h-96 max-w-none"
            style={{ 
              userSelect: 'text',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              lineHeight: '1.7'
            }}
          >
            {renderContentWithTables(
              displayData.content,
              renderHighlightedContent,
              (row: number, col: number, content: string) => {
                if (selectedFileData) {
                  const textSelection: TextSelection = {
                    text: content,
                    startOffset: 0,
                    endOffset: content.length,
                    filename: selectedFileData.name,
                    reference: `${selectedFileData.name}[${row},${col}]`
                  };
                  onTextSelection(textSelection);
                  setSelectedCell({ row, col });
                }
              },
              selectedCell
            ).map((element, index) => (
              <div key={index}>{element}</div>
            ))}
          </div>

        </>
      );
    }

    // Handle CSV files
    if (effectiveFileType === 'csv') {
      const csvData = parseCSV(displayData.content);
      const headers = csvData[0] || [];
      const rows = csvData.slice(1);

      return (
        <>
          <div className="mb-6 pb-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-slate-200">
                {selectedFileData?.name}
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="border-gray-600 text-slate-300">
                  CSV
                </Badge>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200">
                  <Table className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm text-slate-400">
              <div>
                <span className="font-medium">Rows:</span> 
                <span className="ml-1">{rows.length}</span>
              </div>
              <div>
                <span className="font-medium">Columns:</span> 
                <span className="ml-1">{headers.length}</span>
              </div>
              <div>
                <span className="font-medium">Size:</span> 
                <span className="ml-1">{selectedFileData?.size} bytes</span>
              </div>
            </div>
          </div>

          {/* Content Integrity Check Banner for CSV - Loading State */}
          {isCardFile && isVerifying && !verifyResult && (
            <div 
              className="mb-4 p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center gap-2"
              data-testid="integrity-loading-csv"
            >
              <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-slate-400 text-xs">Verifying content integrity...</span>
            </div>
          )}

          {/* Content Integrity Check Banner for CSV - Warning */}
          {isCardFile && verifyResult && !verifyResult.isValid && (
            <div 
              className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3"
              data-testid="integrity-warning-csv"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-amber-300 font-medium text-sm">Content Integrity Issue Detected</div>
                <div className="text-amber-200/70 text-xs mt-1">
                  The card content doesn't match the original source file.
                  {verifyResult.missingText.length > 0 && (
                    verifyResult.missingText[0] === '(content order mismatch)' 
                      ? <span> Content structure or order has changed.</span>
                      : <span> Differences: <span className="font-mono">{verifyResult.missingText.slice(0, 5).join(', ')}{verifyResult.missingText.length > 5 ? '...' : ''}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (selectedFile && confirm('This will restore the original content from the source file. Tag markup will be removed but your USER ADDED section will be preserved. Continue?')) {
                        restoreContentMutation.mutate(selectedFile);
                      }
                    }}
                    disabled={restoreContentMutation.isPending}
                    className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-7"
                    data-testid="button-restore-content-csv"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore from Original
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => refetchVerify()}
                    disabled={isVerifying}
                    className="text-amber-400/70 hover:text-amber-300 text-xs h-7"
                    data-testid="button-recheck-integrity-csv"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isVerifying ? 'animate-spin' : ''}`} />
                    Re-check
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isCardFile && verifyResult?.isValid && (
            <div 
              className="mb-4 p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"
              data-testid="integrity-valid-csv"
            >
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs">Content matches original source file</span>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-750 border-b border-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">
                      #
                    </th>
                    {headers.map((header, colIndex) => (
                      <th
                        key={colIndex}
                        className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider min-w-32"
                      >
                        {header || `Col ${colIndex + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-750">
                      <td className="px-3 py-2 text-slate-500 text-xs">
                        {rowIndex + 1}
                      </td>
                      {headers.map((_, colIndex) => {
                        const rawCellValue = row[colIndex] || '';
                        // Process markdown tags to HTML for each cell AFTER CSV parsing
                        const cellValue = processMarkdownTags(rawCellValue);
                        const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                        
                        return (
                          <td
                            key={colIndex}
                            className={`px-3 py-2 text-slate-300 cursor-pointer hover:bg-gray-600 transition-colors ${
                              isSelected ? 'bg-blue-900 border border-blue-500' : ''
                            }`}
                            onClick={() => handleCellSelection(rowIndex, colIndex, rawCellValue)}
                            title={rawCellValue.replace(/\[[^\]]+\]\([^)]+\)/g, (m) => m.match(/\[([^:]+):([^\]]+)\]/)?.[2] || m)} // Show plain text in tooltip
                          >
                            <div 
                              className="max-w-xs truncate"
                              dangerouslySetInnerHTML={{ __html: cellValue }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      );
    }

    // For unsupported file types, show a message
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">
          Unsupported file type. Only .txt and .csv files are supported.
        </div>
      </div>
    );
  };

  // Get file-specific tags for the tagged elements section
  const getFileSpecificTags = () => {
    const currentFileName = selectedFileData?.name;
    return tags.filter(tag => {
      if (!currentFileName || !tag.references || tag.references.length === 0) return false;
      return tag.references.some(ref => 
        ref.startsWith(currentFileName + '@') || 
        ref.startsWith(currentFileName + '[')
      );
    });
  };

  const displayData = getDisplayContent();

  // Show empty/loading state when no file or loading
  if (!selectedFile || isContentLoading || !fileContent?.content) {
    return (
      <div className="flex-1 bg-gray-900 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-none w-full">
            {renderContent()}
          </div>
        </div>

        {/* Metadata Form Modal */}
        {showMetadataForm && selectedFile && selectedFileData && (
          <MetadataForm
            fileId={selectedFile}
            fileName={selectedFileData.name}
            initialMetadata={metadataContent}
            onClose={() => setShowMetadataForm(false)}
            onSave={handleMetadataSave}
          />
        )}
      </div>
    );
  }

  // Resizable panel layout for all documents with content
  const fileSpecificTags = getFileSpecificTags();

  return (
    <div className="flex-1 bg-gray-900 flex flex-col min-h-0">
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        {/* Panel 1: Original Content */}
        <ResizablePanel defaultSize={70} minSize={20}>
          <div className="h-full flex flex-col min-h-0">
            <div className="px-6 py-2 border-b border-gray-700 flex-shrink-0 bg-gray-800/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Original Content</span>
              </div>
              {cardUuidForQueries && pendingSnippet && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-amber-200 mb-2 line-clamp-2">
                        "{pendingSnippet.text.slice(0, 100)}{pendingSnippet.text.length > 100 ? '...' : ''}"
                      </div>
                      <input
                        type="text"
                        value={snippetComment}
                        onChange={(e) => setSnippetComment(e.target.value)}
                        placeholder="Add a comment (optional)..."
                        className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        data-testid="input-snippet-comment"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={handleCreateSnippet}
                          disabled={createSnippetMutation.isPending}
                          className="h-6 px-2 bg-amber-600 hover:bg-amber-500 text-white text-xs"
                          data-testid="button-create-snippet"
                        >
                          {createSnippetMutation.isPending ? 'Creating...' : 'Create Snippet'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPendingSnippet(null); setSnippetComment(''); }}
                          className="h-6 px-2 text-slate-400 hover:text-slate-200 text-xs"
                          data-testid="button-cancel-snippet"
                        >
                          Cancel
                        </Button>
                        <span className="text-[10px] text-slate-500 ml-auto">
                          [{pendingSnippet.start}-{pendingSnippet.end}]
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* File Header */}
              <div className="mb-4 pb-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-medium text-slate-200">
                    {selectedFileData?.name}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="border-gray-600 text-slate-300">
                      {displayData.sourceType === 'csv' ? 'CSV' : 'TEXT'}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
                  <div>
                    <span className="font-medium">Size:</span> 
                    <span className="ml-1">{selectedFileData?.size} bytes</span>
                  </div>
                  <div>
                    <span className="font-medium">Modified:</span> 
                    <span className="ml-1">{selectedFileData?.modified ? new Date(selectedFileData.modified).toLocaleString() : 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {/* Integrity Banners */}
              {isCardFile && isVerifying && !verifyResult && (
                <div className="mb-4 p-2 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center gap-2" data-testid="integrity-loading">
                  <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                  <span className="text-slate-400 text-xs">Verifying content integrity...</span>
                </div>
              )}

              {isCardFile && verifyResult && !verifyResult.isValid && (
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3" data-testid="integrity-warning">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-amber-300 font-medium text-sm">Content Integrity Issue Detected</div>
                    <div className="text-amber-200/70 text-xs mt-1">
                      The card content doesn't match the original source file.
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (selectedFile && confirm('This will restore the original content from the source file. Continue?')) {
                            restoreContentMutation.mutate(selectedFile);
                          }
                        }}
                        disabled={restoreContentMutation.isPending}
                        className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-7"
                        data-testid="button-restore-content"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Restore from Original
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isCardFile && verifyResult?.isValid && (
                <div className="mb-4 p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2" data-testid="integrity-valid">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 text-xs">Content matches original source file</span>
                </div>
              )}

              {/* Original Content Area */}
              <div 
                ref={contentRef}
                data-section="original"
                className="text-sm leading-relaxed bg-gray-800 p-6 rounded-lg border border-gray-700 select-text text-slate-300"
                style={{ 
                  userSelect: 'text',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  fontSize: '14px',
                  lineHeight: '1.7'
                }}
              >
                {displayData.sourceType === 'csv' ? (
                  (() => {
                    const csvData = parseCSV(displayData.content);
                    const headers = csvData[0] || [];
                    const rows = csvData.slice(1);
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              {headers.map((header, colIndex) => (
                                <th key={colIndex} className="border border-gray-600 bg-gray-700 px-3 py-2 text-left text-slate-200 font-medium">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {row.map((cell, colIndex) => {
                                  // Process markdown tags to HTML for each cell
                                  const processedCell = processMarkdownTags(cell);
                                  return (
                                    <td 
                                      key={colIndex}
                                      className={`border border-gray-600 px-3 py-2 text-slate-300 cursor-pointer hover:bg-gray-700 ${
                                        selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex ? 'bg-blue-900/30' : ''
                                      }`}
                                      onClick={() => handleCellSelection(rowIndex + 1, colIndex, cell)}
                                    >
                                      <span dangerouslySetInnerHTML={{ __html: processedCell }} />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                ) : (
                  renderContentWithTables(
                    displayData.content,
                    renderHighlightedContent,
                    (row: number, col: number, content: string) => {
                      if (selectedFileData) {
                        const textSelection: TextSelection = {
                          text: content,
                          startOffset: 0,
                          endOffset: content.length,
                          filename: selectedFileData.name,
                          reference: `${selectedFileData.name}[${row},${col}]`
                        };
                        onTextSelection(textSelection);
                        setSelectedCell({ row, col });
                      }
                    },
                    selectedCell
                  ).map((element, index) => (
                    <div key={index}>{element}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-gray-700 hover:bg-gray-600" />

        {/* Panel 2: Metadata */}
        <ResizablePanel defaultSize={30} minSize={10}>
          <div className="h-full flex flex-col min-h-0">
            <div className="px-6 py-2 border-b border-gray-700 flex-shrink-0 bg-gray-800/50 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">ORCS Metadata</span>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => {
                    refetchContent();
                    queryClient.refetchQueries({ queryKey: [`/api/files/${selectedFile}/metadata`] });
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-200 h-6 px-2"
                  title="Refresh document content and highlighting"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => setShowMetadataForm(true)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-200 h-6 px-2"
                >
                  <Edit className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 mb-4">
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                  {metadataContent || 'No metadata available'}
                </pre>
              </div>

              {/* Snippets Section */}
              {isCardFile && (
                <div className="pt-4 border-t border-gray-700">
                  <button 
                    onClick={() => setShowSnippets(!showSnippets)}
                    className="flex items-center gap-2 text-slate-400 font-sans text-xs uppercase tracking-wide mb-3 hover:text-slate-200 w-full"
                    data-testid="toggle-snippets"
                  >
                    {showSnippets ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <MessageSquare className="w-3 h-3" />
                    <span>Snippets ({snippets.length})</span>
                  </button>
                  {showSnippets && (
                    <div className="space-y-2 text-xs">
                      {snippets.length === 0 ? (
                        <div className="text-slate-500 italic">No snippets yet. Highlight text and create a snippet.</div>
                      ) : (
                        snippets.map((snippet) => (
                          <div 
                            key={snippet.id} 
                            className="bg-amber-500/10 border border-amber-500/30 rounded p-2 group"
                            data-testid={`snippet-${snippet.id}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-amber-200 line-clamp-2 mb-1">"{snippet.text}"</div>
                                {snippet.comment && (
                                  <div className="text-slate-400 italic text-[10px]">{snippet.comment}</div>
                                )}
                                <div className="text-slate-500 text-[10px] mt-1">
                                  [{snippet.offsets.start}-{snippet.offsets.end}]
                                  {snippet.analyst && <span> · {snippet.analyst}</span>}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => deleteSnippetMutation.mutate(snippet.id)}
                                disabled={deleteSnippetMutation.isPending}
                                data-testid={`delete-snippet-${snippet.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Links Section */}
              {cardUuidForQueries && (
                <div className="pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <button 
                      onClick={() => setShowLinks(!showLinks)}
                      className="flex items-center gap-2 text-slate-400 font-sans text-xs uppercase tracking-wide hover:text-slate-200"
                      data-testid="toggle-links"
                    >
                      {showLinks ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <Link2 className="w-3 h-3" />
                      <span>Links ({links.length})</span>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLinkForm(!showLinkForm)}
                      className="h-6 px-2 text-orange-400 hover:text-orange-300"
                      data-testid="button-show-link-form"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Link Creation Form */}
                  {showLinkForm && (
                    <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs">
                      <div className="flex items-center gap-2 mb-2 text-orange-200">
                        <Link2 className="w-3 h-3" />
                        <span className="font-medium">Create Link</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowLinkForm(false)}
                          className="ml-auto h-5 w-5 p-0 text-slate-400 hover:text-slate-200"
                          data-testid="button-close-link-form"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      {/* Source Entity */}
                      <div className="mb-2">
                        <label className="text-slate-400 text-[10px] block mb-1">Source Entity</label>
                        <select
                          value={linkSourceId}
                          onChange={(e) => setLinkSourceId(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-slate-200 focus:outline-none focus:border-orange-500"
                          data-testid="select-link-source"
                        >
                          <option value="">Select entity...</option>
                          {fileSpecificTags.filter(t => t.type === 'entity').map(entity => (
                            <option key={entity.id} value={entity.id}>
                              {entity.name} ({entity.id.slice(0, 8)})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Predicate */}
                      <div className="mb-2">
                        <label className="text-slate-400 text-[10px] block mb-1">Predicate</label>
                        <input
                          type="text"
                          value={linkPredicate}
                          onChange={(e) => setLinkPredicate(e.target.value)}
                          placeholder="e.g., works_for, located_in"
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                          data-testid="input-link-predicate"
                        />
                      </div>

                      {/* Target Entity */}
                      <div className="mb-2">
                        <label className="text-slate-400 text-[10px] block mb-1">Target Entity</label>
                        <select
                          value={linkTargetId}
                          onChange={(e) => setLinkTargetId(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-slate-200 focus:outline-none focus:border-orange-500"
                          data-testid="select-link-target"
                        >
                          <option value="">Select entity...</option>
                          {fileSpecificTags.filter(t => t.type === 'entity').map(entity => (
                            <option key={entity.id} value={entity.id}>
                              {entity.name} ({entity.id.slice(0, 8)})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Link Type Toggle */}
                      <div className="mb-2 flex items-center gap-4">
                        <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="linkType"
                            checked={linkIsRelationship}
                            onChange={() => setLinkIsRelationship(true)}
                            className="accent-orange-500"
                            data-testid="radio-link-relationship"
                          />
                          <span className="text-orange-300">Relationship</span>
                        </label>
                        <label className="flex items-center gap-1 text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="linkType"
                            checked={!linkIsRelationship}
                            onChange={() => setLinkIsRelationship(false)}
                            className="accent-purple-500"
                            data-testid="radio-link-attribute"
                          />
                          <span className="text-purple-300">Attribute</span>
                        </label>
                      </div>

                      {/* Direction Toggle */}
                      <div className="mb-3">
                        <label className="text-slate-400 text-[10px] block mb-1">Direction</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLinkDirection(1)}
                            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 ${linkDirection === 1 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-slate-400'}`}
                            data-testid="button-direction-forward"
                          >
                            <ArrowRight className="w-3 h-3" /> Forward
                          </button>
                          <button
                            onClick={() => setLinkDirection(3)}
                            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 ${linkDirection === 3 ? 'bg-orange-600 text-white' : 'bg-gray-700 text-slate-400'}`}
                            data-testid="button-direction-bidirectional"
                          >
                            <ArrowLeftRight className="w-3 h-3" /> Both
                          </button>
                        </div>
                      </div>

                      {/* Create Button */}
                      <Button
                        size="sm"
                        onClick={handleCreateLink}
                        disabled={createLinkMutation.isPending || !linkSourceId || !linkTargetId || !linkPredicate.trim()}
                        className="w-full h-7 bg-orange-600 hover:bg-orange-500 text-white text-xs"
                        data-testid="button-create-link"
                      >
                        {createLinkMutation.isPending ? 'Creating...' : 'Create Link'}
                      </Button>
                    </div>
                  )}

                  {showLinks && (
                    <div className="space-y-2 text-xs">
                      {links.length === 0 ? (
                        <div className="text-slate-500 italic">No links yet. Click + to create a link between entities.</div>
                      ) : (
                        links.map((link) => (
                          <div 
                            key={link.id} 
                            className={`rounded p-2 group ${
                              link.isAttribute 
                                ? 'bg-purple-500/10 border border-purple-500/30' 
                                : 'bg-orange-500/10 border border-orange-500/30'
                            }`}
                            data-testid={`link-${link.id}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className={link.isAttribute ? 'text-purple-200' : 'text-orange-200'}>
                                  <span className="font-mono text-[10px]">{link.sourceId.slice(0, 8)}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium">[{link.predicate}]</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-mono text-[10px]">{link.targetId.slice(0, 8)}</span>
                                </div>
                                {Object.keys(link.properties || {}).length > 0 && (
                                  <div className="text-slate-400 text-[10px] mt-1">
                                    {Object.entries(link.properties).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                  </div>
                                )}
                                <div className="text-slate-500 text-[10px] mt-1">
                                  {link.isRelationship && <Badge variant="outline" className="text-[8px] px-1 py-0 mr-1 border-orange-500/50 text-orange-400">REL</Badge>}
                                  {link.isAttribute && <Badge variant="outline" className="text-[8px] px-1 py-0 mr-1 border-purple-500/50 text-purple-400">ATTR</Badge>}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => deleteLinkMutation.mutate(link.id)}
                                disabled={deleteLinkMutation.isPending}
                                data-testid={`delete-link-${link.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bullets Section (auto-generated from links) */}
              {cardUuidForQueries && (
                <div className="pt-4 border-t border-gray-700">
                  <button 
                    onClick={() => setShowBullets(!showBullets)}
                    className="flex items-center gap-2 text-slate-400 font-sans text-xs uppercase tracking-wide mb-3 hover:text-slate-200 w-full"
                    data-testid="toggle-bullets"
                  >
                    {showBullets ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <Zap className="w-3 h-3" />
                    <span>Bullets ({bullets.length})</span>
                  </button>
                  {showBullets && (
                    <div className="space-y-2 text-xs">
                      {bullets.length === 0 ? (
                        <div className="text-slate-500 italic">No bullets yet. Create links to auto-generate bullets.</div>
                      ) : (
                        bullets.map((bullet, idx) => (
                          <div 
                            key={bullet.linkId || idx}
                            className="bg-cyan-500/10 border border-cyan-500/30 rounded p-2"
                            data-testid={`bullet-${bullet.linkId || idx}`}
                          >
                            <div className="text-cyan-200">
                              <span className="font-medium">{bullet.subject?.canonicalName || bullet.subject?.displayName || 'Unknown'}</span>
                              <span className="mx-1 text-cyan-400">[{bullet.predicate}]</span>
                              <span className="font-medium">{bullet.object?.canonicalName || bullet.object?.displayName || 'Unknown'}</span>
                            </div>
                            {Object.keys(bullet.predicateProperties || {}).length > 0 && (
                              <div className="text-slate-400 text-[10px] mt-1">
                                {Object.entries(bullet.predicateProperties).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </div>
                            )}
                            <div className="text-slate-500 text-[10px] mt-1 flex items-center gap-2">
                              {bullet.isRelationship && <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500/50 text-orange-400">REL</Badge>}
                              {bullet.isAttribute && <Badge variant="outline" className="text-[8px] px-1 py-0 border-purple-500/50 text-purple-400">ATTR</Badge>}
                              {bullet.classification && <span className="text-slate-500">({bullet.classification})</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tagged Elements */}
              {fileSpecificTags.length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-slate-400 font-sans text-xs uppercase tracking-wide mb-3">Tagged Elements</h3>
                  <div className="space-y-2 text-xs">
                    {fileSpecificTags.map((tag) => (
                      <div 
                        key={tag.id} 
                        className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-1 rounded"
                        onClick={() => onTagClick(tag)}
                      >
                        <span className={`text-${tag.type === 'entity' ? 'green' : tag.type === 'relationship' ? 'amber' : 'purple'}-400`}>
                          {tag.type}:{tag.name}
                        </span>
                        <span className="text-slate-400 truncate">{tag.references.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Metadata Form Modal */}
      {showMetadataForm && selectedFile && selectedFileData && (
        <MetadataForm
          fileId={selectedFile}
          fileName={selectedFileData.name}
          initialMetadata={metadataContent}
          onClose={() => setShowMetadataForm(false)}
          onSave={handleMetadataSave}
        />
      )}
    </div>
  );
}