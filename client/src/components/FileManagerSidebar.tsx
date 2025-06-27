import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, File as FileIcon, Eye, RefreshCw, Plus, FileText, Table, Trash2 } from "lucide-react";
import { File, Stats, Tag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useFileOperations } from "@/hooks/useFileOperations";

interface FileManagerSidebarProps {
  selectedFile: string | null;
  onFileSelect: (fileId: string) => void;
  searchQuery: string;
  onTagClick: (tag: Tag) => void;
}

export function FileManagerSidebar({ selectedFile, onFileSelect, searchQuery, onTagClick }: FileManagerSidebarProps) {
  const [showOriginals, setShowOriginals] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['raw']));
  const { stats }: { stats?: Stats } = useTagOperations();
  const { deleteFile, isDeleting } = useFileOperations();

  const { data: files = [], isLoading } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const { data: tags = [] } = useQuery<any[]>({
    queryKey: ['/api/tags'],
  });

  // Use search API when there's a query, otherwise show all files
  const { data: searchResults } = useQuery<File[]>({
    queryKey: [`/api/search/files?q=${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.trim().length > 0,
  });

  const filteredFiles = searchQuery.trim().length > 0 
    ? (searchResults || [])
    : files;

  // Separate card files from original files
  const cardFiles = filteredFiles.filter(file => file.name.includes('.card.txt'));
  const originalFiles = filteredFiles.filter(file => (file.type === 'txt' || file.type === 'csv') && !file.name.includes('.card.txt'));
  
  // Show cards by default, originals only when toggled
  const displayFiles = showOriginals ? [...cardFiles, ...originalFiles] : cardFiles;

  const tagCounts = stats?.tagCounts || {};

  // Group tags by type
  const tagsByType = {
    entity: (tags as any[]).filter((tag: any) => tag.type === 'entity'),
    relationship: (tags as any[]).filter((tag: any) => tag.type === 'relationship'),
    attribute: (tags as any[]).filter((tag: any) => tag.type === 'attribute'),
    comment: (tags as any[]).filter((tag: any) => tag.type === 'comment'),
    kv_pair: (tags as any[]).filter((tag: any) => tag.type === 'kv_pair'),
  };

  const toggleFolder = (folderName: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  };

  // Clean display name by removing UUID from card files
  const getDisplayName = (fileName: string): string => {
    if (fileName.includes('.card.txt')) {
      // Remove UUID pattern (8-4-4-4-12 characters) from card filenames
      // Example: "news_clip_1_c0c59139-5114-4243-aa89-3c7d924487bc.card.txt" becomes "news_clip_1.card.txt"
      return fileName.replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, '');
    }
    return fileName;
  };

  const handleDeleteFile = async (fileId: string, fileName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent file selection when clicking delete
    
    const isCard = fileName.includes('_ORCS_CARD');
    const message = isCard 
      ? `Are you sure you want to delete "${fileName}"? This will also delete the original source file.`
      : `Are you sure you want to delete "${fileName}"? This will also delete the corresponding ORCS card.`;
    
    if (confirm(message)) {
      deleteFile(fileId);
      
      // Clear selection if the deleted file was selected
      if (selectedFile === fileId) {
        onFileSelect('');
      }
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="w-80 border-r border-gray-700 flex flex-col">
      {/* File Actions */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-200">File Management</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOriginals(!showOriginals)}
            className="text-blue-400 hover:text-blue-300"
          >
            <Eye className="w-4 h-4 mr-1" />
            {showOriginals ? 'Hide' : 'Show'} Original Files
          </Button>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-gray-800 border-gray-600 hover:bg-gray-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 bg-gray-800 border-gray-600 hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {/* user_data folder */}
          <div className="space-y-1">
            <div className="flex items-center text-sm text-slate-300 py-1">
              <Folder className="w-4 h-4 text-amber-500 mr-2" />
              <span>user_data</span>
            </div>
            
            {/* raw folder */}
            <div className="ml-4 space-y-1">
              <div 
                className="flex items-center text-sm text-slate-300 py-1 cursor-pointer hover:text-slate-200"
                onClick={() => toggleFolder('raw')}
              >
                {expandedFolders.has('raw') ? (
                  <FolderOpen className="w-4 h-4 text-amber-400 mr-2" />
                ) : (
                  <Folder className="w-4 h-4 text-amber-500 mr-2" />
                )}
                <span>raw</span>
              </div>
              {expandedFolders.has('raw') && (
                <div className="ml-4 space-y-1">
                  {isLoading ? (
                    <div className="text-sm text-slate-400">Loading...</div>
                  ) : (
                    displayFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`group flex items-center justify-between text-sm py-1 px-2 rounded cursor-pointer ${
                          selectedFile === file.id 
                            ? 'bg-gray-800 border-l-2 border-blue-400 text-slate-200' 
                            : 'text-slate-400 hover:bg-gray-800'
                        }`}
                        onClick={() => onFileSelect(file.id)}
                      >
                        <div className="flex items-center">
                          {file.type === 'csv' ? (
                            <Table className="w-4 h-4 text-green-400 mr-2" />
                          ) : file.type === 'metadata' ? (
                            <FileText className="w-4 h-4 text-amber-400 mr-2" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-400 mr-2" />
                          )}
                          <span>{getDisplayName(file.name)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteFile(file.id, file.name, e)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 h-auto ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>



            {/* Tag directories */}
            {[
              { name: 'entities', type: 'entity', color: 'green', tags: tagsByType.entity },
              { name: 'relationships', type: 'relationship', color: 'orange', tags: tagsByType.relationship },
              { name: 'attributes', type: 'attribute', color: 'blue', tags: tagsByType.attribute },
              { name: 'comments', type: 'comment', color: 'purple', tags: tagsByType.comment },
              { name: 'kv_pairs', type: 'kv_pair', color: 'red', tags: tagsByType.kv_pair },
            ].map((folder) => (
              <div key={folder.name} className="ml-4 space-y-1">
                <div 
                  className="flex items-center text-sm text-slate-300 py-1 cursor-pointer hover:text-slate-200"
                  onClick={() => toggleFolder(folder.name)}
                >
                  {expandedFolders.has(folder.name) ? (
                    <FolderOpen className="w-4 h-4 text-amber-400 mr-2" />
                  ) : (
                    <Folder className="w-4 h-4 text-amber-500 mr-2" />
                  )}
                  <span>{folder.name}</span>
                  <span className={`ml-auto text-xs bg-${folder.color}-600 text-white rounded-full px-2 py-0.5`}>
                    {folder.tags.length}
                  </span>
                </div>
                {expandedFolders.has(folder.name) && (
                  <div className="ml-4 space-y-1">
                    {folder.tags.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1">No tags</div>
                    ) : (
                      folder.tags.map((tag: any) => (
                        <div
                          key={tag.id}
                          className="group flex items-center justify-between text-xs py-1 px-2 rounded cursor-pointer text-slate-400 hover:bg-gray-800 hover:text-slate-300"
                          onClick={() => onTagClick(tag)}
                        >
                          <div className="flex items-center">
                            <FileText className="w-3 h-3 text-slate-500 mr-2" />
                            <span>{tag.name}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {tag.reference?.split('@')[0]?.split('[')[0] || ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
