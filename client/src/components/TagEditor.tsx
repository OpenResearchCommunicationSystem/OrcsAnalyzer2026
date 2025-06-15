import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Trash2, Plus } from "lucide-react";
import { Tag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";

interface TagEditorProps {
  selectedTag: Tag | null;
  onTagUpdate: (tag: Tag) => void;
  onClose: () => void;
}

export function TagEditor({ selectedTag, onTagUpdate, onClose }: TagEditorProps) {
  const [formData, setFormData] = useState<Partial<Tag>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  
  const { updateTag, deleteTag, isUpdating, isDeleting } = useTagOperations();

  useEffect(() => {
    if (selectedTag) {
      setFormData(selectedTag);
    }
  }, [selectedTag]);

  const handleSave = async () => {
    if (selectedTag && formData.name && formData.type) {
      try {
        const updatedTag = await updateTag(selectedTag.id, formData as Tag);
        onTagUpdate(updatedTag);
      } catch (error) {
        console.error('Failed to update tag:', error);
      }
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
            <Label className="text-sm font-medium text-slate-300">Tag Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}
            >
              <SelectTrigger className="bg-gray-800 border-gray-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entity">Entity</SelectItem>
                <SelectItem value="relationship">Relationship</SelectItem>
                <SelectItem value="attribute">Attribute</SelectItem>
                <SelectItem value="comment">Comment</SelectItem>
                <SelectItem value="kv_pair">Key:Value Pair</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <Label className="text-sm font-medium text-slate-300">Reference</Label>
            <Input
              value={formData.reference || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              className="bg-gray-800 border-gray-600 font-mono focus:border-blue-500"
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
    </div>
  );
}
