import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-slate-900 px-4 py-3 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-300">Intent</p>
      <p className="mt-1 text-sm font-semibold leading-6">{item.payload?.name}</p>
      <p className="mt-2 text-sm font-bold">จำนวน {item.value} ครั้ง</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  );
}

export default function BarPanel({ chartData, colors, search, tall = false }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-xl font-black tracking-tight text-slate-900">อันดับคำถามยอดนิยม</h3>
        <p className="mt-1 text-sm text-slate-500">แสดง intent ที่ถูกถามบ่อยที่สุด</p>
      </div>

      <div className={tall ? 'h-[540px]' : 'h-[360px]'}>
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
              <YAxis
                type="category"
                dataKey="shortName"
                width={160}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#334155', fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                {chartData.map((item, index) => (
                  <Cell key={item.name} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text={search ? 'ไม่พบข้อมูลตามคำค้นหา' : 'ยังไม่มีข้อมูลสถิติ'} />
        )}
      </div>
    </section>
  );
}
