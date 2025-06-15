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
import { TextSelection, Tag } from "@shared/schema";

export default function OrcsMain() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'tagEditor'>('graph');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagModalType, setTagModalType] = useState<string>('entity');
  const [searchQuery, setSearchQuery] = useState('');

  const { uploadFile, isUploading } = useFileOperations();
  const { stats } = useTagOperations();

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
        />

        {/* Central Content Area */}
        <div className="flex-1 flex flex-col">
          <DocumentViewer
            selectedFile={selectedFile}
            onTextSelection={handleTextSelection}
            onTagClick={handleTagClick}
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
