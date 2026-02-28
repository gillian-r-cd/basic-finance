/**
 * ConceptMap.tsx - Universal concept map / mind map component.
 * Props: nodes ({id, label}[]), edges ({source, target, label?}[]).
 * Renders a force-directed-style concept map using pure CSS positioning.
 * Nodes are clickable to highlight connections.
 */
import { useState, useMemo } from 'react';

interface ConceptNode {
  id: string;
  label: string;
}

interface ConceptEdge {
  source: string;
  target: string;
  label?: string;
}

interface Props {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export default function ConceptMap({ nodes = [], edges = [] }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const connectedIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedNode);
    for (const e of edges) {
      if (e.source === selectedNode) ids.add(e.target);
      if (e.target === selectedNode) ids.add(e.source);
    }
    return ids;
  }, [selectedNode, edges]);

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const count = nodes.length;
    if (count === 0) return pos;
    const centerX = 300;
    const centerY = 200;
    const radiusX = 220;
    const radiusY = 140;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      pos[n.id] = {
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
      };
    });
    return pos;
  }, [nodes]);

  if (!nodes.length) {
    return <div className="text-gray-500 text-sm italic p-4">No concept map data available.</div>;
  }

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#3c3c3c] p-4">
      <svg viewBox="0 0 600 400" className="w-full h-auto" style={{ maxHeight: 400 }}>
        {/* Edges */}
        {edges.map((e, idx) => {
          const from = positions[e.source];
          const to = positions[e.target];
          if (!from || !to) return null;
          const isHighlighted = selectedNode && (e.source === selectedNode || e.target === selectedNode);
          return (
            <g key={idx}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={isHighlighted ? '#60a5fa' : '#444'}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={selectedNode && !isHighlighted ? 0.2 : 0.8}
              />
              {e.label && (
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 6}
                  fill={isHighlighted ? '#93c5fd' : '#666'}
                  fontSize={9}
                  textAnchor="middle"
                  opacity={selectedNode && !isHighlighted ? 0.2 : 1}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const pos = positions[n.id];
          if (!pos) return null;
          const isSelected = selectedNode === n.id;
          const isConnected = connectedIds.has(n.id);
          const dimmed = selectedNode && !isConnected;

          return (
            <g
              key={n.id}
              onClick={() => setSelectedNode(isSelected ? null : n.id)}
              className="cursor-pointer"
              opacity={dimmed ? 0.25 : 1}
            >
              <circle
                cx={pos.x} cy={pos.y} r={24}
                fill={isSelected ? '#2563eb' : isConnected ? '#1e3a5f' : '#252526'}
                stroke={isSelected ? '#60a5fa' : isConnected ? '#3b82f6' : '#555'}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text
                x={pos.x} y={pos.y + 1}
                fill={isSelected || isConnected ? '#e0e7ff' : '#aaa'}
                fontSize={10}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight={isSelected ? 'bold' : 'normal'}
              >
                {n.label.length > 12 ? n.label.slice(0, 11) + '...' : n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedNode && (
        <div className="mt-2 text-xs text-blue-300 text-center">
          Click a node to see its connections. Click again to deselect.
        </div>
      )}
    </div>
  );
}
