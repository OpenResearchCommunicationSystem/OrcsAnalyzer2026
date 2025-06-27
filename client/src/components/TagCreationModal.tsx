import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Link, Tag, MessageCircle, Key, X } from "lucide-react";
import { TextSelection, InsertTag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";

interface TagCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: TextSelection | null;
  tagType: string;
  onTagCreated: () => void;
}

export function TagCreationModal({ 
  isOpen, 
  onClose, 
  selectedText, 
  tagType, 
  onTagCreated 
}: TagCreationModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState(tagType);
  const [entityType, setEntityType] = useState('');

  const { createTag, isCreating } = useTagOperations();

  // Auto-populate identifier with selected text when modal opens
  useEffect(() => {
    if (isOpen && selectedText?.text) {
      setIdentifier(selectedText.text);
    } else if (!isOpen) {
      // Reset form when modal closes
      setIdentifier('');
      setDescription('');
      setEntityType('');
    }
  }, [isOpen, selectedText?.text]);

  const handleCreateTag = async () => {
    if (!selectedText || !identifier.trim()) {
      return;
    }

    // Generate card filename reference without offsets (handled inside card)
    const reference = selectedText.filename;
    
    const tagData: InsertTag = {
      type: selectedType as any,
      entityType: entityType || undefined,
      name: identifier.trim(),
      references: [reference],
      aliases: [],
      keyValuePairs: {},
      description: description.trim() || undefined,
    };

    try {
      await createTag(tagData);
      onTagCreated();
      onClose(); // Close the modal after successful creation
      setIdentifier('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const tagTypes = [
    { value: 'entity', label: 'Entity', icon: User, color: 'text-green-400 border-green-500' },
    { value: 'relationship', label: 'Relationship', icon: Link, color: 'text-amber-400 border-amber-500' },
    { value: 'attribute', label: 'Attribute', icon: Tag, color: 'text-purple-400 border-purple-500' },
    { value: 'comment', label: 'Comment', icon: MessageCircle, color: 'text-cyan-400 border-cyan-500' },
    { value: 'kv_pair', label: 'Key:Value Pair', icon: Key, color: 'text-orange-400 border-orange-500' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-300">Selected Text</Label>
            <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono">
              {selectedText?.text || 'No text selected'}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2">Tag Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {tagTypes.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  className={`flex items-center justify-center space-x-2 p-3 rounded border-2 transition-all ${
                    selectedType === value
                      ? `${color} bg-opacity-10`
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedType(value)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">
                {selectedType === 'entity' ? 'Entity Type' : 
                 selectedType === 'relationship' ? 'Relationship Type' :
                 selectedType === 'attribute' ? 'Attribute Type' :
                 selectedType === 'comment' ? 'Comment Type' :
                 'Key-Value Type'}
              </Label>
              <Select
                value={entityType}
                onValueChange={setEntityType}
              >
                <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-slate-200">
                  <SelectValue placeholder={`Select ${selectedType} type (optional)`} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {selectedType === 'entity' && (
                    <>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </>
                  )}
                  {selectedType === 'relationship' && (
                    <>
                      <SelectItem value="ownership">Ownership</SelectItem>
                      <SelectItem value="employment">Employment</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="acquisition">Acquisition</SelectItem>
                      <SelectItem value="collaboration">Collaboration</SelectItem>
                      <SelectItem value="competition">Competition</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                    </>
                  )}
                  {selectedType === 'attribute' && (
                    <>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="temporal">Temporal</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="descriptive">Descriptive</SelectItem>
                      <SelectItem value="quantitative">Quantitative</SelectItem>
                      <SelectItem value="qualitative">Qualitative</SelectItem>
                    </>
                  )}
                  {selectedType === 'comment' && (
                    <>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="hypothesis">Hypothesis</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="summary">Summary</SelectItem>
                    </>
                  )}
                  {selectedType === 'kv_pair' && (
                    <>
                      <SelectItem value="metadata">Metadata</SelectItem>
                      <SelectItem value="classification">Classification</SelectItem>
                      <SelectItem value="reference">Reference</SelectItem>
                      <SelectItem value="identifier">Identifier</SelectItem>
                      <SelectItem value="property">Property</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium text-slate-300">Identifier</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter unique identifier"
              className="bg-gray-900 border-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes or description"
              className="bg-gray-900 border-gray-600 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleCreateTag}
              disabled={isCreating || !identifier.trim() || !selectedText}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? 'Creating...' : 'Create Tag'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-slate-400 hover:bg-gray-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
