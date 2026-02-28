/**
 * InflationTimeline.tsx - Line chart showing inflation eroding purchasing power over time.
 * Props: initialValue, inflationRate (default), years.
 * Learner drags a slider to adjust inflation rate and see purchasing power shrink.
 */
import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  initialValue?: number;
  inflationRate?: number;
  years?: number;
}

export default function InflationTimeline({
  initialValue = 10000,
  inflationRate = 0.03,
  years = 30,
}: Props) {
  const [rate, setRate] = useState(inflationRate);

  const data = useMemo(() => {
    const arr = [];
    for (let y = 0; y <= years; y++) {
      const realValue = initialValue / Math.pow(1 + rate, y);
      arr.push({
        year: y,
        nominal: initialValue,
        real: Math.round(realValue),
      });
    }
    return arr;
  }, [initialValue, rate, years]);

  const finalReal = data[data.length - 1].real;
  const lostPercentage = ((1 - finalReal / initialValue) * 100).toFixed(0);

  return (
    <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#3c3c3c] mt-4 w-full">
      <h3 className="text-lg font-semibold mb-2 text-blue-400">Inflation: The Silent Thief</h3>
      <p className="text-xs text-gray-400 mb-4">
        Your ${initialValue.toLocaleString()} stays the same number on paper, but buys less every year.
      </p>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Annual Inflation Rate: {(rate * 100).toFixed(1)}%
        </label>
        <input
          type="range"
          min="0.01"
          max="0.10"
          step="0.005"
          value={rate}
          onChange={e => setRate(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1% (low)</span>
          <span>10% (high)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#2a2a2a] p-3 rounded text-center">
          <div className="text-xs text-gray-400">Nominal Value (unchanged)</div>
          <div className="text-lg font-bold text-gray-300">${initialValue.toLocaleString()}</div>
        </div>
        <div className="bg-[#2a2a2a] p-3 rounded text-center">
          <div className="text-xs text-gray-400">Real Purchasing Power (Year {years})</div>
          <div className="text-lg font-bold text-red-400">${finalReal.toLocaleString()}</div>
          <div className="text-xs text-red-500 mt-1">Lost {lostPercentage}% of value</div>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="year"
              stroke="#888"
              tick={{ fill: '#888', fontSize: 12 }}
              label={{ value: 'Years', position: 'insideBottomRight', offset: -10, fill: '#888' }}
            />
            <YAxis
              stroke="#888"
              tick={{ fill: '#888', fontSize: 12 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              domain={[0, initialValue * 1.1]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#252526', borderColor: '#333', borderRadius: '8px' }}
              formatter={(value: number, name: string) => {
                const label = name === 'nominal' ? 'Nominal' : 'Real Value';
                return [`$${value.toLocaleString()}`, label];
              }}
              labelFormatter={label => `Year ${label}`}
            />
            <ReferenceLine y={initialValue / 2} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '50% lost', fill: '#ef4444', fontSize: 10, position: 'right' }} />
            <Area type="monotone" dataKey="nominal" stroke="#6b7280" fill="#6b7280" fillOpacity={0.1} strokeDasharray="5 5" />
            <Area type="monotone" dataKey="real" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-gray-500 text-center mt-2">
        The gap between the dashed line (nominal) and the red area (real) is the wealth quietly stolen by inflation.
      </div>
    </div>
  );
}

