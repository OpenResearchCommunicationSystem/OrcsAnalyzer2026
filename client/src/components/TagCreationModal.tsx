import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Link, Tag, MessageCircle, Key, X, AlertTriangle } from "lucide-react";
import { TextSelection, InsertTag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useQuery } from "@tanstack/react-query";
import type { Tag as TagType } from "@shared/schema";

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

  const { createTag, updateTag, isCreating } = useTagOperations();

  // Fetch all tags for similarity detection
  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
  });

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

  // Find similar tags based on the current identifier
  const findSimilarTags = () => {
    if (!identifier.trim() || !allTags.length) return [];
    
    const inputName = identifier.toLowerCase().trim();
    
    return allTags
      .map(tag => {
        const tagName = tag.name.toLowerCase();
        const tagAliases = tag.aliases?.map(a => a.toLowerCase()) || [];
        let similarity = 0;
        const matchReasons: string[] = [];
        
        // Exact name match
        if (tagName === inputName) {
          similarity += 100;
          matchReasons.push("Exact match");
        }
        // Partial name match
        else if (tagName.includes(inputName) || inputName.includes(tagName)) {
          similarity += 75;
          matchReasons.push("Partial match");
        }
        
        // Alias matches
        const aliasMatches = tagAliases.filter(alias => 
          alias === inputName || alias.includes(inputName) || inputName.includes(alias)
        );
        if (aliasMatches.length > 0) {
          similarity += 50;
          matchReasons.push("Alias match");
        }
        
        // Same type bonus
        if (tag.type === selectedType) {
          similarity += 25;
          matchReasons.push("Same type");
        }
        
        return { tag, similarity, matchReasons };
      })
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Show only top 3 matches
  };

  const similarTags = findSimilarTags();

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

  const handleSelectExistingTag = async (existingTag: TagType) => {
    if (!selectedText) {
      return;
    }

    // Add the current document reference to the existing tag
    const reference = selectedText.filename;
    const updatedReferences = existingTag.references.includes(reference) 
      ? existingTag.references 
      : [...existingTag.references, reference];

    try {
      // Update the existing tag with new reference
      await updateTag(existingTag.id, { references: updatedReferences });
      
      onTagCreated();
      onClose(); // Close the modal after successful selection
      setIdentifier('');
      setDescription('');
    } catch (error) {
      console.error('Failed to update existing tag:', error);
    }
  };

  const tagTypes = [
    { value: 'entity', label: 'Entity', icon: User, color: 'text-green-400 border-green-500' },
    { value: 'relationship', label: 'Link', icon: Link, color: 'text-amber-400 border-amber-500' },
    { value: 'kv_pair', label: 'Pair', icon: Key, color: 'text-orange-400 border-orange-500' },
    { value: 'comment', label: 'Comment', icon: MessageCircle, color: 'text-cyan-400 border-cyan-500' },
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
                 selectedType === 'relationship' ? 'Link Type' :
                 selectedType === 'comment' ? 'Comment Type' :
                 'Pair Type'}
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

          {/* Similar Tags Recommendations */}
          {similarTags.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Similar tags found</span>
              </div>
              <div className="space-y-1">
                {similarTags.map(({ tag, similarity, matchReasons }) => (
                  <button
                    key={tag.id}
                    onClick={() => handleSelectExistingTag(tag)}
                    className="w-full flex items-center justify-between text-xs p-2 rounded hover:bg-amber-800/20 transition-colors border border-transparent hover:border-amber-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs px-1 py-0 border-amber-500/50 text-amber-300"
                      >
                        {tag.type}
                      </Badge>
                      <span className="text-slate-300">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-xs">{similarity}% match</span>
                      <span className="text-xs text-slate-400">Click to use</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-xs text-amber-400/80 mt-2">
                Click on a similar tag to use it instead of creating a duplicate
              </div>
            </div>
          )}

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
