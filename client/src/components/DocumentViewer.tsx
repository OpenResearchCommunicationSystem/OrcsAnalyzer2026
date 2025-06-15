import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";
import { File, Tag, TextSelection, OrcsCard } from "@shared/schema";
import { parseOrcsCard } from "@/lib/orcsParser";

interface DocumentViewerProps {
  selectedFile: string | null;
  onTextSelection: (selection: TextSelection) => void;
  onTagClick: (tag: Tag) => void;
}

export function DocumentViewer({ selectedFile, onTextSelection, onTagClick }: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  const { data: fileContent } = useQuery({
    queryKey: ['/api/files', selectedFile, 'content'],
    enabled: !!selectedFile,
  });

  const selectedFileData = files.find(f => f.id === selectedFile);
  const isOrcsCard = selectedFileData?.type === 'orcs_card';
  const parsedCard = isOrcsCard && fileContent?.content ? parseOrcsCard(fileContent.content) : null;

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && contentRef.current?.contains(selection.anchorNode)) {
        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;
        
        setSelectedText(text);
        
        if (selectedFileData) {
          onTextSelection({
            text,
            startOffset,
            endOffset,
            filename: selectedFileData.name,
          });
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [selectedFileData, onTextSelection]);

  if (!selectedFile || !selectedFileData) {
    return (
      <div className="flex-1 bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <h3 className="text-lg font-medium mb-2">No File Selected</h3>
          <p>Select a file from the sidebar to view its contents</p>
        </div>
      </div>
    );
  }

  if (!fileContent) {
    return (
      <div className="flex-1 bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-slate-400">Loading file content...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {parsedCard ? (
        // ORCS Card View
        <>
          {/* Document Header */}
          <div className="mb-6 pb-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-slate-200">
                {parsedCard.title}
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive" className="bg-red-600">
                  {parsedCard.classification}
                </Badge>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <span className="font-medium">Source:</span> 
                <span className="ml-1">{parsedCard.source}</span>
              </div>
              <div>
                <span className="font-medium">Modified:</span> 
                <span className="ml-1">{new Date(parsedCard.modified).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-medium">UUID:</span> 
                <span className="font-mono text-xs ml-1">{parsedCard.id}</span>
              </div>
              <div>
                <span className="font-medium">Citation:</span> 
                <span className="ml-1">{parsedCard.citation}</span>
              </div>
            </div>
          </div>

          {/* Document Content */}
          <div 
            ref={contentRef}
            className="font-mono text-sm leading-relaxed bg-gray-800 p-4 rounded-lg border border-gray-700 select-text"
            style={{ userSelect: 'text' }}
          >
            <div className="text-slate-300 mb-4 whitespace-pre-wrap">
              {parsedCard.content}
            </div>

            {/* Tagged entities visualization would go here */}
            {tags.length > 0 && (
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
        </>
      ) : (
        // Plain file view
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-medium text-slate-200">{selectedFileData.name}</h2>
            <p className="text-sm text-slate-400">
              {selectedFileData.type.toUpperCase()} file • {(selectedFileData.size / 1024).toFixed(1)} KB
            </p>
          </div>
          
          <div 
            ref={contentRef}
            className="font-mono text-sm leading-relaxed bg-gray-800 p-4 rounded-lg border border-gray-700 select-text whitespace-pre-wrap"
            style={{ userSelect: 'text' }}
          >
            {fileContent.content}
          </div>
        </div>
      )}
    </div>
  );
}
