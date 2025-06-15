import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import type { Tag, TextSelection, File } from '@shared/schema';

interface DocumentViewerProps {
  selectedFile: string | null;
  onTextSelection: (selection: TextSelection) => void;
  onTagClick: (tag: Tag) => void;
}

export function DocumentViewer({ selectedFile, onTextSelection, onTagClick }: DocumentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);

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

  const selectedFileData = files.find(f => f.id === selectedFile);
  const fileType = selectedFileData?.type;

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

    // Only show text files
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

    // For non-text files, show a message
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">
          Only text files (.txt) are supported in this viewer
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {renderContent()}
      
      {/* Tagged entities visualization */}
      {tags.length > 0 && selectedFile && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-slate-400 font-sans text-xs uppercase tracking-wide mb-3">Tagged Elements</h3>
          <div className="space-y-2 text-xs">
            {tags.slice(0, 5).map((tag) => (
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
      )}
    </div>
  );
}