/**
 * AssetAllocationPie.tsx - Interactive donut chart for portfolio allocation.
 * Props: allocations (optional array of {name, percentage, color}), editable (boolean).
 * Learner drags sliders to adjust allocation and sees expected return/risk change.
 */
import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Allocation {
  name: string;
  percentage: number;
  color: string;
  expectedReturn: number;   // annual %
  expectedRisk: number;     // annual std dev %
}

interface Props {
  allocations?: Allocation[];
  editable?: boolean;
}

const DEFAULT_ALLOCATIONS: Allocation[] = [
  { name: 'Stocks', percentage: 60, color: '#3b82f6', expectedReturn: 10, expectedRisk: 15 },
  { name: 'Bonds', percentage: 30, color: '#22c55e', expectedReturn: 4.5, expectedRisk: 5 },
  { name: 'Cash', percentage: 10, color: '#6b7280', expectedReturn: 2, expectedRisk: 0.5 },
];

export default function AssetAllocationPie({ allocations, editable = true }: Props) {
  const initial = (allocations || DEFAULT_ALLOCATIONS).map(a => ({ ...a }));
  const [allocs, setAllocs] = useState(initial);

  const handleChange = (index: number, newPct: number) => {
    const updated = allocs.map((a, i) => {
      if (i === index) return { ...a, percentage: newPct };
      return a;
    });
    // Normalize others proportionally
    const otherTotal = updated.reduce((s, a, i) => i === index ? s : s + a.percentage, 0);
    const remaining = 100 - newPct;
    if (otherTotal > 0) {
      const scale = remaining / otherTotal;
      for (let i = 0; i < updated.length; i++) {
        if (i !== index) {
          updated[i] = { ...updated[i], percentage: Math.max(0, Math.round(updated[i].percentage * scale)) };
        }
      }
    }
    // Fix rounding
    const total = updated.reduce((s, a) => s + a.percentage, 0);
    if (total !== 100 && updated.length > 0) {
      const lastOther = updated.findIndex((_, i) => i !== index);
      if (lastOther >= 0) {
        updated[lastOther] = { ...updated[lastOther], percentage: updated[lastOther].percentage + (100 - total) };
      }
    }
    setAllocs(updated);
  };

  const portfolio = useMemo(() => {
    const expReturn = allocs.reduce((s, a) => s + (a.expectedReturn * a.percentage / 100), 0);
    const expRisk = allocs.reduce((s, a) => s + (a.expectedRisk * a.percentage / 100), 0);
    return { expReturn: expReturn.toFixed(1), expRisk: expRisk.toFixed(1) };
  }, [allocs]);

  const pieData = allocs.filter(a => a.percentage > 0);

  return (
    <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#3c3c3c] mt-4 w-full">
      <h3 className="text-lg font-semibold mb-2 text-blue-400">Portfolio Asset Allocation</h3>
      <p className="text-xs text-gray-400 mb-4">
        {editable ? 'Drag the sliders to change your allocation and see how it affects expected risk and return.' : 'Current portfolio allocation.'}
      </p>

      <div className="flex gap-8 items-start">
        {/* Pie chart */}
        <div className="w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="percentage"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#252526', borderColor: '#333', borderRadius: '8px' }}
                formatter={(value: number) => [`${value}%`, 'Allocation']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sliders */}
        <div className="flex-1 space-y-4">
          {allocs.map((a, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: a.color }} />
                  {a.name}
                </span>
                <span className="text-gray-400 font-mono">{a.percentage}%</span>
              </div>
              {editable && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={a.percentage}
                  onChange={e => handleChange(i, parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio stats */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="bg-[#2a2a2a] p-3 rounded text-center">
          <div className="text-xs text-gray-400">Expected Annual Return</div>
          <div className="text-lg font-bold text-green-400">{portfolio.expReturn}%</div>
        </div>
        <div className="bg-[#2a2a2a] p-3 rounded text-center">
          <div className="text-xs text-gray-400">Expected Volatility</div>
          <div className="text-lg font-bold text-yellow-400">{portfolio.expRisk}%</div>
        </div>
      </div>
    </div>
  );
}

