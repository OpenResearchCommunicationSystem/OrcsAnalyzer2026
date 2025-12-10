import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MetadataFormProps {
  fileId: string;
  fileName: string;
  initialMetadata: string;
  onClose: () => void;
  onSave: () => void;
}

interface ParsedMetadata {
  version: string;
  uuid: string;
  source_file: string;
  source_reference: string;
  classification: string;
  handling: string[];
  created: string;
  modified: string;
  file_type: string;
  file_size: string;
  analyst: string;
  confidence: string;
}

export function MetadataForm({ fileId, fileName, initialMetadata, onClose, onSave }: MetadataFormProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ParsedMetadata>({
    version: "2025.003",
    uuid: "",
    source_file: fileName,
    source_reference: "",
    classification: "",
    handling: [""],
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    file_type: "",
    file_size: "",
    analyst: "",
    confidence: ""
  });

  // Parse existing metadata when component loads
  useEffect(() => {
    if (initialMetadata) {
      try {
        const parsed = parseYamlMetadata(initialMetadata);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn("Could not parse existing metadata, using defaults");
      }
    }
  }, [initialMetadata]);

  const parseYamlMetadata = (yamlContent: string): Partial<ParsedMetadata> => {
    const parsed: Partial<ParsedMetadata> = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes(':')) continue;
      
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      
      switch (key.trim()) {
        case 'version':
          parsed.version = value;
          break;
        case 'uuid':
          parsed.uuid = value;
          break;
        case 'source_file':
          parsed.source_file = value;
          break;
        case 'source_reference':
          parsed.source_reference = value;
          break;
        case 'classification':
          parsed.classification = value;
          break;
        case 'created':
          parsed.created = value;
          break;
        case 'modified':
          parsed.modified = value;
          break;
        case 'file_type':
          parsed.file_type = value;
          break;
        case 'file_size':
          parsed.file_size = value;
          break;
        case 'analyst':
          parsed.analyst = value;
          break;
        case 'confidence':
          parsed.confidence = value;
          break;
      }
    }
    
    return parsed;
  };

  const generateYamlContent = (data: ParsedMetadata): string => {
    const now = new Date().toISOString();
    return [
      '# ORCS Metadata Card',
      `version: "${data.version}"`,
      `uuid: "${data.uuid || crypto.randomUUID()}"`,
      `source_file: "${data.source_file}"`,
      `source_reference: "${data.source_reference}"`,
      `classification: "${data.classification}"`,
      `handling:`,
      ...data.handling.map(h => `  - "${h}"`),
      `created: "${data.created}"`,
      `modified: "${now}"`,
      ``,
      `metadata:`,
      `  file_type: "${data.file_type}"`,
      `  file_size: ${data.file_size}`,
      `  analyst: "${data.analyst}"`,
      `  confidence: "${data.confidence}"`,
      ``,
      `tag_index: []`,
      ``
    ].join('\n');
  };

  const saveMetadataMutation = useMutation({
    mutationFn: async (metadata: string) => {
      console.log('Saving metadata:', { fileId, metadataLength: metadata.length });
      const response = await apiRequest('PUT', `/api/files/${fileId}/metadata`, { metadata });
      console.log('Save response:', response);
      return response;
    },
    onSuccess: () => {
      console.log('Metadata saved successfully');
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}/metadata`] });
      onSave();
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to save metadata:', error);
      console.error('Error details:', error.message, error.cause);
      alert(`Failed to save metadata: ${error.message || 'Unknown error'}`);
    }
  });

  const handleSave = () => {
    const yamlContent = generateYamlContent(formData);
    saveMetadataMutation.mutate(yamlContent);
  };

  const handleInputChange = (field: keyof ParsedMetadata, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHandlingChange = (index: number, value: string) => {
    const newHandling = [...formData.handling];
    newHandling[index] = value;
    setFormData(prev => ({ ...prev, handling: newHandling }));
  };

  const addHandlingLine = () => {
    setFormData(prev => ({ ...prev, handling: [...prev.handling, ""] }));
  };

  const removeHandlingLine = (index: number) => {
    if (index >= 0 && index < formData.handling.length && formData.handling.length > 1) {
      setFormData(prev => ({ 
        ...prev, 
        handling: prev.handling.filter((_, i) => i !== index) 
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-medium text-slate-200">Edit ORCS Metadata</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="source_file" className="text-slate-300">Source File</Label>
              <Input
                id="source_file"
                value={formData.source_file}
                onChange={(e) => handleInputChange('source_file', e.target.value)}
                className="bg-gray-700 border-gray-600 text-slate-200"
                disabled
              />
            </div>
            <div>
              <Label htmlFor="version" className="text-slate-300">Version</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                className="bg-gray-700 border-gray-600 text-slate-200"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="source_reference" className="text-slate-300">Source Reference (URL or ID)</Label>
            <Input
              id="source_reference"
              value={formData.source_reference}
              onChange={(e) => handleInputChange('source_reference', e.target.value)}
              placeholder="External URL or reference"
              className="bg-gray-700 border-gray-600 text-slate-200"
            />
          </div>

          {/* Classification */}
          <div>
            <Label htmlFor="classification" className="text-slate-300">Classification</Label>
            <Select value={formData.classification || undefined} onValueChange={(value) => handleInputChange('classification', value)}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue placeholder="Select classification level" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="Unclassified">Unclassified</SelectItem>
                <SelectItem value="Proprietary Information">Proprietary Information</SelectItem>
                <SelectItem value="Confidential">Confidential</SelectItem>
                <SelectItem value="Restricted">Restricted</SelectItem>
                <SelectItem value="Secret">Secret</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Handling Instructions */}
          <div>
            <Label className="text-slate-300">Handling Instructions</Label>
            <div className="space-y-2">
              {formData.handling.map((instruction, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={instruction}
                    onChange={(e) => handleHandlingChange(index, e.target.value)}
                    placeholder="Handling instruction"
                    className="bg-gray-700 border-gray-600 text-slate-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHandlingLine(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHandlingLine}
                className="text-slate-300 border-gray-600"
              >
                Add Handling Instruction
              </Button>
            </div>
          </div>

          {/* Analysis Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="analyst" className="text-slate-300">Analyst</Label>
              <Input
                id="analyst"
                value={formData.analyst}
                onChange={(e) => handleInputChange('analyst', e.target.value)}
                placeholder="Analyst name or ID"
                className="bg-gray-700 border-gray-600 text-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="confidence" className="text-slate-300">Confidence Level</Label>
              <Select value={formData.confidence} onValueChange={(value) => handleInputChange('confidence', value)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-slate-200">
                  <SelectValue placeholder="Select confidence" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="file_type" className="text-slate-300">File Type</Label>
              <Input
                id="file_type"
                value={formData.file_type}
                onChange={(e) => handleInputChange('file_type', e.target.value)}
                placeholder="e.g., text, csv, intelligence"
                className="bg-gray-700 border-gray-600 text-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="file_size" className="text-slate-300">File Size</Label>
              <Input
                id="file_size"
                value={formData.file_size}
                onChange={(e) => handleInputChange('file_size', e.target.value)}
                placeholder="File size in bytes"
                className="bg-gray-700 border-gray-600 text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose} className="text-slate-400">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMetadataMutation.isPending}
            className={`${
              saveMetadataMutation.isSuccess 
                ? 'bg-green-600 hover:bg-green-700' 
                : saveMetadataMutation.isError
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMetadataMutation.isPending 
              ? 'Saving...' 
              : saveMetadataMutation.isSuccess 
              ? 'Saved!' 
              : saveMetadataMutation.isError 
              ? 'Error - Retry' 
              : 'Save Metadata'}
          </Button>
        </div>
      </div>
    </div>
  );
}