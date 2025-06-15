import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Table, Save, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { Tag, TextSelection, File } from '@shared/schema';

interface DocumentViewerProps {
  selectedFile: string | null;
  onTextSelection: (selection: TextSelection) => void;
  onTagClick: (tag: Tag) => void;
}

export function DocumentViewer({ selectedFile, onTextSelection, onTagClick }: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [metadataContent, setMetadataContent] = useState<string>('');
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const queryClient = useQueryClient();

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  const { data: fileContent, isLoading: isContentLoading } = useQuery<{ content: string }>({
    queryKey: [`/api/files/${selectedFile}/content`],
    enabled: !!selectedFile,
  });

  const { data: metadataResponse, isLoading: isMetadataLoading } = useQuery<{ metadata: string }>({
    queryKey: [`/api/files/${selectedFile}/metadata`],
    enabled: !!selectedFile,
  });

  const selectedFileData = files.find(f => f.id === selectedFile);
  const fileType = selectedFileData?.type;

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

  // Metadata save mutation
  const saveMetadataMutation = useMutation({
    mutationFn: async (metadata: string) => {
      const response = await apiRequest(`/api/files/${selectedFile}/metadata`, 'PUT', { metadata });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${selectedFile}/metadata`] });
      setIsEditingMetadata(false);
      // Show success notification
      console.log('Metadata saved successfully');
    },
    onError: (error: any) => {
      console.error('Failed to save metadata:', error);
      alert('Failed to save metadata. Please try again.');
    }
  });

  const handleSaveMetadata = () => {
    saveMetadataMutation.mutate(metadataContent);
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
      const textSelection: TextSelection = {
        text: cellValue,
        startOffset: 0,
        endOffset: cellValue.length,
        filename: selectedFileData.name,
        reference: `${selectedFileData.name}[${row},${col}]`
      };
      onTextSelection(textSelection);
      setSelectedCell({ row, col });
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0 && contentRef.current) {
        const range = selection.getRangeAt(0);
        const text = selection.toString();
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;

        if (selectedFileData) {
          const textSelection: TextSelection = {
            text,
            startOffset,
            endOffset,
            filename: selectedFileData.name,
            reference: `${selectedFileData.name}@${startOffset}-${endOffset}`
          };
          onTextSelection(textSelection);
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [selectedFileData, onTextSelection]);

  const renderContent = () => {

    if (!selectedFile) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Select a document to view</div>
        </div>
      );
    }

    if (!fileContent?.content) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading document...</div>
        </div>
      );
    }

    // Handle text files
    if (fileType === 'txt') {
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
            className="font-mono text-sm leading-relaxed bg-gray-800 p-4 rounded-lg border border-gray-700 select-text"
            style={{ userSelect: 'text' }}
          >
            <div className="text-slate-300 mb-4 whitespace-pre-wrap">
              {fileContent.content}
            </div>
          </div>
        </>
      );
    }

    // Handle CSV files
    if (fileType === 'csv') {
      const csvData = parseCSV(fileContent.content);
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
                            title={cellValue}
                          >
                            <div className="max-w-xs truncate">
                              {cellValue}
                            </div>
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
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {renderContent()}
      
      {/* Metadata Panel */}
      {selectedFile && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 font-sans text-xs uppercase tracking-wide">ORCS Metadata</h3>
            <div className="flex items-center space-x-2">
              {isEditingMetadata ? (
                <>
                  <Button
                    onClick={handleSaveMetadata}
                    disabled={saveMetadataMutation.isPending}
                    size="sm"
                    className={`${
                      saveMetadataMutation.isSuccess 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : saveMetadataMutation.isError
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {saveMetadataMutation.isPending 
                      ? 'Saving...' 
                      : saveMetadataMutation.isSuccess 
                      ? 'Saved!' 
                      : saveMetadataMutation.isError 
                      ? 'Error - Retry' 
                      : 'Save'}
                  </Button>
                  <Button
                    onClick={() => setIsEditingMetadata(false)}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditingMetadata(true)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-slate-200"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
          
          {isEditingMetadata ? (
            <Textarea
              value={metadataContent}
              onChange={(e) => setMetadataContent(e.target.value)}
              className="font-mono text-xs bg-gray-800 border-gray-600 min-h-48"
              placeholder="YAML metadata content..."
            />
          ) : (
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {metadataContent || 'No metadata available'}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {/* Tagged entities visualization */}
      {(() => {
        // Filter tags to only show those that reference the current file
        const currentFileName = selectedFileData?.name;
        const fileSpecificTags = tags.filter(tag => {
          if (!currentFileName || !tag.reference) return false;
          // Check if tag references this file (handle both @offset and [row,col] formats)
          return tag.reference.startsWith(currentFileName + '@') || 
                 tag.reference.startsWith(currentFileName + '[');
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
                  <span className="text-slate-400">{tag.reference}</span>
                  {tag.aliases.length > 0 && (
                    <span className="text-slate-500">[{tag.aliases.join(', ')}]</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}