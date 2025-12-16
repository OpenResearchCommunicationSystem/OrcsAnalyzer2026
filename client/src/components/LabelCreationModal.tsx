import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bookmark } from "lucide-react";
import { TextSelection, InsertTag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";

interface LabelCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: TextSelection | null;
  onTagCreated: () => void;
}

export function LabelCreationModal({ 
  isOpen, 
  onClose, 
  selectedText, 
  onTagCreated 
}: LabelCreationModalProps) {
  const [text, setText] = useState('');
  const [normalization, setNormalization] = useState('');
  const [comment, setComment] = useState('');

  const { createTag, isCreating } = useTagOperations();

  useEffect(() => {
    if (isOpen && selectedText?.text) {
      setText(selectedText.text);
    } else if (!isOpen) {
      setText('');
      setNormalization('');
      setComment('');
    }
  }, [isOpen, selectedText?.text]);

  const handleCreateLabel = async () => {
    if (!selectedText || !text.trim()) {
      return;
    }

    const reference = selectedText.filename;
    
    const tagData: InsertTag = {
      type: 'label',
      name: text.trim(),
      references: [reference],
      aliases: [],
      keyValuePairs: {},
      normalization: normalization.trim() || undefined,
      comment: comment.trim() || undefined,
    };

    try {
      await createTag(tagData);
      onTagCreated();
      onClose();
      setText('');
      setNormalization('');
      setComment('');
    } catch (error) {
      console.error('Failed to create label:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-cyan-400" />
            <span>Create Label</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3 text-sm">
            <p className="text-cyan-300">
              Labels become reusable vocabulary for this card. They populate dropdowns in Entity and Link creation.
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Selected Text</Label>
            <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-cyan-300">
              {selectedText?.text || 'No text selected'}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Label Text</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter label text"
              className="bg-gray-900 border-gray-600 focus:border-cyan-500"
              data-testid="input-label-text"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">
              Normalization <span className="text-slate-500">(optional)</span>
            </Label>
            <Input
              value={normalization}
              onChange={(e) => setNormalization(e.target.value)}
              placeholder="[[type:canonical|display]] format"
              className="bg-gray-900 border-gray-600 focus:border-cyan-500"
              data-testid="input-label-normalization"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use wiki-link syntax for normalization, e.g., [[person:John Smith|Johnny]]
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">
              Comment <span className="text-slate-500">(optional)</span>
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Analyst notes about this label"
              className="bg-gray-900 border-gray-600 focus:border-cyan-500 resize-none"
              rows={2}
              data-testid="input-label-comment"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleCreateLabel}
              disabled={isCreating || !text.trim() || !selectedText}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700"
              data-testid="button-create-label"
            >
              {isCreating ? 'Creating...' : 'Create Label'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-slate-400 hover:bg-gray-700"
              data-testid="button-cancel-label"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
