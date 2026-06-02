import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

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

export default function PiePanel({ chartData, colors }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-xl font-black tracking-tight text-slate-900">สัดส่วน intent</h3>
        <p className="mt-1 text-sm text-slate-500">ดูภาพรวมของหัวข้อที่ถูกถามมากที่สุด</p>
      </div>

      <div className="h-[280px]">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData.slice(0, 6)}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={94}
                paddingAngle={4}
              >
                {chartData.slice(0, 6).map((item, index) => (
                  <Cell key={item.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="ยังไม่มีข้อมูลสำหรับสร้างกราฟ" />
        )}
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.name} className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
              {item.name}
            </p>
            <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {item.value} ครั้ง
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
