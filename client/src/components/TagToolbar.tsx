import { Button } from "@/components/ui/button";
import { User, Link, Tag, MessageCircle, Key, X } from "lucide-react";
import { TextSelection } from "@shared/schema";

interface TagToolbarProps {
  selectedText: TextSelection | null;
  onCreateTag: (type: string) => void;
  onClearSelection: () => void;
}

export function TagToolbar({ selectedText, onCreateTag, onClearSelection }: TagToolbarProps) {
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
              disabled={!selectedText}
              className="bg-green-500 bg-opacity-20 text-green-400 hover:bg-opacity-30 border border-green-500 border-opacity-30"
            >
              <User className="w-4 h-4 mr-1" />
              Entity
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('relationship')}
              disabled={!selectedText}
              className="bg-orange-500 bg-opacity-20 text-orange-400 hover:bg-opacity-30 border border-orange-500 border-opacity-30"
            >
              <Link className="w-4 h-4 mr-1" />
              Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('comment')}
              disabled={!selectedText}
              className="bg-blue-500 bg-opacity-20 text-blue-400 hover:bg-opacity-30 border border-blue-500 border-opacity-30"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              Comment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateTag('kv_pair')}
              disabled={!selectedText}
              className="bg-amber-500 bg-opacity-20 text-amber-400 hover:bg-opacity-30 border border-amber-500 border-opacity-30"
            >
              <Key className="w-4 h-4 mr-1" />
              Pair
            </Button>
          </div>
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
