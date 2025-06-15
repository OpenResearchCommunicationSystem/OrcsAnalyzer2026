import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZoomIn, ZoomOut, RotateCcw, RefreshCw, Maximize2 } from "lucide-react";
import { GraphData, Tag } from "@shared/schema";
import * as d3 from "d3";

interface GraphVisualizationProps {
  onNodeClick: (tag: Tag) => void;
}

type LayoutType = 'force' | 'hierarchy' | 'radial' | 'grid' | 'circular';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  id: string;
  label: string;
  type: string;
}

export function GraphVisualization({ onNodeClick }: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, undefined> | null>(null);
  const [layout, setLayout] = useState<LayoutType>('force');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: graphData, refetch } = useQuery<GraphData>({
    queryKey: ['/api/graph'],
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  const renderGraph = (data: GraphData, layoutType: LayoutType) => {
    if (!svgRef.current || !data?.nodes?.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svg.node()!.getBoundingClientRect();
    const width = container.width || 800;
    const height = container.height || 600;

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create main group for zooming/panning
    const g = svg.append("g");

    // Convert data to D3 format
    const nodes: D3Node[] = data.nodes.map(d => ({
      id: d.id,
      label: d.label,
      type: d.type,
    }));

    const links: D3Link[] = data.edges.map(d => ({
      id: d.id,
      source: d.source,
      target: d.target,
      label: d.label,
      type: d.type
    }));

    // Apply layout-specific positioning
    switch (layoutType) {
      case 'hierarchy':
        applyHierarchyLayout(nodes, links, width, height);
        break;
      case 'radial':
        applyRadialLayout(nodes, links, width, height);
        break;
      case 'grid':
        applyGridLayout(nodes, width, height);
        break;
      case 'circular':
        applyCircularLayout(nodes, width, height);
        break;
      default:
        // Force layout will be applied by simulation
        break;
    }

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
      .attr("marker-end", "url(#arrowhead)")
      .attr("opacity", 0.8);

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

    // Create node groups
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Add circles to nodes
    node.append("circle")
      .attr("r", d => d.type === 'entity' ? 15 : 12)
      .attr("fill", d => {
        switch (d.type) {
          case 'entity': return "#10b981";
          case 'relationship': return "#f59e0b";
          case 'attribute': return "#8b5cf6";
          case 'comment': return "#06b6d4";
          case 'kv_pair': return "#ef4444";
          default: return "#6b7280";
        }
      })
      .attr("stroke", "#374151")
      .attr("stroke-width", 2);

    // Add labels to nodes
    node.append("text")
      .attr("dx", 0)
      .attr("dy", d => d.type === 'entity' ? 30 : 25)
      .attr("fill", "#E5E7EB")
      .attr("font-size", "11px")
      .attr("text-anchor", "middle")
      .attr("font-weight", d => d.type === 'entity' ? "bold" : "normal")
      .text(d => d.label.length > 15 ? d.label.substring(0, 15) + "..." : d.label);

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
        .attr("r", d => (d.type === 'entity' ? 18 : 15))
        .attr("stroke-width", 3);
      
      // Highlight connected links
      link.style("opacity", l => {
        const isConnected = (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id;
        return isConnected ? 1 : 0.3;
      });
    })
    .on("mouseout", function(event, d) {
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", d => d.type === 'entity' ? 15 : 12)
        .attr("stroke-width", 2);
      
      // Reset link opacity
      link.style("opacity", 0.8);
    });

    if (layoutType === 'force') {
      // Create force simulation for dynamic layout
      const simulation = d3.forceSimulation<D3Node>(nodes)
        .force("link", d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25));

      simulationRef.current = simulation;

      // Add drag behavior for force layout
      node.call(d3.drag<SVGGElement, D3Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

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

        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any, d: D3Node) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event: any, d: D3Node) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: any, d: D3Node) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    } else {
      // For static layouts, position elements immediately
      node.attr("transform", d => `translate(${d.x},${d.y})`);
      
      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      linkLabels
        .attr("x", d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr("y", d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2);
    }

    // Store zoom functions for toolbar buttons
    (svg.node() as any).zoomIn = () => {
      svg.transition().call(zoom.scaleBy as any, 1.5);
    };

    (svg.node() as any).zoomOut = () => {
      svg.transition().call(zoom.scaleBy as any, 1 / 1.5);
    };

    (svg.node() as any).resetView = () => {
      svg.transition().call(zoom.transform as any, d3.zoomIdentity);
    };
  };

  // Layout algorithms
  const applyHierarchyLayout = (nodes: D3Node[], links: D3Link[], width: number, height: number) => {
    // Create hierarchy based on node types and connections
    const entities = nodes.filter(n => n.type === 'entity');
    const relationships = nodes.filter(n => n.type === 'relationship');
    const others = nodes.filter(n => !['entity', 'relationship'].includes(n.type));

    // Position entities at top
    entities.forEach((node, i) => {
      node.x = (width / (entities.length + 1)) * (i + 1);
      node.y = height * 0.2;
    });

    // Position relationships in middle
    relationships.forEach((node, i) => {
      node.x = (width / (relationships.length + 1)) * (i + 1);
      node.y = height * 0.5;
    });

    // Position others at bottom
    others.forEach((node, i) => {
      node.x = (width / (others.length + 1)) * (i + 1);
      node.y = height * 0.8;
    });
  };

  const applyRadialLayout = (nodes: D3Node[], links: D3Link[], width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Find central node (most connected)
    const connectionCount = new Map<string, number>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
      connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
    });

    const centralNode = nodes.reduce((max, node) => 
      (connectionCount.get(node.id) || 0) > (connectionCount.get(max.id) || 0) ? node : max
    );

    // Position central node at center
    centralNode.x = centerX;
    centralNode.y = centerY;

    // Position other nodes in concentric circles
    const otherNodes = nodes.filter(n => n.id !== centralNode.id);
    otherNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / otherNodes.length;
      const nodeRadius = radius + (Math.random() * 50 - 25); // Add some variation
      node.x = centerX + Math.cos(angle) * nodeRadius;
      node.y = centerY + Math.sin(angle) * nodeRadius;
    });
  };

  const applyGridLayout = (nodes: D3Node[], width: number, height: number) => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      node.x = cellWidth * (col + 0.5);
      node.y = cellHeight * (row + 0.5);
    });
  };

  const applyCircularLayout = (nodes: D3Node[], width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });
  };

  useEffect(() => {
    if (graphData) {
      renderGraph(graphData, layout);
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [graphData, tags, layout]);

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

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : 'flex-1'} p-4`}>
      <div className="bg-gray-800 rounded-lg border border-gray-700 h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-200">Entity Relationships</h3>
          <div className="flex items-center space-x-2">
            <Select value={layout} onValueChange={(value: LayoutType) => setLayout(value)}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="force">Force</SelectItem>
                <SelectItem value="hierarchy">Hierarchy</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="circular">Circular</SelectItem>
              </SelectContent>
            </Select>
            
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
              onClick={toggleFullscreen}
              className="text-slate-400 hover:text-slate-200"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
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
        <div className={`${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-96'} border border-gray-700 rounded bg-gray-900 relative overflow-hidden`}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
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
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
              <span className="text-slate-400">Comments</span>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            {layout === 'force' ? 'Drag nodes • ' : ''}Mouse wheel zoom • Click to select
          </div>
        </div>
      </div>
    </div>
  );
}