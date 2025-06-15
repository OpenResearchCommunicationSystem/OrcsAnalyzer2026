import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Maximize2, RefreshCw } from "lucide-react";
import { GraphData, Tag } from "@shared/schema";

interface GraphVisualizationProps {
  onNodeClick: (tag: Tag) => void;
}

export function GraphVisualization({ onNodeClick }: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: graphData, refetch } = useQuery<GraphData>({
    queryKey: ['/api/graph'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  useEffect(() => {
    if (graphData && svgRef.current) {
      renderGraph(graphData);
    }
  }, [graphData]);

  const renderGraph = (data: GraphData) => {
    const svg = svgRef.current;
    if (!svg) return;

    try {
      // Safely clear existing content
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }

      const width = svg.clientWidth || 400;
      const height = svg.clientHeight || 300;

      // Create a main group for all graph elements
      const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      mainGroup.setAttribute('class', 'graph-container');

      // Render edges first (so they appear behind nodes)
      data.edges.forEach((edge, index) => {
        const sourceNode = data.nodes.find(n => n.id === edge.source);
        const targetNode = data.nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          // Line
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', String(sourceNode.x || 100));
          line.setAttribute('y1', String(sourceNode.y || 100));
          line.setAttribute('x2', String(targetNode.x || 200));
          line.setAttribute('y2', String(targetNode.y || 150));
          line.setAttribute('stroke', '#F59E0B');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('class', `edge-${index}`);
          mainGroup.appendChild(line);

          // Edge label
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          const midX = ((sourceNode.x || 100) + (targetNode.x || 200)) / 2;
          const midY = ((sourceNode.y || 100) + (targetNode.y || 150)) / 2;
          text.setAttribute('x', String(midX));
          text.setAttribute('y', String(midY));
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', '#F59E0B');
          text.setAttribute('font-size', '10');
          text.setAttribute('class', `edge-label-${index}`);
          text.textContent = edge.label || 'related';
          mainGroup.appendChild(text);
        }
      });

      // Render nodes
      data.nodes.forEach((node, index) => {
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', `node-${index}`);
        nodeGroup.style.cursor = 'pointer';
        
        // Circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(node.x || 100 + (index * 80)));
        circle.setAttribute('cy', String(node.y || 100 + (index * 60)));
        circle.setAttribute('r', node.type === 'entity' ? '15' : '12');
        
        const color = node.type === 'entity' ? '#10B981' : 
                     node.type === 'relationship' ? '#F59E0B' :
                     node.type === 'attribute' ? '#8B5CF6' : '#06B6D4';
        
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '2');
        
        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(node.x || 100 + (index * 80)));
        text.setAttribute('y', String((node.y || 100 + (index * 60)) + 25));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#E5E7EB');
        text.setAttribute('font-size', '10');
        text.textContent = node.label || 'Unknown';
        
        nodeGroup.appendChild(circle);
        nodeGroup.appendChild(text);
        
        // Click handler
        nodeGroup.addEventListener('click', () => {
          const tag = tags.find(t => t.id === node.id);
          if (tag) {
            onNodeClick(tag);
          }
        });
        
        mainGroup.appendChild(nodeGroup);
      });

      // Add the main group to SVG
      svg.appendChild(mainGroup);
      
    } catch (error) {
      console.warn('Graph rendering error:', error);
      // Fallback: create a simple "error" text
      const errorText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      errorText.setAttribute('x', '50%');
      errorText.setAttribute('y', '50%');
      errorText.setAttribute('text-anchor', 'middle');
      errorText.setAttribute('fill', '#EF4444');
      errorText.setAttribute('font-size', '12');
      errorText.textContent = 'Graph render error';
      svg.appendChild(errorText);
    }
  };

  return (
    <div className="flex-1 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-200">Entity Relationships</h3>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Graph SVG Container */}
        <div className="h-64 border border-gray-700 rounded bg-gray-900 relative">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="absolute inset-0"
          >
            {!graphData?.nodes.length && (
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize="14"
              >
                No graph data available
              </text>
            )}
          </svg>
        </div>

        {/* Graph Legend */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-400">Entities</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <div className="w-6 h-0.5 bg-amber-500"></div>
            <span className="text-slate-400">Relationships</span>
          </div>
        </div>
      </div>
    </div>
  );
}
