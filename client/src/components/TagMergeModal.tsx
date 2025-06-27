import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Users, 
  FileText, 
  Merge, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
  Target,
  MapPin,
  Settings,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Tag } from "@shared/schema";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useReferenceAnalysis } from "@/hooks/useReferenceAnalysis";

interface TagMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterTag: Tag | null;
  onMergeComplete?: () => void;
}

interface SimilarTag {
  tag: Tag;
  similarity: number;
  matchReasons: string[];
}

export function TagMergeModal({ isOpen, onClose, masterTag, onMergeComplete }: TagMergeModalProps) {
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("similar-tags");
  const [aliasSettings, setAliasSettings] = useState({
    similaritySearch: true,    // For Similar Tags comparison
    documentSearch: true,      // For single document reference search
    repositorySearch: false    // For repository-wide reference search
  });
  
  const queryClient = useQueryClient();
  const { updateTag } = useTagOperations();
  
  // Fetch all tags for similarity detection
  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  // Reference analysis for tagged/untagged instances
  const { data: referenceAnalysis, isLoading: isAnalysisLoading } = useReferenceAnalysis(masterTag, aliasSettings);

  // Parse references to show file locations
  const parseReferences = (tag: Tag) => {
    if (!tag.references || tag.references.length === 0) return [];
    
    return tag.references.map((ref: string) => {
      const atMatch = ref.match(/^(.+?)@(\d+)-(\d+)$/);
      const csvMatch = ref.match(/^(.+?)\[(\d+),(\d+)\]$/);
      
      if (atMatch) {
        return {
          filename: atMatch[1],
          location: `Characters ${atMatch[2]}-${atMatch[3]}`,
          type: 'text',
          fullRef: ref
        };
      } else if (csvMatch) {
        return {
          filename: csvMatch[1],
          location: `Row ${csvMatch[2]}, Column ${csvMatch[3]}`,
          type: 'csv',
          fullRef: ref
        };
      } else {
        return {
          filename: ref,
          location: 'Unknown location',
          type: 'unknown',
          fullRef: ref
        };
      }
    });
  };

  // Find similar tags with scoring
  const findSimilarTags = (): SimilarTag[] => {
    if (!masterTag) return [];
    
    return allTags
      .filter(tag => tag.id !== masterTag.id)
      .map(tag => {
        const matchReasons: string[] = [];
        let similarity = 0;
        
        const tagName = tag.name.toLowerCase();
        const masterName = masterTag.name.toLowerCase();
        const tagAliases = tag.aliases?.map(a => a.toLowerCase()) || [];
        const masterAliases = masterTag.aliases?.map(a => a.toLowerCase()) || [];
        
        // Exact name match (highest score)
        if (tagName === masterName) {
          similarity += 100;
          matchReasons.push("Exact name match");
        }
        // Partial name match
        else if (tagName.includes(masterName) || masterName.includes(tagName)) {
          similarity += 75;
          matchReasons.push("Partial name match");
        }
        
        // Alias matches - only if similarity search aliases are enabled
        if (aliasSettings.similaritySearch) {
          const aliasMatches = tagAliases.filter(alias => 
            masterAliases.includes(alias) || 
            alias.includes(masterName) ||
            masterName.includes(alias)
          );
          if (aliasMatches.length > 0) {
            similarity += 50 * aliasMatches.length;
            matchReasons.push(`Alias match: ${aliasMatches.join(', ')}`);
          }
        }
        
        // Same type and entity type
        if (tag.type === masterTag.type) {
          similarity += 25;
          matchReasons.push("Same tag type");
          
          if (tag.entityType === masterTag.entityType) {
            similarity += 25;
            matchReasons.push("Same entity type");
          }
        }
        
        return { tag, similarity, matchReasons };
      })
      .filter(item => item.similarity >= 100)
      .sort((a, b) => b.similarity - a.similarity);
  };

  const similarTags = findSimilarTags();

  const handleMerge = async () => {
    if (!masterTag || selectedForMerge.size === 0) return;
    
    try {
      const tagIdsToMerge = Array.from(selectedForMerge);
      
      // Call the merge API endpoint
      const response = await fetch(`/api/tags/${masterTag.id}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagIdsToMerge }),
      });
      
      if (!response.ok) {
        throw new Error(`Merge failed: ${response.statusText}`);
      }
      
      const mergedTag = await response.json();
      console.log('Tags merged successfully:', mergedTag);
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      onMergeComplete?.();
      onClose();
      
    } catch (error) {
      console.error('Merge failed:', error);
    }
  };

  const toggleTagSelection = (tagId: string) => {
    const newSelection = new Set(selectedForMerge);
    if (newSelection.has(tagId)) {
      newSelection.delete(tagId);
    } else {
      newSelection.add(tagId);
    }
    setSelectedForMerge(newSelection);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-slate-200 flex items-center">
            <Merge className="w-5 h-5 mr-2" />
            Merge Tags: {masterTag?.name}
          </DialogTitle>
        </DialogHeader>
        
        {/* PHASE 2: NEW Master Tag Display - Duplicated from Similar Tags tab */}
        <div className="bg-blue-900/30 border border-blue-600/50 p-4 rounded-lg mb-4">
          <div className="flex items-center mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400 mr-2" />
            <span className="font-semibold text-blue-200">Master Tag (Target)</span>
          </div>
          <div className="text-slate-200 font-medium">{masterTag?.name}</div>
          <div className="text-sm text-slate-400 mt-1">
            {masterTag?.entityType} • {parseReferences(masterTag || {} as Tag).length} reference(s)
          </div>
          {masterTag?.aliases && masterTag.aliases.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-slate-400 mb-1">Aliases:</div>
              <div className="flex flex-wrap gap-1">
                {masterTag.aliases.map(alias => (
                  <Badge key={alias} variant="outline" className="text-xs border-blue-600 text-blue-300">
                    {alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Alias Toggle Controls */}
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-3">
            <Settings className="w-4 h-4 mr-2 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Search Alias Settings</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="similarity-aliases" className="text-xs text-slate-300">
                  Similar Tags
                </Label>
                <span className="text-xs text-slate-500">
                  Include aliases when finding similar tags
                </span>
              </div>
              <Switch
                id="similarity-aliases"
                checked={aliasSettings.similaritySearch}
                onCheckedChange={(checked) => 
                  setAliasSettings(prev => ({ ...prev, similaritySearch: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="document-aliases" className="text-xs text-slate-300">
                  Document Search
                </Label>
                <span className="text-xs text-slate-500">
                  Use aliases for single document analysis
                </span>
              </div>
              <Switch
                id="document-aliases"
                checked={aliasSettings.documentSearch}
                onCheckedChange={(checked) => 
                  setAliasSettings(prev => ({ ...prev, documentSearch: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="repository-aliases" className="text-xs text-slate-300">
                  Repository Search
                </Label>
                <span className="text-xs text-slate-500">
                  Use aliases for repository-wide analysis
                </span>
              </div>
              <Switch
                id="repository-aliases"
                checked={aliasSettings.repositorySearch}
                onCheckedChange={(checked) => 
                  setAliasSettings(prev => ({ ...prev, repositorySearch: checked }))
                }
              />
            </div>
          </div>
          
          {masterTag?.aliases && masterTag.aliases.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs text-slate-400 mb-2">Current aliases for "{masterTag.name}":</div>
              <div className="flex flex-wrap gap-1">
                {masterTag.aliases.map(alias => (
                  <Badge key={alias} variant="outline" className="text-xs border-amber-600/50 text-amber-300">
                    {alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="similar-tags" className="text-slate-300">
              <Users className="w-4 h-4 mr-2" />
              Similar Tags ({similarTags.length})
            </TabsTrigger>
            <TabsTrigger value="tagged-refs" className="text-slate-300">
              <Target className="w-4 h-4 mr-2" />
              Tagged ({referenceAnalysis?.totalTaggedCount || 0})
            </TabsTrigger>
            <TabsTrigger value="untagged-refs" className="text-slate-300">
              <Eye className="w-4 h-4 mr-2" />
              Untagged ({referenceAnalysis?.totalUntaggedCount || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="similar-tags" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {/* PHASE 4: OLD Master Tag Display - COMMENTED OUT */}
                {/* 
                <div className="bg-blue-900/30 border border-blue-600/50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-5 h-5 text-blue-400 mr-2" />
                    <span className="font-semibold text-blue-200">Master Tag (Target)</span>
                  </div>
                  <div className="text-slate-200 font-medium">{masterTag?.name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {masterTag?.entityType} • {parseReferences(masterTag || {} as Tag).length} reference(s)
                  </div>
                  {masterTag?.aliases && masterTag.aliases.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-400 mb-1">Aliases:</div>
                      <div className="flex flex-wrap gap-1">
                        {masterTag.aliases.map(alias => (
                          <Badge key={alias} variant="outline" className="text-xs border-blue-600 text-blue-300">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <Separator className="bg-gray-700" />
                */}
                
                {/* Similar Tags */}
                {similarTags.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-amber-200 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Select tags to merge into the master tag:
                    </div>
                    
                    {similarTags.map(({ tag, similarity, matchReasons }) => (
                      <div 
                        key={tag.id} 
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedForMerge.has(tag.id)
                            ? 'bg-amber-900/30 border-amber-600/50'
                            : similarity >= 100 
                              ? 'bg-amber-900/20 border-amber-600/30 hover:border-amber-600/50'
                              : 'bg-gray-800/50 border-gray-600 hover:border-amber-600/30'
                        }`}
                        onClick={() => toggleTagSelection(tag.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className="font-medium text-slate-200">{tag.name}</div>
                              {similarity >= 100 && (
                                <Badge className="ml-2 bg-amber-600 text-amber-100">
                                  Perfect Match
                                </Badge>
                              )}
                            </div>
                            
                            <div className="text-sm text-slate-400 mt-1">
                              {tag.entityType} • {parseReferences(tag).length} reference(s)
                            </div>
                            
                            {tag.aliases && tag.aliases.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-slate-400 mb-1">Aliases:</div>
                                <div className="flex flex-wrap gap-1">
                                  {tag.aliases.map(alias => (
                                    <Badge key={alias} variant="outline" className="text-xs border-amber-600/50 text-amber-300">
                                      {alias}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-2">
                              <div className="text-xs text-slate-400 mb-1">Match reason:</div>
                              <div className="text-xs text-amber-400">
                                {matchReasons.join(' • ')}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-4">
                            {selectedForMerge.has(tag.id) ? (
                              <CheckCircle className="w-5 h-5 text-amber-400" />
                            ) : (
                              <div className="w-5 h-5 border-2 border-gray-500 rounded-full" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <div>No similar tags found</div>
                    <div className="text-sm">Try adjusting tag names or aliases to find matches</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="tagged-refs" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {isAnalysisLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50 animate-pulse" />
                  <div>Analyzing documents...</div>
                  <div className="text-sm">Finding all tagged references</div>
                </div>
              ) : referenceAnalysis?.taggedReferences.length ? (
                <div className="space-y-4">
                  {referenceAnalysis.taggedReferences.map((ref, index) => (
                    <div key={index} className="bg-green-900/20 border border-green-600/30 p-4 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <Target className="w-4 h-4 text-green-400 mr-2" />
                          <span className="font-medium text-green-300">{ref.exactText}</span>
                        </div>
                        <Badge variant="outline" className="border-green-600/30 text-green-400 text-xs">
                          {ref.type.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-slate-300 mb-2 bg-gray-800/50 p-2 rounded border-l-2 border-green-500/30">
                        "{ref.context}"
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center text-slate-400">
                          <FileText className="w-3 h-3 mr-1" />
                          {ref.filename}
                        </div>
                        <div className="flex items-center text-slate-500">
                          <MapPin className="w-3 h-3 mr-1" />
                          {ref.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div>No tagged references found</div>
                  <div className="text-sm">This entity hasn't been tagged in any documents yet</div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="untagged-refs" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {isAnalysisLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-50 animate-pulse" />
                  <div>Analyzing documents...</div>
                  <div className="text-sm">Finding potential untagged references</div>
                </div>
              ) : referenceAnalysis?.untaggedReferences.length ? (
                <div className="space-y-4">
                  {referenceAnalysis.untaggedReferences.map((ref, index) => (
                    <div key={index} className="bg-amber-900/20 border border-amber-600/30 p-4 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 text-amber-400 mr-2" />
                          <span className="font-medium text-amber-300">{ref.text}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              ref.confidence > 0.7 
                                ? 'border-green-600/30 text-green-400' 
                                : ref.confidence > 0.5 
                                ? 'border-yellow-600/30 text-yellow-400'
                                : 'border-red-600/30 text-red-400'
                            }`}
                          >
                            {Math.round(ref.confidence * 100)}% match
                          </Badge>
                          <Badge variant="outline" className="border-amber-600/30 text-amber-400 text-xs">
                            {ref.type.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-300 mb-2 bg-gray-800/50 p-2 rounded border-l-2 border-amber-500/30">
                        "{ref.context}"
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center text-slate-400 text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          {ref.filename}
                        </div>
                        <div className="flex items-center text-slate-500 text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          Characters {ref.position.start}-{ref.position.end}
                        </div>
                      </div>
                      
                      <div className="text-xs text-amber-400">
                        <strong>Why detected:</strong> {ref.reasons.join(' • ')}
                      </div>
                      
                      <div className="mt-2 flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-400 hover:bg-green-600 hover:text-white text-xs"
                          onClick={() => {
                            // TODO: Implement tag creation for this reference
                            console.log('Tag this reference:', ref);
                          }}
                        >
                          Tag This
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-400 hover:bg-gray-600 hover:text-white text-xs"
                          onClick={() => {
                            // TODO: Implement ignore functionality
                            console.log('Ignore this reference:', ref);
                          }}
                        >
                          Ignore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div>No untagged references found</div>
                  <div className="text-sm">All instances of this entity appear to be tagged</div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <div className="text-sm text-slate-400">
            {selectedForMerge.size > 0 ? (
              `${selectedForMerge.size} tag(s) selected for merge`
            ) : (
              'Select tags to merge'
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={selectedForMerge.size === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Merge className="w-4 h-4 mr-2" />
              Merge {selectedForMerge.size} Tag(s)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}