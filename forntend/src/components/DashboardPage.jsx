import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Droplet,
  Dumbbell,
  LogOut,
  MessageCircleHeart,
  Bell,
  BellRing,
  Plus,
  Settings2,
  ShieldPlus,
  Sparkles,
  TrendingDown,
  User,
  X,
} from 'lucide-react';
import GlucoseModal from './GlucoseModal';

function loadMealReminders() {
  try {
    const saved = localStorage.getItem('meal_reminders');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 1, label: 'มื้อเช้า', time: '08:00', isDone: false },
          { id: 2, label: 'มื้อกลางวัน', time: '12:00', isDone: false },
          { id: 3, label: 'มื้อเย็น', time: '18:00', isDone: false },
        ];
  } catch (_error) {
    return [
      { id: 1, label: 'มื้อเช้า', time: '08:00', isDone: false },
      { id: 2, label: 'มื้อกลางวัน', time: '12:00', isDone: false },
      { id: 3, label: 'มื้อเย็น', time: '18:00', isDone: false },
    ];
  }
}

export default function DashboardPage({
  onSelectChat,
  onSelectReport,
  onEditProfile,
  onLogout,
  userName,
  bmi,
  stage,
  allergy,
  treatment,
  lastGlucose,
  beforeGlucose,
  afterGlucose,
  onSaveGlucose,
  onNotice,
  notificationPermission,
  onEnableNotifications,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reminders, setReminders] = useState(loadMealReminders);
  const [isSettingReminders, setIsSettingReminders] = useState(false);

  useEffect(() => {
    localStorage.setItem('meal_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const visibleReminders = useMemo(
    () => reminders.filter((item) => isSettingReminders || !item.isDone),
    [isSettingReminders, reminders]
  );
  const notificationState = useMemo(() => {
    if (notificationPermission === 'granted') {
      return {
        label: 'เปิดการแจ้งเตือนแล้ว',
        detail: 'ระบบจะแจ้งเตือนเมื่อถึงเวลาอาหาร หากเว็บแอปยังเปิดอยู่',
        tone: 'bg-emerald-50 border-emerald-100 text-emerald-700',
      };
    }

    if (notificationPermission === 'denied') {
      return {
        label: 'การแจ้งเตือนถูกปิดอยู่',
        detail: 'เปิดสิทธิ์แจ้งเตือนในเบราว์เซอร์ก่อน จึงจะเด้งแจ้งเตือนได้',
        tone: 'bg-amber-50 border-amber-100 text-amber-700',
      };
    }

    if (notificationPermission === 'unsupported') {
      return {
        label: 'อุปกรณ์นี้ยังไม่รองรับ',
        detail: 'เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนจากเว็บแอป',
        tone: 'bg-slate-100 border-slate-200 text-slate-600',
      };
    }

    return {
      label: 'ยังไม่ได้เปิดการแจ้งเตือน',
      detail: 'กดเปิดเพื่อให้ระบบเตือนเวลาอาหาร พร้อมเสียงและการสั่นบนมือถือที่รองรับ',
      tone: 'bg-sky-50 border-sky-100 text-sky-700',
    };
  }, [notificationPermission]);

  const treatmentStyle = useMemo(() => {
    switch (treatment) {
      case 'ฉีดยา':
        return {
          card: 'bg-orange-50 border-orange-100 text-orange-700',
          label: 'ดูแลด้วยการฉีดยา',
        };
      case 'ไม่มี':
        return {
          card: 'bg-emerald-50 border-emerald-100 text-emerald-700',
          label: 'คุมอาหารและออกกำลังกาย',
        };
      default:
        return {
          card: 'bg-blue-50 border-blue-100 text-blue-700',
          label: 'ทานยาสม่ำเสมอ',
        };
    }
  }, [treatment]);

  const glucoseStatus = useMemo(() => {
    if (!lastGlucose?.value) return null;
    const num = parseInt(lastGlucose.value, 10);
    if (num < 70) return { label: 'ต่ำกว่าปกติ', tone: 'bg-amber-100 text-amber-700' };
    if (num <= 140) return { label: 'อยู่ในเกณฑ์ดี', tone: 'bg-emerald-100 text-emerald-700' };
    if (num <= 180) return { label: 'เริ่มสูง', tone: 'bg-orange-100 text-orange-700' };
    return { label: 'สูงกว่าปกติ', tone: 'bg-red-100 text-red-700' };
  }, [lastGlucose]);

  const hasGlucoseData = Boolean(lastGlucose);

  const handleCheckMeal = (id) => {
    setReminders((prev) => prev.map((item) => (item.id === id ? { ...item, isDone: true } : item)));
  };

  const addReminder = () => {
    setReminders((prev) => [
      ...prev,
      { id: Date.now(), label: 'ช่วงเวลาใหม่', time: '12:00', isDone: false },
    ]);
  };

  const deleteReminder = (id) => {
    setReminders((prev) => prev.filter((item) => item.id !== id));
  };

  const updateReminder = (id, field, value) => {
    setReminders((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="app-page app-page-transition flex flex-col bg-slate-50 sm:h-full">
      <div className="app-safe-top rounded-b-[2.5rem] border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-5 pb-6 pt-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Today Care</p>
            <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-tight text-slate-900">
              สวัสดีคุณ {userName || 'ผู้ใช้งาน'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-emerald-700">
              วันนี้มาเช็กสุขภาพกันแบบสบาย ๆ และดูแลค่าน้ำตาลให้ต่อเนื่องนะคะ
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
              <User size={22} />
            </div>
            <button
              onClick={onLogout}
              className="touch-target inline-flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-black text-slate-500 shadow-sm transition hover:text-rose-500"
            >
              <LogOut size={16} />
              ออก
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCard
            title="BMI"
            value={bmi || '0.0'}
            tone="blue"
            action={
              <button
                onClick={onEditProfile}
                className="touch-target inline-flex items-center gap-1.5 rounded-full bg-blue-200 px-3 py-2 text-xs font-black text-blue-700"
              >
                <Settings2 size={12} />
                แก้ไขข้อมูล
              </button>
            }
          />

          <StatCard
            title="Diabetes Stage"
            value={`ระยะ ${stage || '1'}`}
            tone="emerald"
            action={
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${treatmentStyle.card}`}
              >
                <ShieldPlus size={13} />
                {treatmentStyle.label}
              </div>
            }
          />
        </div>
      </div>

      <div className="app-scroll-region custom-scrollbar flex-1 space-y-5 px-5 py-5">
        <SectionCard>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-rose-50 p-2.5 text-rose-500">
                <Droplet size={20} fill="currentColor" />
              </div>
              <div>
                <p className="text-base font-black text-slate-900">น้ำตาลล่าสุด</p>
                <p className="text-sm text-slate-400">
                  {hasGlucoseData
                    ? 'บันทึกได้ตลอดทั้งวัน'
                    : 'ยังไม่มีข้อมูล ลองเริ่มบันทึกครั้งแรกได้เลย'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-black text-white shadow-md shadow-rose-100 transition hover:bg-rose-600 active:scale-[0.99]"
            >
              <Plus size={16} />
              บันทึก
            </button>
          </div>

          {hasGlucoseData ? (
            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="flex items-end gap-3">
                <ValueChip label="ก่อนอาหาร" color="blue" value={beforeGlucose} />
                <span className="mb-1 text-4xl font-light text-slate-300">/</span>
                <ValueChip label="หลังอาหาร" color="orange" value={afterGlucose} />
              </div>

              <div className="text-right">
                <p className="text-sm font-black text-slate-500">mg/dL</p>
                {glucoseStatus ? (
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-black ${glucoseStatus.tone}`}>
                    {glucoseStatus.label}
                  </span>
                ) : null}
                <p className="mt-3 text-xs font-bold text-slate-400">{lastGlucose?.time || '--:--'}</p>
                <p className="text-xs text-slate-300">{lastGlucose?.date || 'วัน/เดือน/ปี'}</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
              เมื่อเริ่มบันทึกค่าน้ำตาล ระบบจะสรุปก่อนอาหารและหลังอาหารให้ดูง่ายขึ้นในหน้านี้
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <Clock size={18} className="text-indigo-500" />
                เตือนมื้ออาหาร
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {isSettingReminders
                  ? 'ปรับชื่อมื้ออาหารและเวลาได้ตามต้องการ'
                  : 'ช่วยจัดจังหวะการกินให้สม่ำเสมอ'}
              </p>
            </div>

            <button
              onClick={() => setIsSettingReminders((prev) => !prev)}
              className="touch-target rounded-full bg-slate-100 px-3.5 py-2 text-sm font-black text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
            >
              {isSettingReminders ? 'เสร็จสิ้น' : 'ตั้งเวลา'}
            </button>
          </div>

          <div className={`mt-4 rounded-[1.5rem] border px-4 py-4 ${notificationState.tone}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/70 p-2.5">
                {notificationPermission === 'granted' ? <BellRing size={18} /> : <Bell size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{notificationState.label}</p>
                <p className="mt-1 text-sm leading-6 opacity-90">{notificationState.detail}</p>
              </div>
            </div>

            {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
              <button
                onClick={onEnableNotifications}
                className="touch-target mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-sky-700 shadow-sm transition hover:bg-sky-100"
              >
                <BellRing size={15} />
                เปิดการแจ้งเตือน
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {visibleReminders.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-2xl border px-3.5 py-3 transition ${
                  item.isDone ? 'bg-slate-50 opacity-50' : 'border-slate-100 bg-white shadow-sm'
                }`}
              >
                <div className="flex flex-1 items-center gap-3">
                  {!isSettingReminders ? (
                    <button
                      onClick={() => handleCheckMeal(item.id)}
                      className="touch-target flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-200 text-white transition hover:bg-indigo-500"
                      aria-label={`ทำเครื่องหมาย ${item.label}`}
                    >
                      {item.isDone && <Check size={14} strokeWidth={4} />}
                    </button>
                  ) : (
                    <button
                      onClick={() => deleteReminder(item.id)}
                      className="touch-target text-rose-400 transition hover:text-rose-600"
                      aria-label={`ลบ ${item.label}`}
                    >
                      <X size={18} />
                    </button>
                  )}

                  {isSettingReminders ? (
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(event) => updateReminder(item.id, 'label', event.target.value)}
                        className="min-w-0 flex-1 border-b border-slate-200 bg-transparent text-sm font-bold outline-none"
                      />
                      <input
                        type="time"
                        value={item.time}
                        onChange={(event) => updateReminder(item.id, 'time', event.target.value)}
                        className="border-b border-slate-200 bg-transparent text-sm font-bold outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-black text-slate-700">{item.label}</p>
                      <p className="text-sm font-bold text-slate-400">{item.time} น.</p>
                    </div>
                  )}
                </div>

                {!isSettingReminders && !item.isDone && (
                  <div className="animate-soft-pulse h-2.5 w-2.5 rounded-full bg-amber-400" />
                )}
              </div>
            ))}

            {!isSettingReminders && visibleReminders.length === 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700">
                วันนี้ทำครบทุกมื้อแล้ว เก่งมากครับ
              </div>
            )}

            {isSettingReminders && (
              <button
                onClick={addReminder}
                className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 text-sm font-black text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500"
              >
                <Plus size={14} />
                เพิ่มช่วงเวลา
              </button>
            )}
          </div>
        </SectionCard>

        <button
          onClick={() => onSelectChat()}
          className="touch-target w-full rounded-[2rem] border border-indigo-100 bg-[linear-gradient(135deg,#eef4ff_0%,#f7fbff_52%,#ffffff_100%)] p-5 text-left shadow-sm transition hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <MessageCircleHeart size={25} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 shadow-sm">
                <Sparkles size={12} />
                หมอ AI
              </div>
              <p className="mt-3 text-xl font-black text-slate-900">คุยกับหมอ AI ได้ทุกเวลา</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                ถามเรื่องอาหาร อาการ ค่าน้ำตาล หรือขอคำแนะนำสั้น ๆ ได้ทันที
              </p>
            </div>
            <ChevronRight className="shrink-0 text-slate-300" />
          </div>
        </button>

        <button
          onClick={onSelectReport}
          className="touch-target w-full rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600 shadow-inner">
                <TrendingDown size={24} />
              </div>
              <div className="text-left">
                <p className="font-black text-slate-900">สรุปสุขภาพประจำสัปดาห์</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {hasGlucoseData
                    ? 'ดูแนวโน้มค่าน้ำตาลและขอคำแนะนำจาก AI'
                    : 'เริ่มบันทึกค่าน้ำตาลก่อน เพื่อดูรายงานได้ละเอียดขึ้น'}
                </p>
              </div>
            </div>
            <ChevronRight className="text-slate-300" />
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <MenuButton
            label="อาหาร"
            icon={<Apple size={34} />}
            color="bg-orange-500"
            onClick={() => onSelectChat('อาหาร')}
          />
          <MenuButton
            label="ออกกำลังกาย"
            icon={<Dumbbell size={34} />}
            color="bg-green-500"
            onClick={() => onSelectChat('ออกกำลังกาย')}
          />
          <MenuButton
            label="คุมน้ำตาล"
            icon={<Activity size={34} />}
            color="bg-blue-500"
            onClick={() => onSelectChat('คุมน้ำตาล')}
          />
          <MenuButton
            label="ความรู้เรื่องโรค"
            icon={<BookOpen size={34} />}
            color="bg-rose-500"
            onClick={() => onSelectChat('ความรู้เรื่องโรค')}
          />
        </div>

        <div className="rounded-[1.75rem] border border-rose-100 bg-rose-50/70 p-4">
          <p className="mb-1 text-sm font-black uppercase tracking-[0.14em] text-rose-500">ข้อมูลเฉพาะตัว</p>
          <p className="text-base text-slate-700">
            ประวัติแพ้ยา:
            <span className="font-black text-slate-900"> {allergy || 'ไม่มี'}</span>
          </p>
        </div>
      </div>

      <div className="app-safe-bottom" />

      <GlucoseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveGlucose}
        onNotice={onNotice}
      />
    </div>
  );
}

function SectionCard({ children }) {
  return <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">{children}</div>;
}

function StatCard({ title, value, tone, action }) {
  const toneMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  };

  return (
    <div className={`rounded-[1.75rem] border p-4 shadow-sm ${toneMap[tone]}`}>
      <p className="text-sm font-black uppercase tracking-[0.12em]">{title}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}

function ValueChip({ label, color, value }) {
  return (
    <div className="flex min-w-[92px] flex-col items-center">
      <span className="text-5xl font-black leading-none tracking-tight text-slate-900">
        {value ?? '-'}
      </span>
      <span
        className={`mt-2 rounded-full px-3 py-1.5 text-xs font-black ${
          color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function MenuButton({ label, icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="touch-target flex min-h-[152px] flex-col items-center justify-center gap-3 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm transition active:scale-[0.99]"
    >
      <div className={`${color} rounded-2xl p-4 text-white shadow-lg`}>{icon}</div>
      <span className="text-center text-lg font-black leading-tight text-slate-700">{label}</span>
    </button>
  );
}
