import { Button } from "@/components/ui/button";
import { User, Link, Bookmark, Database, X, Highlighter, MessageCircle, Trash2 } from "lucide-react";
import { TextSelection } from "@shared/schema";

interface TagToolbarProps {
  selectedText: TextSelection | null;
  onCreateTag: (type: string) => void;
  onClearSelection: () => void;
  onDeleteTag?: (tagId: string) => void;
  selectedTagId?: string | null;
}

export function TagToolbar({ selectedText, onCreateTag, onClearSelection, onDeleteTag, selectedTagId }: TagToolbarProps) {
  const containsTaggedText = selectedText?.containsTaggedText ?? false;
  
  return (
    <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="border-t border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-400">Selection Tools:</span>
          
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('entity')}
              disabled={!selectedText || containsTaggedText}
              className="bg-green-500 bg-opacity-20 text-green-400 hover:bg-opacity-30 border border-green-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-entity"
            >
              <User className="w-4 h-4 mr-1" />
              Entity
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('relationship')}
              disabled={!selectedText || containsTaggedText}
              className="bg-orange-500 bg-opacity-20 text-orange-400 hover:bg-opacity-30 border border-orange-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-link"
            >
              <Link className="w-4 h-4 mr-1" />
              Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('label')}
              disabled={!selectedText || containsTaggedText}
              className="bg-cyan-500 bg-opacity-20 text-cyan-400 hover:bg-opacity-30 border border-cyan-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-label"
            >
              <Bookmark className="w-4 h-4 mr-1" />
              Label
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('data')}
              disabled={!selectedText || containsTaggedText}
              className="bg-purple-500 bg-opacity-20 text-purple-400 hover:bg-opacity-30 border border-purple-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-data"
            >
              <Database className="w-4 h-4 mr-1" />
              Data
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectedTagId && onDeleteTag?.(selectedTagId)}
              disabled={!selectedTagId}
              className="bg-red-500 bg-opacity-20 text-red-400 hover:bg-opacity-30 border border-red-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-delete-tag"
              title="Delete selected tag"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-600 mx-1" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('snippet')}
              disabled={!selectedText}
              className="bg-amber-500 bg-opacity-20 text-amber-400 hover:bg-opacity-30 border border-amber-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-snippet"
            >
              <Highlighter className="w-4 h-4 mr-1" />
              Snippet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('comment')}
              disabled={!selectedText}
              className="bg-blue-500 bg-opacity-20 text-blue-400 hover:bg-opacity-30 border border-blue-500 border-opacity-30 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-tag-comment"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Comment
            </Button>
          </div>
          
          {containsTaggedText && selectedText && (
            <span className="text-xs text-slate-500 italic">
              (Tag buttons disabled - selection includes tagged text)
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-400">
            {selectedText ? `"${selectedText.text.substring(0, 30)}${selectedText.text.length > 30 ? '...' : ''}" selected` : 'No text selected'}
          </span>
          {selectedText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
