import React, { Suspense, lazy, useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Download,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Siren,
  Stethoscope,
  Users,
} from 'lucide-react';
import { API_URL } from './config';

const COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444'];
const BarPanel = lazy(() => import('./components/BarPanel.jsx'));
const PiePanel = lazy(() => import('./components/PiePanel.jsx'));

const NAV_ITEMS = [
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'analytics', label: 'วิเคราะห์หมวดคำถาม', icon: BarChart3 },
  { id: 'popular', label: 'คำถามยอดนิยมจริง', icon: MessageSquareText },
  { id: 'quality', label: 'คุณภาพ AI', icon: ShieldCheck },
  { id: 'health', label: 'สถานะระบบ', icon: Stethoscope },
  { id: 'table', label: 'ตารางข้อมูล', icon: ClipboardList },
];

function formatThaiDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toChartData(intentStats) {
  return intentStats.slice(0, 8).map((item) => ({
    name: item.label,
    shortName: item.label.length > 22 ? `${item.label.slice(0, 22)}...` : item.label,
    value: item.count,
  }));
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate),
  };
}

function buildAdminQueryString(dateRange) {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function downloadBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    summary: null,
    intentStats: [],
    topQuestions: [],
    quality: null,
    health: null,
    updatedAt: '',
  });
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  const checkAdminSession = async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await fetch(`${API_URL}/admin/session`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setIsAuthenticated(false);
        setAdminUser(null);
        return;
      }

      const data = await response.json();
      setAdminUser(data?.admin || null);
      setIsAuthenticated(true);
    } catch (sessionError) {
      console.error('Check admin session error:', sessionError);
      setIsAuthenticated(false);
      setAdminUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate > dateRange.endDate) {
        throw new Error('ช่วงวันที่ไม่ถูกต้อง');
      }

      const queryString = buildAdminQueryString(dateRange);
      const [overviewResponse, healthResponse, qualityResponse] = await Promise.all([
        fetch(`${API_URL}/admin/overview${queryString}`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/admin/health`, {
          credentials: 'include',
        }),
        fetch(`${API_URL}/admin/quality${queryString}`, {
          credentials: 'include',
        }),
      ]);

      if (overviewResponse.status === 401 || healthResponse.status === 401 || qualityResponse.status === 401) {
        setIsAuthenticated(false);
        setAdminUser(null);
        return;
      }

      const overviewData = await overviewResponse.json();
      const healthData = await healthResponse.json();
      const qualityData = await qualityResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(overviewData?.error || 'โหลดข้อมูลภาพรวมแอดมินไม่สำเร็จ');
      }

      if (!healthResponse.ok) {
        throw new Error(healthData?.error || 'โหลดสถานะระบบไม่สำเร็จ');
      }
      if (!qualityResponse.ok) {
        throw new Error(qualityData?.error || 'โหลดข้อมูลคุณภาพ AI ไม่สำเร็จ');
      }

      setDashboardData({
        summary: overviewData?.summary || null,
        intentStats: Array.isArray(overviewData?.intentStats) ? overviewData.intentStats : [],
        topQuestions: Array.isArray(overviewData?.topQuestions) ? overviewData.topQuestions : [],
        quality: qualityData || null,
        health: healthData || null,
        updatedAt:
          overviewData?.updatedAt || qualityData?.updatedAt || healthData?.updatedAt || new Date().toISOString(),
      });
    } catch (fetchError) {
      console.error('Fetch admin dashboard error:', fetchError);
      setError(fetchError.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลแอดมิน');
    } finally {
      setLoading(false);
    }
  };

  const runFetchDashboardData = useEffectEvent(() => {
    fetchDashboardData();
  });

  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    runFetchDashboardData();
  }, [isAuthenticated, dateRange.startDate, dateRange.endDate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'เข้าสู่ระบบแอดมินไม่สำเร็จ');
      }

      setAdminUser(data?.admin || null);
      setIsAuthenticated(true);
      setLoginForm({
        username: '',
        password: '',
      });
    } catch (loginError) {
      console.error('Admin login error:', loginError);
      setAuthError(loginError.message || 'เข้าสู่ระบบแอดมินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (logoutError) {
      console.error('Admin logout error:', logoutError);
    } finally {
      setIsAuthenticated(false);
      setAdminUser(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');

    try {
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate > dateRange.endDate) {
        throw new Error('ช่วงวันที่ไม่ถูกต้อง');
      }

      const queryString = buildAdminQueryString(dateRange);
      const exportPath =
        activeView === 'quality' ? '/admin/export/fallbacks.csv' : '/admin/export/questions.csv';

      const response = await fetch(`${API_URL}${exportPath}${queryString}`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        setAdminUser(null);
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'ส่งออกข้อมูลไม่สำเร็จ');
      }

      const blob = await response.blob();
      const filename = activeView === 'quality' ? 'admin-fallbacks.csv' : 'admin-questions.csv';
      downloadBlob(blob, filename);
    } catch (exportError) {
      console.error('Export admin data error:', exportError);
      setError(exportError.message || 'ส่งออกข้อมูลไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  };

  const filteredQuestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return dashboardData.topQuestions;

    return dashboardData.topQuestions.filter((item) => {
      const question = String(item.questionText || '').toLowerCase();
      const label = String(item.label || '').toLowerCase();
      return question.includes(keyword) || label.includes(keyword);
    });
  }, [dashboardData.topQuestions, search]);

  const filteredIntentStats = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return dashboardData.intentStats;

    return dashboardData.intentStats.filter((item) =>
      String(item.label || '').toLowerCase().includes(keyword)
    );
  }, [dashboardData.intentStats, search]);

  const chartData = useMemo(() => toChartData(filteredIntentStats), [filteredIntentStats]);
  const summary = dashboardData.summary;
  const activeTitle = NAV_ITEMS.find((item) => item.id === activeView)?.label || 'ภาพรวม';

  if (authLoading) {
    return <LoadingScreen label="กำลังตรวจสอบสิทธิ์แอดมิน..." />;
  }

  if (!isAuthenticated) {
    return (
      <AdminLoginScreen
        form={loginForm}
        setForm={setLoginForm}
        onSubmit={handleLogin}
        loading={loading}
        error={authError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <div className="grid min-h-screen grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-[#111827] px-5 py-6 text-slate-100">
          <div className="px-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">Admin Panel</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Diabetes Insight</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              ใช้ดูภาพรวมคำถาม สุขภาพระบบ และคุณภาพการตอบของหมอ AI
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Admin Session</p>
            <p className="mt-2 text-sm font-semibold text-white">{adminUser?.username || '-'}</p>
            <p className="mt-1 text-xs text-slate-400">สิทธิ์: {adminUser?.role || 'admin'}</p>
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

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">อัปเดตล่าสุด</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatThaiDateTime(dashboardData.updatedAt)}</p>
            <button
              onClick={handleLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-8 py-7">
          <TopBar
            title={activeTitle}
            search={search}
            setSearch={setSearch}
            dateRange={dateRange}
            setDateRange={setDateRange}
            loading={loading}
            exporting={exporting}
            error={error}
            updatedAt={dashboardData.updatedAt}
            onRefresh={fetchDashboardData}
            onExport={handleExport}
            exportLabel={activeView === 'quality' ? 'Export Fallback CSV' : 'Export Questions CSV'}
          />

          {activeView === 'overview' && (
            <OverviewView
              summary={summary}
              chartData={chartData}
              topQuestions={filteredQuestions}
              health={dashboardData.health}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView intentStats={filteredIntentStats} chartData={chartData} />
          )}

          {activeView === 'popular' && (
            <PopularQuestionsView questions={filteredQuestions} />
          )}

          {activeView === 'quality' && <QualityView quality={dashboardData.quality} />}

          {activeView === 'health' && <HealthView health={dashboardData.health} />}

          {activeView === 'table' && (
            <QuestionTableView questions={filteredQuestions} search={search} />
          )}
        </main>
      </div>
    </div>
  );
}

function LoadingScreen({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6fb] px-6">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
        <p className="text-sm font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AdminLoginScreen({ form, setForm, onSubmit, loading, error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_45%,#eef2ff_100%)] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-lg">
          <ShieldCheck size={28} />
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-500">Admin Access</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">เข้าสู่ระบบแอดมิน</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ใช้สำหรับดูสถิติ ตรวจสถานะระบบ และติดตามคำถามที่ผู้ใช้ถามหมอ AI
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">ชื่อผู้ใช้แอดมิน</span>
            <input
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
              placeholder="กรอกชื่อผู้ใช้แอดมิน"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">รหัสผ่าน</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
              placeholder="กรอกรหัสผ่าน"
            />
          </label>

          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <LockKeyhole size={17} />
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}

function TopBar({
  title,
  search,
  setSearch,
  dateRange,
  setDateRange,
  loading,
  exporting,
  error,
  updatedAt,
  onRefresh,
  onExport,
  exportLabel,
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 text-base text-slate-500">
            ดูภาพรวมคำถามจริงของผู้ใช้ ความนิยมแต่ละหมวด และสถานะระบบจาก backend โดยตรง
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <label className="flex w-80 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาหมวดหรือคำถาม"
              className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Start
              </span>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(event) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
              />
            </label>

            <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                End
              </span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(event) =>
                  setDateRange((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
              />
            </label>

            <button
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Download size={18} className={exporting ? 'animate-pulse' : ''} />
              {exporting ? 'กำลังส่งออก...' : exportLabel}
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>
      </header>

      <div className="mt-5 flex items-center gap-3 text-sm">
        <span className="rounded-2xl bg-white px-3 py-1.5 font-semibold text-slate-500 shadow-sm">
          อัปเดตล่าสุด: {formatThaiDateTime(updatedAt)}
        </span>
        <span className="rounded-2xl bg-white px-3 py-1.5 font-semibold text-slate-500 shadow-sm">
          ช่วงข้อมูล: {dateRange.startDate || '-'} ถึง {dateRange.endDate || '-'}
        </span>
        {loading ? (
          <span className="rounded-2xl bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
            กำลังโหลดข้อมูล...
          </span>
        ) : null}
        {error ? (
          <span className="rounded-2xl bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">
            {error}
          </span>
        ) : null}
      </div>
    </>
  );
}

function OverviewView({ summary, chartData, topQuestions, health }) {
  return (
    <>
      <section className="mt-7 grid grid-cols-5 gap-5">
        <MetricCard icon={<Users size={20} />} title="ผู้ใช้ทั้งหมด" value={summary?.totalUsers || 0} helper="นับจากบัญชีที่สมัครไว้" tone="blue" />
        <MetricCard icon={<MessageSquareText size={20} />} title="คำถามทั้งหมด" value={summary?.totalQuestions || 0} helper="รวมทุกครั้งที่ระบบบันทึกคำถาม" tone="emerald" />
        <MetricCard icon={<ClipboardList size={20} />} title="คำถามไม่ซ้ำ" value={summary?.totalQuestionTypes || 0} helper="จำนวนหัวข้อคำถามที่ไม่ซ้ำกัน" tone="amber" />
        <MetricCard icon={<Activity size={20} />} title="บันทึกน้ำตาล" value={summary?.totalGlucoseRecords || 0} helper="จำนวนรายการในประวัติน้ำตาล" tone="indigo" />
        <MetricCard icon={<Stethoscope size={20} />} title="ผู้ใช้ที่ตั้งเตือน" value={summary?.activeReminderUsers || 0} helper="ผู้ใช้ที่เปิดมื้ออาหารอย่างน้อย 1 รายการ" tone="sky" />
      </section>

      <section className="mt-7 grid grid-cols-[1.35fr_0.85fr] gap-6">
        <Suspense fallback={<ChartPanelFallback />}>
          <BarPanel chartData={chartData} search="" colors={COLORS} />
        </Suspense>
        <Suspense fallback={<ChartPanelFallback compact />}>
          <PiePanel chartData={chartData} colors={COLORS} />
        </Suspense>
      </section>

      <section className="mt-7 grid grid-cols-[1.2fr_0.8fr] gap-6">
        <Panel title="คำถามที่ถูกถามบ่อยที่สุด" description="ข้อมูลจริงจาก backend ที่ถูกถามบ่อยล่าสุด">
          <PopularQuestionList questions={topQuestions.slice(0, 6)} />
        </Panel>

        <Panel title="สรุปที่ควรรู้" description="ใช้ดูว่าระบบและการใช้งานไปทางไหน">
          <div className="space-y-4">
            <InsightCard
              title="หมวดที่ถูกถามมากสุด"
              value={summary?.topCategory?.label || '-'}
              helper={summary?.topCategory ? `${summary.topCategory.count} ครั้ง` : 'ยังไม่มีข้อมูล'}
            />
            <InsightCard
              title="คำถามเด่นที่สุด"
              value={summary?.topQuestion?.questionText || '-'}
              helper={summary?.topQuestion ? `${summary.topQuestion.count} ครั้ง` : 'ยังไม่มีข้อมูล'}
            />
            <InsightCard
              title="ค่าเฉลี่ยต่อหัวข้อ"
              value={summary?.averageQuestionsPerType || 0}
              helper="ช่วยดูว่าคำถามกระจุกอยู่ไม่กี่หัวข้อหรือกระจายตัว"
            />
            <InsightCard
              title="สถานะระบบ"
              value={health?.status === 'ok' ? 'พร้อมใช้งาน' : 'มีปัญหา'}
              helper="ตรวจจาก backend, database, AI และ push service"
            />
          </div>
        </Panel>
      </section>
    </>
  );
}

function AnalyticsView({ intentStats, chartData }) {
  return (
    <section className="mt-7 grid grid-cols-[1.4fr_0.8fr] gap-6">
      <Suspense fallback={<ChartPanelFallback tall />}>
        <BarPanel chartData={chartData} search="" tall colors={COLORS} />
      </Suspense>

      <Panel title="เรียงตามหมวดคำถาม" description="ดูว่าคนสนใจเรื่องใดมากที่สุดในระบบ">
        <div className="space-y-3">
          {intentStats.map((item, index) => (
            <div key={item.intentKey} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-700 shadow-sm">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">intent key: {item.intentKey}</p>
                  </div>
                </div>
                <span className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                  {item.count} ครั้ง
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function PopularQuestionsView({ questions }) {
  return (
    <section className="mt-7">
      <Panel title="คำถามยอดนิยมจริง" description="ใช้ดูคำถามจริงที่ผู้ใช้พิมพ์เข้ามา และควรนำไปปรับ quick prompts หรือ fallback ต่อ">
        <PopularQuestionList questions={questions} />
      </Panel>
    </section>
  );
}

function HealthView({ health }) {
  const services = health?.services || {};
  const cards = [
    { key: 'backend', label: 'Backend API', ok: services.backend, icon: ShieldCheck },
    { key: 'database', label: 'Database', ok: services.database, icon: ClipboardList },
    { key: 'aiConfigured', label: 'Gemini AI', ok: services.aiConfigured, icon: Activity },
    { key: 'pushConfigured', label: 'Push Notifications', ok: services.pushConfigured, icon: Siren },
    { key: 'adminConfigured', label: 'Admin Config', ok: services.adminConfigured, icon: LockKeyhole },
    { key: 'sessionConfigured', label: 'Session Secret', ok: services.sessionConfigured, icon: ShieldCheck },
  ];

  return (
    <>
      <section className="mt-7 grid grid-cols-3 gap-5">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                <Icon size={22} />
              </div>
              <p className="mt-4 text-lg font-black text-slate-900">{item.label}</p>
              <p className={`mt-2 text-sm font-semibold ${item.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {item.ok ? 'พร้อมใช้งาน' : 'ต้องตรวจเพิ่ม'}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-7">
        <Panel title="โมเดล AI ที่เปิดใช้" description="ใช้ตรวจว่า backend รองรับโมเดลอะไรบ้างในรอบนี้">
          <div className="flex flex-wrap gap-3">
            {(health?.chatModels || []).map((model) => (
              <span key={model} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {model}
              </span>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function QualityView({ quality }) {
  const summary = quality?.summary || {};
  const fallbackQuestions = quality?.fallbackQuestions || [];
  const recentFallbacks = quality?.recentFallbacks || [];
  const modelStats = quality?.modelStats || [];

  return (
    <>
      <section className="mt-7 grid grid-cols-4 gap-5">
        <MetricCard
          icon={<MessageSquareText size={20} />}
          title="แชทรวมทั้งหมด"
          value={summary.totalChats || 0}
          helper="จำนวนครั้งที่ผู้ใช้ถามหมอ AI"
          tone="blue"
        />
        <MetricCard
          icon={<ShieldCheck size={20} />}
          title="ตอบสำเร็จ"
          value={summary.successCount || 0}
          helper="ตอบด้วยโมเดลปกติ ไม่ fallback"
          tone="emerald"
        />
        <MetricCard
          icon={<Siren size={20} />}
          title="fallback"
          value={summary.fallbackCount || 0}
          helper="จำนวนครั้งที่ต้องใช้คำตอบสำรอง"
          tone="amber"
        />
        <MetricCard
          icon={<Activity size={20} />}
          title="fallback rate"
          value={`${summary.fallbackRate || 0}%`}
          helper="สัดส่วนคำถามที่ AI ยังตอบได้ไม่ดีพอ"
          tone="indigo"
        />
      </section>

      <section className="mt-7 grid grid-cols-[1fr_1fr] gap-6">
        <Panel title="คำถามที่ fallback บ่อย" description="ใช้ดูว่าคำถามไหนควรเอาไปปรับ prompt หรือเพิ่มข้อมูลก่อน">
          <PopularQuestionList
            questions={fallbackQuestions.map((item) => ({
              ...item,
              updatedAt: quality?.updatedAt,
            }))}
          />
        </Panel>

        <Panel title="fallback ล่าสุด" description="ใช้ไล่ดูปัญหาที่เพิ่งเกิดขึ้นจริงจากผู้ใช้">
          {recentFallbacks.length ? (
            <div className="space-y-3">
              {recentFallbacks.map((item, index) => (
                <div key={`${item.questionText}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                          {item.label}
                        </span>
                        <span className="text-xs text-slate-400">{formatThaiDateTime(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{item.questionText}</p>
                    </div>
                    <span className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">
                      {item.responseModel || 'fallback'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="ยังไม่มี fallback log สำหรับแสดง" />
          )}
        </Panel>
      </section>

      <section className="mt-7">
        <Panel title="โมเดลที่ถูกใช้ตอบ" description="ช่วยดูว่าสัดส่วนการตอบออกจากโมเดลจริงและ fallback เป็นอย่างไร">
          <div className="grid grid-cols-3 gap-4">
            {modelStats.map((item) => (
              <div key={item.model} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-sm font-bold text-slate-500">โมเดล</p>
                <p className="mt-2 text-lg font-black text-slate-900">{item.model}</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">{item.count} ครั้ง</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function QuestionTableView({ questions, search }) {
  return (
    <section className="mt-7">
      <Panel title="ตารางคำถามจริง" description={`แสดง ${questions.length} รายการ${search ? ' จากผลค้นหา' : ''}`}>
        <DataTable rows={questions} search={search} />
      </Panel>
    </section>
  );
}

function PopularQuestionList({ questions }) {
  if (!questions.length) {
    return <EmptyState text="ยังไม่มีคำถามสำหรับแสดง" />;
  }

  return (
    <div className="space-y-3">
      {questions.map((item, index) => (
        <div key={`${item.intentKey}-${item.questionText}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                  {item.label}
                </span>
                <span className="text-xs text-slate-400">{formatThaiDateTime(item.updatedAt)}</span>
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{item.questionText}</p>
            </div>
            <div className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
              {item.count} ครั้ง
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, search }) {
  if (!rows.length) {
    return <EmptyState text={search ? 'ไม่พบข้อมูลตามคำค้นหา' : 'ยังไม่มีข้อมูลในตาราง'} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <div className="grid grid-cols-[1fr_180px_110px] gap-4 bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        <div>คำถามจริง</div>
        <div>หมวด</div>
        <div>จำนวน</div>
      </div>

      <div className="divide-y divide-slate-100">
        {rows.map((item, index) => (
          <div key={`${item.intentKey}-${item.questionText}-${index}`} className="grid grid-cols-[1fr_180px_110px] gap-4 px-5 py-4 hover:bg-slate-50">
            <div className="text-sm font-semibold leading-6 text-slate-800">{item.questionText}</div>
            <div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {item.label}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-700">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartPanelFallback({ tall = false, compact = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 space-y-2">
        <div className="h-6 w-40 rounded bg-slate-100" />
        <div className="h-4 w-56 rounded bg-slate-100" />
      </div>
      <div className={`${tall ? 'h-[540px]' : compact ? 'h-[280px]' : 'h-[360px]'} animate-pulse rounded-2xl bg-slate-100`} />
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  const IconComponent = icon;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
        active ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-300 hover:bg-white/8 hover:text-white'
      }`}
    >
      <IconComponent size={18} />
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ icon, title, value, helper, tone = 'blue' }) {
  const toneClassMap = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
  };

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClassMap[tone] || toneClassMap.blue}`}>
        {icon}
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </article>
  );
}

function InsightCard({ title, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-2 text-base font-black leading-7 text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-xl font-black tracking-tight text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  );
}

export default App;
