import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X, Save, Trash2, Plus, Link, Search, ChevronDown, ChevronRight, FileText, Users, Edit2, Copy, RotateCcw } from "lucide-react";
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
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  
  const { updateTag, deleteTagAsync, isUpdating, isDeleting } = useTagOperations();

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

  const copyUUID = async () => {
    if (selectedTag?.id) {
      await navigator.clipboard.writeText(selectedTag.id);
    }
  };

  const handleEditName = () => {
    setEditingName(formData.name || '');
    setShowEditNameModal(true);
  };

  const saveNameEdit = () => {
    if (editingName.trim()) {
      setFormData(prev => ({ ...prev, name: editingName.trim() }));
    }
    setShowEditNameModal(false);
  };

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

  // DEPRECATED: No longer needed with card-based system
  /* const handleFixReferences = async () => {
    if (!selectedTag) return;
    
    try {
      // Get all files to check reference alignment
      const filesResponse = await fetch('/api/files');
      const files = await filesResponse.json();
      
      const fixedReferences: string[] = [];
      
      for (const ref of selectedTag.references || []) {
        const atMatch = ref.match(/^(.+?)@(\d+)-(\d+)$/);
        if (atMatch) {
          const filename = atMatch[1];
          const originalStart = parseInt(atMatch[2]);
          const originalEnd = parseInt(atMatch[3]);
          const file = files.find((f: any) => f.name === filename);
          
          if (file) {
            // Get file content
            const contentResponse = await fetch(`/api/files/${file.id}/content`);
            const { content } = await contentResponse.json();
            
            // Get the text that was originally selected
            const originalText = content.substring(originalStart, originalEnd);
            
            // Check if the original position still contains valid text
            if (originalText.trim().length > 0 && !originalText.includes('<') && !originalText.includes('>')) {
              // Original position seems valid, keep it
              fixedReferences.push(ref);
            } else {
              // Try to find the tag name in the content for repositioning
              const searchText = selectedTag.name;
              const newIndex = content.indexOf(searchText);
              
              if (newIndex !== -1) {
                const newRef = `${filename}@${newIndex}-${newIndex + searchText.length}`;
                fixedReferences.push(newRef);
                console.log(`Fixed reference: ${ref} -> ${newRef}`);
              } else {
                // If we can't find it, try to find similar text (case insensitive)
                const lowerContent = content.toLowerCase();
                const lowerSearch = searchText.toLowerCase();
                const caseInsensitiveIndex = lowerContent.indexOf(lowerSearch);
                
                if (caseInsensitiveIndex !== -1) {
                  const actualText = content.substring(caseInsensitiveIndex, caseInsensitiveIndex + searchText.length);
                  const newRef = `${filename}@${caseInsensitiveIndex}-${caseInsensitiveIndex + actualText.length}`;
                  fixedReferences.push(newRef);
                  console.log(`Fixed reference (case insensitive): ${ref} -> ${newRef}`);
                } else {
                  // Keep original if we can't find any match
                  console.log(`Cannot fix reference: ${ref} - text not found`);
                  fixedReferences.push(ref);
                }
              }
            }
          } else {
            // Keep original reference if file not found
            fixedReferences.push(ref);
          }
        } else {
          // Keep non-text references as-is (CSV references, etc.)
          fixedReferences.push(ref);
        }
      }
      
      // Update the tag with fixed references
      const updates = { references: fixedReferences };
      updateTag(selectedTag.id, updates);
      
      // Update local form data
      setFormData(prev => ({ ...prev, references: fixedReferences }));
      
      console.log('References fix completed');
      
    } catch (error) {
      console.error('Failed to fix references:', error);
    }
  }; */

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
        await deleteTagAsync(selectedTag.id);
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
    <div className="flex-1 flex flex-col h-full">
      {/* Header with name and controls - fixed */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-200">
              {selectedTag?.name || 'No Tag Selected'}
            </h2>
            {selectedTag && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditName}
                className="text-slate-400 hover:text-slate-200 p-1 h-auto"
                title="Edit name"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        {selectedTag?.id && (
          <div className="py-1">
            <button
              onClick={copyUUID}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors font-mono"
              title="Click to copy UUID"
            >
              {selectedTag.id}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
        <div className="space-y-4">
          {/* Search Aliases Field - Always visible */}
          <div>
            <Label className="text-sm font-medium text-slate-300">Search Aliases</Label>
            <Input
              value={formData.aliases?.join(', ') || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                aliases: e.target.value.split(',').map(alias => alias.trim()).filter(alias => alias.length > 0)
              }))}
              className="bg-gray-800 border-gray-600 focus:border-blue-500"
              placeholder="Enter search terms for finding untagged content"
            />
          </div>

          {/* Action Buttons - Always Accessible */}
          <div className="flex space-x-2 pt-3">
            <Button
              onClick={handleSave}
              disabled={isUpdating || !formData.name}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 px-3"
            >
              <Save className="w-4 h-4 mr-1" />
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => setShowConnectionModal(true)}
              disabled={!selectedTag}
              variant="outline"
              className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white py-2 px-3"
            >
              <Link className="w-4 h-4 mr-1" />
              Connect
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              className="flex-1 py-2 px-3"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>

          {/* Find Similar Button */}
          {selectedTag && (
            <Button
              variant="outline"
              className="w-full border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-white mt-3 py-2 px-3"
              onClick={() => setShowMergeModal(true)}
            >
              <Search className="w-4 h-4 mr-1" />
              Find & Merge Similar Tags
            </Button>
          )}

          {/* Collapsible Middle Section - Tag Details */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 hover:bg-gray-800 rounded">
              <span className="text-sm font-medium text-slate-300">Tag Details</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Tag Details Form */}
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
                <SelectItem value="relationship">Link</SelectItem>
                <SelectItem value="label">Label</SelectItem>
                <SelectItem value="data">Data</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type && (
            <div>
              <Label className="text-sm font-medium text-slate-300 mb-2 block">
                {formData.type === 'entity' ? 'Entity Type' : 
                 formData.type === 'relationship' ? 'Link Type' :
                 formData.type === 'label' ? 'Label Type' :
                 formData.type === 'data' ? 'Data Type' :
                 'Type'}
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
                  {formData.type === 'label' && (
                    <>
                      <SelectItem value="vocabulary">Vocabulary</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="topic">Topic</SelectItem>
                    </>
                  )}
                  {formData.type === 'data' && (
                    <>
                      <SelectItem value="Generic">Generic</SelectItem>
                      <SelectItem value="Geotemporal">Geotemporal</SelectItem>
                      <SelectItem value="Identifier">Identifier</SelectItem>
                      <SelectItem value="Quantity">Quantity</SelectItem>
                      <SelectItem value="Quality">Quality</SelectItem>
                      <SelectItem value="Metadata">Metadata</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}





          <div>
            <Label className="text-sm font-medium text-slate-300">Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="bg-gray-800 border-gray-600 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>





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

            </CollapsibleContent>
          </Collapsible>
        
          {/* Bottom Section - Expandable KVP and References */}
          <div className="border-t border-gray-700 mt-4 pt-4 max-h-96 overflow-y-auto">
            {/* Key Value Pairs Section */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 hover:bg-gray-800 rounded">
                <span className="text-sm font-medium text-slate-300">Key Value Pairs</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-2">
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
              </CollapsibleContent>
            </Collapsible>

            {/* Similar Tags Section */}
            {selectedTag && similarTags.length > 0 && (
              <Collapsible open={showSimilarTags} onOpenChange={setShowSimilarTags}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 hover:bg-gray-800 rounded">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">Similar Tags ({similarTags.length})</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 p-2">
                  <div className="text-sm text-amber-200 mb-2">
                    These tags might be duplicates that could be merged:
                  </div>
                  {similarTags.map((tag) => (
                    <div key={tag.id} className="bg-amber-900/20 border border-amber-600/30 p-3 rounded hover:bg-amber-900/30 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
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
                          className="border-amber-600 text-amber-400 hover:bg-amber-600 hover:text-white ml-2"
                          onClick={() => {
                            // Open merge modal with this tag pre-selected
                            setShowMergeModal(true);
                          }}
                        >
                          Merge
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* References Section */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 hover:bg-gray-800 rounded">
                <span className="text-sm font-medium text-slate-300">References</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="p-2">
                {selectedTag && (
                  <div className="space-y-2">
                    {/* Fix References Button - DEPRECATED: No longer needed with card-based system */}
                    {/* <Button
                      variant="outline"
                      className="w-full border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white py-2 px-3 mb-3"
                      onClick={handleFixReferences}
                      disabled={isUpdating}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Fix Misaligned References
                    </Button> */}
                    
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
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Edit Name Modal */}
      <Dialog open={showEditNameModal} onOpenChange={setShowEditNameModal}>
        <DialogContent className="bg-gray-800 border-gray-600">
          <DialogHeader>
            <DialogTitle className="text-slate-200">Edit Tag Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="bg-gray-700 border-gray-600 text-slate-200"
              placeholder="Enter tag name"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                onClick={() => setShowEditNameModal(false)}
                className="text-slate-400"
              >
                Cancel
              </Button>
              <Button
                onClick={saveNameEdit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
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
