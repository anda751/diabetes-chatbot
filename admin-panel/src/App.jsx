import React, { Suspense, lazy, useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  BookOpen,
  Download,
  Edit3,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Siren,
  Stethoscope,
  Target,
  Upload,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
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
  { id: 'evaluation', label: 'ประเมินความถูกต้อง', icon: Target },
  { id: 'health', label: 'สถานะระบบ', icon: Stethoscope },
  { id: 'table', label: 'ตารางข้อมูล', icon: ClipboardList },
  { id: 'users', label: 'ดูผู้ใช้', icon: Users },
  { id: 'records', label: 'ค้นหารายการ', icon: ClipboardList },
  { id: 'anomalies', label: 'แจ้งเตือนผิดปกติ', icon: Siren },
  { id: 'knowledge', label: 'คลังความรู้', icon: BookOpen },
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

function formatThaiDateOnly(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDefaultDateRange() {
  return {
    startDate: '',
    endDate: '',
  };
}

function normalizeDateRange(dateRange) {
  const startDate = dateRange?.startDate || '';
  const endDate = dateRange?.endDate || '';

  if (startDate && !endDate) {
    return { startDate, endDate: startDate };
  }

  if (!startDate && endDate) {
    return { startDate: endDate, endDate };
  }

  return { startDate, endDate };
}

function buildAdminQueryString(dateRange) {
  const normalizedRange = normalizeDateRange(dateRange);
  const params = new URLSearchParams();
  if (normalizedRange.startDate) params.set('startDate', normalizedRange.startDate);
  if (normalizedRange.endDate) params.set('endDate', normalizedRange.endDate);
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
      const normalizedRange = normalizeDateRange(dateRange);
      if (
        normalizedRange.startDate &&
        normalizedRange.endDate &&
        normalizedRange.startDate > normalizedRange.endDate
      ) {
        throw new Error('ช่วงวันที่ไม่ถูกต้อง');
      }

      const queryString = buildAdminQueryString(normalizedRange);
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

      if (
        overviewResponse.status === 401 ||
        healthResponse.status === 401 ||
        qualityResponse.status === 401
      ) {
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
          overviewData?.updatedAt ||
          qualityData?.updatedAt ||
          healthData?.updatedAt ||
          new Date().toISOString(),
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
      const normalizedRange = normalizeDateRange(dateRange);
      if (
        normalizedRange.startDate &&
        normalizedRange.endDate &&
        normalizedRange.startDate > normalizedRange.endDate
      ) {
        throw new Error('ช่วงวันที่ไม่ถูกต้อง');
      }

      const query = new URLSearchParams(buildAdminQueryString(normalizedRange).slice(1));
      if ((activeView === 'users' || activeView === 'records') && search.trim()) {
        query.set('search', search.trim());
      }

      const exportPathMap = {
        quality: '/admin/export/fallbacks.csv',
        evaluation: '/admin/export/evaluation.csv',
        knowledge: '/admin/export/knowledge.csv',
        users: '/admin/export/users.csv',
        records: '/admin/export/records.csv',
        anomalies: '/admin/export/anomalies.csv',
        overview: '/admin/export/questions.csv',
        analytics: '/admin/export/questions.csv',
        popular: '/admin/export/questions.csv',
        health: '/admin/export/questions.csv',
        table: '/admin/export/questions.csv',
      };
      const exportPath = exportPathMap[activeView] || '/admin/export/questions.csv';

      const response = await fetch(`${API_URL}${exportPath}${query.toString() ? `?${query.toString()}` : ''}`, {
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
      const filenameMap = {
        quality: 'admin-fallbacks.csv',
        evaluation: 'admin-evaluation.csv',
        knowledge: 'admin-knowledge.csv',
        users: 'admin-users.csv',
        records: 'admin-records.csv',
        anomalies: 'admin-anomalies.csv',
      };
      const filename = filenameMap[activeView] || 'admin-questions.csv';
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
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">
              Admin Panel
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Diabetes Insight</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              ใช้ดูภาพรวมคำถาม การใช้งานสุขภาพ และคุณภาพการตอบของหมอ AI ในหน้าเดียว
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Admin Session
            </p>
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              อัปเดตล่าสุด
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {formatThaiDateTime(dashboardData.updatedAt)}
            </p>
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
            exportLabel={
              activeView === 'quality'
                ? 'Export Fallback CSV'
                : activeView === 'knowledge'
                  ? 'Export Knowledge CSV'
                  : 'Export Questions CSV'
            }
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

          {activeView === 'popular' && <PopularQuestionsView questions={filteredQuestions} />}

          {activeView === 'quality' && <QualityView quality={dashboardData.quality} />}

          {activeView === 'evaluation' && <EvaluationView search={search} dateRange={dateRange} />}

          {activeView === 'health' && <HealthView health={dashboardData.health} />}

          {activeView === 'knowledge' && <KnowledgeView search={search} />}

          {activeView === 'users' && <UsersView search={search} />}

          {activeView === 'records' && (
            <RecordsView search={search} dateRange={dateRange} />
          )}

          {activeView === 'anomalies' && (
            <AnomaliesView search={search} dateRange={dateRange} />
          )}

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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-500">
            Admin Access
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            เข้าสู่ระบบแอดมิน
          </h1>
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
  const normalizedRange = normalizeDateRange(dateRange);

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
              <span className="mt-2 block text-xs font-semibold text-slate-400">
                {dateRange.startDate ? formatThaiDateOnly(dateRange.startDate) : 'ยังไม่ได้เลือก'}
              </span>
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
              <span className="mt-2 block text-xs font-semibold text-slate-400">
                {dateRange.endDate
                  ? formatThaiDateOnly(dateRange.endDate)
                  : 'ถ้าเว้นว่าง จะใช้วันเดียวกับ Start'}
              </span>
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
        <span className="rounded-2xl bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 shadow-sm">
          กรองจริง: {formatThaiDateOnly(normalizedRange.startDate)} ถึง{' '}
          {formatThaiDateOnly(normalizedRange.endDate)}
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
        <MetricCard
          icon={<Users size={20} />}
          title="ผู้ใช้ทั้งหมด"
          value={summary?.totalUsers || 0}
          helper="นับจากบัญชีที่สมัครไว้"
          tone="blue"
        />
        <MetricCard
          icon={<MessageSquareText size={20} />}
          title="คำถามทั้งหมด"
          value={summary?.totalQuestions || 0}
          helper="รวมทุกครั้งที่ระบบบันทึกคำถาม"
          tone="emerald"
        />
        <MetricCard
          icon={<ClipboardList size={20} />}
          title="คำถามไม่ซ้ำ"
          value={summary?.totalQuestionTypes || 0}
          helper="จำนวนหัวข้อคำถามที่ไม่ซ้ำกัน"
          tone="amber"
        />
        <MetricCard
          icon={<Activity size={20} />}
          title="บันทึกน้ำตาล"
          value={summary?.totalGlucoseRecords || 0}
          helper="จำนวนรายการในประวัติน้ำตาล"
          tone="indigo"
        />
        <MetricCard
          icon={<Stethoscope size={20} />}
          title="ผู้ใช้ที่ตั้งเตือน"
          value={summary?.activeReminderUsers || 0}
          helper="ผู้ใช้ที่เปิดมื้ออาหารอย่างน้อย 1 รายการ"
          tone="sky"
        />
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
        <Panel
          title="คำถามที่ถูกถามบ่อยที่สุด"
          description="ข้อมูลจริงจาก backend ที่ถูกถามบ่อยล่าสุด"
        >
          <PopularQuestionList questions={topQuestions.slice(0, 6)} />
        </Panel>

        <Panel title="สรุปที่ควรรู้" description="ใช้ดูว่าระบบและการใช้งานไปทางไหน">
          <div className="space-y-4">
            <InsightCard
              title="หมวดที่ถูกถามมากสุด"
              value={summary?.topCategory?.label || '-'}
              helper={
                summary?.topCategory
                  ? `${summary.topCategory.count} ครั้ง`
                  : 'ยังไม่มีข้อมูล'
              }
            />
            <InsightCard
              title="คำถามเด่นที่สุด"
              value={summary?.topQuestion?.questionText || '-'}
              helper={
                summary?.topQuestion
                  ? `${summary.topQuestion.count} ครั้ง`
                  : 'ยังไม่มีข้อมูล'
              }
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
            <div
              key={item.intentKey}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
            >
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
      <Panel
        title="คำถามยอดนิยมจริง"
        description="ใช้ดูคำถามจริงที่ผู้ใช้พิมพ์เข้ามา และควรนำไปปรับ quick prompts หรือ fallback ต่อ"
      >
        <PopularQuestionList questions={questions} />
      </Panel>
    </section>
  );
}

function KnowledgeView({ search }) {
  const knowledgeIntentOptions = [
    { value: 'general', label: 'ทั่วไป' },
    { value: 'greeting', label: 'ทักทาย' },
    { value: 'food', label: 'อาหาร' },
    { value: 'glucose', label: 'น้ำตาล' },
    { value: 'symptom', label: 'อาการ' },
    { value: 'exercise', label: 'ออกกำลังกาย' },
    { value: 'medicine', label: 'ยา' },
    { value: 'report', label: 'รายงาน' },
  ];

  const emptyForm = {
    title: '',
    content: '',
    intentKey: 'general',
    tags: '',
    sortOrder: '0',
    isEnabled: true,
  };

  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/admin/knowledge`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        throw new Error('session_expired');
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'โหลดคลังความรู้ไม่สำเร็จ');
      }

      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKnowledge();
  }, [loadKnowledge]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const content = String(item.content || '').toLowerCase();
      const tags = String(item.tags || '').toLowerCase();
      const intentKey = String(item.intentKey || '').toLowerCase();
      return (
        title.includes(keyword) ||
        content.includes(keyword) ||
        tags.includes(keyword) ||
        intentKey.includes(keyword)
      );
    });
  }, [items, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      content: item.content || '',
      intentKey: item.intentKey || 'general',
      tags: item.tags || '',
      sortOrder: String(item.sortOrder ?? 0),
      isEnabled: item.isEnabled !== false,
    });
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        intentKey: form.intentKey,
        tags: form.tags.trim(),
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isEnabled: form.isEnabled,
      };

      const response = await fetch(
        editingId ? `${API_URL}/admin/knowledge/${editingId}` : `${API_URL}/admin/knowledge`,
        {
          method: editingId ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'บันทึกความรู้ไม่สำเร็จ');
      }

      setMessage(editingId ? 'แก้ไขความรู้เรียบร้อยแล้ว' : 'เพิ่มความรู้ใหม่เรียบร้อยแล้ว');
      resetForm();
      await loadKnowledge();
    } catch (submitError) {
      setError(submitError.message || 'บันทึกความรู้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/admin/knowledge/${item.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled: !item.isEnabled }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'อัปเดตสถานะความรู้ไม่สำเร็จ');
      }

      setMessage(item.isEnabled ? 'ปิดใช้งานความรู้แล้ว' : 'เปิดใช้งานความรู้แล้ว');
      await loadKnowledge();
    } catch (toggleError) {
      setError(toggleError.message || 'อัปเดตสถานะความรู้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`ลบความรู้ "${item.title}" ใช่ไหม?`)) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/admin/knowledge/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || 'ลบความรู้ไม่สำเร็จ');
      }

      if (editingId === item.id) {
        resetForm();
      }

      setMessage('ลบความรู้เรียบร้อยแล้ว');
      await loadKnowledge();
    } catch (deleteError) {
      setError(deleteError.message || 'ลบความรู้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-6">
      <Panel
        title={editingId ? 'แก้ไขความรู้' : 'เพิ่มความรู้ใหม่'}
        description="เพิ่มข้อมูลหรือแนวทางใหม่ให้แชทบอทนำไปใช้ตอบได้จริง"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">หัวข้อ</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
              placeholder="เช่น วิธีดูแลน้ำตาลหลังอาหาร"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">หมวด</span>
              <select
                value={form.intentKey}
                onChange={(event) => setForm((prev) => ({ ...prev, intentKey: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
              >
                {knowledgeIntentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">ลำดับ</span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
                min="0"
                step="1"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">แท็ก</span>
            <input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
              placeholder="เช่น น้ำตาล, มื้อเช้า, คำแนะนำ"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">เนื้อหา</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              rows={8}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-sky-400"
              placeholder="ใส่ความรู้ คำแนะนำ หรือข้อมูลที่อยากให้บอทจำและนำไปตอบ"
            />
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">เปิดใช้งาน</p>
              <p className="text-xs text-slate-500">ถ้าปิดไว้ บอทจะไม่เอาความรู้นี้ไปใช้</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
              className="text-slate-700"
            >
              {form.isEnabled ? <ToggleRight size={34} className="text-emerald-600" /> : <ToggleLeft size={34} className="text-slate-400" />}
            </button>
          </label>

          {message ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Save size={17} />
              {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มความรู้'}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <X size={17} />
                ยกเลิกแก้ไข
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel
        title="รายการความรู้ทั้งหมด"
        description={`ทั้งหมด ${filteredItems.length} รายการ${search ? ' จากผลค้นหา' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            แชทบอทจะนำรายการที่เปิดใช้งานและตรงหมวดไปใช้ประกอบการตอบ
          </div>
          <button
            onClick={() => void loadKnowledge()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>

        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">
              กำลังโหลดคลังความรู้...
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                        {item.intentKey}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {item.isEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                        ลำดับ {item.sortOrder || 0}
                      </span>
                    </div>

                    <h4 className="mt-3 text-base font-black text-slate-900">{item.title}</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {item.content}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {item.tags ? <span>แท็ก: {item.tags}</span> : <span>ไม่มีแท็ก</span>}
                      <span>อัปเดต {formatThaiDateTime(item.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Edit3 size={14} />
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggle(item)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      {item.isEnabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                      {item.isEnabled ? 'ปิด' : 'เปิด'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState text={search ? 'ไม่พบความรู้ตามคำค้นหา' : 'ยังไม่มีคลังความรู้ เพิ่มรายการแรกได้เลย'} />
          )}
        </div>
      </Panel>
    </section>
  );
}

function UsersView({ search }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/users?search=${encodeURIComponent(search.trim())}`, {
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('session_expired');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'ดึงรายชื่อผู้ใช้ไม่สำเร็จ');
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotal(Number(payload?.total) || 0);
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadDetail = useCallback(async (userId) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'ดึงรายละเอียดผู้ใช้ไม่สำเร็จ');
      setDetail(payload);
    } catch (fetchError) {
      setDetail(null);
      setError(fetchError.message || 'ดึงรายละเอียดผู้ใช้ไม่สำเร็จ');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUserId && items.length) {
      void loadDetail(items[0].id);
    }
  }, [items, selectedUserId, loadDetail]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const haystack = [item.username, item.name, item.stage, item.bmi, item.lastActivityAt]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, search]);

  const selectedSummary = detail?.user || null;

  return (
    <section className="mt-7 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Panel
        title="ผู้ใช้ทั้งหมด"
        description={`แสดง ${filteredItems.length} จาก ${total} บัญชี${search ? ' ที่ค้นพบ' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">คลิกรายชื่อเพื่อดูประวัติและสถิติแบบรายคน</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            รีเฟรช
          </button>
        </div>

        <div className="mt-4 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <EmptyState text="กำลังโหลดรายชื่อผู้ใช้..." />
          ) : filteredItems.length ? (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void loadDetail(item.id)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  selectedUserId === item.id
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-100 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      @{item.username} • stage {item.stage} • BMI {item.bmi || '-'}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      ล่าสุด: {formatThaiDateTime(item.lastActivityAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">น้ำตาล</p>
                    <p className="text-sm font-black text-slate-900">{item.glucoseCount}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">ถาม</p>
                    <p className="text-sm font-black text-slate-900">{item.chatCount}</p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <EmptyState text={search ? 'ไม่พบผู้ใช้ตามคำค้นหา' : 'ยังไม่มีผู้ใช้ให้แสดง'} />
          )}
        </div>
      </Panel>

      <Panel
        title="รายละเอียดผู้ใช้"
        description="ดูประวัติ น้ำตาล คำถาม และข้อมูลที่เกี่ยวข้องของคนนี้"
      >
        {detailLoading ? (
          <EmptyState text="กำลังโหลดรายละเอียด..." />
        ) : selectedSummary ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <InsightCard title="ชื่อ" value={selectedSummary.name} helper={`@${selectedSummary.username}`} />
              <InsightCard title="สถานะ" value={`stage ${selectedSummary.stage}`} helper={`BMI ${selectedSummary.bmi || '-'} | น้ำหนัก ${selectedSummary.weight || '-'} | ส่วนสูง ${selectedSummary.height || '-'}`} />
              <InsightCard title="น้ำตาลล่าสุด" value={selectedSummary.lastGlucoseValue != null ? `${selectedSummary.lastGlucoseValue} mg/dL` : '-'} helper={formatThaiDateTime(selectedSummary.lastGlucoseAt)} />
              <InsightCard title="คำถามล่าสุด" value={selectedSummary.chatCount || 0} helper={formatThaiDateTime(selectedSummary.lastQuestionAt)} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="text-sm font-black text-slate-900">ประวัติน้ำตาลล่าสุด</p>
                <div className="mt-3 space-y-2">
                  {detail?.recentGlucose?.length ? detail.recentGlucose.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.value} mg/dL</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.phase === 'before' ? 'ก่อนอาหาร' : item.phase === 'after' ? 'หลังอาหาร' : item.phase || '-'} • {item.date || '-'} {item.time || ''}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">{formatThaiDateTime(item.recordedAt)}</span>
                      </div>
                    </div>
                  )) : <EmptyState text="ยังไม่มีประวัติน้ำตาล" />}
                </div>
              </div>

              <div>
                <p className="text-sm font-black text-slate-900">ประวัติคำถามล่าสุด</p>
                <div className="mt-3 space-y-2">
                  {detail?.recentQuestions?.length ? detail.recentQuestions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold leading-6 text-slate-800">{item.questionText}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-white px-2.5 py-1 font-bold">{item.intentKey}</span>
                        {item.usedFallback ? <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">fallback</span> : null}
                        <span>{item.responseModel}</span>
                        <span>{formatThaiDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                  )) : <EmptyState text="ยังไม่มีประวัติคำถาม" />}
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-black text-slate-900">การแจ้งเตือนมื้ออาหาร</p>
              <div className="mt-3 space-y-2">
                {detail?.reminders?.length ? detail.reminders.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.reminderKey} • {item.time}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {item.isEnabled ? 'เปิด' : 'ปิด'}
                      </span>
                    </div>
                  </div>
                )) : <EmptyState text="ยังไม่มีการแจ้งเตือน" />}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState text="เลือกผู้ใช้จากฝั่งซ้ายเพื่อดูรายละเอียด" />
        )}
      </Panel>
    </section>
  );
}

function RecordsView({ search, dateRange }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('type', typeFilter);
      params.set('search', search.trim());
      if (userFilter.trim()) params.set('userId', userFilter.trim());
      if (phaseFilter !== 'all') params.set('phase', phaseFilter);
      if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.set('endDate', dateRange.endDate);

      const response = await fetch(`${API_URL}/admin/records?${params.toString()}`, {
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('session_expired');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'ดึงรายการบันทึกไม่สำเร็จ');
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, phaseFilter, userFilter, search, dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleDelete = async (item) => {
    if (!window.confirm(`ลบรายการ ${item.title} นี้ใช่ไหม?`)) return;
    setMessage('');
    setError('');
    try {
      const response = await fetch(`${API_URL}/admin/records/${item.recordType}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'ลบรายการไม่สำเร็จ');
      setMessage('ลบรายการเรียบร้อยแล้ว');
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError.message || 'ลบรายการไม่สำเร็จ');
    }
  };

  const glucoseCount = items.filter((item) => item.recordType === 'glucose').length;
  const chatCount = items.filter((item) => item.recordType === 'chat').length;

  return (
    <section className="mt-7 space-y-6">
      <Panel
        title="ค้นหาและจัดการ record"
        description="กรองระดับ record เพื่อไล่ตรวจข้อมูลรายรายการและลบข้อมูลที่ไม่ต้องการได้"
      >
        <div className="grid gap-3 lg:grid-cols-[160px_160px_1fr_160px]">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none"
          >
            <option value="all">ทั้งหมด</option>
            <option value="glucose">น้ำตาล</option>
            <option value="chat">คำถาม</option>
          </select>
          <select
            value={phaseFilter}
            onChange={(event) => setPhaseFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none"
          >
            <option value="all">ทุกช่วง</option>
            <option value="before">ก่อนอาหาร</option>
            <option value="after">หลังอาหาร</option>
          </select>
          <input
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="กรองด้วย user id"
            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none"
          />
          <button
            type="button"
            onClick={() => void loadRecords()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            โหลดใหม่
          </button>
        </div>

        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<ClipboardList size={20} />} title="record รวม" value={items.length} helper="ผลลัพธ์ที่โหลดจากการค้นหาล่าสุด" tone="indigo" />
        <MetricCard icon={<Users size={20} />} title="น้ำตาล" value={glucoseCount} helper="รายการบันทึกน้ำตาล" tone="emerald" />
        <MetricCard icon={<MessageSquareText size={20} />} title="คำถาม" value={chatCount} helper="รายการคำถามจาก user" tone="amber" />
      </div>

      <Panel
        title="รายการบันทึก"
        description={`แสดง ${items.length} รายการ${search ? ' ตามคำค้นหา' : ''}`}
      >
        {loading ? (
          <EmptyState text="กำลังโหลดรายการ..." />
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={`${item.recordType}-${item.id}`} className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                        {item.recordType}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        @{item.username} • {item.name}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-black text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.subtitle}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatThaiDateTime(item.recordedAt || item.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.recordType === 'glucose' ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        {item.phase || '-'} • {item.value} mg/dL
                      </span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.usedFallback ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                        {item.intentKey || 'general'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="ไม่พบรายการตามเงื่อนไขที่กรอง" />
        )}
      </Panel>
    </section>
  );
}

function AnomaliesView({ search, dateRange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnomalies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.set('endDate', dateRange.endDate);
      const response = await fetch(`${API_URL}/admin/anomalies?${params.toString()}`, {
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('session_expired');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'ดึง anomaly ไม่สำเร็จ');
      setData(payload);
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    void loadAnomalies();
  }, [loadAnomalies]);

  const filteredGlucose = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.glucoseAlerts || [];
    return (data?.glucoseAlerts || []).filter((item) =>
      [item.username, item.name, item.phase, item.value, item.severity].join(' ').toLowerCase().includes(keyword)
    );
  }, [data?.glucoseAlerts, search]);

  const filteredFallbacks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.fallbackAlerts || [];
    return (data?.fallbackAlerts || []).filter((item) =>
      [item.username, item.name, item.fallbackCount].join(' ').toLowerCase().includes(keyword)
    );
  }, [data?.fallbackAlerts, search]);

  const filteredRepeats = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data?.repeatedQuestionAlerts || [];
    return (data?.repeatedQuestionAlerts || []).filter((item) =>
      [item.username, item.name, item.questionText, item.questionCount].join(' ').toLowerCase().includes(keyword)
    );
  }, [data?.repeatedQuestionAlerts, search]);

  return (
    <section className="mt-7 space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Siren size={20} />} title="น้ำตาลผิดปกติ" value={data?.summary?.glucoseAlerts || 0} helper="ค่าที่สูงหรือต่ำผิดปกติ" tone="amber" />
        <MetricCard icon={<MessageSquareText size={20} />} title="fallback ผู้ใช้" value={data?.summary?.fallbackUsers || 0} helper="ผู้ใช้ที่ติด fallback ซ้ำ" tone="indigo" />
        <MetricCard icon={<ClipboardList size={20} />} title="คำถามซ้ำ" value={data?.summary?.repeatedQuestions || 0} helper="คำถามเดิมที่เกิดซ้ำหลายครั้ง" tone="emerald" />
      </div>

      <Panel
        title="แจ้งเตือน anomaly"
        description="เราจัดกลุ่มสัญญาณผิดปกติให้ทีมแอดมินไล่ดูได้ง่ายขึ้น"
      >
        {loading ? (
          <EmptyState text="กำลังโหลด anomaly..." />
        ) : error ? (
          <EmptyState text={error} />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-black text-slate-900">น้ำตาลผิดปกติ</p>
              <div className="mt-3 space-y-2">
                {filteredGlucose.length ? filteredGlucose.map((item) => (
                  <div key={`${item.userId}-${item.id}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.name} (@{item.username})</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.phase || '-'} • {item.value} mg/dL • {formatThaiDateTime(item.recordedAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.severity}
                      </span>
                    </div>
                  </div>
                )) : <EmptyState text="ยังไม่มีค่าเกิน threshold ในช่วงนี้" />}
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <p className="text-sm font-black text-slate-900">fallback หนัก</p>
                <div className="mt-3 space-y-2">
                  {filteredFallbacks.length ? filteredFallbacks.map((item) => (
                    <div key={item.userId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold text-slate-800">{item.name} (@{item.username})</p>
                      <p className="mt-1 text-xs text-slate-500">
                        fallback {item.fallbackCount} ครั้ง • ล่าสุด {formatThaiDateTime(item.lastSeenAt)}
                      </p>
                    </div>
                  )) : <EmptyState text="ยังไม่มีผู้ใช้ fallback ซ้ำ" />}
                </div>
              </div>

              <div>
                <p className="text-sm font-black text-slate-900">คำถามซ้ำ</p>
                <div className="mt-3 space-y-2">
                  {filteredRepeats.length ? filteredRepeats.map((item) => (
                    <div key={`${item.userId}-${item.questionText}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold leading-6 text-slate-800">{item.questionText}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.name} (@{item.username}) • {item.questionCount} ครั้ง • {formatThaiDateTime(item.lastSeenAt)}
                      </p>
                    </div>
                  )) : <EmptyState text="ยังไม่พบคำถามซ้ำระดับ anomaly" />}
                </div>
              </div>
            </div>
          </div>
        )}
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
            <div
              key={item.key}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  item.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                <Icon size={22} />
              </div>
              <p className="mt-4 text-lg font-black text-slate-900">{item.label}</p>
              <p
                className={`mt-2 text-sm font-semibold ${
                  item.ok ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
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
              <span
                key={model}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
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
          title="ใช้คำตอบสำรอง"
          value={summary.fallbackCount || 0}
          helper="จำนวนครั้งที่ต้องใช้คำตอบสำรอง"
          tone="amber"
        />
        <MetricCard
          icon={<Activity size={20} />}
          title="อัตรา fallback"
          value={`${summary.fallbackRate || 0}%`}
          helper="สัดส่วนคำถามที่ AI ยังตอบได้ไม่ดีพอ"
          tone="indigo"
        />
      </section>

      <section className="mt-7 grid grid-cols-[1fr_1fr] gap-6">
        <Panel
          title="คำถามที่ fallback บ่อย"
          description="ใช้ดูว่าคำถามไหนควรเอาไปปรับ prompt หรือเพิ่มข้อมูลก่อน"
        >
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
                <div
                  key={`${item.questionText}-${index}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                          {item.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatThaiDateTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
                        {item.questionText}
                      </p>
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
        <Panel
          title="โมเดลที่ถูกใช้ตอบ"
          description="ช่วยดูว่าสัดส่วนการตอบออกจากโมเดลจริงและ fallback เป็นอย่างไร"
        >
          <div className="grid grid-cols-3 gap-4">
            {modelStats.map((item) => (
              <div
                key={item.model}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
              >
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

function EvaluationView({ search, dateRange }) {
  const intentOptions = [
    { value: 'general', label: 'ทั่วไป' },
    { value: 'greeting', label: 'ทักทาย' },
    { value: 'food', label: 'อาหาร' },
    { value: 'glucose', label: 'น้ำตาล' },
    { value: 'symptom', label: 'อาการ' },
    { value: 'exercise', label: 'ออกกำลังกาย' },
    { value: 'medicine', label: 'ยา' },
    { value: 'report', label: 'รายงาน' },
  ];

  const [state, setState] = useState({
    summary: null,
    labels: [],
    confusionMatrix: null,
    classMetrics: [],
    reviewQueue: [],
    updatedAt: '',
    source: '',
  });
  const [loading, setLoading] = useState(true);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    actualIntentKey: 'general',
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadEvaluation = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (dateRange?.startDate) params.set('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.set('endDate', dateRange.endDate);

      const response = await fetch(`${API_URL}/admin/evaluation?${params.toString()}`, {
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('session_expired');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'ดึงข้อมูลประเมินไม่สำเร็จ');

      setState({
        summary: payload?.summary || null,
        labels: Array.isArray(payload?.labels) ? payload.labels : [],
        confusionMatrix: payload?.confusionMatrix || null,
        classMetrics: Array.isArray(payload?.classMetrics) ? payload.classMetrics : [],
        reviewQueue: Array.isArray(payload?.reviewQueue) ? payload.reviewQueue : [],
        updatedAt: payload?.updatedAt || new Date().toISOString(),
        source: payload?.source || 'live',
      });

      const nextSelected = payload?.reviewQueue?.[0] || null;
      setSelectedItemId((current) => current ?? nextSelected?.id ?? null);
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
      setState({
        summary: null,
        labels: [],
        confusionMatrix: null,
        classMetrics: [],
        reviewQueue: [],
        updatedAt: '',
        source: '',
      });
    } finally {
      setLoading(false);
    }
  }, [search, dateRange?.startDate, dateRange?.endDate]);

  const loadBenchmarkSummary = useCallback(async () => {
    setBenchmarkLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/admin/evaluation/benchmark`, {
        credentials: 'include',
      });
      if (response.status === 401) throw new Error('session_expired');
      const responseText = await response.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(`เซิร์ฟเวอร์ส่งข้อมูลไม่ใช่ JSON (${response.status}) โปรดตรวจสอบว่า backend ทำงานอยู่ที่ port 5000`);
      }
      if (!response.ok) throw new Error(payload?.error || 'อ่านไฟล์ benchmark ไม่สำเร็จ');

      setState({
        summary: payload?.summary || null,
        labels: Array.isArray(payload?.labels) ? payload.labels : [],
        confusionMatrix: payload?.confusionMatrix || null,
        classMetrics: Array.isArray(payload?.classMetrics) ? payload.classMetrics : [],
        reviewQueue: Array.isArray(payload?.reviewQueue) ? payload.reviewQueue : [],
        updatedAt: payload?.updatedAt || new Date().toISOString(),
        source: payload?.source || 'benchmark-file',
      });
      setSelectedItemId(null);
      setReviewForm({
        actualIntentKey: 'general',
        notes: '',
      });
      setMessage('โหลด benchmark file เรียบร้อยแล้ว');
    } catch (fetchError) {
      setError(fetchError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : fetchError.message);
    } finally {
      setBenchmarkLoading(false);
    }
  }, []);

  const handleBenchmarkUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/admin/evaluation/benchmark/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, csvText: await file.text() }),
      });
      if (response.status === 401) throw new Error('session_expired');
      const responseText = await response.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(`เซิร์ฟเวอร์ส่งข้อมูลไม่ใช่ JSON (${response.status}) โปรดตรวจสอบว่า backend ทำงานอยู่ที่ port 5000`);
      }
      if (!response.ok) throw new Error(payload?.error || 'อัปโหลด benchmark ไม่สำเร็จ');

      setState({
        summary: payload?.summary || null,
        labels: Array.isArray(payload?.labels) ? payload.labels : [],
        confusionMatrix: payload?.confusionMatrix || null,
        classMetrics: Array.isArray(payload?.classMetrics) ? payload.classMetrics : [],
        reviewQueue: Array.isArray(payload?.reviewQueue) ? payload.reviewQueue : [],
        updatedAt: payload?.updatedAt || new Date().toISOString(),
        source: payload?.source || 'benchmark-upload',
      });
      setSelectedItemId(payload?.reviewQueue?.[0]?.id || null);
      setMessage(`อัปโหลด ${file.name} สำเร็จ แสดงคำถาม ${payload?.reviewQueue?.length || 0} ข้อแล้ว`);
    } catch (uploadError) {
      setError(uploadError.message === 'session_expired' ? 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' : uploadError.message);
    } finally {
      setUploadLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvaluation();
  }, [loadEvaluation]);

  const f1ChartData = useMemo(() => {
    return (state.classMetrics || []).map((item) => ({
      name: item.label,
      shortName: item.label.length > 18 ? `${item.label.slice(0, 18)}...` : item.label,
      value: Math.round((Number(item.f1) || 0) * 100),
    }));
  }, [state.classMetrics]);

  const selectedQueueItem = useMemo(() => {
    if (!selectedItemId) return state.reviewQueue[0] || null;
    return state.reviewQueue.find((item) => item.id === selectedItemId) || state.reviewQueue[0] || null;
  }, [selectedItemId, state.reviewQueue]);

  useEffect(() => {
    if (!selectedQueueItem) return;
    setReviewForm({
      actualIntentKey: selectedQueueItem.actualIntentKey || selectedQueueItem.predictedIntentKey || 'general',
      notes: selectedQueueItem.notes || '',
    });
  }, [selectedQueueItem?.id]);

  const handlePickItem = (item) => {
    setSelectedItemId(item.id);
    setReviewForm({
      actualIntentKey: item.actualIntentKey || item.predictedIntentKey || 'general',
      notes: item.notes || '',
    });
  };

  const handleSaveReview = async (event) => {
    event.preventDefault();
    if (!selectedQueueItem) return;

    setSavingId(selectedQueueItem.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/admin/evaluation/${selectedQueueItem.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actualIntentKey: reviewForm.actualIntentKey,
          notes: reviewForm.notes,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'บันทึกการประเมินไม่สำเร็จ');

      setMessage('บันทึกการประเมินเรียบร้อยแล้ว');
      await loadEvaluation();
    } catch (saveError) {
      setError(saveError.message || 'บันทึกการประเมินไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  const handleClearReview = async () => {
    if (!selectedQueueItem) return;
    if (!window.confirm('ลบ label การประเมินของรายการนี้ใช่ไหม?')) return;

    setSavingId(selectedQueueItem.id);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/admin/evaluation/${selectedQueueItem.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'ลบการประเมินไม่สำเร็จ');

      setMessage('ลบการประเมินเรียบร้อยแล้ว');
      await loadEvaluation();
    } catch (deleteError) {
      setError(deleteError.message || 'ลบการประเมินไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  const matrix = state.confusionMatrix || { labels: [], rows: [] };
  const matrixLabels = matrix.labels || [];
  const maxCell = Math.max(
    0,
    ...((matrix.rows || []).flatMap((row) => row.cells?.map((cell) => Number(cell.count) || 0) || []))
  );

  return (
    <section className="mt-7 space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={<CheckCircle2 size={20} />}
          title="Accuracy"
          value={`${((state.summary?.accuracy || 0) * 100).toFixed(1)}%`}
          helper={`รีวิวแล้ว ${state.summary?.totalReviewed || 0} รายการ`}
          tone="emerald"
        />
        <MetricCard
          icon={<Target size={20} />}
          title="Precision"
          value={`${((state.summary?.macroPrecision || 0) * 100).toFixed(1)}%`}
          helper="ค่าเฉลี่ยแบบ macro"
          tone="blue"
        />
        <MetricCard
          icon={<Activity size={20} />}
          title="Recall"
          value={`${((state.summary?.macroRecall || 0) * 100).toFixed(1)}%`}
          helper="ค่าเฉลี่ยแบบ macro"
          tone="indigo"
        />
        <MetricCard
          icon={<XCircle size={20} />}
          title="F-measure"
          value={`${((state.summary?.macroF1 || 0) * 100).toFixed(1)}%`}
          helper="ค่าเฉลี่ยแบบ macro"
          tone="amber"
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Suspense fallback={<ChartPanelFallback tall />}>
          <BarPanel
            chartData={f1ChartData}
            colors={COLORS}
            search={search}
            tall
            title="F1 ราย intent"
            description="ใช้ label จริงที่แอดมินเลือกเทียบกับ intent ที่ระบบทำนาย"
          />
        </Suspense>

        <Panel
          title="Confusion Matrix"
          description="แถว = intent จริง, คอลัมน์ = intent ที่ระบบทำนาย"
        >
          {loading ? (
            <EmptyState text="กำลังโหลดข้อมูลประเมิน..." />
          ) : matrixLabels.length ? (
            <div className="overflow-auto">
              <div
                className="grid gap-px rounded-2xl bg-slate-200 p-px"
                style={{
                  gridTemplateColumns: `180px repeat(${matrixLabels.length}, minmax(72px, 1fr))`,
                }}
              >
                <div className="bg-slate-50 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Actual / Pred
                </div>
                {matrixLabels.map((label) => (
                  <div
                    key={label.intentKey}
                    className="bg-slate-50 px-3 py-3 text-center text-xs font-black text-slate-500"
                  >
                    {label.label}
                  </div>
                ))}
                {matrix.rows.map((row) => (
                  <React.Fragment key={row.actualIntentKey}>
                    <div className="bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                      {row.actualLabel}
                    </div>
                    {row.cells.map((cell) => {
                      const count = Number(cell.count) || 0;
                      const opacity = maxCell ? Math.max(0.08, count / maxCell) : 0.08;
                      return (
                        <div
                          key={`${row.actualIntentKey}-${cell.predictedIntentKey}`}
                          className="min-h-16 bg-white px-3 py-3 text-center"
                          style={{
                            backgroundColor: `rgba(37, 99, 235, ${opacity})`,
                          }}
                        >
                          <p className="text-sm font-black text-slate-900">{count}</p>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState text="ยังไม่มี label จริงให้คำนวณ matrix" />
          )}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel
          title="รายการสำหรับติด label"
          description="เลือกคำตอบจริงของแต่ละคำถาม แล้วระบบจะคำนวณ metric ให้ใหม่"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">คลิกรายการทางซ้ายเพื่อแก้ label จริง</p>
              {state.source ? (
                <p className="text-xs font-medium text-slate-400">
                  แหล่งข้อมูล: {state.source === 'benchmark-file' ? 'benchmark file' : state.source === 'benchmark-upload' ? 'ไฟล์ที่อัปโหลด' : 'ข้อมูลจริง'}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
                <Upload size={16} className={uploadLoading ? 'animate-pulse' : ''} />
                {uploadLoading ? 'กำลังอัปโหลด...' : 'อัปโหลด CSV'}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBenchmarkUpload} disabled={uploadLoading} />
              </label>
              <button
                type="button"
                onClick={() => void loadBenchmarkSummary()}
                disabled={benchmarkLoading}
                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Target size={16} className={benchmarkLoading ? 'animate-pulse' : ''} />
                โหลด Benchmark
              </button>
              <button
                type="button"
                onClick={() => void loadEvaluation()}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                รีเฟรช
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
            {state.reviewQueue.length ? (
              state.reviewQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePickItem(item)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                    selectedQueueItem?.id === item.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-100 bg-slate-50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                          @{item.username || '-'}
                        </span>
                        {item.isReviewed ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            reviewed
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                            pending
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-bold leading-6 text-slate-800">
                        {item.questionText}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Predicted: {item.predictedLabel} • {item.responseModel}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{formatThaiDateTime(item.createdAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState text="ยังไม่มีรายการให้ประเมิน" />
            )}
          </div>
        </Panel>

        <Panel title="แก้ label จริง" description="เลือก intent จริงของคำถามนี้">
          {selectedQueueItem?.readOnly ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-500">คำถามจากไฟล์ benchmark</p>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-800">{selectedQueueItem.questionText}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">คำตอบที่คาดหวัง</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{selectedQueueItem.actualLabel}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">คำตอบที่ระบบทำนาย</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{selectedQueueItem.predictedLabel}</p>
                </div>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${selectedQueueItem.actualIntentKey === selectedQueueItem.predictedIntentKey ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {selectedQueueItem.actualIntentKey === selectedQueueItem.predictedIntentKey ? 'ถูกต้อง' : 'ไม่ถูกต้อง'} — รายการนี้เป็นข้อมูลจากไฟล์ทดสอบแบบอ่านอย่างเดียว
              </div>
            </div>
          ) : selectedQueueItem ? (
            <form className="space-y-4" onSubmit={handleSaveReview}>
              <div className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
                <p className="text-sm font-bold leading-6 text-slate-800">{selectedQueueItem.questionText}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Predicted: {selectedQueueItem.predictedLabel} • {selectedQueueItem.responseModel} •{' '}
                  {formatThaiDateTime(selectedQueueItem.createdAt)}
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">คำตอบจริง / intent จริง</span>
                <select
                  value={reviewForm.actualIntentKey}
                  onChange={(event) =>
                    setReviewForm((prev) => ({ ...prev, actualIntentKey: event.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-400"
                >
                  {intentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">หมายเหตุ</span>
                <textarea
                  value={reviewForm.notes}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-sky-400"
                  placeholder="เช่น คำตอบควรเป็นอาหาร / ควรตอบแบบ fallback / ตอบผิดหมวด"
                />
              </label>

              {selectedQueueItem.actualIntentKey ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Current review: {selectedQueueItem.actualLabel}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {message}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={savingId === selectedQueueItem.id}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Save size={17} />
                  {savingId === selectedQueueItem.id ? 'กำลังบันทึก...' : 'บันทึก label'}
                </button>

                <button
                  type="button"
                  onClick={handleClearReview}
                  disabled={savingId === selectedQueueItem.id || !selectedQueueItem.isReviewed}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={17} />
                  ลบ label
                </button>
              </div>
            </form>
          ) : (
            <EmptyState text="เลือกรายการจากฝั่งซ้ายเพื่อเริ่มประเมิน" />
          )}
        </Panel>
      </section>
    </section>
  );
}

function QuestionTableView({ questions, search }) {
  return (
    <section className="mt-7">
      <Panel
        title="ตารางคำถามจริง"
        description={`แสดง ${questions.length} รายการ${search ? ' จากผลค้นหา' : ''}`}
      >
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
        <div
          key={`${item.intentKey}-${item.questionText}-${index}`}
          className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                  {item.label}
                </span>
                {item.updatedAt ? (
                  <span className="text-xs text-slate-400">
                    {formatThaiDateTime(item.updatedAt)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">ยังไม่มีเวลา log จริง</span>
                )}
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
                {item.questionText}
              </p>
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
          <div
            key={`${item.intentKey}-${item.questionText}-${index}`}
            className="grid grid-cols-[1fr_180px_110px] gap-4 px-5 py-4 hover:bg-slate-50"
          >
            <div className="text-sm font-semibold leading-6 text-slate-800">
              {item.questionText}
            </div>
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
      <div
        className={`${
          tall ? 'h-[540px]' : compact ? 'h-[280px]' : 'h-[360px]'
        } animate-pulse rounded-2xl bg-slate-100`}
      />
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
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          toneClassMap[tone] || toneClassMap.blue
        }`}
      >
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
