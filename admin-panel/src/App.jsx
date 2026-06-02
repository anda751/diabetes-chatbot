import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  RefreshCcw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { API_URL } from './config';

const COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444'];
const BarPanel = lazy(() => import('./components/BarPanel.jsx'));
const PiePanel = lazy(() => import('./components/PiePanel.jsx'));

const NAV_ITEMS = [
  { id: 'overview', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
  { id: 'analytics', label: 'สถิติการใช้งาน', icon: BarChart3 },
  { id: 'popular', label: 'คำถามยอดนิยม', icon: MessageSquareText },
  { id: 'table', label: 'ตารางข้อมูล', icon: ClipboardList },
];

function normalizeAdminIntentLabel(value) {
  const source = String(value || '').trim().toLowerCase();

  const intentRules = [
    { label: 'ทักทาย', keywords: ['สวัสดี', 'hello', 'hi', 'ทักทาย', 'greeting'] },
    { label: 'แนะนำอาหาร', keywords: ['อาหาร', 'กิน', 'เมนู', 'มื้อ', 'ผลไม้', 'ข้าว', 'หวาน', 'เครื่องดื่ม'] },
    { label: 'ประเมินค่าน้ำตาล', keywords: ['น้ำตาล', 'mg/dl', 'mgdl', 'ก่อนอาหาร', 'หลังอาหาร', 'สูงไหม', 'ต่ำไหม'] },
    { label: 'อาการผิดปกติ', keywords: ['หน้ามืด', 'เวียนหัว', 'ใจสั่น', 'เหงื่อ', 'อาการ', 'ฉุกเฉิน', 'โรงพยาบาล', 'อันตราย'] },
    { label: 'ออกกำลังกาย', keywords: ['เดิน', 'ออกกำลังกาย', 'วิ่ง', 'โยคะ', 'ขยับ', 'เผาผลาญ'] },
    { label: 'ยาและการรักษา', keywords: ['ยา', 'ฉีด', 'อินซูลิน', 'รักษา', 'แพ้ยา', 'หมอ', 'แพทย์'] },
    { label: 'รายงานสุขภาพ', keywords: ['รายงาน', 'ประวัติ', 'สรุป', 'กราฟ', 'แนวโน้ม'] },
  ];

  const matchedRule = intentRules.find((rule) =>
    rule.keywords.some((keyword) => source.includes(keyword))
  );

  return matchedRule?.label || 'คำถามทั่วไป';
}

function groupIntentStats(rawStats) {
  const grouped = new Map();

  rawStats.forEach((item) => {
    const label = normalizeAdminIntentLabel(item.question_text);
    const current = grouped.get(label) || {
      id: label,
      question_text: label,
      count: 0,
      examples: [],
    };

    current.count += Number(item.count) || 0;

    if (
      item.question_text &&
      item.question_text !== label &&
      current.examples.length < 3 &&
      !current.examples.includes(item.question_text)
    ) {
      current.examples.push(item.question_text);
    }

    grouped.set(label, current);
  });

  return [...grouped.values()].sort((a, b) => b.count - a.count);
}

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/admin/stats`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'ไม่สามารถดึงข้อมูลสถิติได้');
      }

      const normalized = Array.isArray(data)
        ? data
            .map((item) => ({
              ...item,
              question_text: String(item.question_text || '').trim(),
              count: Number(item.count) || 0,
            }))
            .filter((item) => item.question_text)
            .sort((a, b) => b.count - a.count)
        : [];

      setStats(groupIntentStats(normalized));
      setLastUpdated(
        new Date().toLocaleString('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      );
    } catch (fetchError) {
      console.error('Fetch admin stats error:', fetchError);
      setStats([]);
      setError(fetchError.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const filteredStats = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return stats;

    return stats.filter((item) => item.question_text.toLowerCase().includes(keyword));
  }, [search, stats]);

  const totalQuestions = useMemo(
    () => stats.reduce((sum, item) => sum + item.count, 0),
    [stats]
  );

  const topIntent = stats[0];
  const averageCount = stats.length ? Math.round(totalQuestions / stats.length) : 0;
  const chartData = useMemo(
    () =>
      filteredStats.slice(0, 8).map((item) => ({
        name: item.question_text,
        shortName:
          item.question_text.length > 24
            ? `${item.question_text.slice(0, 24)}...`
            : item.question_text,
        value: item.count,
      })),
    [filteredStats]
  );

  const activeTitle =
    NAV_ITEMS.find((item) => item.id === activeView)?.label || 'ภาพรวมระบบ';

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-[#111827] px-5 py-6 text-slate-100">
          <div className="px-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">
              Admin Panel
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Diabetes Insight</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              ระบบติดตามคำถามและ intent จากหมอ AI
            </p>
          </div>

          <nav className="mt-8 space-y-1.5">
            {NAV_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeView === item.id}
                onClick={() => setActiveView(item.id)}
              />
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              สถานะระบบ
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span>AI Service</span>
                <span className="font-bold text-emerald-300">พร้อมใช้งาน</span>
              </div>
              <div>
                <p className="text-slate-500">อัปเดตล่าสุด</p>
                <p className="mt-1 font-semibold text-slate-300">{lastUpdated || '-'}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-8 py-7">
          <TopBar
            title={activeTitle}
            search={search}
            setSearch={setSearch}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
            onRefresh={fetchStats}
          />

          {activeView === 'overview' && (
            <OverviewView
              stats={stats}
              chartData={chartData}
              totalQuestions={totalQuestions}
              averageCount={averageCount}
              topIntent={topIntent}
              filteredStats={filteredStats}
              search={search}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView chartData={chartData} filteredStats={filteredStats} search={search} />
          )}

          {activeView === 'popular' && (
            <PopularView
              filteredStats={filteredStats}
              totalQuestions={totalQuestions}
              search={search}
            />
          )}

          {activeView === 'table' && (
            <TableView
              filteredStats={filteredStats}
              totalQuestions={totalQuestions}
              search={search}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function TopBar({ title, search, setSearch, loading, error, lastUpdated, onRefresh }) {
  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 text-base text-slate-500">
            ดูสรุปคำถามที่ผู้ใช้ถามหมอ AI และแนวโน้มที่เกิดขึ้นในระบบ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex w-80 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหา intent หรือหัวข้อคำถาม"
              className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      </header>

      <div className="mt-5 flex items-center gap-3 text-sm">
        <span className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-500 shadow-sm">
          อัปเดตล่าสุด: {lastUpdated || 'ยังไม่มีข้อมูล'}
        </span>
        {loading && (
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
            กำลังโหลดข้อมูล...
          </span>
        )}
        {error && (
          <span className="rounded-lg bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">
            {error}
          </span>
        )}
      </div>
    </>
  );
}

function OverviewView({
  stats,
  chartData,
  totalQuestions,
  averageCount,
  topIntent,
  filteredStats,
  search,
}) {
  return (
    <>
      <section className="mt-7 grid grid-cols-4 gap-5">
        <MetricCard
          icon={<MessageSquareText size={20} />}
          title="จำนวนคำถามทั้งหมด"
          value={totalQuestions}
          helper="รวมทุกครั้งที่ระบบบันทึก intent"
          tone="blue"
        />
        <MetricCard
          icon={<BarChart3 size={20} />}
          title="จำนวน intent"
          value={stats.length}
          helper="หัวข้อคำถามที่ไม่ซ้ำกัน"
          tone="emerald"
        />
        <MetricCard
          icon={<TrendingUp size={20} />}
          title="intent สูงสุด"
          value={topIntent?.count || 0}
          helper={topIntent?.question_text || 'ยังไม่มีข้อมูล'}
          tone="amber"
        />
        <MetricCard
          icon={<Activity size={20} />}
          title="ค่าเฉลี่ยต่อ intent"
          value={averageCount}
          helper="คำนวณจากจำนวนคำถามทั้งหมด"
          tone="indigo"
        />
      </section>

      <section className="mt-7 grid grid-cols-[1.35fr_0.85fr] gap-6">
        <Suspense fallback={<ChartPanelFallback />}>
          <BarPanel chartData={chartData} search={search} colors={COLORS} />
        </Suspense>
        <Suspense fallback={<ChartPanelFallback compact />}>
          <PiePanel chartData={chartData} colors={COLORS} />
        </Suspense>
      </section>

      <section className="mt-7">
        <Panel title="ข้อมูลล่าสุด" description={`แสดง ${filteredStats.length} รายการจากผลค้นหา`}>
          <DataTable rows={filteredStats.slice(0, 8)} totalQuestions={totalQuestions} compact />
        </Panel>
      </section>
    </>
  );
}

function AnalyticsView({ chartData, filteredStats, search }) {
  return (
    <section className="mt-7 grid grid-cols-[1.4fr_0.8fr] gap-6">
      <Suspense fallback={<ChartPanelFallback tall />}>
        <BarPanel chartData={chartData} search={search} tall colors={COLORS} />
      </Suspense>
      <div className="space-y-6">
        <Suspense fallback={<ChartPanelFallback compact />}>
          <PiePanel chartData={chartData} colors={COLORS} />
        </Suspense>
        <Panel title="รายการที่อยู่ในกราฟ" description={`นำ ${Math.min(filteredStats.length, 8)} รายการแรกมาแสดง`}>
          <RankList
            rows={filteredStats.slice(0, 6)}
            totalQuestions={filteredStats.reduce((sum, item) => sum + item.count, 0)}
          />
        </Panel>
      </div>
    </section>
  );
}

function PopularView({ filteredStats, totalQuestions, search }) {
  return (
    <section className="mt-7">
      <Panel title="คำถามยอดนิยม" description="จัดอันดับจากจำนวนครั้งที่ถูกถามมากที่สุด">
        <RankList rows={filteredStats} totalQuestions={totalQuestions} search={search} />
      </Panel>
    </section>
  );
}

function TableView({ filteredStats, totalQuestions, search }) {
  return (
    <section className="mt-7">
      <Panel title="ตารางข้อมูลทั้งหมด" description={`พบ ${filteredStats.length} รายการ`}>
        <DataTable rows={filteredStats} totalQuestions={totalQuestions} search={search} />
      </Panel>
    </section>
  );
}

function ChartPanelFallback({ tall = false, compact = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 space-y-2">
        <div className="h-6 w-40 rounded bg-slate-100" />
        <div className="h-4 w-56 rounded bg-slate-100" />
      </div>
      <div
        className={`${tall ? 'h-[540px]' : compact ? 'h-[280px]' : 'h-[360px]'} animate-pulse rounded-lg bg-slate-100`}
      />
    </div>
  );
}

function RankList({ rows, totalQuestions, search }) {
  if (!rows.length) {
    return <EmptyState text={search ? 'ไม่พบ intent ที่ค้นหา' : 'ยังไม่มีข้อมูล intent'} />;
  }

  return (
    <div className="space-y-3">
      {rows.map((item, index) => {
        const percent = totalQuestions ? Math.round((item.count / totalQuestions) * 100) : 0;

        return (
          <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-black text-blue-700">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-6 text-slate-800">{item.question_text}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{percent}%</span>
                </div>
              </div>
              <div className="rounded bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm">
                {item.count} ครั้ง
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ rows, totalQuestions, search, compact = false }) {
  if (!rows.length) {
    return <EmptyState text={search ? 'ไม่พบข้อมูลตามคำค้นหา' : 'ยังไม่มีข้อมูลในตาราง'} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <div className="grid grid-cols-[1fr_130px_110px] gap-4 bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        <div>หัวข้อคำถาม</div>
        <div>จำนวนครั้ง</div>
        <div>สัดส่วน</div>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((item) => {
          const percent = totalQuestions ? ((item.count / totalQuestions) * 100).toFixed(1) : '0.0';

          return (
            <div
              key={item.id}
              className={`grid grid-cols-[1fr_130px_110px] gap-4 px-5 hover:bg-slate-50 ${
                compact ? 'py-3' : 'py-4'
              }`}
            >
              <div className="text-sm font-semibold leading-6 text-slate-800">
                {item.question_text}
              </div>
              <div className="text-sm font-black text-blue-700">{item.count} ครั้ง</div>
              <div className="text-sm font-semibold text-slate-500">{percent}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }) {
  const IconComponent = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <IconComponent size={18} />
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ icon, title, value, helper, tone }) {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-3 ${toneMap[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{title}</p>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-xl font-black tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  );
}

export default App;
