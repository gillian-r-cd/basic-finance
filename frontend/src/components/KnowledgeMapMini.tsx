/**
 * KnowledgeMapMini.tsx - Compact knowledge map for the LearnSession sidebar.
 * Shows nodes as small colored dots in a simple SVG layout.
 * Highlights the current unit's position in the knowledge network.
 * Props: knowledgeMap, currentUnitTopic (to highlight related nodes).
 */
import { useMemo } from 'react';

interface KMNode {
  id: string;
  label: string;
  status: string;
}

interface KMEdge {
  from: string;
  to: string;
}

interface Props {
  knowledgeMap: { nodes: KMNode[]; edges: KMEdge[] } | null;
  currentUnitTopic?: string;
}

const STATUS_FILL: Record<string, string> = {
  on_path: '#3b82f6',
  contextual: '#ca8a04',
  excluded: '#4b5563',
};

export default function KnowledgeMapMini({ knowledgeMap, currentUnitTopic }: Props) {
  const positions = useMemo(() => {
    if (!knowledgeMap?.nodes) return {};
    const pos: Record<string, { x: number; y: number }> = {};
    const count = knowledgeMap.nodes.length;
    const cx = 100, cy = 80, rx = 70, ry = 55;
    knowledgeMap.nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      pos[n.id] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
    });
    return pos;
  }, [knowledgeMap]);

  if (!knowledgeMap?.nodes?.length) return null;

  const topicLower = (currentUnitTopic || '').toLowerCase();

  return (
    <div className="bg-[#1e1e1e] rounded border border-[#333] p-2">
      <svg viewBox="0 0 200 160" className="w-full h-auto">
        {knowledgeMap.edges.map((e, idx) => {
          const from = positions[e.from];
          const to = positions[e.to];
          if (!from || !to) return null;
          return (
            <line key={idx} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#3c3c3c" strokeWidth={0.8} />
          );
        })}
        {knowledgeMap.nodes.map((n) => {
          const pos = positions[n.id];
          if (!pos) return null;
          const isCurrent = topicLower && n.label.toLowerCase().includes(topicLower.slice(0, 8));
          return (
            <g key={n.id}>
              <circle cx={pos.x} cy={pos.y}
                r={isCurrent ? 7 : 5}
                fill={STATUS_FILL[n.status] || '#4b5563'}
                stroke={isCurrent ? '#60a5fa' : 'none'}
                strokeWidth={isCurrent ? 2 : 0}
                opacity={n.status === 'excluded' ? 0.4 : 1}
              />
              {isCurrent && (
                <circle cx={pos.x} cy={pos.y} r={11}
                  fill="none" stroke="#60a5fa" strokeWidth={1} opacity={0.4} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-3 text-[9px] text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} /> Path
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ca8a04' }} /> Context
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full opacity-50" style={{ background: '#4b5563' }} /> Out
        </span>
      </div>
    </div>
  );
}
