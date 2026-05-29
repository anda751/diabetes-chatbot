import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  Sparkles,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const WeeklyReportPage = ({ onBack, glucoseHistory = [], onConsultAI }) => {
  const [filterDays, setFilterDays] = useState(7);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const parseDate = (dateStr) => {
    try {
      const parts = String(dateStr).split('/');
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year > 2500) year -= 543;
      return new Date(year, month, day);
    } catch (error) {
      return null;
    }
  };

  const chartData = useMemo(() => {
    if (!glucoseHistory?.length) return [];

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const filtered = glucoseHistory.filter((item) => {
      const itemDate = parseDate(item.date);
      if (!itemDate) return false;

      if (customRange.start && customRange.end) {
        const start = new Date(customRange.start);
        const end = new Date(customRange.end);
        end.setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      }

      const diffTime = now.getTime() - itemDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays < filterDays && diffDays >= 0;
    });

    return [...filtered]
      .sort((a, b) => a.id - b.id)
      .map((item) => ({
        ...item,
        beforeValue: item.phase === 'before' ? item.value : null,
        afterValue: item.phase === 'after' ? item.value : null,
        displayDate: `${String(item.date).split('/')[0]}/${String(item.date).split('/')[1]}`,
      }));
  }, [glucoseHistory, filterDays, customRange]);

  const stats = useMemo(() => {
    if (!chartData.length) {
      return { avg: 0, highCount: 0 };
    }

    const sum = chartData.reduce((acc, curr) => acc + curr.value, 0);
    const highEntries = chartData.filter((item) => item.value > 140);

    return {
      avg: Math.round(sum / chartData.length),
      highCount: highEntries.length,
    };
  }, [chartData]);

  const handleConsultAI = () => {
    const context = `สรุปรายงานค่าน้ำตาลเฉลี่ย ${stats.avg} mg/dL และพบค่าสูงกว่าเกณฑ์ ${stats.highCount} ครั้ง ช่วยอธิบายแนวโน้มและแนะนำวิธีดูแลตัวเองต่อเนื่องแบบเข้าใจง่ายให้หน่อยค่ะ`;
    if (onConsultAI) onConsultAI(context);
  };

  const clearCustomRange = () => {
    setCustomRange({ start: '', end: '' });
    setFilterDays(7);
  };

  return (
    <div className="min-h-[100dvh] sm:h-full bg-[#F8FAFC] flex flex-col font-sans">
      <div className="bg-white p-6 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all active:scale-95"
          >
            <ChevronLeft size={22} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">สรุปค่าน้ำตาล</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ดูแนวโน้มสุขภาพรายวัน</p>
          </div>
        </div>

        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`p-2.5 rounded-2xl transition-all ${showDatePicker ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
        >
          <Calendar size={22} />
        </button>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            {[3, 7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => {
                  setFilterDays(days);
                  setCustomRange({ start: '', end: '' });
                }}
                className={`px-6 py-2.5 rounded-2xl text-sm font-black whitespace-nowrap transition-all ${
                  filterDays === days && !customRange.start
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'bg-white text-slate-500 border border-slate-100'
                }`}
              >
                {days} วันล่าสุด
              </button>
            ))}
          </div>

          {showDatePicker && (
            <div className="bg-white p-5 rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-50/50 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-black text-slate-800 uppercase">เลือกช่วงวันที่เอง</p>
                {(customRange.start || customRange.end) && (
                  <button onClick={clearCustomRange} className="text-[10px] font-black text-red-500 flex items-center gap-1">
                    <X size={12} />
                    ล้างค่า
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-bold outline-none focus:border-indigo-300"
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                />
                <ChevronRight size={16} className="text-slate-300" />
                <input
                  type="date"
                  className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-bold outline-none focus:border-indigo-300"
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative">
          <div className="mb-8 flex justify-between items-start gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                {customRange.start ? 'ค่าเฉลี่ยในช่วงวันที่เลือก' : `ค่าเฉลี่ยใน ${filterDays} วันล่าสุด`}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black text-slate-800 tracking-tighter">{stats.avg}</h3>
                <span className="text-slate-400 text-sm font-bold">mg/dL</span>
              </div>
            </div>

            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black ${stats.avg > 140 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
              {stats.avg > 140 ? 'ต้องระวังเพิ่ม' : 'ภาพรวมดี'}
            </div>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={140} stroke="#FDA4AF" strokeDasharray="3 3" />
                  <Line name="ก่อนอาหาร" type="monotone" dataKey="beforeValue" stroke="#4F46E5" strokeWidth={4} dot={<CustomDot color="#4F46E5" />} connectNulls />
                  <Line name="หลังอาหาร" type="monotone" dataKey="afterValue" stroke="#F97316" strokeWidth={4} dot={<CustomDot color="#F97316" />} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-100 rounded-3xl">
                <Info size={32} />
                <p className="text-xs font-bold uppercase tracking-widest text-center">
                  ไม่มีข้อมูลในช่วงที่เลือก
                  <br />
                  กรุณาลองเปลี่ยนช่วงเวลา
                </p>
              </div>
            )}
          </div>
        </div>

        {stats.highCount > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 p-6 rounded-[2rem] shadow-sm animate-in zoom-in-95 duration-300">
            <div className="flex gap-4">
              <div className="bg-red-500 text-white p-3 rounded-2xl h-fit shadow-lg shadow-red-200">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-3">
                <h4 className="font-black text-red-900 leading-tight">พบค่าสูงกว่าปกติ {stats.highCount} ครั้ง</h4>
                <p className="text-sm text-red-700/80 leading-relaxed font-medium">
                  ในช่วงที่เลือกมีค่าน้ำตาลเกิน 140 mg/dL หลายครั้ง ลองให้หมอ AI ช่วยสรุปและแนะนำแนวทางดูแลเพิ่มเติมได้เลย
                </p>
                <button
                  onClick={handleConsultAI}
                  className="flex items-center gap-2 bg-white text-red-600 px-5 py-2.5 rounded-xl text-xs font-black shadow-sm border border-red-100 hover:bg-red-600 hover:text-white transition-all group"
                >
                  <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                  ขอคำแนะนำจาก AI
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 pb-10">
          <h4 className="px-2 font-black text-slate-800 flex items-center gap-2">
            <Filter size={18} className="text-indigo-500" />
            รายการทั้งหมด {chartData.length} รายการ
          </h4>

          <div className="grid gap-3">
            {[...chartData].reverse().map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-3xl flex items-center justify-between border border-slate-100 shadow-sm transition-all hover:border-indigo-100">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${item.phase === 'before' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                    {item.phase === 'before' ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">
                      {item.value} <span className="text-[10px] text-slate-400">mg/dL</span>
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {item.date} • {item.time}
                    </p>
                  </div>
                </div>

                <div
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${
                    item.value > 140
                      ? 'bg-red-100 text-red-600'
                      : item.phase === 'before'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {item.phase === 'before' ? 'ก่อนอาหาร' : 'หลังอาหาร'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomDot = ({ cx, cy, value, color }) => {
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
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!(active && payload && payload.length)) return null;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-3 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
          <p className="text-sm font-bold">
            {entry.name}: <span className={entry.value > 140 ? 'text-red-400' : 'text-indigo-300'}>{entry.value}</span>
          </p>
        </div>
      ))}
    </div>
  );
};

export default WeeklyReportPage;
