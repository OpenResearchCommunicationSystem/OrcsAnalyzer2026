import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database } from "lucide-react";
import { TextSelection, InsertTag, CanonDataType } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useQuery } from "@tanstack/react-query";
import type { Tag } from "@shared/schema";
import { SearchableSelect } from "@/components/SearchableSelect";

interface DataCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: TextSelection | null;
  onTagCreated: () => void;
}

const CANON_DATA_TYPES: CanonDataType[] = ['Generic', 'Geotemporal', 'Identifier', 'Quantity', 'Quality', 'Metadata'];

export function DataCreationModal({ 
  isOpen, 
  onClose, 
  selectedText, 
  onTagCreated
}: DataCreationModalProps) {
  const [dataType, setDataType] = useState<CanonDataType | ''>('');
  const [dataKey, setDataKey] = useState('');
  const [dataValue, setDataValue] = useState('');
  const [normalization, setNormalization] = useState('');
  const [comment, setComment] = useState('');

  const { createTag, isCreating } = useTagOperations();

  const { data: allTags = [] } = useQuery<Tag[]>({
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
      setDataValue(selectedText.text);
    } else if (!isOpen) {
      setDataType('');
      setDataKey('');
      setDataValue('');
      setNormalization('');
      setComment('');
    }
  }, [isOpen, selectedText?.text]);

  const handleCreateData = async () => {
    if (!selectedText || !dataValue.trim()) {
      return;
    }

    const reference = selectedText.filename;
    const effectiveType = dataType || 'Generic';
    const effectiveKey = dataKey.trim() || 'Tag';
    
    const tagData: InsertTag = {
      type: 'data',
      name: dataValue.trim(),
      references: [reference],
      aliases: [],
      keyValuePairs: {},
      dataType: effectiveType as CanonDataType,
      dataKey: effectiveKey,
      dataValue: dataValue.trim(),
      normalization: normalization.trim() || undefined,
      comment: comment.trim() || undefined,
    };

    try {
      await createTag(tagData);
      onTagCreated();
      onClose();
      setDataType('');
      setDataKey('');
      setDataValue('');
      setNormalization('');
      setComment('');
    } catch (error) {
      console.error('Failed to create data tag:', error);
    }
  };

  const handleLabelSelectForType = (labelName: string) => {
    setDataType(labelName as CanonDataType);
  };

  const handleLabelSelectForKey = (labelName: string) => {
    setDataKey(labelName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span>Create Data Tag</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3 text-sm">
            <p className="text-purple-300">
              Data tags capture structured values with type/key/value. Blank type = "Generic", blank key = "Tag".
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Selected Text (Value)</Label>
            <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm font-mono text-purple-300">
              {selectedText?.text || 'No text selected'}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">
              Type <span className="text-slate-500">(blank = Generic)</span>
            </Label>
            <div className="space-y-2">
              <Select value={dataType} onValueChange={(v) => setDataType(v as CanonDataType)}>
                <SelectTrigger className="w-full bg-gray-900 border-gray-600 text-slate-200" data-testid="select-data-type">
                  <SelectValue placeholder="Select canon type (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {CANON_DATA_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {cardLabels.length > 0 && (
                <div className="text-xs text-slate-400">
                  <span className="block mb-1">Or use a label from this card:</span>
                  {cardLabels.length <= 10 ? (
                    <div className="flex flex-wrap gap-1">
                      {cardLabels.map(label => (
                        <button
                          key={label.id}
                          onClick={() => handleLabelSelectForType(label.name)}
                          className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-xs hover:bg-cyan-500/30"
                          data-testid={`label-type-${label.id}`}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <SearchableSelect
                      options={cardLabels.map(l => ({ value: l.name, label: l.name }))}
                      value={dataType}
                      onValueChange={handleLabelSelectForType}
                      placeholder="Search labels..."
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">
              Key <span className="text-slate-500">(blank = Tag)</span>
            </Label>
            <Input
              value={dataKey}
              onChange={(e) => setDataKey(e.target.value)}
              placeholder="Enter key (optional)"
              className="bg-gray-900 border-gray-600 focus:border-purple-500"
              data-testid="input-data-key"
            />
            
            {cardLabels.length > 0 && (
              <div className="text-xs text-slate-400 mt-2">
                <span className="block mb-1">Or use a label:</span>
                {cardLabels.length <= 10 ? (
                  <div className="flex flex-wrap gap-1">
                    {cardLabels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => handleLabelSelectForKey(label.name)}
                        className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-xs hover:bg-cyan-500/30"
                        data-testid={`label-key-${label.id}`}
                      >
                        {label.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <SearchableSelect
                    options={cardLabels.map(l => ({ value: l.name, label: l.name }))}
                    value={dataKey}
                    onValueChange={handleLabelSelectForKey}
                    placeholder="Search labels..."
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Value</Label>
            <Input
              value={dataValue}
              onChange={(e) => setDataValue(e.target.value)}
              placeholder="Enter value"
              className="bg-gray-900 border-gray-600 focus:border-purple-500"
              data-testid="input-data-value"
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
              className="bg-gray-900 border-gray-600 focus:border-purple-500"
              data-testid="input-data-normalization"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">
              Comment <span className="text-slate-500">(optional)</span>
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Analyst notes"
              className="bg-gray-900 border-gray-600 focus:border-purple-500 resize-none"
              rows={2}
              data-testid="input-data-comment"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleCreateData}
              disabled={isCreating || !dataValue.trim() || !selectedText}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              data-testid="button-create-data"
            >
              {isCreating ? 'Creating...' : 'Create Data Tag'}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-gray-600 text-slate-400 hover:bg-gray-700"
              data-testid="button-cancel-data"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
