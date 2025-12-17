import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Search, MessageSquare, Zap, Users, Link2, Maximize2, Minimize2 } from 'lucide-react';
import type { Snippet, Bullet, Tag, Link as LinkType } from '@shared/schema';

interface AnalysisAreaProps {
  cardUuid: string | null;
  cardFileName: string;
  cardClassification: string;
  cardSourceReference: string;
  entities: Tag[];
  links: LinkType[];
  snippets: Snippet[];
  bullets: Bullet[];
}

type AnalysisTab = 'snip' | 'bullet' | 'node' | 'edge';

export function AnalysisArea({ cardUuid, cardFileName, cardClassification, cardSourceReference, entities, links, snippets, bullets }: AnalysisAreaProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('snip');
  const [currentSnipIndex, setCurrentSnipIndex] = useState(0);
  const [currentBulletIndex, setCurrentBulletIndex] = useState(0);
  const [nodeSearch, setNodeSearch] = useState('');
  const [edgeSearch, setEdgeSearch] = useState('');
  const [nodeExpanded, setNodeExpanded] = useState(false);
  const [edgeExpanded, setEdgeExpanded] = useState(false);
  const [outputNodeExpanded, setOutputNodeExpanded] = useState(false);
  const [outputEdgeExpanded, setOutputEdgeExpanded] = useState(false);

  const tabConfig = [
    { id: 'snip' as const, label: 'Snip', icon: MessageSquare, count: snippets.length, color: 'amber' },
    { id: 'bullet' as const, label: 'Bullet', icon: Zap, count: bullets.length, color: 'cyan' },
    { id: 'node' as const, label: 'Node', icon: Users, count: entities.length, color: 'green' },
    { id: 'edge' as const, label: 'Edge', icon: Link2, count: links.length, color: 'orange' },
  ];

  const filteredEntities = entities.filter(e => 
    nodeSearch === '' || 
    e.name.toLowerCase().includes(nodeSearch.toLowerCase()) ||
    e.type.toLowerCase().includes(nodeSearch.toLowerCase())
  );

  const filteredLinks = links.filter(l =>
    edgeSearch === '' ||
    l.predicate.toLowerCase().includes(edgeSearch.toLowerCase())
  );

  const currentSnippet = snippets[currentSnipIndex];
  const currentBullet = bullets[currentBulletIndex];

  const navigateSnip = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentSnipIndex > 0) {
      setCurrentSnipIndex(currentSnipIndex - 1);
    } else if (direction === 'next' && currentSnipIndex < snippets.length - 1) {
      setCurrentSnipIndex(currentSnipIndex + 1);
    }
  };

  const navigateBullet = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentBulletIndex > 0) {
      setCurrentBulletIndex(currentBulletIndex - 1);
    } else if (direction === 'next' && currentBulletIndex < bullets.length - 1) {
      setCurrentBulletIndex(currentBulletIndex + 1);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800/50" data-testid="analysis-area">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? `text-${tab.color}-400 border-b-2 border-${tab.color}-400 bg-gray-800`
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-3 h-3" />
            <span>{tab.label}</span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 min-h-[140px]">
        {activeTab === 'snip' && (
          <div className="space-y-2" data-testid="snip-content">
            {snippets.length === 0 ? (
              <div className="text-slate-500 italic text-sm">No snippets. Select text and create a snippet.</div>
            ) : (
              <>
                {/* Record Navigation */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateSnip('prev')}
                      disabled={currentSnipIndex === 0}
                      className="h-6 w-6 p-0"
                      data-testid="snip-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-400">
                      {currentSnipIndex + 1} / {snippets.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateSnip('next')}
                      disabled={currentSnipIndex === snippets.length - 1}
                      className="h-6 w-6 p-0"
                      data-testid="snip-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Snippet Display */}
                {currentSnippet && (
                  <div className="space-y-2">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3" data-testid={`snip-display-${currentSnipIndex}`}>
                      <div className="text-amber-200 text-sm">"{currentSnippet.text}"</div>
                      {currentSnippet.comment && (
                        <div className="text-slate-400 text-xs mt-1 italic">— {currentSnippet.comment}</div>
                      )}
                    </div>
                    {/* Document Preview */}
                    <div className="bg-gray-900/50 rounded p-2 text-xs text-slate-500 border border-gray-700">
                      <span className="text-slate-600">Document format: </span>
                      <span className="text-amber-300/70">"...{currentSnippet.text.slice(0, 50)}..."</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'bullet' && (
          <div className="space-y-2" data-testid="bullet-content">
            {bullets.length === 0 ? (
              <div className="text-slate-500 italic text-sm">No bullets. Create links to generate bullets.</div>
            ) : (
              <>
                {/* Record Navigation */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateBullet('prev')}
                      disabled={currentBulletIndex === 0}
                      className="h-6 w-6 p-0"
                      data-testid="bullet-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-400">
                      {currentBulletIndex + 1} / {bullets.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateBullet('next')}
                      disabled={currentBulletIndex === bullets.length - 1}
                      className="h-6 w-6 p-0"
                      data-testid="bullet-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Bullet Display */}
                {currentBullet && (
                  <div className="space-y-2">
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3" data-testid={`bullet-display-${currentBulletIndex}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                          {currentBullet.subject?.type || 'unknown'}
                        </Badge>
                        <span className="text-cyan-200 font-medium">{currentBullet.subject?.canonicalName || 'Unknown'}</span>
                        <span className="text-cyan-400">[{currentBullet.predicate}]</span>
                        <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                          {currentBullet.object?.type || 'unknown'}
                        </Badge>
                        <span className="text-cyan-200 font-medium">{currentBullet.object?.canonicalName || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {currentBullet.isRelationship && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500/50 text-orange-400">REL</Badge>
                        )}
                        {currentBullet.isAttribute && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-purple-500/50 text-purple-400">ATTR</Badge>
                        )}
                      </div>
                    </div>
                    {/* Document Preview */}
                    <div className="bg-gray-900/50 rounded p-2 text-xs text-slate-500 border border-gray-700">
                      <span className="text-slate-600">Document format: </span>
                      <span className="text-cyan-300/70">
                        {currentBullet.subject?.canonicalName} → [{currentBullet.predicate}] → {currentBullet.object?.canonicalName}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'node' && (
          <div className="space-y-2" data-testid="node-content">
            {/* Search + Expand */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search entities..."
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  className="h-7 text-xs bg-gray-900 border-gray-600"
                  data-testid="node-search"
                />
                <Search className="w-3 h-3 absolute right-2 top-2 text-slate-500" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setNodeExpanded(!nodeExpanded)}
                title={nodeExpanded ? 'Collapse' : 'Expand'}
                data-testid="node-expand"
              >
                {nodeExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </Button>
            </div>

            {/* Entity Table */}
            <div className={`${nodeExpanded ? 'max-h-[300px]' : 'max-h-[80px]'} overflow-y-auto border border-gray-700 rounded transition-all`}>
              <table className="w-full text-xs">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Name</th>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntities.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-2 py-2 text-slate-500 italic text-center">No entities</td>
                    </tr>
                  ) : (
                    filteredEntities.map((entity) => (
                      <tr key={entity.id} className="border-t border-gray-700 hover:bg-gray-700/50" data-testid={`node-row-${entity.id}`}>
                        <td className="px-2 py-1 text-green-300">{entity.name}</td>
                        <td className="px-2 py-1">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500/50 text-green-400">
                            {entity.entityType || entity.type}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'edge' && (
          <div className="space-y-2" data-testid="edge-content">
            {/* Search + Expand */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search edges..."
                  value={edgeSearch}
                  onChange={(e) => setEdgeSearch(e.target.value)}
                  className="h-7 text-xs bg-gray-900 border-gray-600"
                  data-testid="edge-search"
                />
                <Search className="w-3 h-3 absolute right-2 top-2 text-slate-500" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setEdgeExpanded(!edgeExpanded)}
                title={edgeExpanded ? 'Collapse' : 'Expand'}
                data-testid="edge-expand"
              >
                {edgeExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </Button>
            </div>

            {/* Edge Table */}
            <div className={`${edgeExpanded ? 'max-h-[300px]' : 'max-h-[80px]'} overflow-y-auto border border-gray-700 rounded transition-all`}>
              <table className="w-full text-xs">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Source</th>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Predicate</th>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Target</th>
                    <th className="text-left px-2 py-1 text-slate-400 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLinks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-slate-500 italic text-center">No edges</td>
                    </tr>
                  ) : (
                    filteredLinks.map((link) => (
                      <tr key={link.id} className="border-t border-gray-700 hover:bg-gray-700/50" data-testid={`edge-row-${link.id}`}>
                        <td className="px-2 py-1 text-slate-300 font-mono text-[10px]">{link.sourceId.slice(0, 8)}</td>
                        <td className="px-2 py-1 text-orange-300">{link.predicate}</td>
                        <td className="px-2 py-1 text-slate-300 font-mono text-[10px]">{link.targetId.slice(0, 8)}</td>
                        <td className="px-2 py-1">
                          {link.isRelationship && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 border-orange-500/50 text-orange-400">REL</Badge>
                          )}
                          {link.isAttribute && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 border-purple-500/50 text-purple-400">ATTR</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Output Footer - Formatted for copy-paste */}
      <div className="border-t border-gray-700 bg-gray-900/70 p-3" data-testid="output-footer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Output View</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] px-2"
            onClick={async () => {
              const outputEl = document.getElementById('output-content');
              if (outputEl) {
                const text = outputEl.innerText || outputEl.textContent || '';
                try {
                  await navigator.clipboard.writeText(text);
                } catch {
                  // Fallback for older browsers
                  const range = document.createRange();
                  range.selectNodeContents(outputEl);
                  const selection = window.getSelection();
                  selection?.removeAllRanges();
                  selection?.addRange(range);
                  document.execCommand('copy');
                  selection?.removeAllRanges();
                }
              }
            }}
            data-testid="copy-output"
          >
            Copy All
          </Button>
        </div>
        <div 
          id="output-content" 
          className={`bg-gray-950 border border-gray-700 rounded p-3 overflow-y-auto font-mono text-xs ${
            (activeTab === 'node' && outputNodeExpanded) || (activeTab === 'edge' && outputEdgeExpanded) 
              ? 'max-h-[450px]' 
              : 'max-h-[120px]'
          } transition-all`}
          data-testid="output-content"
        >
          {activeTab === 'snip' && (
            <div className="space-y-2">
              {snippets.length === 0 ? (
                <div className="text-slate-500 italic">No snippets to display</div>
              ) : (
                snippets.map((snippet, idx) => (
                  <div key={snippet.id || idx} className="text-slate-200" data-testid={`output-snip-${idx}`}>
                    <strong className="text-amber-300">({snippet.classification || cardClassification || 'UNCLASSIFIED'})</strong>{' '}
                    {snippet.text}
                    {snippet.comment && <em className="text-slate-400"> {snippet.comment}</em>}
                    {' '}<span className="text-slate-500">(source: {cardSourceReference || cardFileName})</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'bullet' && (
            <div className="space-y-2">
              {bullets.length === 0 ? (
                <div className="text-slate-500 italic">No bullets to display</div>
              ) : (
                bullets.map((bullet, idx) => (
                  <div key={bullet.linkId || idx} className="text-slate-200" data-testid={`output-bullet-${idx}`}>
                    <strong className="text-cyan-300">({bullet.classification || cardClassification || 'UNCLASSIFIED'})</strong>{' '}
                    {bullet.subject?.canonicalName || 'Unknown'}{' '}
                    <span className="text-orange-300">{bullet.predicate}</span>{' '}
                    {bullet.object?.canonicalName || 'Unknown'}
                    {' '}<span className="text-slate-500">(source: {cardSourceReference || cardFileName})</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'node' && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-2"
                  onClick={() => setOutputNodeExpanded(!outputNodeExpanded)}
                  title={outputNodeExpanded ? 'Collapse' : 'Expand'}
                  data-testid="output-node-expand"
                >
                  {outputNodeExpanded ? <Minimize2 className="w-3 h-3 mr-1" /> : <Maximize2 className="w-3 h-3 mr-1" />}
                  {outputNodeExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              <div className={`overflow-x-auto ${outputNodeExpanded ? 'max-h-[400px]' : 'max-h-[80px]'} overflow-y-auto transition-all`}>
                {filteredEntities.length === 0 ? (
                  <div className="text-slate-500 italic">No entities to display</div>
                ) : (
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left px-2 py-1 text-slate-400">Name</th>
                        <th className="text-left px-2 py-1 text-slate-400">Type</th>
                        <th className="text-left px-2 py-1 text-slate-400">Aliases</th>
                        <th className="text-left px-2 py-1 text-slate-400">Description</th>
                        <th className="text-left px-2 py-1 text-slate-400">Classification</th>
                        <th className="text-left px-2 py-1 text-slate-400">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntities.map((entity, idx) => (
                        <tr key={entity.id} className="border-b border-gray-800" data-testid={`output-node-${idx}`}>
                          <td className="px-2 py-1 text-green-300">{entity.name}</td>
                          <td className="px-2 py-1 text-slate-300">{entity.entityType || entity.type}</td>
                          <td className="px-2 py-1 text-slate-400">{entity.aliases?.join(', ') || '-'}</td>
                          <td className="px-2 py-1 text-slate-400">{entity.description || '-'}</td>
                          <td className="px-2 py-1 text-slate-400">{cardClassification || 'UNCLASSIFIED'}</td>
                          <td className="px-2 py-1 text-slate-500">{cardFileName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'edge' && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-2"
                  onClick={() => setOutputEdgeExpanded(!outputEdgeExpanded)}
                  title={outputEdgeExpanded ? 'Collapse' : 'Expand'}
                  data-testid="output-edge-expand"
                >
                  {outputEdgeExpanded ? <Minimize2 className="w-3 h-3 mr-1" /> : <Maximize2 className="w-3 h-3 mr-1" />}
                  {outputEdgeExpanded ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              <div className={`overflow-x-auto ${outputEdgeExpanded ? 'max-h-[400px]' : 'max-h-[80px]'} overflow-y-auto transition-all`}>
                {filteredLinks.length === 0 ? (
                  <div className="text-slate-500 italic">No edges to display</div>
                ) : (
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left px-2 py-1 text-slate-400">Source Name</th>
                        <th className="text-left px-2 py-1 text-slate-400">Source Type</th>
                        <th className="text-left px-2 py-1 text-slate-400">Predicate</th>
                        <th className="text-left px-2 py-1 text-slate-400">Target Name</th>
                        <th className="text-left px-2 py-1 text-slate-400">Target Type</th>
                        <th className="text-left px-2 py-1 text-slate-400">Link Type</th>
                        <th className="text-left px-2 py-1 text-slate-400">Direction</th>
                        <th className="text-left px-2 py-1 text-slate-400">Classification</th>
                        <th className="text-left px-2 py-1 text-slate-400">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((link, idx) => {
                        const sourceEntity = entities.find(e => e.id === link.sourceId);
                        const targetEntity = entities.find(e => e.id === link.targetId);
                        return (
                          <tr key={link.id} className="border-b border-gray-800" data-testid={`output-edge-${idx}`}>
                            <td className="px-2 py-1 text-green-300">{sourceEntity?.name || link.sourceId.slice(0, 8)}</td>
                            <td className="px-2 py-1 text-slate-400">{sourceEntity?.entityType || sourceEntity?.type || '-'}</td>
                            <td className="px-2 py-1 text-orange-300">{link.predicate}</td>
                            <td className="px-2 py-1 text-green-300">{targetEntity?.name || link.targetId.slice(0, 8)}</td>
                            <td className="px-2 py-1 text-slate-400">{targetEntity?.entityType || targetEntity?.type || '-'}</td>
                            <td className="px-2 py-1 text-slate-400">
                              {link.isRelationship ? 'REL' : ''}{link.isAttribute ? 'ATTR' : ''}{!link.isRelationship && !link.isAttribute ? '-' : ''}
                            </td>
                            <td className="px-2 py-1 text-slate-400">
                              {link.direction === 0 ? '→' : link.direction === 1 ? '←' : link.direction === 2 ? '↔' : '-'}
                            </td>
                            <td className="px-2 py-1 text-slate-400">{cardClassification || 'UNCLASSIFIED'}</td>
                            <td className="px-2 py-1 text-slate-500">{cardFileName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
