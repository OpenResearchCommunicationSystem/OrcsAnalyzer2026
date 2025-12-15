import { useState } from "react";
import { FileManagerSidebar } from "@/components/FileManagerSidebar";
import { DocumentViewer } from "@/components/DocumentViewer";
import { TagToolbar } from "@/components/TagToolbar";
import { GraphVisualization } from "@/components/GraphVisualization";
import { TagEditor } from "@/components/TagEditor";
import { TagCreationModal } from "@/components/TagCreationModal";
import { RelationshipConnectionModal } from "@/components/RelationshipConnectionModal";
import { MetadataForm } from "@/components/MetadataForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Upload, Search, Link2, X, RefreshCw, AlertTriangle, PanelLeftClose, PanelRightClose, PanelLeft, PanelRight } from "lucide-react";
import { useFileOperations } from "@/hooks/useFileOperations";
import { useTagOperations } from "@/hooks/useTagOperations";
import { TextSelection, Tag, Stats, File, MasterIndex, BrokenReference } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function OrcsMain() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedDocumentPattern, setSelectedDocumentPattern] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'tagEditor'>('tagEditor');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalType, setTagModalType] = useState<string>('entity');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Entity connection state for creating relationships
  const [selectedEntities, setSelectedEntities] = useState<Tag[]>([]);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  
  // New file metadata modal state
  const [showNewFileMetadata, setShowNewFileMetadata] = useState(false);
  const [newlyUploadedFile, setNewlyUploadedFile] = useState<{ id: string; name: string } | null>(null);

  // Sidebar collapse state
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  const { uploadFileAsync, isUploading } = useFileOperations();
  const { stats }: { stats?: Stats } = useTagOperations();
  const { toast } = useToast();
  
  // Fetch files for reference navigation
  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  // System index and broken connections
  const { data: systemIndex } = useQuery<MasterIndex>({
    queryKey: ['/api/system/index'],
    refetchInterval: 30000,
  });

  const { data: brokenConnections = [] } = useQuery<BrokenReference[]>({
    queryKey: ['/api/system/broken-connections'],
    refetchInterval: 60000,
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/system/reindex');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/index'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/broken-connections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph-data'] });
      toast({ title: 'System reindexed', description: 'All data has been refreshed' });
    },
    onError: () => {
      toast({ title: 'Reindex failed', description: 'Please try again', variant: 'destructive' });
    },
  });

  const handleSystemRefresh = () => {
    reindexMutation.mutate();
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await uploadFileAsync(file);
          // Fetch fresh file list directly from API
          const response = await fetch('/api/files');
          const refreshedFiles: File[] = await response.json();
          // Find the card file that was created
          const baseName = file.name.replace(/\.(txt|csv)$/, '');
          const cardFile = refreshedFiles?.find((f: File) => 
            f.name.includes('.card.txt') && f.name.includes(baseName)
          );
          // Invalidate to refresh UI
          await queryClient.invalidateQueries({ queryKey: ['/api/files'] });
          if (cardFile) {
            setNewlyUploadedFile({ id: cardFile.id, name: cardFile.name });
            setShowNewFileMetadata(true);
          }
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }
    };
    input.click();
  };

  const handleTextSelection = (selection: TextSelection) => {
    setSelectedText(selection);
  };

  const handleCreateTag = (type: string) => {
    if (!selectedText) {
      alert('Please select text first');
      return;
    }
    setTagModalType(type);
    setShowTagModal(true);
  };

  // Handle drag-and-drop entity connection (preferred workflow)
  const handleEntityDragConnection = (sourceEntity: Tag, targetEntity: Tag) => {
    setSelectedEntities([sourceEntity, targetEntity]);
    setShowConnectionModal(true);
  };

  const handleTagClick = (tag: Tag, isCtrlClick?: boolean) => {
    // If Ctrl+click on an entity, add to selection for connection
    if (isCtrlClick && tag.type === 'entity') {
      setSelectedEntities(prev => {
        // If already selected, remove it
        if (prev.some(e => e.id === tag.id)) {
          return prev.filter(e => e.id !== tag.id);
        }
        // Add to selection (max 2 entities)
        const newSelection = [...prev, tag];
        if (newSelection.length === 2) {
          // Auto-open connection modal when 2 entities selected
          setTimeout(() => setShowConnectionModal(true), 100);
        }
        return newSelection.slice(-2); // Keep only last 2
      });
      return;
    }
    
    // Normal click - select tag for editing
    setSelectedTag(tag);
    setActiveTab('tagEditor');
  };

  const handleEntitySelect = (entity: Tag) => {
    setSelectedEntities(prev => {
      if (prev.some(e => e.id === entity.id)) {
        return prev.filter(e => e.id !== entity.id);
      }
      const newSelection = [...prev, entity];
      if (newSelection.length === 2) {
        setTimeout(() => setShowConnectionModal(true), 100);
      }
      return newSelection.slice(-2);
    });
  };

  const clearEntitySelection = () => {
    setSelectedEntities([]);
  };

  const handleFileNotFound = (staleFileId: string) => {
    // When a card file becomes invalid after tag operations, find the updated version
    // Use the stored document pattern to find the correct replacement
    
    if (selectedDocumentPattern) {
      // Find the current card file matching our document pattern
      const matchingCardFile = files.find(f => 
        f.name.includes('.card.txt') && 
        f.name.startsWith(selectedDocumentPattern) &&
        f.id !== staleFileId
      );
      
      if (matchingCardFile) {
        setSelectedFile(matchingCardFile.id);
        return;
      }
    }
    
    // Fallback: clear selection if we can't find the right document
    setSelectedFile(null);
    setSelectedDocumentPattern(null);
  };

  // Enhanced file selection that tracks document pattern
  const handleFileSelect = (fileId: string | null) => {
    setSelectedFile(fileId);
    
    if (fileId) {
      const file = files.find(f => f.id === fileId);
      if (file && file.name.includes('.card.txt')) {
        // Extract document pattern (e.g., "social_post_1" from "social_post_1_uuid.card.txt")
        const baseNameMatch = file.name.match(/^([^_]+(?:_[^_]+)*?)_[a-f0-9-]+\.card\.txt$/);
        if (baseNameMatch) {
          setSelectedDocumentPattern(baseNameMatch[1]);
        }
      }
    } else {
      setSelectedDocumentPattern(null);
    }
  };

  const handleReferenceClick = (filename: string) => {
    // Find the file by name and select it
    const matchingFile = files.find(file => file.name === filename);
    if (matchingFile) {
      // Only change file if it's different from currently selected
      if (selectedFile !== matchingFile.id) {
        setSelectedFile(matchingFile.id);
      }
      // Keep tag editor open - don't switch tabs or close tag editor
    } else {
      console.warn('File not found:', filename);
    }
  };

  // Handle re-selection by cardUuid after file modifications (e.g., adding user text)
  const handleSelectFileByCardUuid = (cardUuid: string) => {
    const matchingFile = files.find(f => f.cardUuid === cardUuid);
    if (matchingFile) {
      setSelectedFile(matchingFile.id);
    }
  };

  return (
    <div className="desktop-layout min-h-screen flex flex-col bg-gray-900 text-slate-50">
      {/* Header */}
      <header style={{ backgroundColor: 'var(--orcs-panel)' }} className="border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-semibold">ORCS Intelligence Platform</h1>
          </div>
          <div className="text-sm text-slate-400">v2025.003</div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search files, entities, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 bg-gray-800 border-gray-600 focus:border-blue-500"
            />
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          </div>
          
          <Button 
            onClick={handleFileUpload}
            disabled={isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </header>

      {/* Main Content Area - Optimized for HD Desktop */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - File Management */}
        <div 
          className={`flex-shrink-0 transition-all duration-300 ${
            leftSidebarCollapsed ? 'w-10' : 'w-72 lg:w-80 xl:w-96'
          }`}
          style={{ backgroundColor: 'var(--orcs-panel)' }}
        >
          <div className="h-full flex flex-col border-r border-gray-700">
            {/* Collapse toggle */}
            <div className="p-1 border-b border-gray-700 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                data-testid="toggle-left-sidebar"
              >
                {leftSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </Button>
            </div>
            {!leftSidebarCollapsed && (
              <FileManagerSidebar
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                searchQuery={searchQuery}
                onTagClick={handleTagClick}
              />
            )}
          </div>
        </div>

        {/* Central Content Area (Flexible Width) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tag Toolbar - Selection Tools */}
          <TagToolbar
            selectedText={selectedText}
            onCreateTag={handleCreateTag}
            onClearSelection={() => setSelectedText(null)}
          />

          {/* Document Viewer Area - Flex container for resizable panels */}
          <div className="flex-1 flex flex-col min-h-0">
            <DocumentViewer
              selectedFile={selectedFile}
              onTextSelection={handleTextSelection}
              onTagClick={handleTagClick}
              onFileNotFound={handleFileNotFound}
              onEntityDragConnection={handleEntityDragConnection}
              onSelectFileByCardUuid={handleSelectFileByCardUuid}
            />
          </div>
        </div>

        {/* Right Sidebar - Graph & Tag Editor */}
        <div 
          style={{ backgroundColor: 'var(--orcs-panel)' }} 
          className={`border-l border-gray-700 flex flex-col flex-shrink-0 transition-all duration-300 ${
            rightSidebarCollapsed ? 'w-10' : 'w-80 lg:w-96 xl:w-[420px] 2xl:w-[480px]'
          }`}
        >
          {/* Collapse toggle */}
          <div className="p-1 border-b border-gray-700 flex justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
              data-testid="toggle-right-sidebar"
            >
              {rightSidebarCollapsed ? <PanelRight className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
            </Button>
          </div>

          {!rightSidebarCollapsed && (
            <>
              {/* Tab Navigation */}
              <div className="border-b border-gray-700">
                <div className="flex">
                  <button
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'graph'
                        ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => setActiveTab('graph')}
                    data-testid="tab-graph"
                  >
                    Graph
                  </button>
                  <button
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'tagEditor'
                        ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => setActiveTab('tagEditor')}
                    data-testid="tab-tag-editor"
                  >
                    Tag Editor
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'graph' ? (
                <GraphVisualization onNodeClick={handleTagClick} />
              ) : (
                <TagEditor
                  selectedTag={selectedTag}
                  onTagUpdate={(tag) => setSelectedTag(tag)}
                  onClose={() => setSelectedTag(null)}
                  onReferenceClick={handleReferenceClick}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Entity Selection Indicator */}
      {selectedEntities.length > 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-orange-500/50 rounded-lg px-4 py-3 shadow-lg z-50">
          <div className="flex items-center gap-3">
            <Link2 className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-slate-300">
              {selectedEntities.length === 1 
                ? 'Ctrl+click another entity to connect' 
                : 'Ready to create connection'}
            </span>
            <div className="flex items-center gap-2">
              {selectedEntities.map((entity, i) => (
                <Badge 
                  key={entity.id}
                  className="bg-green-500/20 text-green-300 border-green-500/30"
                >
                  {entity.name}
                </Badge>
              ))}
            </div>
            {selectedEntities.length === 2 && (
              <Button 
                size="sm" 
                onClick={() => setShowConnectionModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-xs"
              >
                Connect
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={clearEntitySelection}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Relationship Connection Modal */}
      <RelationshipConnectionModal
        isOpen={showConnectionModal}
        onClose={() => {
          setShowConnectionModal(false);
          clearEntitySelection();
        }}
        sourceEntity={selectedEntities[0] || null}
        targetEntity={selectedEntities[1] || null}
        currentFileId={selectedFile}
        cardUuid={files.find(f => f.id === selectedFile)?.cardUuid}
        onConnectionCreated={() => {
          setShowConnectionModal(false);
          clearEntitySelection();
        }}
      />

      {/* Tag Creation Modal */}
      {showTagModal && (
        <TagCreationModal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          selectedText={selectedText}
          tagType={tagModalType}
          onTagCreated={() => {
            setShowTagModal(false);
            setSelectedText(null);
          }}
        />
      )}

      {/* New File Metadata Modal */}
      {showNewFileMetadata && newlyUploadedFile && (
        <MetadataForm
          fileId={newlyUploadedFile.id}
          fileName={newlyUploadedFile.name}
          initialMetadata=""
          onClose={() => {
            setShowNewFileMetadata(false);
            setNewlyUploadedFile(null);
          }}
          onSave={() => {
            setShowNewFileMetadata(false);
            setNewlyUploadedFile(null);
            queryClient.invalidateQueries({ queryKey: ['/api/files'] });
            toast({ title: 'Metadata saved', description: 'Card metadata has been updated' });
          }}
        />
      )}

      {/* Status Bar */}
      <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="border-t border-gray-700 px-6 py-2 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>Ready</span>
            <span>|</span>
            <span>Entities: <span className="text-slate-300">{systemIndex?.stats.totalEntities || 0}</span></span>
            <span>|</span>
            <span>Files: <span className="text-slate-300">{systemIndex?.stats.totalFiles || stats?.totalFiles || 0}</span></span>
            <span>|</span>
            <span>Links: <span className="text-slate-300">{systemIndex?.stats.totalLinks || 0}</span></span>
            {brokenConnections.length > 0 && (
              <>
                <span>|</span>
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {brokenConnections.length} broken
                </span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSystemRefresh}
              disabled={reindexMutation.isPending}
              className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
              data-testid="button-system-refresh"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
              {reindexMutation.isPending ? 'Reindexing...' : 'Refresh'}
            </Button>
            <span>|</span>
            <span>ORCS v2025.003</span>
            <span>|</span>
            <span>{systemIndex?.lastUpdated ? `Indexed: ${new Date(systemIndex.lastUpdated).toLocaleTimeString()}` : 'Auto-saved'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
