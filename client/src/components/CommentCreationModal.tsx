import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageCircle, User, AlertTriangle } from "lucide-react";
import { TextSelection, CommentInsert } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CommentCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: TextSelection | null;
  onCommentCreated: () => void;
}

export function CommentCreationModal({ 
  isOpen, 
  onClose, 
  selectedText, 
  onCommentCreated 
}: CommentCreationModalProps) {
  const [commentText, setCommentText] = useState('');
  const [analyst, setAnalyst] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setCommentText('');
      const storedAnalyst = localStorage.getItem('orcs_analyst_name') || '';
      setAnalyst(storedAnalyst);
    }
  }, [isOpen]);

  const extractCardId = (filename: string): string | null => {
    const match = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.card\.txt$/i);
    return match ? match[1] : null;
  };

  const cardId = selectedText?.filename ? extractCardId(selectedText.filename) : null;

  const createCommentMutation = useMutation({
    mutationFn: async (data: { text: string; insertOffset: number; analyst: string }) => {
      if (!cardId) throw new Error('Not a card file');
      return apiRequest('POST', `/api/cards/${cardId}/comments`, data);
    },
    onSuccess: () => {
      if (analyst.trim()) {
        localStorage.setItem('orcs_analyst_name', analyst.trim());
      }
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/file'] });
      if (cardId) {
        queryClient.invalidateQueries({ queryKey: ['/api/cards', cardId, 'comments'] });
      }
      toast({
        title: 'Comment inserted',
        description: 'Your inline comment has been added to the document.',
      });
      onCommentCreated();
      onClose();
    },
    onError: (error) => {
      console.error('Failed to create comment:', error);
      toast({
        title: 'Failed to insert comment',
        description: 'There was an error inserting your comment.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedText || !commentText.trim() || !analyst.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please enter your comment text and analyst name.',
        variant: 'destructive',
      });
      return;
    }

    createCommentMutation.mutate({
      text: commentText.trim(),
      insertOffset: selectedText.endOffset,
      analyst: analyst.trim(),
    });
  };

  const isCardFile = selectedText?.filename?.includes('.card.txt');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-400">
            <MessageCircle className="w-5 h-5" />
            Insert Inline Comment
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Add an analyst comment that will be inserted into the document text.
          </DialogDescription>
        </DialogHeader>

        {!isCardFile && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Comments can only be added to card files</span>
            </div>
          </div>
        )}

        {isCardFile && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                Insert after selection:
              </span>
              <p className="text-sm text-slate-300 mt-1 font-mono">
                "{selectedText?.text.slice(0, 50)}{(selectedText?.text.length ?? 0) > 50 ? '...' : ''}"
              </p>
              <span className="text-xs text-slate-500 mt-1 block">
                Position: {selectedText?.endOffset}
              </span>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block flex items-center gap-2">
                <User className="w-4 h-4" />
                Analyst Name
              </Label>
              <input
                type="text"
                value={analyst}
                onChange={(e) => setAnalyst(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                data-testid="input-comment-analyst"
              />
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">
                Comment Text
              </Label>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Enter your comment..."
                className="min-h-[80px] bg-gray-800 border-gray-600 text-slate-200 placeholder:text-slate-500"
                data-testid="input-comment-text"
              />
              <p className="text-xs text-slate-500 mt-1">
                Will be inserted as: [<span className="text-blue-400">{commentText || 'your comment'}</span>]
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200"
                data-testid="button-cancel-comment"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!commentText.trim() || !analyst.trim() || createCommentMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                data-testid="button-create-comment"
              >
                {createCommentMutation.isPending ? 'Inserting...' : 'Insert Comment'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
