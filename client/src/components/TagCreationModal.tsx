import { useState, useEffect, useRef, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Link, Tag, Database, AlertTriangle, GripVertical } from "lucide-react";
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
  const [dataCanonType, setDataCanonType] = useState('');
  const [selectedType, setSelectedType] = useState(tagType);

  const handleTagTypeChange = (newType: string) => {
    setSelectedType(newType);
    setEntityType('');
    setDataCanonType('');
  };

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
      setEntityType('');
      setDataCanonType('');
    } else if (!isOpen) {
      setIdentifier('');
      setDescription('');
      setEntityType('');
      setDataCanonType('');
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
    { value: 'label', label: 'Label', icon: Tag, color: 'text-cyan-400 border-cyan-500' },
    { value: 'data', label: 'Data', icon: Database, color: 'text-purple-400 border-purple-500' },
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

  const dataCanonTypes = [
    { value: 'generic', label: 'Generic' },
    { value: 'geotemporal', label: 'Geotemporal' },
    { value: 'identifier', label: 'Identifier' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'quality', label: 'Quality' },
    { value: 'metadata', label: 'Metadata' },
  ];

  const getTypeOptions = () => {
    if (selectedType === 'entity') return entityTypeOptions;
    if (selectedType === 'relationship') return relationshipTypeOptions;
    if (selectedType === 'data') return dataCanonTypes;
    return [];
  };

  const typeOptions = getTypeOptions();

  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, labelName: string) => {
    e.dataTransfer.setData('text/plain', labelName);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedLabel(labelName);
  };

  const handleDragEnd = () => {
    setDraggedLabel(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: DragEvent<HTMLInputElement | HTMLTextAreaElement>, fieldName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget(fieldName);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: DragEvent<HTMLInputElement | HTMLTextAreaElement>, fieldName: string, setter: (val: string) => void, currentValue?: string) => {
    e.preventDefault();
    const labelName = e.dataTransfer.getData('text/plain');
    if (labelName) {
      if (fieldName === 'description' && currentValue) {
        setter(currentValue + (currentValue ? ' ' : '') + labelName);
      } else {
        setter(labelName);
      }
    }
    setDropTarget(null);
    setDraggedLabel(null);
  };

  const [dataKey, setDataKey] = useState('');
  const [dataValue, setDataValue] = useState('');
  const [dataNormalized, setDataNormalized] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDataKey('');
      setDataValue('');
      setDataNormalized('');
    }
  }, [isOpen]);

  const handleCreateTagWithData = async () => {
    if (!selectedText || !identifier.trim()) {
      return;
    }

    const reference = selectedText.filename;
    
    const keyValuePairs: Record<string, string> = {};
    if (selectedType === 'data' && dataKey.trim()) {
      keyValuePairs[dataKey.trim()] = dataValue.trim();
      if (dataNormalized.trim()) {
        keyValuePairs['_normalized'] = dataNormalized.trim();
      }
    }
    
    const getEntityTypeForSubmit = () => {
      if (selectedType === 'label') return undefined;
      if (selectedType === 'data') return dataCanonType || undefined;
      return entityType || undefined;
    };

    const tagData: InsertTag = {
      type: selectedType as any,
      entityType: getEntityTypeForSubmit(),
      name: identifier.trim(),
      references: [reference],
      aliases: [],
      keyValuePairs,
      description: description.trim() || undefined,
    };

    try {
      await createTag(tagData);
      onTagCreated();
      onClose();
      setIdentifier('');
      setDescription('');
      setDataKey('');
      setDataValue('');
      setDataNormalized('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const getDropClass = (fieldName: string) => {
    if (dropTarget === fieldName) {
      return 'ring-2 ring-cyan-400 bg-cyan-900/20';
    }
    return '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-slate-200 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Selected Text */}
          <div>
            <Label className="text-sm font-medium text-slate-300">Selected Text</Label>
            <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono">
              {selectedText?.text || 'No text selected'}
            </div>
          </div>

          {/* 2. Tag Type - 4 buttons in 2x2 grid */}
          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2">Tag Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {tagTypes.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  className={`flex items-center justify-center space-x-1 p-2 rounded border-2 transition-all ${
                    selectedType === value
                      ? `${color} bg-opacity-10`
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => handleTagTypeChange(value)}
                  data-testid={`button-type-${value}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Card Labels - Draggable buttons (except when creating labels) */}
          {cardLabels.length > 0 && selectedType !== 'label' && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
              <Label className="text-xs font-medium text-slate-400 mb-2 block">
                <GripVertical className="w-3 h-3 inline mr-1" />
                Drag labels to fields below:
              </Label>
              <div className="flex flex-wrap gap-1">
                {cardLabels.map(label => (
                  <button
                    key={label.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, label.name)}
                    onDragEnd={handleDragEnd}
                    className={`px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-xs cursor-grab active:cursor-grabbing hover:bg-cyan-500/30 transition-all ${
                      draggedLabel === label.name ? 'opacity-50 scale-95' : ''
                    }`}
                    data-testid={`draggable-label-${label.id}`}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Tag-Specific Fields - Entity/Link type selector */}
          {selectedType && (selectedType === 'entity' || selectedType === 'relationship') && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">
                {selectedType === 'entity' ? 'Entity Type' : 'Link Type'} 
                <span className="text-slate-500"> (blank = Generic)</span>
              </Label>
              
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
            </div>
          )}

          {/* Data canon type selector */}
          {selectedType === 'data' && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">
                Data Type <span className="text-slate-500">(blank = Generic)</span>
              </Label>
              
              <Select value={dataCanonType} onValueChange={setDataCanonType}>
                <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-slate-200" data-testid="select-data-type">
                  <SelectValue placeholder="Select data type (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {dataCanonTypes.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Identifier field */}
          <div>
            <Label className="text-sm font-medium text-slate-300">
              {selectedType === 'label' ? 'Label Name' : 'Identifier'}
            </Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onDragOver={(e) => handleDragOver(e, 'identifier')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'identifier', setIdentifier)}
              placeholder={selectedType === 'label' ? 'Enter label name' : 'Enter unique identifier'}
              className={`bg-gray-900 border-gray-600 focus:border-blue-500 transition-all ${getDropClass('identifier')}`}
              data-testid="input-identifier"
            />
          </div>

          {/* Data-specific fields */}
          {selectedType === 'data' && (
            <>
              <div>
                <Label className="text-sm font-medium text-slate-300">Key</Label>
                <Input
                  value={dataKey}
                  onChange={(e) => setDataKey(e.target.value)}
                  onDragOver={(e) => handleDragOver(e, 'dataKey')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'dataKey', setDataKey)}
                  placeholder="Enter data key (e.g., 'latitude', 'amount')"
                  className={`bg-gray-900 border-gray-600 focus:border-blue-500 transition-all ${getDropClass('dataKey')}`}
                  data-testid="input-data-key"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-300">Value</Label>
                <Input
                  value={dataValue}
                  onChange={(e) => setDataValue(e.target.value)}
                  onDragOver={(e) => handleDragOver(e, 'dataValue')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'dataValue', setDataValue)}
                  placeholder="Enter data value"
                  className={`bg-gray-900 border-gray-600 focus:border-blue-500 transition-all ${getDropClass('dataValue')}`}
                  data-testid="input-data-value"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-300">
                  Normalized Value <span className="text-slate-500">(optional)</span>
                </Label>
                <Input
                  value={dataNormalized}
                  onChange={(e) => setDataNormalized(e.target.value)}
                  onDragOver={(e) => handleDragOver(e, 'dataNormalized')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'dataNormalized', setDataNormalized)}
                  placeholder="Standardized/normalized form"
                  className={`bg-gray-900 border-gray-600 focus:border-blue-500 transition-all ${getDropClass('dataNormalized')}`}
                  data-testid="input-data-normalized"
                />
              </div>
            </>
          )}

          {/* Similar tags warning */}
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

          {/* Description field (optional for all types) */}
          <div>
            <Label className="text-sm font-medium text-slate-300">Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onDragOver={(e) => handleDragOver(e, 'description')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'description', setDescription, description)}
              placeholder="Additional notes or description"
              className={`bg-gray-900 border-gray-600 focus:border-blue-500 resize-none transition-all ${getDropClass('description')}`}
              rows={2}
              data-testid="input-description"
            />
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleCreateTagWithData}
              disabled={isCreating || !identifier.trim() || !selectedText}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-tag"
            >
              {isCreating ? 'Creating...' : `Create ${selectedType === 'label' ? 'Label' : 'Tag'}`}
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
