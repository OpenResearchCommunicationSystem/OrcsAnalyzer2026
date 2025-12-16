import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Link, Tag, MessageCircle, Key, X, AlertTriangle, KeyRound, Type, Equal } from "lucide-react";
import { TextSelection, InsertTag, PairSubtype } from "@shared/schema";
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
  const [entityType, setEntityType] = useState('');
  const [pairDelimiter, setPairDelimiter] = useState(':');

  // Normalize tagType: kv_pair_key/kv_pair_value -> kv_pair with preset subtype
  const normalizedType = tagType === 'kv_pair_key' || tagType === 'kv_pair_value' ? 'kv_pair' : tagType;
  const presetPairSubtype: PairSubtype | null = 
    tagType === 'kv_pair_key' ? 'key' : 
    tagType === 'kv_pair_value' ? 'value' : null;
  
  const [selectedType, setSelectedType] = useState(normalizedType);
  const [pairSubtype, setPairSubtype] = useState<PairSubtype>(presetPairSubtype || 'key_value');
  
  // Track if subtype was preset (to hide selection UI)
  const isPairSubtypePreset = presetPairSubtype !== null;

  const { createTag, updateTag, isCreating } = useTagOperations();

  // Fetch all tags for similarity detection
  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
  });

  // Auto-populate identifier with selected text when modal opens
  useEffect(() => {
    if (isOpen && selectedText?.text) {
      setIdentifier(selectedText.text);
      // Set normalized type and preset subtype when opening
      setSelectedType(normalizedType);
      setPairSubtype(presetPairSubtype || 'key_value');
    } else if (!isOpen) {
      // Reset form when modal closes
      setIdentifier('');
      setDescription('');
      setEntityType('');
      setPairSubtype('key_value');
      setPairDelimiter(':');
    }
  }, [isOpen, selectedText?.text, normalizedType, presetPairSubtype]);

  // Parse key and value from identifier when pair subtype is key_value
  const parsedKeyValue = () => {
    if (pairSubtype !== 'key_value' || !pairDelimiter) return { key: '', value: '' };
    const parts = identifier.split(pairDelimiter);
    if (parts.length >= 2) {
      return { key: parts[0].trim(), value: parts.slice(1).join(pairDelimiter).trim() };
    }
    return { key: identifier, value: '' };
  };

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
    
    // Build tag data with pair-specific fields if applicable
    const tagData: InsertTag = {
      type: selectedType as any,
      entityType: entityType || undefined,
      name: identifier.trim(),
      references: [reference],
      aliases: [],
      keyValuePairs: {},
      description: description.trim() || undefined,
    };

    // Add pair-specific fields for kv_pair type
    if (selectedType === 'kv_pair') {
      tagData.pairSubtype = pairSubtype;
      const { key, value } = parsedKeyValue();
      
      if (pairSubtype === 'key') {
        tagData.pairKey = identifier.trim();
      } else if (pairSubtype === 'value') {
        tagData.pairValue = identifier.trim();
      } else if (pairSubtype === 'key_value') {
        tagData.pairKey = key;
        tagData.pairValue = value;
      }
    }

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
          <DialogTitle>
            {isPairSubtypePreset 
              ? `Create Pair ${pairSubtype === 'key' ? 'Key' : 'Value'}` 
              : 'Create New Tag'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-300">Selected Text</Label>
            <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono">
              {selectedText?.text || 'No text selected'}
            </div>
          </div>

          {/* Hide tag type selection when pair subtype is preset from button */}
          {!isPairSubtypePreset && (
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
          )}

          {/* Hide entity type selection when pair subtype is preset - keep it simple */}
          {selectedType && !isPairSubtypePreset && (
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

          {/* Pair Subtype Selection - Only for kv_pair type when NOT preset */}
          {selectedType === 'kv_pair' && !isPairSubtypePreset && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">What are you marking?</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-all ${
                    pairSubtype === 'key'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setPairSubtype('key')}
                  data-testid="pair-subtype-key"
                >
                  <KeyRound className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">Key Only</span>
                  <span className="text-[10px] text-slate-500 mt-1">Needs a value</span>
                </button>
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-all ${
                    pairSubtype === 'value'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setPairSubtype('value')}
                  data-testid="pair-subtype-value"
                >
                  <Type className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">Value Only</span>
                  <span className="text-[10px] text-slate-500 mt-1">Needs a key</span>
                </button>
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-all ${
                    pairSubtype === 'key_value'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-gray-600 text-slate-400 hover:bg-gray-700'
                  }`}
                  onClick={() => setPairSubtype('key_value')}
                  data-testid="pair-subtype-key-value"
                >
                  <Equal className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">Key:Value</span>
                  <span className="text-[10px] text-slate-500 mt-1">Both in text</span>
                </button>
              </div>

              {/* Delimiter input for key_value subtype */}
              {pairSubtype === 'key_value' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-400">Delimiter:</Label>
                    <Input
                      value={pairDelimiter}
                      onChange={(e) => setPairDelimiter(e.target.value)}
                      placeholder=":"
                      className="w-16 h-7 text-center bg-gray-900 border-gray-600"
                      data-testid="pair-delimiter-input"
                    />
                  </div>
                  {/* Preview of parsed key:value */}
                  {identifier && (
                    <div className="bg-gray-900/50 border border-gray-700 rounded p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">Key:</span>
                        <span className="text-slate-300">{parsedKeyValue().key || '(empty)'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-amber-400">Value:</span>
                        <span className="text-slate-300">{parsedKeyValue().value || '(empty)'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Orphan indicator for pair keys/values (both preset and selected) */}
          {selectedType === 'kv_pair' && (pairSubtype === 'key' || pairSubtype === 'value') && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded p-3 text-sm text-amber-300">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">
                  Creating orphan {pairSubtype}
                </span>
              </div>
              <p className="text-xs text-amber-400/70">
                This {pairSubtype} will need to be linked with a {pairSubtype === 'key' ? 'value' : 'key'}.
                After creation, drag it onto another pair tag to connect them.
              </p>
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
