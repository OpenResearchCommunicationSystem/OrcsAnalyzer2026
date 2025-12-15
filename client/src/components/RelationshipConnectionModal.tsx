import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Tag, ConnectionDirection, TagConnection } from '@shared/schema';
import { ArrowRight, ArrowLeft, ArrowLeftRight, Minus, Link2 } from 'lucide-react';

interface RelationshipConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceEntity: Tag | null;
  targetEntity: Tag | null;
  currentFileId?: string | null;
  cardUuid?: string | null;
  onConnectionCreated?: () => void;
}

export function RelationshipConnectionModal({
  isOpen,
  onClose,
  sourceEntity,
  targetEntity,
  currentFileId,
  cardUuid,
  onConnectionCreated
}: RelationshipConnectionModalProps) {
  const queryClient = useQueryClient();
  const [relationshipMode, setRelationshipMode] = useState<'existing' | 'document' | 'custom'>('document');
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>('');
  const [customLabel, setCustomLabel] = useState<string>('');
  const [direction, setDirection] = useState<ConnectionDirection>(0);

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  const { data: connections = [] } = useQuery<TagConnection[]>({
    queryKey: ['/api/connections'],
  });

  const existingRelationshipsBetweenEntities = connections
    .filter(conn => 
      (conn.sourceTagId === sourceEntity?.id && conn.targetTagId === targetEntity?.id) ||
      (conn.sourceTagId === targetEntity?.id && conn.targetTagId === sourceEntity?.id)
    )
    .map(conn => {
      const relTag = tags.find(t => t.id === conn.relationshipTagId);
      return relTag;
    })
    .filter((t): t is Tag => t !== undefined);

  const documentRelationships = tags.filter(t => t.type === 'relationship');

  const createConnectionMutation = useMutation({
    mutationFn: async (data: {
      sourceTagId: string;
      targetTagId: string;
      relationshipTagId?: string;
      direction: ConnectionDirection;
      customLabel?: string;
      predicate?: string;
    }) => {
      // Create the connection (old system for graph visualization)
      const connectionResult = await apiRequest('POST', '/api/connections', data);
      
      // Also create a Link in the card's LINK INDEX (new system for bullets)
      if (cardUuid && data.predicate) {
        await apiRequest('POST', `/api/cards/${cardUuid}/links`, {
          sourceId: data.sourceTagId,
          targetId: data.targetTagId,
          predicate: data.predicate,
          isRelationship: true,
          isAttribute: false,
          direction: data.direction
        });
      }
      
      return connectionResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      // Invalidate links and bullets for the card
      if (cardUuid) {
        queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuid, 'links'] });
        queryClient.invalidateQueries({ queryKey: ['/api/cards', cardUuid, 'bullets'] });
      }
      onConnectionCreated?.();
      handleClose();
    }
  });

  const handleClose = () => {
    setRelationshipMode('document');
    setSelectedRelationshipId('');
    setCustomLabel('');
    setDirection(0);
    onClose();
  };

  const handleCreate = () => {
    if (!sourceEntity || !targetEntity) return;

    let relationshipTagId: string | undefined;
    let predicate: string | undefined;

    if (relationshipMode === 'existing' && selectedRelationshipId) {
      relationshipTagId = selectedRelationshipId;
      const relTag = tags.find(t => t.id === selectedRelationshipId);
      predicate = relTag?.name;
    } else if (relationshipMode === 'document' && selectedRelationshipId) {
      relationshipTagId = selectedRelationshipId;
      const relTag = tags.find(t => t.id === selectedRelationshipId);
      predicate = relTag?.name;
    } else if (relationshipMode === 'custom' && customLabel.trim()) {
      predicate = customLabel.trim();
    }

    createConnectionMutation.mutate({
      sourceTagId: sourceEntity.id,
      targetTagId: targetEntity.id,
      relationshipTagId,
      direction,
      customLabel: relationshipMode === 'custom' ? customLabel : undefined,
      predicate
    });
  };

  const getDirectionIcon = (dir: ConnectionDirection) => {
    switch (dir) {
      case 1: return <ArrowRight className="w-4 h-4" />;
      case 2: return <ArrowLeft className="w-4 h-4" />;
      case 3: return <ArrowLeftRight className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const directionLabels: Record<ConnectionDirection, string> = {
    0: 'None',
    1: 'Forward',
    2: 'Backward',
    3: 'Both'
  };

  if (!sourceEntity || !targetEntity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-orange-400" />
            Create Relationship
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-800 rounded-lg">
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
              {sourceEntity.name}
            </Badge>
            <div className="flex items-center text-orange-400">
              {getDirectionIcon(direction)}
            </div>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 px-3 py-1">
              {targetEntity.name}
            </Badge>
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-slate-300">Relationship Label</Label>
            
            <RadioGroup value={relationshipMode} onValueChange={(v) => setRelationshipMode(v as any)}>
              {existingRelationshipsBetweenEntities.length > 0 && (
                <div className="flex items-center space-x-2 p-2 rounded border border-gray-700 hover:border-gray-600">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="flex-1 cursor-pointer text-sm">
                    Existing relationship between these entities
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-2 p-2 rounded border border-gray-700 hover:border-gray-600">
                <RadioGroupItem value="document" id="document" />
                <Label htmlFor="document" className="flex-1 cursor-pointer text-sm">
                  Select from document relationships
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-2 rounded border border-gray-700 hover:border-gray-600">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex-1 cursor-pointer text-sm">
                  Custom label (creates "manual link")
                </Label>
              </div>
            </RadioGroup>
          </div>

          {relationshipMode === 'existing' && existingRelationshipsBetweenEntities.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-400">Select existing relationship</Label>
              <Select value={selectedRelationshipId} onValueChange={setSelectedRelationshipId}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Choose relationship..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {existingRelationshipsBetweenEntities.map(rel => (
                    <SelectItem key={rel.id} value={rel.id}>
                      {rel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {relationshipMode === 'document' && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-400">Select document relationship</Label>
              <Select value={selectedRelationshipId} onValueChange={setSelectedRelationshipId}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="Choose relationship..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {documentRelationships.length > 0 ? (
                    documentRelationships.map(rel => (
                      <SelectItem key={rel.id} value={rel.id}>
                        {rel.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No relationships in document
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {relationshipMode === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-400">Custom relationship label</Label>
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., location, present, works at"
                className="bg-gray-800 border-gray-700"
              />
              <p className="text-xs text-slate-500">
                This will create a "manual link" relationship tag appended to the document
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm text-slate-300">Direction</Label>
            <div className="grid grid-cols-4 gap-2">
              {([0, 1, 2, 3] as ConnectionDirection[]).map((dir) => (
                <Button
                  key={dir}
                  type="button"
                  variant={direction === dir ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection(dir)}
                  className={`flex flex-col items-center gap-1 h-auto py-2 ${
                    direction === dir 
                      ? 'bg-orange-600 hover:bg-orange-700 border-orange-500' 
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {getDirectionIcon(dir)}
                  <span className="text-xs">{directionLabels[dir]}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={
              createConnectionMutation.isPending ||
              (relationshipMode === 'custom' && !customLabel.trim()) ||
              (relationshipMode !== 'custom' && !selectedRelationshipId)
            }
            className="bg-orange-600 hover:bg-orange-700"
          >
            {createConnectionMutation.isPending ? 'Creating...' : 'Create Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}