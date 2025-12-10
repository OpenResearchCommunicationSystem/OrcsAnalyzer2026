import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Table, Save, FileText, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { Tag, TextSelection, File } from '@shared/schema';
import { MetadataForm } from './MetadataForm';
import { renderContentWithTables } from '@/lib/markdownTableRenderer';

interface DocumentViewerProps {
  selectedFile: string | null;
  onTextSelection: (selection: TextSelection) => void;
  onTagClick: (tag: Tag, isCtrlClick?: boolean) => void;
  onFileNotFound?: (staleFileId: string) => void;
}

export function DocumentViewer({ selectedFile, onTextSelection, onTagClick, onFileNotFound }: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [metadataContent, setMetadataContent] = useState<string>('');
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const queryClient = useQueryClient();

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
      return `<button class="${colorClass} hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50" data-tag-id="${uuid}" data-tag-type="${type}" type="button" style="cursor: pointer; border: none; font: inherit; padding: 2px 4px; position: relative; z-index: 10;">${text}</button>`;
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
  const getDisplayContent = (): { content: string; sourceType: 'txt' | 'csv' | null } => {
    if (!fileContent?.content) return { content: '', sourceType: null };
    
    // If this is a card file (.card.txt), extract the original content section
    if (selectedFileData?.name.includes('.card.txt')) {
      const originalContent = extractOriginalContent(fileContent.content);
      const sourceInfo = getSourceFileInfo(fileContent.content);
      
      // Process markdown tags in the content for highlighting
      const processedContent = processMarkdownTags(originalContent);
      
      return { 
        content: processedContent, 
        sourceType: sourceInfo.type 
      };
    }
    
    // For original files, return content as-is
    return { 
      content: fileContent.content, 
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
    const tagSegments: TagSegment[] = fileTags
      .flatMap(tag => {
        return tag.references
          .filter((ref: string) => ref.includes(selectedFileData.name))
          .map((ref: string) => {
            const match = ref.match(new RegExp(`${escapeRegExp(selectedFileData.name)}@(\\d+)-(\\d+)`));
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
      const highlightedSpan = `<span class="${highlightClass}" data-tag-id="${segment.tag.id}" data-tag-name="${tagName}" title="${tagName} (${tagType})" style="cursor: pointer;">${taggedText}</span>`;

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
      if (selection && selection.toString().trim().length > 0 && contentRef.current && fileContent?.content) {
        const selectedText = selection.toString();
        const range = selection.getRangeAt(0);
        const displayData = getDisplayContent();
        
        // Calculate offset by counting characters from the beginning of the content element
        const walker = document.createTreeWalker(
          contentRef.current,
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
        
        if (startOffset !== -1 && selectedFileData) {
          const endOffset = startOffset + selectedText.length;
          
          // Verify the selection matches the content at these offsets
          const contentAtOffsets = displayData.content.substring(startOffset, endOffset);
          
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
          } else {
            // If offsets don't match, try to find the text in the display content
            const actualStartIndex = displayData.content.indexOf(selectedText);
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
  }, [selectedFileData, onTextSelection, fileContent?.content, isTagClick]);

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

          <div 
            ref={contentRef}
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
                        const cellValue = row[colIndex] || '';
                        const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                        
                        return (
                          <td
                            key={colIndex}
                            className={`px-3 py-2 text-slate-300 cursor-pointer hover:bg-gray-600 transition-colors ${
                              isSelected ? 'bg-blue-900 border border-blue-500' : ''
                            }`}
                            onClick={() => handleCellSelection(rowIndex, colIndex, cellValue)}
                            title={cellValue.replace(/<[^>]*>/g, '')} // Strip HTML for tooltip
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

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto min-h-0">
      <div className="max-w-none w-full">
        {renderContent()}</div>
      
      {/* Metadata Panel */}
      {selectedFile && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 font-sans text-xs uppercase tracking-wide">ORCS Metadata</h3>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => {
                  refetchContent();
                  queryClient.refetchQueries({ queryKey: [`/api/files/${selectedFile}/metadata`] });
                }}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
                title="Refresh document content and highlighting"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
              <Button
                onClick={() => setShowMetadataForm(true)}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
            </div>
          </div>
          
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {metadataContent || 'No metadata available'}
            </pre>
          </div>
        </div>
      )}
      
      {/* Tagged entities visualization */}
      {(() => {
        // Filter tags to only show those that reference the current file
        const currentFileName = selectedFileData?.name;
        const fileSpecificTags = tags.filter(tag => {
          if (!currentFileName || !tag.references || tag.references.length === 0) return false;
          // Check if tag references this file (handle both @offset and [row,col] formats)
          return tag.references.some(ref => 
            ref.startsWith(currentFileName + '@') || 
            ref.startsWith(currentFileName + '[')
          );
        });
        
        return fileSpecificTags.length > 0 && selectedFile && (
          <div className="mt-6 pt-4 border-t border-gray-700">
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
                  <span className="text-slate-400">{tag.references.join(', ')}</span>
                  {tag.aliases.length > 0 && (
                    <span className="text-slate-500">[{tag.aliases.join(', ')}]</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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