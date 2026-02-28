/**
 * KnowledgeMapView.tsx - Full knowledge network graph using React Flow + dagre layout.
 * Displays knowledge_map nodes with color-coding by status (on_path/contextual/excluded).
 * Click a node to see its brief description and connections.
 * Props: knowledgeMap (from plan API), currentUnitId? (optional, highlights current position).
 */
import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

interface KMNode {
  id: string;
  label: string;
  status: string;
  brief?: string;
  exclusion_reason?: string;
}

interface KMEdge {
  from: string;
  to: string;
  relation?: string;
}

interface KnowledgeMap {
  nodes: KMNode[];
  edges: KMEdge[];
}

interface Props {
  knowledgeMap: KnowledgeMap | null;
  currentUnitId?: string;
  planPath?: Array<{ unit_id: string; topic: string }>;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  on_path:    { bg: '#1e3a5f', border: '#3b82f6', text: '#bfdbfe' },
  contextual: { bg: '#2d2a1a', border: '#ca8a04', text: '#fde68a' },
  excluded:   { bg: '#2a1a1a', border: '#6b7280', text: '#9ca3af' },
};

function KMNodeComponent({ data }: { data: Record<string, unknown> }) {
  const status = (data.status as string) || 'on_path';
  const colors = STATUS_COLORS[status] || STATUS_COLORS.on_path;
  const isHighlighted = data.highlighted as boolean;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 6, height: 6 }} />
      <div
        style={{
          background: colors.bg,
          border: `2px solid ${isHighlighted ? '#60a5fa' : colors.border}`,
          borderRadius: 8,
          padding: '8px 12px',
          minWidth: 100,
          textAlign: 'center',
          boxShadow: isHighlighted ? '0 0 12px rgba(96,165,250,0.4)' : 'none',
        }}
      >
        <div style={{ color: colors.text, fontSize: 11, fontWeight: 600 }}>
          {data.label as string}
        </div>
        <div style={{ color: '#888', fontSize: 9, marginTop: 2 }}>
          {status}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 6, height: 6 }} />
    </>
  );
}

const nodeTypes: NodeTypes = { kmNode: KMNodeComponent };

function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 140, height: 60 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 70, y: pos.y - 30 },
    };
  });
}

export default function KnowledgeMapView({ knowledgeMap, currentUnitId, planPath }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const unitNodeIds = useMemo(() => {
    if (!planPath) return new Set<string>();
    return new Set(planPath.map(u => u.unit_id));
  }, [planPath]);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!knowledgeMap || !knowledgeMap.nodes) return { flowNodes: [], flowEdges: [] };

    const rawNodes: Node[] = knowledgeMap.nodes.map((n) => ({
      id: n.id,
      type: 'kmNode',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        status: n.status,
        brief: n.brief || '',
        exclusion_reason: n.exclusion_reason || '',
        highlighted: n.id === selectedNodeId,
      },
    }));

    const rawEdges: Edge[] = knowledgeMap.edges.map((e, idx) => ({
      id: `e-${idx}`,
      source: e.from,
      target: e.to,
      label: e.relation || '',
      style: { stroke: '#555', strokeWidth: 1.5 },
      labelStyle: { fill: '#888', fontSize: 9 },
      animated: false,
    }));

    const laid = layoutGraph(rawNodes, rawEdges);
    return { flowNodes: laid, flowEdges: rawEdges };
  }, [knowledgeMap, selectedNodeId]);

  const selectedDetail = useMemo(() => {
    if (!selectedNodeId || !knowledgeMap) return null;
    return knowledgeMap.nodes.find(n => n.id === selectedNodeId);
  }, [selectedNodeId, knowledgeMap]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
  }, []);

  if (!knowledgeMap || !knowledgeMap.nodes || knowledgeMap.nodes.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic p-4">
        No knowledge map data available for this plan.
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#3c3c3c] overflow-hidden">
      <div style={{ height: 420 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#333" gap={20} />
          <Controls
            style={{ background: '#252526', border: '1px solid #3c3c3c', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-[#3c3c3c] text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#1e3a5f', border: '1px solid #3b82f6' }} />
          On Path
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#2d2a1a', border: '1px solid #ca8a04' }} />
          Contextual
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded" style={{ background: '#2a1a1a', border: '1px solid #6b7280' }} />
          Excluded
        </div>
      </div>

      {/* Node detail panel */}
      {selectedDetail && (
        <div className="px-4 py-3 border-t border-[#3c3c3c] bg-[#252526]">
          <h4 className="text-sm font-semibold text-blue-300">{selectedDetail.label}</h4>
          <p className="text-xs text-gray-400 mt-1">{selectedDetail.brief}</p>
          {selectedDetail.exclusion_reason && (
            <p className="text-xs text-amber-400 mt-1 italic">
              Excluded: {selectedDetail.exclusion_reason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
