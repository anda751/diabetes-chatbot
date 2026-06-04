import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

const WeeklyReportChart = lazy(() => import('./WeeklyReportChart'));

function parseThaiDate(dateStr) {
  try {
    const parts = String(dateStr).split('/');
    const day = Number.parseInt(parts[0], 10);
    const month = Number.parseInt(parts[1], 10) - 1;
    let year = Number.parseInt(parts[2], 10);
    if (year > 2500) year -= 543;
    return new Date(year, month, day);
  } catch {
    return null;
  }
}

function getRecordDate(item) {
  if (item?.recordedAt) {
    const parsed = new Date(item.recordedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return parseThaiDate(item?.date);
}

function getDisplayDate(item) {
  const recordDate = getRecordDate(item);
  if (!recordDate || Number.isNaN(recordDate.getTime())) {
    return String(item?.date || '-');
  }

  return recordDate.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDisplayTime(item) {
  if (item?.time) return item.time;
  const recordDate = getRecordDate(item);
  if (!recordDate || Number.isNaN(recordDate.getTime())) {
    return '-';
  }

  return recordDate.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WeeklyReportPage({ onBack, glucoseHistory = [], onConsultAI }) {
  const [filterDays, setFilterDays] = useState(7);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const chartData = useMemo(() => {
    if (!glucoseHistory?.length) return [];

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const filtered = glucoseHistory.filter((item) => {
      const itemDate = getRecordDate(item);
      if (!itemDate || Number.isNaN(itemDate.getTime())) return false;

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
      .sort((a, b) => getRecordDate(a)?.getTime() - getRecordDate(b)?.getTime())
      .map((item) => {
        const itemDate = getRecordDate(item);
        const displayDate =
          itemDate && !Number.isNaN(itemDate.getTime())
            ? itemDate.toLocaleDateString('th-TH', {
                day: '2-digit',
                month: '2-digit',
              })
            : '-';

        return {
          ...item,
          beforeValue: item.phase === 'before' ? item.value : null,
          afterValue: item.phase === 'after' ? item.value : null,
          displayDate,
        };
      });
  }, [customRange, filterDays, glucoseHistory]);

  const stats = useMemo(() => {
    if (!chartData.length) {
      return { avg: 0, highCount: 0 };
    }

    const sum = chartData.reduce((acc, item) => acc + item.value, 0);
    const highCount = chartData.filter((item) => item.value > 140).length;

    return {
      avg: Math.round(sum / chartData.length),
      highCount,
    };
  }, [chartData]);

  const hasAnyHistory = glucoseHistory.length > 0;

  const handleConsultAI = () => {
    const context = `สรุปรายงานค่าน้ำตาลเฉลี่ย ${stats.avg} mg/dL และพบค่าสูงกว่าเกณฑ์ ${stats.highCount} ครั้ง ช่วยอธิบายแนวโน้มและแนะนำวิธีดูแลตัวเองต่อเนื่องแบบเข้าใจง่ายให้หน่อยค่ะ`;
    onConsultAI?.(context);
  };

  const clearCustomRange = () => {
    setCustomRange({ start: '', end: '' });
    setFilterDays(7);
  };

  const chartFallback = (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl bg-slate-50">
      <div className="animate-soft-pulse h-8 w-8 rounded-full bg-slate-200" />
      <div className="animate-soft-pulse h-4 w-40 rounded bg-slate-200" />
    </div>
  );

  return (
    <div className="app-page app-page-transition flex flex-col bg-[#F8FAFC] sm:h-full">
      <div className="app-safe-top sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 pb-4 pt-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="touch-target rounded-2xl border border-slate-100 p-2.5 transition hover:bg-slate-50 active:scale-95"
          >
            <ChevronLeft size={22} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">สรุปค่าน้ำตาล</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ดูแนวโน้มสุขภาพรายวัน</p>
          </div>
        </div>

        <button
          onClick={() => setShowDatePicker((prev) => !prev)}
          className={`touch-target rounded-2xl p-2.5 transition ${
            showDatePicker ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          <Calendar size={22} />
        </button>
      </div>

      <div className="app-scroll-region custom-scrollbar flex-1 space-y-6 px-5 py-5">
        <div className="space-y-4">
          <div className="custom-scrollbar flex items-center gap-3 overflow-x-auto pb-2">
            {[3, 7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => {
                  setFilterDays(days);
                  setCustomRange({ start: '', end: '' });
                }}
                className={`touch-target whitespace-nowrap rounded-2xl px-6 py-2.5 text-sm font-black transition ${
                  filterDays === days && !customRange.start
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                    : 'border border-slate-100 bg-white text-slate-500'
                }`}
              >
                {days} วันล่าสุด
              </button>
            ))}
          </div>

          {showDatePicker && (
            <div className="animate-fade-up rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-50/50">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-black uppercase text-slate-800">เลือกช่วงวันที่เอง</p>
                {(customRange.start || customRange.end) && (
                  <button onClick={clearCustomRange} className="flex items-center gap-1 text-[10px] font-black text-red-500">
                    <X size={12} />
                    ล้างค่า
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="touch-target flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-indigo-300"
                  value={customRange.start}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, start: event.target.value }))}
                />
                <ChevronRight size={16} className="text-slate-300" />
                <input
                  type="date"
                  className="touch-target flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold outline-none focus:border-indigo-300"
                  value={customRange.end}
                  onChange={(event) => setCustomRange((prev) => ({ ...prev, end: event.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white p-7 shadow-sm">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {customRange.start ? 'ค่าเฉลี่ยในช่วงวันที่เลือก' : `ค่าเฉลี่ยใน ${filterDays} วันล่าสุด`}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black tracking-tight text-slate-800">{stats.avg}</h3>
                <span className="text-sm font-bold text-slate-400">mg/dL</span>
              </div>
            </div>

            <div
              className={`rounded-full px-4 py-1.5 text-[10px] font-black ${
                stats.avg > 140 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'
              }`}
            >
              {stats.avg > 140 ? 'ต้องระวังเพิ่ม' : 'ภาพรวมดี'}
            </div>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <Suspense fallback={chartFallback}>
                <WeeklyReportChart chartData={chartData} />
              </Suspense>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-100 px-5 text-center text-slate-300">
                <Info size={32} />
                <p className="text-xs font-bold uppercase tracking-widest">
                  {hasAnyHistory
                    ? 'ไม่มีข้อมูลในช่วงที่เลือก กรุณาลองเปลี่ยนช่วงเวลา'
                    : 'ยังไม่มีข้อมูลค่าน้ำตาล เริ่มบันทึกครั้งแรกได้เลย'}
                </p>
              </div>
            )}
          </div>
        </div>

        {!hasAnyHistory && (
          <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
            <div className="flex gap-4">
              <div className="rounded-2xl bg-sky-500 p-3 text-white shadow-lg shadow-sky-100">
                <Sparkles size={22} />
              </div>
              <div>
                <h4 className="font-black text-slate-900">เริ่มต้นบันทึกแล้วรายงานจะชัดขึ้น</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  เมื่อมีข้อมูลก่อนอาหารและหลังอาหาร ระบบจะสรุปแนวโน้มและช่วยให้หมอ AI ตอบได้ตรงขึ้น
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.highCount > 0 && (
          <div className="animate-fade-up rounded-[2rem] border border-red-100 bg-gradient-to-br from-red-50 to-orange-50 p-6 shadow-sm">
            <div className="flex gap-4">
              <div className="h-fit rounded-2xl bg-red-500 p-3 text-white shadow-lg shadow-red-200">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-3">
                <h4 className="leading-tight font-black text-red-900">พบค่าสูงกว่าปกติ {stats.highCount} ครั้ง</h4>
                <p className="text-sm font-medium leading-relaxed text-red-700/80">
                  ในช่วงที่เลือกมีค่าน้ำตาลเกิน 140 mg/dL หลายครั้ง ลองให้หมอ AI ช่วยสรุปและแนะนำแนวทางดูแลเพิ่มได้เลย
                </p>
                <button
                  onClick={handleConsultAI}
                  className="touch-target group flex items-center gap-2 rounded-xl border border-red-100 bg-white px-5 py-2.5 text-xs font-black text-red-600 shadow-sm transition hover:bg-red-600 hover:text-white"
                >
                  <Sparkles size={14} className="transition-transform group-hover:rotate-12" />
                  ขอคำแนะนำจาก AI
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 pb-6">
          <h4 className="flex items-center gap-2 px-2 font-black text-slate-800">
            <Filter size={18} className="text-indigo-500" />
            รายการทั้งหมด {chartData.length} รายการ
          </h4>

          <div className="grid gap-3">
            {[...chartData].reverse().map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-indigo-100"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`rounded-2xl p-3 ${
                      item.phase === 'before' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    {item.phase === 'before' ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">
                      {item.value} <span className="text-[10px] text-slate-400">mg/dL</span>
                    </p>
                    <p className="text-[10px] font-bold tracking-tight text-slate-400">
                      {getDisplayDate(item)} · {getDisplayTime(item)}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-full px-4 py-1.5 text-[9px] font-black uppercase ${
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
}
