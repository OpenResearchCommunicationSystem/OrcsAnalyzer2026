import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Highlighter, AlertTriangle } from "lucide-react";
import { TextSelection } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SnippetCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: TextSelection | null;
  onSnippetCreated: () => void;
}

export function SnippetCreationModal({ 
  isOpen, 
  onClose, 
  selectedText, 
  onSnippetCreated 
}: SnippetCreationModalProps) {
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setComment('');
    }
  }, [isOpen]);

  const extractCardId = (filename: string): string | null => {
    const match = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.card\.txt$/i);
    return match ? match[1] : null;
  };

  const cardId = selectedText?.filename ? extractCardId(selectedText.filename) : null;

  const createSnippetMutation = useMutation({
    mutationFn: async (data: { text: string; offsets: { start: number; end: number }; comment?: string }) => {
      if (!cardId) throw new Error('Not a card file');
      return apiRequest('POST', `/api/cards/${cardId}/snippets`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/file'] });
      if (cardId) {
        queryClient.invalidateQueries({ queryKey: ['/api/cards', cardId, 'snippets'] });
      }
      toast({
        title: 'Snippet created',
        description: 'The selected text has been highlighted.',
      });
      onSnippetCreated();
      onClose();
    },
    onError: (error) => {
      console.error('Failed to create snippet:', error);
      toast({
        title: 'Failed to create snippet',
        description: 'There was an error creating your snippet.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedText) {
      toast({
        title: 'No text selected',
        description: 'Please select text to create a snippet.',
        variant: 'destructive',
      });
      return;
    }

    createSnippetMutation.mutate({
      text: selectedText.text,
      offsets: { start: selectedText.startOffset, end: selectedText.endOffset },
      comment: comment.trim() || undefined,
    });
  };

  const isCardFile = selectedText?.filename?.includes('.card.txt');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Highlighter className="w-5 h-5" />
            Create Snippet
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Highlight this text and optionally add a note.
          </DialogDescription>
        </DialogHeader>

        {!isCardFile && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Snippets can only be added to card files</span>
            </div>
          </div>
        )}

        {isCardFile && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Selected text:
              </span>
              <p className="text-sm text-amber-200 mt-1 line-clamp-3">
                "{selectedText?.text.slice(0, 150)}{(selectedText?.text.length ?? 0) > 150 ? '...' : ''}"
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                Range: [{selectedText?.startOffset}-{selectedText?.endOffset}]
              </span>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">
                Note (optional)
              </Label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note to this snippet..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                data-testid="input-snippet-comment"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200"
                data-testid="button-cancel-snippet"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createSnippetMutation.isPending}
                className="bg-amber-600 hover:bg-amber-500 text-white"
                data-testid="button-create-snippet"
              >
                {createSnippetMutation.isPending ? 'Creating...' : 'Create Snippet'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
