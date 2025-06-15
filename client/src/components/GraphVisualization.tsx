import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw } from "lucide-react";
import { GraphData, Tag } from "@shared/schema";
import * as d3 from "d3";

interface GraphVisualizationProps {
  onNodeClick: (tag: Tag) => void;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  fx?: number | null;
  fy?: number | null;
}

interface D3Edge {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  label: string;
  type: string;
}

export function GraphVisualization({ onNodeClick }: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, undefined> | null>(null);

  const { data: graphData, refetch } = useQuery<GraphData>({
    queryKey: ['/api/graph'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  const renderGraph = (data: GraphData) => {
    const svg = d3.select(svgRef.current);
    if (!svg.node() || !data.nodes.length) return;

    // Clear existing content
    svg.selectAll("*").remove();

    const container = svg.node()!.getBoundingClientRect();
    const width = container.width;
    const height = container.height;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Create main group for zooming/panning
    const g = svg.append("g");

    // Convert data to D3 format
    const nodes: D3Node[] = data.nodes.map(d => ({
      id: d.id,
      label: d.label,
      type: d.type,
      x: d.x || width / 2,
      y: d.y || height / 2
    }));

    const links: D3Edge[] = data.edges.map(d => ({
      id: d.id,
      source: d.source,
      target: d.target,
      label: d.label,
      type: d.type
    }));

    // Create force simulation
    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force("link", d3.forceLink<D3Node, D3Edge>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25));

    simulationRef.current = simulation;

    // Create arrow markers for directed edges
    const defs = g.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#f59e0b")
      .style("stroke", "none");

    // Create links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Create link labels
    const linkLabels = g.append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(links)
      .enter().append("text")
      .attr("class", "link-label")
      .attr("fill", "#9CA3AF")
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text(d => d.label);

    // Create nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, D3Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add circles to nodes
    node.append("circle")
      .attr("r", 12)
      .attr("fill", d => {
        switch (d.type) {
          case 'entity': return "#10b981";
          case 'relationship': return "#f59e0b";
          case 'attribute': return "#8b5cf6";
          case 'comment': return "#06b6d4";
          default: return "#6b7280";
        }
      })
      .attr("stroke", "#374151")
      .attr("stroke-width", 2);

    // Add labels to nodes
    node.append("text")
      .attr("dx", 0)
      .attr("dy", 25)
      .attr("fill", "#E5E7EB")
      .attr("font-size", "10px")
      .attr("text-anchor", "middle")
      .text(d => d.label.length > 12 ? d.label.substring(0, 12) + "..." : d.label);

    // Add click handlers
    node.on("click", (event, d) => {
      const tag = tags.find(t => t.id === d.id);
      if (tag) onNodeClick(tag);
    });

    // Add hover effects
    node.on("mouseover", function(event, d) {
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", 15)
        .attr("stroke-width", 3);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", 12)
        .attr("stroke-width", 2);
    });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      linkLabels
        .attr("x", d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr("y", d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Store zoom and pan functions for toolbar buttons
    (svg.node() as any).zoomIn = () => {
      svg.transition().call(zoom.scaleBy, 1.5);
    };

    (svg.node() as any).zoomOut = () => {
      svg.transition().call(zoom.scaleBy, 1 / 1.5);
    };

    (svg.node() as any).resetView = () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
    };
  };

  useEffect(() => {
    if (graphData) {
      renderGraph(graphData);
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [graphData, tags]);

  const handleZoomIn = () => {
    const svg = svgRef.current as any;
    if (svg?.zoomIn) svg.zoomIn();
  };

  const handleZoomOut = () => {
    const svg = svgRef.current as any;
    if (svg?.zoomOut) svg.zoomOut();
  };

  const handleResetView = () => {
    const svg = svgRef.current as any;
    if (svg?.resetView) svg.resetView();
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
              onClick={handleZoomIn}
              className="text-slate-400 hover:text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="text-slate-400 hover:text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetView}
              className="text-slate-400 hover:text-slate-200"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
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

        {/* Graph Legend and Controls */}
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
            Drag nodes • Scroll to zoom • Click to select
          </div>
        </div>
      </div>
    </div>
  );
}