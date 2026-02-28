import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Props {
  initialPrincipal?: number;
  rateRange?: [number, number];
  yearsRange?: [number, number];
}

export default function CompoundInterestChart({
  initialPrincipal = 10000,
  rateRange = [0.01, 0.15],
  yearsRange = [1, 40]
}: Props) {
  const [rate, setRate] = useState(0.05); // Default 5%
  const [years, setYears] = useState(20);

  const data = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= years; i++) {
      const compound = initialPrincipal * Math.pow(1 + rate, i);
      const simple = initialPrincipal + (initialPrincipal * rate * i);
      arr.push({
        year: i,
        Compound: Math.round(compound),
        Simple: Math.round(simple),
        Principal: initialPrincipal
      });
    }
    return arr;
  }, [initialPrincipal, rate, years]);

  return (
    <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#3c3c3c] mt-4 w-full">
      <h3 className="text-lg font-semibold mb-4 text-blue-400">Compound Interest vs Simple Interest</h3>
      
      <div className="flex gap-8 mb-6">
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-2">
            Annual Return Rate: {(rate * 100).toFixed(1)}%
          </label>
          <input 
            type="range" 
            min={rateRange[0]} 
            max={rateRange[1]} 
            step="0.005"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-2">
            Time Horizon: {years} Years
          </label>
          <input 
            type="range" 
            min={yearsRange[0]} 
            max={yearsRange[1]} 
            step="1"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="year" stroke="#888" label={{ value: 'Years', position: 'insideBottomRight', offset: -10, fill: '#888' }} />
            <YAxis stroke="#888" tickFormatter={(val) => `$${val/1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#252526', borderColor: '#3c3c3c', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number | undefined) => [value !== undefined ? `$${value.toLocaleString()}` : '', undefined]}
              labelFormatter={(label) => `Year ${label}`}
            />
            <Legend />
            <Line type="monotone" dataKey="Compound" stroke="#3b82f6" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Simple" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="Principal" stroke="#6b7280" strokeWidth={1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

