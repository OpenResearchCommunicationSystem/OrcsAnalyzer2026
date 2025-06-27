/**
 * CleanContentDisplay - Standardized component for displaying clean content
 * Ensures consistent formatting and prevents metadata contamination
 */

import { useRef, useEffect } from 'react';
import type { Tag, TextSelection } from '@shared/schema';

interface CleanContentDisplayProps {
  content: string;
  sourceType: 'text' | 'csv' | null;
  enableTagHighlighting?: boolean;
  onTagClick?: (tag: Tag) => void;
  onTextSelection?: (selection: TextSelection) => void;
  className?: string;
  tags?: Tag[];
}

export function CleanContentDisplay({ 
  content, 
  sourceType, 
  enableTagHighlighting = true,
  onTagClick,
  onTextSelection,
  className = '',
  tags = []
}: CleanContentDisplayProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Official ORCS Color Schema for tag highlighting
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

  // Process markdown tags in content for highlighting
  const processMarkdownTags = (content: string): string => {
    if (!enableTagHighlighting) return content;
    
    // Look for markdown-style tags: [entity:TechCorp](uuid) format
    return content.replace(/\[([^:]+):([^\]]+)\]\(([^)]+)\)/g, (match, type, text, uuid) => {
      const colorClass = getTagColorClass(type);
      return `<span class="${colorClass}" data-tag-id="${uuid}" data-tag-type="${type}" style="cursor: pointer;">${text}</span>`;
    });
  };

  // Handle tag clicks
  useEffect(() => {
    if (!contentRef.current || !onTagClick) return;

    const handleTagClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const tagId = target.getAttribute('data-tag-id');
      const tagType = target.getAttribute('data-tag-type');
      
      if (tagId && tags.length > 0) {
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
          onTagClick(tag);
        }
      }
    };

    const tagElements = contentRef.current.querySelectorAll('[data-tag-id]');
    tagElements.forEach(el => el.addEventListener('click', handleTagClick));

    return () => {
      tagElements.forEach(el => el.removeEventListener('click', handleTagClick));
    };
  }, [content, onTagClick, tags]);

  // Handle text selection for tagging
  useEffect(() => {
    if (!contentRef.current || !onTextSelection) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      if (selectedText.length === 0) return;

      // Calculate character positions relative to clean content
      const contentElement = contentRef.current;
      if (!contentElement) return;

      // Create a TreeWalker to traverse text nodes
      const walker = document.createTreeWalker(
        contentElement,
        NodeFilter.SHOW_TEXT,
        null
      );

      let charOffset = 0;
      let startOffset = -1;
      let endOffset = -1;
      
      // Find start and end positions
      let node;
      while (node = walker.nextNode()) {
        const textNode = node as Text;
        const nodeLength = textNode.textContent?.length || 0;
        
        if (range.startContainer === textNode) {
          startOffset = charOffset + range.startOffset;
        }
        if (range.endContainer === textNode) {
          endOffset = charOffset + range.endOffset;
        }
        
        charOffset += nodeLength;
        
        if (startOffset >= 0 && endOffset >= 0) break;
      }

      if (startOffset >= 0 && endOffset >= 0) {
        const textSelection: TextSelection = {
          text: selectedText,
          start: startOffset,
          end: endOffset
        };
        
        onTextSelection(textSelection);
      }
    };

    document.addEventListener('mouseup', handleSelection);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
    };
  }, [onTextSelection]);

  // Render CSV content as table
  const renderCSVContent = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-slate-600">
          <thead>
            <tr className="bg-slate-800">
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className="border border-slate-600 px-3 py-2 text-left text-slate-300 font-medium"
                  dangerouslySetInnerHTML={{ __html: processMarkdownTags(header) }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-800/50">
                {row.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex}
                    className="border border-slate-600 px-3 py-2 text-slate-400"
                    dangerouslySetInnerHTML={{ __html: processMarkdownTags(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render text content with line breaks
  const renderTextContent = (textContent: string) => {
    const processedContent = processMarkdownTags(textContent);
    
    return processedContent.split('\n').map((line, index) => (
      <span key={index}>
        {index > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: line }} />
      </span>
    ));
  };

  // Validate content is clean (no metadata contamination)
  const validateCleanContent = (content: string): boolean => {
    const hasUUIDs = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(content);
    const hasYAML = /^[a-z_]+:\s/m.test(content);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/i.test(content);
    
    if (hasUUIDs || hasYAML || hasTimestamps) {
      console.error('Metadata contamination detected in CleanContentDisplay:', {
        hasUUIDs,
        hasYAML,
        hasTimestamps
      });
      return false;
    }
    
    return true;
  };

  // Validate content before rendering
  if (!validateCleanContent(content)) {
    return (
      <div className={`p-4 border border-red-500/30 bg-red-900/20 rounded ${className}`}>
        <div className="text-red-400 font-semibold">Content Validation Error</div>
        <div className="text-red-300 text-sm mt-1">
          Metadata contamination detected. Content contains UUIDs, YAML, or timestamps.
        </div>
      </div>
    );
  }

  if (!content.trim()) {
    return (
      <div className={`p-4 text-slate-500 italic ${className}`}>
        No content available
      </div>
    );
  }

  return (
    <div 
      ref={contentRef}
      className={`p-4 ${className}`}
      style={{ userSelect: 'text' }}
    >
      {sourceType === 'csv' ? renderCSVContent(content) : renderTextContent(content)}
    </div>
  );
}