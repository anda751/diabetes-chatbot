import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function CustomDot({ cx, cy, value, color }) {
  if (!cx || !cy) return null;

  if (value > 140) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill={color} opacity="0.2">
          <animate attributeName="r" from="8" to="16" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={3} />
      </g>
    );
  }

  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />;
}

function CustomTooltip({ active, payload, label }) {
  if (!(active && payload && payload.length)) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md">
      <p className="mb-2 border-b border-white/10 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-3 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <p className="text-sm font-bold">
            {entry.name}:{' '}
            <span className={entry.value > 140 ? 'text-red-400' : 'text-indigo-300'}>
              {entry.value}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyReportChart({ chartData }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#F1F5F9" />
        <XAxis
          dataKey="displayLabel"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          domain={['dataMin - 20', 'dataMax + 20']}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={140} stroke="#FDA4AF" strokeDasharray="3 3" />
        <Line
          name="ก่อนอาหาร"
          type="monotone"
          dataKey="beforeValue"
          stroke="#4F46E5"
          strokeWidth={4}
          dot={<CustomDot color="#4F46E5" />}
          connectNulls
        />
        <Line
          name="หลังอาหาร"
          type="monotone"
          dataKey="afterValue"
          stroke="#F97316"
          strokeWidth={4}
          dot={<CustomDot color="#F97316" />}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
