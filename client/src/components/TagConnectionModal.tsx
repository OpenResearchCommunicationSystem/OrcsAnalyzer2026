import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus, Minus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Tag, TagConnection, InsertTagConnection } from "@shared/schema";

interface TagConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTag?: Tag;
  onConnectionCreated?: () => void;
}

export function TagConnectionModal({ 
  isOpen, 
  onClose, 
  sourceTag, 
  onConnectionCreated 
}: TagConnectionModalProps) {
  const queryClient = useQueryClient();
  
  const [connectionData, setConnectionData] = useState<Partial<InsertTagConnection>>({
    sourceTagId: sourceTag?.id || '',
    targetTagId: '',
    relationshipTagId: '',
    attributeTagIds: [],
    connectionType: 'entity_relationship',
    strength: 1,
    notes: ''
  });

  // Fetch all tags for selection
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
    enabled: isOpen
  });

  // Filter tags by type for easier selection
  const entityTags = tags.filter(tag => tag.type === 'entity');
  const relationshipTags = tags.filter(tag => tag.type === 'relationship');
  const attributeTags = tags.filter(tag => tag.type === 'attribute');

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: async (data: InsertTagConnection) => {
      return await apiRequest('POST', '/api/connections', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      onConnectionCreated?.();
      onClose();
      setConnectionData({
        sourceTagId: sourceTag?.id || '',
        targetTagId: '',
        relationshipTagId: '',
        attributeTagIds: [],
        connectionType: 'entity_relationship',
        strength: 1,
        notes: ''
      });
    },
    onError: (error: any) => {
      console.error('Failed to create connection:', error);
      alert('Failed to create connection. Please try again.');
    }
  });

  const handleSave = () => {
    if (!connectionData.sourceTagId || !connectionData.targetTagId) {
      alert('Please select both source and target tags');
      return;
    }

    const connectionToCreate: InsertTagConnection = {
      sourceTagId: connectionData.sourceTagId!,
      targetTagId: connectionData.targetTagId!,
      relationshipTagId: connectionData.relationshipTagId || undefined,
      attributeTagIds: connectionData.attributeTagIds || [],
      connectionType: connectionData.connectionType!,
      strength: connectionData.strength || 1,
      notes: connectionData.notes || undefined
    };

    createConnectionMutation.mutate(connectionToCreate);
  };

  const addAttributeTag = (attributeId: string) => {
    if (!connectionData.attributeTagIds?.includes(attributeId)) {
      setConnectionData(prev => ({
        ...prev,
        attributeTagIds: [...(prev.attributeTagIds || []), attributeId]
      }));
    }
  };

  const removeAttributeTag = (attributeId: string) => {
    setConnectionData(prev => ({
      ...prev,
      attributeTagIds: (prev.attributeTagIds || []).filter(id => id !== attributeId)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-medium text-slate-200">Create Tag Connection</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Source Tag */}
          <div>
            <Label className="text-slate-300">Source Tag</Label>
            <Select 
              value={connectionData.sourceTagId} 
              onValueChange={(value) => setConnectionData(prev => ({ ...prev, sourceTagId: value }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue placeholder="Select source tag" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {entityTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-green-400 border-green-400">Entity</Badge>
                      <span>{tag.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Connection Type */}
          <div>
            <Label className="text-slate-300">Connection Type</Label>
            <Select 
              value={connectionData.connectionType} 
              onValueChange={(value: any) => setConnectionData(prev => ({ ...prev, connectionType: value }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="entity_relationship">Entity → Relationship</SelectItem>
                <SelectItem value="entity_attribute">Entity → Attribute</SelectItem>
                <SelectItem value="relationship_attribute">Relationship → Attribute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Tag */}
          <div>
            <Label className="text-slate-300">Target Tag</Label>
            <Select 
              value={connectionData.targetTagId} 
              onValueChange={(value) => setConnectionData(prev => ({ ...prev, targetTagId: value }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue placeholder="Select target tag" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {entityTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-green-400 border-green-400">Entity</Badge>
                      <span>{tag.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Tag (optional) */}
          {connectionData.connectionType === 'entity_relationship' && (
            <div>
              <Label className="text-slate-300">Relationship (Optional)</Label>
              <Select 
                value={connectionData.relationshipTagId || ''} 
                onValueChange={(value) => setConnectionData(prev => ({ ...prev, relationshipTagId: value || undefined }))}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="">No specific relationship</SelectItem>
                  {relationshipTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-blue-400 border-blue-400">Relationship</Badge>
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Attribute Tags */}
          <div>
            <Label className="text-slate-300">Attributes</Label>
            <div className="space-y-2">
              {/* Selected attributes */}
              {(connectionData.attributeTagIds || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {connectionData.attributeTagIds!.map((attributeId) => {
                    const attribute = attributeTags.find(tag => tag.id === attributeId);
                    return attribute ? (
                      <div key={attributeId} className="flex items-center space-x-1 bg-gray-700 rounded px-2 py-1">
                        <Badge variant="outline" className="text-orange-400 border-orange-400 text-xs">Attr</Badge>
                        <span className="text-sm text-slate-200">{attribute.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttributeTag(attributeId)}
                          className="h-4 w-4 p-0 text-red-400 hover:text-red-300"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              
              {/* Add attribute selector */}
              <Select onValueChange={addAttributeTag}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                  <SelectValue placeholder="Add attribute..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {attributeTags
                    .filter(tag => !connectionData.attributeTagIds?.includes(tag.id))
                    .map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-orange-400 border-orange-400">Attribute</Badge>
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Connection Strength */}
          <div>
            <Label className="text-slate-300">Connection Strength</Label>
            <Select 
              value={connectionData.strength?.toString()} 
              onValueChange={(value) => setConnectionData(prev => ({ ...prev, strength: parseFloat(value) }))}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="1">Strong (1.0)</SelectItem>
                <SelectItem value="0.8">Medium-Strong (0.8)</SelectItem>
                <SelectItem value="0.6">Medium (0.6)</SelectItem>
                <SelectItem value="0.4">Medium-Weak (0.4)</SelectItem>
                <SelectItem value="0.2">Weak (0.2)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-slate-300">Notes (Optional)</Label>
            <Textarea
              value={connectionData.notes || ''}
              onChange={(e) => setConnectionData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this connection..."
              className="bg-gray-700 border-gray-600 text-slate-200"
              rows={3}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={createConnectionMutation.isPending || !connectionData.sourceTagId || !connectionData.targetTagId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {createConnectionMutation.isPending ? 'Creating...' : 'Create Connection'}
          </Button>
        </div>
      </div>
    </div>
  );
}