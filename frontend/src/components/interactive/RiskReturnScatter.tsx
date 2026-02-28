/**
 * RiskReturnScatter.tsx - Scatter plot showing risk-return tradeoff across asset classes.
 * Props: assets (optional array of {name, risk, return}), uses preset data if not provided.
 * Lets learner see that higher return comes with higher risk (volatility).
 */
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface Asset {
  name: string;
  risk: number;      // annualized std dev as percentage
  return: number;     // annualized return as percentage
}

interface Props {
  assets?: Asset[];
}

const DEFAULT_ASSETS: Asset[] = [
  { name: 'Cash / Money Market', risk: 0.5, return: 2.0 },
  { name: 'Government Bonds', risk: 4.0, return: 4.5 },
  { name: 'Corporate Bonds', risk: 6.0, return: 5.5 },
  { name: 'Real Estate (REITs)', risk: 12.0, return: 8.0 },
  { name: 'US Large Cap (S&P 500)', risk: 15.0, return: 10.0 },
  { name: 'International Developed', risk: 17.0, return: 8.5 },
  { name: 'Emerging Markets', risk: 22.0, return: 11.0 },
  { name: 'Small Cap Growth', risk: 25.0, return: 12.0 },
  { name: 'Crypto (Bitcoin)', risk: 60.0, return: 25.0 },
];

const COLORS = [
  '#22c55e', '#3b82f6', '#6366f1', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

export default function RiskReturnScatter({ assets }: Props) {
  const data = (assets || DEFAULT_ASSETS).map((a, i) => ({
    ...a,
    x: a.risk,
    y: a.return,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="bg-[#1e1e1e] p-6 rounded-xl border border-[#3c3c3c] mt-4 w-full">
      <h3 className="text-lg font-semibold mb-2 text-blue-400">Risk vs Return: The Fundamental Tradeoff</h3>
      <p className="text-xs text-gray-400 mb-4">Each dot is an asset class. The further right, the more volatile (risky). The higher up, the higher the historical return.</p>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="x"
              name="Risk"
              stroke="#888"
              label={{ value: 'Risk (Volatility %)', position: 'insideBottom', offset: -15, fill: '#888', fontSize: 12 }}
              domain={[0, 'auto']}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Return"
              stroke="#888"
              label={{ value: 'Return (%)', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 12 }}
              domain={[0, 'auto']}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#666' }}
              contentStyle={{ backgroundColor: '#252526', borderColor: '#3c3c3c', borderRadius: '8px' }}
              itemStyle={{ color: '#ccc' }}
              formatter={(value: number, name: string) => {
                if (name === 'Risk') return [`${value.toFixed(1)}%`, 'Volatility'];
                if (name === 'Return') return [`${value.toFixed(1)}%`, 'Avg Return'];
                return [value, name];
              }}
              labelFormatter={() => ''}
            />
            <ReferenceLine
              segment={[{ x: 0, y: 2 }, { x: 65, y: 27 }]}
              stroke="#555"
              strokeDasharray="5 5"
              ifOverflow="extendDomain"
            />
            <Scatter data={data} nameKey="name">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} r={8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}

