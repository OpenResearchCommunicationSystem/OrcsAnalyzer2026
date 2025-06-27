import { useState } from "react";
import { FileManagerSidebar } from "@/components/FileManagerSidebar";
import { DocumentViewer } from "@/components/DocumentViewer";
import { TagToolbar } from "@/components/TagToolbar";
import { GraphVisualization } from "@/components/GraphVisualization";
import { TagEditor } from "@/components/TagEditor";
import { TagCreationModal } from "@/components/TagCreationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Upload, Search } from "lucide-react";
import { useFileOperations } from "@/hooks/useFileOperations";
import { useTagOperations } from "@/hooks/useTagOperations";
import { TextSelection, Tag, Stats, File } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export default function OrcsMain() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'tagEditor'>('tagEditor');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalType, setTagModalType] = useState<string>('entity');
  const [searchQuery, setSearchQuery] = useState('');

  const { uploadFile, isUploading } = useFileOperations();
  const { stats }: { stats?: Stats } = useTagOperations();
  
  // Fetch files for reference navigation
  const { data: files = [] } = useQuery<File[]>({
    queryKey: ['/api/files'],
  });

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadFile(file);
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

  const handleTagClick = (tag: Tag) => {
    setSelectedTag(tag);
    setActiveTab('tagEditor');
  };

  const handleFileNotFound = (staleFileId: string) => {
    // When a file becomes invalid after tag operations, find the corresponding card file
    const staleFile = files.find(f => f.id === staleFileId);
    if (staleFile) {
      // Extract base name from the stale file to find matching card
      const baseName = staleFile.name.replace(/\.(txt|csv)$/, '').replace(/\.card$/, '');
      
      // Look for a card file with the same base name
      const matchingCardFile = files.find(f => 
        f.name.includes('.card.txt') && f.name.startsWith(baseName)
      );
      
      if (matchingCardFile) {
        setSelectedFile(matchingCardFile.id);
        return;
      }
    }
    
    // Fallback: if we can't find a specific match, try to stay in the same document family
    const cardFiles = files.filter(f => f.name.includes('.card.txt'));
    if (cardFiles.length > 0) {
      setSelectedFile(cardFiles[0].id);
    } else {
      setSelectedFile(null);
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

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-slate-50">
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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Management */}
        <FileManagerSidebar
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          searchQuery={searchQuery}
          onTagClick={handleTagClick}
        />

        {/* Central Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Document Header */}
          <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="border-b border-gray-700 px-6 py-2 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>Document</span>
                <span>|</span>
                <span>Ready for analysis</span>
              </div>
              <div className="flex items-center space-x-4">
                <span>Text viewer</span>
                <span>|</span>
                <span>Selection mode</span>
              </div>
            </div>
          </div>

          <DocumentViewer
            selectedFile={selectedFile}
            onTextSelection={handleTextSelection}
            onTagClick={handleTagClick}
            onFileNotFound={handleFileNotFound}
          />
          
          <TagToolbar
            selectedText={selectedText}
            onCreateTag={handleCreateTag}
            onClearSelection={() => setSelectedText(null)}
          />
        </div>

        {/* Right Sidebar - Graph & Tag Editor */}
        <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="w-80 border-l border-gray-700 flex flex-col">
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
        </div>
      </div>

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

      {/* Status Bar */}
      <div style={{ backgroundColor: 'var(--orcs-panel)' }} className="border-t border-gray-700 px-6 py-2 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span>Ready</span>
            <span>|</span>
            <span>Tags: <span className="text-slate-300">{stats?.totalTags || 0}</span></span>
            <span>|</span>
            <span>Files: <span className="text-slate-300">{stats?.totalFiles || 0}</span></span>
          </div>
          <div className="flex items-center space-x-4">
            <span>ORCS v2025.003</span>
            <span>|</span>
            <span>Auto-saved</span>
          </div>
        </div>
      </div>
    </div>
  );
}
