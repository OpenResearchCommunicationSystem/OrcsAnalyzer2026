import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Save, Trash2, Plus, Link, Search, ChevronDown, ChevronRight, FileText, Users } from "lucide-react";
import { Tag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { TagConnectionModal } from "./TagConnectionModal";
import { TagMergeModal } from "./TagMergeModal";
import { useQuery } from "@tanstack/react-query";

interface TagEditorProps {
  selectedTag: Tag | null;
  onTagUpdate: (tag: Tag) => void;
  onClose: () => void;
  onReferenceClick?: (filename: string) => void;
}

export function TagEditor({ selectedTag, onTagUpdate, onClose, onReferenceClick }: TagEditorProps) {
  const [formData, setFormData] = useState<Partial<Tag>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [showSimilarTags, setShowSimilarTags] = useState(false);
  
  const { updateTag, deleteTag, isUpdating, isDeleting } = useTagOperations();

  // Fetch all tags for similarity detection
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  useEffect(() => {
    if (selectedTag) {
      setFormData(selectedTag);
    }
  }, [selectedTag]);

  // Find similar tags based on name, aliases, and entity type
  const findSimilarTags = () => {
    if (!selectedTag) return [];
    
    return allTags.filter(tag => {
      if (tag.id === selectedTag.id) return false; // Don't include self
      
      const tagName = tag.name.toLowerCase();
      const selectedName = selectedTag.name.toLowerCase();
      const tagAliases = tag.aliases?.map(a => a.toLowerCase()) || [];
      const selectedAliases = selectedTag.aliases?.map(a => a.toLowerCase()) || [];
      
      // Check for exact matches or partial matches
      const nameMatch = tagName === selectedName || 
                       tagName.includes(selectedName) || 
                       selectedName.includes(tagName);
      
      // Check if any aliases match
      const aliasMatch = tagAliases.some(alias => 
        selectedAliases.includes(alias) || 
        alias.includes(selectedName) ||
        selectedName.includes(alias)
      );
      
      // Check if selected name matches any alias
      const nameAliasMatch = tagAliases.includes(selectedName) || 
                            selectedAliases.includes(tagName);
      
      // Same entity type is a strong indicator
      const sameType = tag.type === selectedTag.type && 
                      tag.entityType === selectedTag.entityType;
      
      return (nameMatch || aliasMatch || nameAliasMatch) && sameType;
    });
  };

  const similarTags = findSimilarTags();

  // Parse references to show file locations
  const parseReferences = (tag: Tag) => {
    if (!tag.references || tag.references.length === 0) return [];
    
    return tag.references.map((ref: string) => {
      // Parse filename@start-end or filename[row,col] format
      const atMatch = ref.match(/^(.+?)@(\d+)-(\d+)$/);
      const csvMatch = ref.match(/^(.+?)\[(\d+),(\d+)\]$/);
      
      if (atMatch) {
        return {
          filename: atMatch[1],
          location: `Characters ${atMatch[2]}-${atMatch[3]}`,
          type: 'text'
        };
      } else if (csvMatch) {
        return {
          filename: csvMatch[1],
          location: `Row ${csvMatch[2]}, Column ${csvMatch[3]}`,
          type: 'csv'
        };
      } else {
        return {
          filename: ref,
          location: 'Unknown location',
          type: 'unknown'
        };
      }
    });
  };

  const handleSave = () => {
    if (selectedTag && formData.name && formData.type) {
      updateTag(selectedTag.id, formData);
      // Create updated tag object for callback
      const updatedTag: Tag = {
        ...selectedTag,
        ...formData,
        modified: new Date().toISOString()
      } as Tag;
      onTagUpdate(updatedTag);
    }
  };

  const handleDelete = async () => {
    if (selectedTag && confirm('Are you sure you want to delete this tag?')) {
      try {
        await deleteTag(selectedTag.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete tag:', error);
      }
    }
  };

  const handleAddKeyValue = () => {
    if (newKey.trim() && newValue.trim()) {
      setFormData(prev => ({
        ...prev,
        keyValuePairs: {
          ...prev.keyValuePairs,
          [newKey.trim()]: newValue.trim()
        }
      }));
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemoveKeyValue = (key: string) => {
    setFormData(prev => {
      const newKvp = { ...prev.keyValuePairs };
      delete newKvp[key];
      return { ...prev, keyValuePairs: newKvp };
    });
  };

  if (!selectedTag) {
    return (
      <div className="flex-1 p-4">
        <div className="text-center text-slate-400">
          <h3 className="font-medium mb-2">No Tag Selected</h3>
          <p className="text-sm">Click on a tag in the graph or document to edit it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-200">Edit Tag</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tag Details Form */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-300 mb-2 block">Tag Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}
            >
              <SelectTrigger className="w-full bg-gray-800 border-gray-600 text-slate-200">
                <SelectValue placeholder="Select tag type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="entity">Entity</SelectItem>
                <SelectItem value="relationship">Relationship</SelectItem>
                <SelectItem value="attribute">Attribute</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
                <SelectItem value="kv_pair">Key:Value Pair</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">
                {formData.type === 'entity' ? 'Entity Type' : 
                 formData.type === 'relationship' ? 'Relationship Type' :
                 formData.type === 'attribute' ? 'Attribute Type' :
                 formData.type === 'comment' ? 'Comment Type' :
                 'Key-Value Type'}
              </Label>
              <Select
                value={formData.entityType || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, entityType: value }))}
              >
                <SelectTrigger className="w-full bg-gray-800 border-gray-600 text-slate-200">
                  <SelectValue placeholder={`Select ${formData.type} type`} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {formData.type === 'entity' && (
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
                  {formData.type === 'relationship' && (
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
                  {formData.type === 'attribute' && (
                    <>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="temporal">Temporal</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="descriptive">Descriptive</SelectItem>
                      <SelectItem value="quantitative">Quantitative</SelectItem>
                      <SelectItem value="qualitative">Qualitative</SelectItem>
                    </>
                  )}
                  {formData.type === 'comment' && (
                    <>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="hypothesis">Hypothesis</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="summary">Summary</SelectItem>
                    </>
                  )}
                  {formData.type === 'kv_pair' && (
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
            <Label className="text-sm font-medium text-slate-300">UUID</Label>
            <Input
              value={formData.id || ''}
              className="bg-gray-800 border-gray-600 font-mono text-slate-400"
              readOnly
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Name/Identifier</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="bg-gray-800 border-gray-600 focus:border-blue-500"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">References</Label>
            <Input
              value={formData.references?.join(', ') || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                references: e.target.value.split(',').map(ref => ref.trim()).filter(ref => ref.length > 0)
              }))}
              className="bg-gray-800 border-gray-600 font-mono focus:border-blue-500"
              placeholder="filename@start-end, filename[row,col]"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Aliases</Label>
            <Input
              value={formData.aliases?.join(', ') || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              className="bg-gray-800 border-gray-600 focus:border-blue-500"
              placeholder="Comma-separated list"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-gray-800 border-gray-600 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-300">Key-Value Pairs</Label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Input
                  placeholder="Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-600 focus:border-blue-500"
                />
                <Input
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-600 focus:border-blue-500"
                />
                <Button
                  onClick={handleAddKeyValue}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.keyValuePairs && Object.entries(formData.keyValuePairs).length > 0 && (
                <div className="space-y-1">
                  {Object.entries(formData.keyValuePairs).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-800 p-2 rounded text-xs">
                      <span><strong>{key}:</strong> {value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveKeyValue(key)}
                        className="text-red-400 hover:text-red-300 p-1 h-auto"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* References Section */}
          {selectedTag && (
            <Collapsible open={showReferences} onOpenChange={setShowReferences}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-slate-300 hover:text-white">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    References ({parseReferences(selectedTag).length})
                  </div>
                  {showReferences ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {parseReferences(selectedTag).map((ref, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-800 p-3 rounded border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                    onClick={() => onReferenceClick?.(ref.filename)}
                    title={`Click to open ${ref.filename}`}
                  >
                    <div className="font-medium text-slate-200 hover:text-blue-300">{ref.filename}</div>
                    <div className="text-sm text-slate-400">{ref.location}</div>
                    <div className="text-xs text-slate-500 capitalize">{ref.type} file</div>
                  </div>
                ))}
                {parseReferences(selectedTag).length === 0 && (
                  <div className="text-slate-400 text-sm italic">No references found</div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Similar Tags Section */}
          {selectedTag && similarTags.length > 0 && (
            <Collapsible open={showSimilarTags} onOpenChange={setShowSimilarTags}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-amber-300 hover:text-amber-200">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Similar Tags ({similarTags.length})
                  </div>
                  {showSimilarTags ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                <div className="text-sm text-amber-200 mb-2">
                  These tags might be duplicates that could be merged:
                </div>
                {similarTags.map((tag) => (
                  <div key={tag.id} className="bg-amber-900/20 border border-amber-600/30 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-amber-200">{tag.name}</div>
                        <div className="text-sm text-amber-300">
                          {tag.entityType} • {parseReferences(tag).length} reference(s)
                        </div>
                        {tag.aliases && tag.aliases.length > 0 && (
                          <div className="text-xs text-amber-400 mt-1">
                            Aliases: {tag.aliases.join(', ')}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-white"
                        onClick={() => setShowMergeModal(true)}
                      >
                        Merge
                      </Button>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Find Similar Button */}
          {selectedTag && (
            <Button
              variant="outline"
              className="w-full border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-white mt-4"
              onClick={() => setShowMergeModal(true)}
            >
              <Search className="w-4 h-4 mr-2" />
              Find & Merge Similar Tags
            </Button>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={isUpdating || !formData.name}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => setShowConnectionModal(true)}
              disabled={!selectedTag}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
            >
              <Link className="w-4 h-4 mr-2" />
              Connect
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Tag Connection Modal */}
      <TagConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        sourceTag={selectedTag || undefined}
        onConnectionCreated={() => {
          // Refresh graph and connections data
          console.log('Connection created successfully');
        }}
      />
      
      {/* Tag Merge Modal */}
      <TagMergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        masterTag={selectedTag}
        onMergeComplete={() => {
          // Refresh tag data after merge
          window.location.reload(); // Temporary - will improve this
        }}
      />
    </div>
  );
}
