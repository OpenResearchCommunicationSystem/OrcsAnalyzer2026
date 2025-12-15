import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Link2, MessageSquare, User, Building, MapPin, Phone, Calendar, Tag, Zap } from 'lucide-react';
import type { Entity, Bullet, Snippet, OrcsCard } from '@shared/schema';
import { useState } from 'react';

interface DossierData {
  entity: Entity;
  cards: string[];
  snippets: Snippet[];
  bullets: Bullet[];
  relationships: Bullet[];
  attributes: Bullet[];
}

const entityTypeIcons: Record<string, typeof User> = {
  person: User,
  org: Building,
  location: MapPin,
  selector: Phone,
  date: Calendar,
  event: Tag,
  object: Tag,
  concept: Tag,
};

const entityTypeColors: Record<string, string> = {
  person: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  org: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  location: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  selector: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  date: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  event: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  object: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  concept: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
};

export default function EntityDossier() {
  const [, params] = useRoute('/dossier/:entityId');
  const [, setLocation] = useLocation();
  const entityId = params?.entityId;

  const [showBullets, setShowBullets] = useState(true);
  const [showRelationships, setShowRelationships] = useState(true);
  const [showAttributes, setShowAttributes] = useState(true);
  const [showSnippets, setShowSnippets] = useState(true);
  const [showCards, setShowCards] = useState(true);

  const { data: dossier, isLoading, error } = useQuery<DossierData>({
    queryKey: ['/api/entities', entityId, 'dossier'],
    queryFn: async () => {
      if (!entityId) throw new Error('No entity ID');
      const response = await fetch(`/api/entities/${entityId}/dossier`);
      if (!response.ok) throw new Error('Failed to fetch dossier');
      return response.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-6" data-testid="dossier-loading">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dossier?.entity) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-6" data-testid="dossier-error">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to ORCS
          </Button>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <p className="text-red-400">Entity not found or failed to load dossier.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { entity, cards, snippets, bullets, relationships, attributes } = dossier;
  const EntityIcon = entityTypeIcons[entity.type] || Tag;
  const entityColor = entityTypeColors[entity.type] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6" data-testid="dossier-page">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="mb-4 hover:bg-gray-800"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to ORCS
        </Button>

        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg border ${entityColor}`}>
                <EntityIcon className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-2xl text-gray-100" data-testid="entity-name">
                  {entity.canonicalName}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={entityColor} data-testid="entity-type">
                    {entity.type}
                  </Badge>
                  {entity.displayName && entity.displayName !== entity.canonicalName && (
                    <span className="text-gray-400 text-sm">
                      (also: {entity.displayName})
                    </span>
                  )}
                </div>
                {entity.aliases && entity.aliases.length > 0 && (
                  <div className="text-gray-500 text-sm mt-1">
                    Aliases: {entity.aliases.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="bg-gray-700/50 rounded-lg p-3" data-testid="stat-cards">
                <div className="text-2xl font-bold text-blue-400">{cards.length}</div>
                <div className="text-xs text-gray-400">Cards</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3" data-testid="stat-relationships">
                <div className="text-2xl font-bold text-orange-400">{relationships.length}</div>
                <div className="text-xs text-gray-400">Relationships</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3" data-testid="stat-attributes">
                <div className="text-2xl font-bold text-purple-400">{attributes.length}</div>
                <div className="text-xs text-gray-400">Attributes</div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3" data-testid="stat-snippets">
                <div className="text-2xl font-bold text-amber-400">{snippets.length}</div>
                <div className="text-xs text-gray-400">Snippets</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Collapsible open={showRelationships} onOpenChange={setShowRelationships}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-gray-800" data-testid="toggle-relationships">
                {showRelationships ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Link2 className="w-4 h-4 text-orange-400" />
                <span>Relationships ({relationships.length})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="bg-gray-800 border-gray-700 mt-2">
                <CardContent className="p-4">
                  {relationships.length === 0 ? (
                    <p className="text-gray-500 italic">No relationships found</p>
                  ) : (
                    <div className="space-y-2">
                      {relationships.map((bullet, idx) => (
                        <div 
                          key={bullet.linkId || idx}
                          className="bg-orange-500/10 border border-orange-500/30 rounded p-3"
                          data-testid={`relationship-${bullet.linkId || idx}`}
                        >
                          <div className="text-orange-200">
                            <span className="font-medium">{bullet.subject?.canonicalName || 'Unknown'}</span>
                            <span className="mx-2 text-orange-400">[{bullet.predicate}]</span>
                            <span className="font-medium">{bullet.object?.canonicalName || 'Unknown'}</span>
                          </div>
                          {bullet.sourceCardName && (
                            <div className="text-gray-500 text-xs mt-1">
                              From: {bullet.sourceCardName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showAttributes} onOpenChange={setShowAttributes}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-gray-800" data-testid="toggle-attributes">
                {showAttributes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Tag className="w-4 h-4 text-purple-400" />
                <span>Attributes ({attributes.length})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="bg-gray-800 border-gray-700 mt-2">
                <CardContent className="p-4">
                  {attributes.length === 0 ? (
                    <p className="text-gray-500 italic">No attributes found</p>
                  ) : (
                    <div className="space-y-2">
                      {attributes.map((bullet, idx) => (
                        <div 
                          key={bullet.linkId || idx}
                          className="bg-purple-500/10 border border-purple-500/30 rounded p-3"
                          data-testid={`attribute-${bullet.linkId || idx}`}
                        >
                          <div className="text-purple-200">
                            <span className="font-medium">{bullet.subject?.canonicalName || 'Unknown'}</span>
                            <span className="mx-2 text-purple-400">[{bullet.predicate}]</span>
                            <span className="font-medium">{bullet.object?.canonicalName || 'Unknown'}</span>
                          </div>
                          {bullet.sourceCardName && (
                            <div className="text-gray-500 text-xs mt-1">
                              From: {bullet.sourceCardName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showBullets} onOpenChange={setShowBullets}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-gray-800" data-testid="toggle-all-bullets">
                {showBullets ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>All Bullets ({bullets.length})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="bg-gray-800 border-gray-700 mt-2">
                <CardContent className="p-4">
                  {bullets.length === 0 ? (
                    <p className="text-gray-500 italic">No bullets found</p>
                  ) : (
                    <div className="space-y-2">
                      {bullets.map((bullet, idx) => (
                        <div 
                          key={bullet.linkId || idx}
                          className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3"
                          data-testid={`bullet-${bullet.linkId || idx}`}
                        >
                          <div className="text-cyan-200">
                            <span className="font-medium">{bullet.subject?.canonicalName || 'Unknown'}</span>
                            <span className="mx-2 text-cyan-400">[{bullet.predicate}]</span>
                            <span className="font-medium">{bullet.object?.canonicalName || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {bullet.isRelationship && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-500/50 text-orange-400">REL</Badge>
                            )}
                            {bullet.isAttribute && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-500/50 text-purple-400">ATTR</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showSnippets} onOpenChange={setShowSnippets}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-gray-800" data-testid="toggle-snippets">
                {showSnippets ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>Snippets ({snippets.length})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="bg-gray-800 border-gray-700 mt-2">
                <CardContent className="p-4">
                  {snippets.length === 0 ? (
                    <p className="text-gray-500 italic">No snippets found</p>
                  ) : (
                    <div className="space-y-2">
                      {snippets.map((snippet, idx) => (
                        <div 
                          key={snippet.id || idx}
                          className="bg-amber-500/10 border border-amber-500/30 rounded p-3"
                          data-testid={`snippet-${snippet.id || idx}`}
                        >
                          <div className="text-amber-200 text-sm">"{snippet.text}"</div>
                          {snippet.comment && (
                            <div className="text-gray-400 text-xs mt-1 italic">
                              {snippet.comment}
                            </div>
                          )}
                          {snippet.analyst && (
                            <div className="text-gray-500 text-xs mt-1">
                              — {snippet.analyst}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={showCards} onOpenChange={setShowCards}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-gray-800" data-testid="toggle-cards">
                {showCards ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Source Cards ({cards.length})</span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="bg-gray-800 border-gray-700 mt-2">
                <CardContent className="p-4">
                  {cards.length === 0 ? (
                    <p className="text-gray-500 italic">No source cards found</p>
                  ) : (
                    <div className="space-y-2">
                      {cards.map((cardId, idx) => (
                        <div 
                          key={cardId}
                          className="bg-blue-500/10 border border-blue-500/30 rounded p-3 flex items-center gap-2"
                          data-testid={`card-${cardId}`}
                        >
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-mono text-sm">{cardId.slice(0, 8)}...</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
