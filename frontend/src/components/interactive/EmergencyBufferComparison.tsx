import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface EmergencyBufferProps {
  initialPortfolio?: number;
  marketDrop?: number;
  emergencyNeed?: number;
}

export function EmergencyBufferComparison({ 
  initialPortfolio = 20000, 
  marketDrop = 0.3, 
  emergencyNeed = 3000 
}: EmergencyBufferProps) {
  const [bufferMonths, setBufferMonths] = useState(6);
  const monthlyExpense = emergencyNeed / 6; // Assume emergencyNeed is for 6 months
  
  // Calculate scenarios based on buffer size
  const actualBufferAvailable = bufferMonths * monthlyExpense;
  const shortfall = Math.max(0, emergencyNeed - actualBufferAvailable);
  
  // Scenario A: Forced selling
  // If shortfall > 0, we sell from portfolio at the bottom
  const portfolioAtBottom = initialPortfolio * (1 - marketDrop);
  const portfolioAfterForcedSell = portfolioAtBottom - shortfall;
  // Let's assume market recovers 50% from the bottom over the next 5 years
  const finalPortfolioNoBuffer = portfolioAfterForcedSell * 1.5;

  // Scenario B: Full buffer (6 months)
  const finalPortfolioWithBuffer = (initialPortfolio * (1 - marketDrop)) * 1.5;

  // Data for chart
  const data = [];
  for (let year = 0; year <= 5; year++) {
    // simplified curve: drops at year 1, recovers linearly to year 5
    if (year === 0) {
      data.push({ year, "No Buffer": initialPortfolio, "With Buffer": initialPortfolio });
    } else if (year === 1) {
      data.push({ year, "No Buffer": portfolioAfterForcedSell, "With Buffer": portfolioAtBottom });
    } else {
      const recoveryProgress = (year - 1) / 4;
      const valNoBuffer = portfolioAfterForcedSell + (finalPortfolioNoBuffer - portfolioAfterForcedSell) * recoveryProgress;
      const valWithBuffer = portfolioAtBottom + (finalPortfolioWithBuffer - portfolioAtBottom) * recoveryProgress;
      data.push({ year, "No Buffer": valNoBuffer, "With Buffer": valWithBuffer });
    }
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '';
    return `$${(value / 1000).toFixed(1)}k`;
  };

  return (
    <div className="w-full bg-[#1e1e1e] p-6 rounded-xl border border-[#333]">
      <h3 className="text-lg font-semibold text-blue-400 mb-6">Emergency Buffer vs Forced Selling</h3>
      
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Emergency Buffer Available: {bufferMonths} Months (${Math.round(actualBufferAvailable)})
          </label>
          <input 
            type="range" 
            min="0" 
            max="12" 
            step="1"
            value={bufferMonths}
            onChange={(e) => setBufferMonths(Number(e.target.value))}
            className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 Months (No safety net)</span>
            <span>12 Months (Very safe)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#2a2a2a] p-3 rounded text-center">
          <div className="text-xs text-gray-400">Final Wealth (Year 5)</div>
          <div className={`text-lg font-bold ${shortfall > 0 ? 'text-red-400' : 'text-green-400'}`}>
            ${Math.round(data[5]["No Buffer"]).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Your actual outcome</div>
        </div>
        <div className="bg-[#2a2a2a] p-3 rounded text-center opacity-70">
          <div className="text-xs text-gray-400">Ideal Outcome (Full Buffer)</div>
          <div className="text-lg font-bold text-gray-300">
            ${Math.round(data[5]["With Buffer"]).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">If you didn't sell</div>
        </div>
      </div>

      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis 
              dataKey="year" 
              stroke="#666" 
              tick={{fill: '#888', fontSize: 12}}
              tickFormatter={(val) => `Yr ${val}`}
            />
            <YAxis 
              stroke="#666" 
              tick={{fill: '#888', fontSize: 12}}
              tickFormatter={formatCurrency}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#252526', borderColor: '#333', borderRadius: '8px' }}
              itemStyle={{ color: '#ccc' }}
              formatter={(value: number) => [`$${Math.round(value).toLocaleString()}`, undefined]}
            />
            <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Crisis', fill: '#ef4444', fontSize: 10 }} />
            <Area 
              type="monotone" 
              dataKey="With Buffer" 
              stroke="#22c55e" 
              fill="#22c55e" 
              fillOpacity={0.1} 
              strokeDasharray="5 5"
            />
            <Area 
              type="monotone" 
              dataKey="No Buffer" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        Notice how a lack of buffer forces you to sell at the bottom (Year 1), permanently impairing the recovery slope.
      </div>
    </div>
  );
}
