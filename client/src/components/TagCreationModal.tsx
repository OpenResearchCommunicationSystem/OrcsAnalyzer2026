import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Link, MessageCircle, AlertTriangle } from "lucide-react";
import { TextSelection, InsertTag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useQuery } from "@tanstack/react-query";
import type { Tag as TagType } from "@shared/schema";
import { SearchableSelect } from "@/components/SearchableSelect";

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
  const [entityType, setEntityType] = useState('');
  const [selectedType, setSelectedType] = useState(tagType);

  const { createTag, updateTag, isCreating } = useTagOperations();

  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
  });

  const cardLabels = allTags.filter(tag => {
    if (tag.type !== 'label') return false;
    if (!selectedText?.filename) return false;
    const currentFilename = selectedText.filename;
    return tag.references.some(ref => {
      const refName = ref.split('/').pop() || ref;
      const currentName = currentFilename.split('/').pop() || currentFilename;
      const refBase = refName.replace('.card.txt', '').replace('.txt', '').split('_')[0];
      const currentBase = currentName.replace('.card.txt', '').replace('.txt', '').split('_')[0];
      return refBase === currentBase || ref.includes(currentFilename) || currentFilename.includes(refName);
    });
  });

  useEffect(() => {
    if (isOpen && selectedText?.text) {
      setIdentifier(selectedText.text);
      setSelectedType(tagType);
    } else if (!isOpen) {
      setIdentifier('');
      setDescription('');
      setEntityType('');
    }
  }, [isOpen, selectedText?.text, tagType]);

  const findSimilarTags = () => {
    if (!identifier.trim() || !allTags.length) return [];
    
    const inputName = identifier.toLowerCase().trim();
    
    return allTags
      .map(tag => {
        const tagName = tag.name.toLowerCase();
        const tagAliases = tag.aliases?.map(a => a.toLowerCase()) || [];
        let similarity = 0;
        const matchReasons: string[] = [];
        
        if (tagName === inputName) {
          similarity += 100;
          matchReasons.push("Exact match");
        } else if (tagName.includes(inputName) || inputName.includes(tagName)) {
          similarity += 75;
          matchReasons.push("Partial match");
        }
        
        const aliasMatches = tagAliases.filter(alias => 
          alias === inputName || alias.includes(inputName) || inputName.includes(alias)
        );
        if (aliasMatches.length > 0) {
          similarity += 50;
          matchReasons.push("Alias match");
        }
        
        if (tag.type === selectedType) {
          similarity += 25;
          matchReasons.push("Same type");
        }
        
        return { tag, similarity, matchReasons };
      })
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  };

  const similarTags = findSimilarTags();

  const handleCreateTag = async () => {
    if (!selectedText || !identifier.trim()) {
      return;
    }

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
      onClose();
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

    const reference = selectedText.filename;
    const updatedReferences = existingTag.references.includes(reference) 
      ? existingTag.references 
      : [...existingTag.references, reference];

    try {
      await updateTag(existingTag.id, { references: updatedReferences });
      onTagCreated();
      onClose();
      setIdentifier('');
      setDescription('');
    } catch (error) {
      console.error('Failed to update existing tag:', error);
    }
  };

  const tagTypes = [
    { value: 'entity', label: 'Entity', icon: User, color: 'text-green-400 border-green-500' },
    { value: 'relationship', label: 'Link', icon: Link, color: 'text-orange-400 border-orange-500' },
    { value: 'comment', label: 'Comment', icon: MessageCircle, color: 'text-blue-400 border-blue-500' },
  ];

  const entityTypeOptions = [
    { value: 'person', label: 'Person' },
    { value: 'organization', label: 'Organization' },
    { value: 'location', label: 'Location' },
    { value: 'event', label: 'Event' },
    { value: 'product', label: 'Product' },
    { value: 'concept', label: 'Concept' },
    { value: 'document', label: 'Document' },
  ];

  const relationshipTypeOptions = [
    { value: 'ownership', label: 'Ownership' },
    { value: 'employment', label: 'Employment' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'acquisition', label: 'Acquisition' },
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'competition', label: 'Competition' },
    { value: 'family', label: 'Family' },
    { value: 'location', label: 'Location' },
  ];

  const commentTypeOptions = [
    { value: 'analysis', label: 'Analysis' },
    { value: 'hypothesis', label: 'Hypothesis' },
    { value: 'question', label: 'Question' },
    { value: 'note', label: 'Note' },
    { value: 'warning', label: 'Warning' },
    { value: 'summary', label: 'Summary' },
  ];

  const getTypeOptions = () => {
    if (selectedType === 'entity') return entityTypeOptions;
    if (selectedType === 'relationship') return relationshipTypeOptions;
    if (selectedType === 'comment') return commentTypeOptions;
    return [];
  };

  const typeOptions = getTypeOptions();

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
            <div className="grid grid-cols-3 gap-2">
              {tagTypes.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  className={`flex items-center justify-center space-x-2 p-3 rounded border-2 transition-all ${
                    selectedType === value
                      ? `${color} bg-opacity-10`
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedType(value)}
                  data-testid={`button-type-${value}`}
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
                 'Comment Type'} <span className="text-slate-500">(blank = Generic)</span>
              </Label>
              
              <div className="space-y-2">
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-slate-200" data-testid="select-type">
                    <SelectValue placeholder={`Select ${selectedType} type (optional)`} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {typeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {cardLabels.length > 0 && (selectedType === 'entity' || selectedType === 'relationship') && (
                  <div className="text-xs text-slate-400">
                    <span className="block mb-1">Or use a label from this card:</span>
                    {cardLabels.length <= 10 ? (
                      <div className="flex flex-wrap gap-1">
                        {cardLabels.map(label => (
                          <button
                            key={label.id}
                            onClick={() => setEntityType(label.name)}
                            className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-xs hover:bg-cyan-500/30"
                            data-testid={`label-option-${label.id}`}
                          >
                            {label.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <SearchableSelect
                        options={cardLabels.map(l => ({ value: l.name, label: l.name }))}
                        value={entityType}
                        onValueChange={setEntityType}
                        placeholder="Search labels..."
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium text-slate-300">Identifier</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter unique identifier"
              className="bg-gray-900 border-gray-600 focus:border-blue-500"
              data-testid="input-identifier"
            />
          </div>

          {similarTags.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Similar tags found</span>
              </div>
              <div className="space-y-1">
                {similarTags.map(({ tag, similarity }) => (
                  <button
                    key={tag.id}
                    onClick={() => handleSelectExistingTag(tag)}
                    className="w-full flex items-center justify-between text-xs p-2 rounded hover:bg-amber-800/20 transition-colors border border-transparent hover:border-amber-500/30"
                    data-testid={`similar-tag-${tag.id}`}
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
              data-testid="input-description"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleCreateTag}
              disabled={isCreating || !identifier.trim() || !selectedText}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-tag"
            >
              {isCreating ? 'Creating...' : 'Create Tag'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-slate-400 hover:bg-gray-700"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
