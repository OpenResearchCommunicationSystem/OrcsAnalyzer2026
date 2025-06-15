import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw } from "lucide-react";
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

  const renderGraph = (data: GraphData) => {
    const svg = svgRef.current;
    if (!svg || !data?.nodes?.length) return;

    // Clear existing content
    svg.innerHTML = '';

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 400;

    // Create SVG groups
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(g);

    // Draw edges
    data.edges.forEach(edge => {
      const sourceNode = data.nodes.find(n => n.id === edge.source);
      const targetNode = data.nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", (sourceNode.x || 100).toString());
        line.setAttribute("y1", (sourceNode.y || 100).toString());
        line.setAttribute("x2", (targetNode.x || 200).toString());
        line.setAttribute("y2", (targetNode.y || 200).toString());
        line.setAttribute("stroke", "#f59e0b");
        line.setAttribute("stroke-width", "2");
        g.appendChild(line);

        // Add edge label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const midX = ((sourceNode.x || 100) + (targetNode.x || 200)) / 2;
        const midY = ((sourceNode.y || 100) + (targetNode.y || 200)) / 2;
        text.setAttribute("x", midX.toString());
        text.setAttribute("y", midY.toString());
        text.setAttribute("fill", "#9CA3AF");
        text.setAttribute("font-size", "10");
        text.setAttribute("text-anchor", "middle");
        text.textContent = edge.label;
        g.appendChild(text);
      }
    });

    // Draw nodes
    data.nodes.forEach((node, index) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const x = node.x || (100 + index * 150);
      const y = node.y || (100 + (index % 3) * 100);
      
      circle.setAttribute("cx", x.toString());
      circle.setAttribute("cy", y.toString());
      circle.setAttribute("r", "12");
      circle.setAttribute("fill", node.type === 'entity' ? "#10b981" : 
                          node.type === 'relationship' ? "#f59e0b" : "#8b5cf6");
      circle.setAttribute("stroke", "#374151");
      circle.setAttribute("stroke-width", "2");
      circle.style.cursor = "pointer";
      
      circle.addEventListener('click', () => {
        const tag = tags.find(t => t.id === node.id);
        if (tag) onNodeClick(tag);
      });
      
      g.appendChild(circle);

      // Add node label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x.toString());
      text.setAttribute("y", (y + 25).toString());
      text.setAttribute("fill", "#E5E7EB");
      text.setAttribute("font-size", "10");
      text.setAttribute("text-anchor", "middle");
      text.textContent = node.label.length > 12 ? node.label.substring(0, 12) + "..." : node.label;
      g.appendChild(text);
    });
  };

  useEffect(() => {
    if (graphData) {
      renderGraph(graphData);
    }
  }, [graphData, tags]);

  return (
    <div className="flex-1 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-200">Entity Relationships</h3>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Graph SVG Container */}
        <div className="h-96 border border-gray-700 rounded bg-gray-900 relative overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="absolute inset-0"
            viewBox="0 0 800 400"
          >
            {!graphData?.nodes?.length && (
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
        <div className="mt-4 flex justify-between items-center">
          <div className="flex space-x-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-400">Entities</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-slate-400">Relationships</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-slate-400">Attributes</span>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Click nodes to select
          </div>
        </div>
      </div>
    </div>
  );
}