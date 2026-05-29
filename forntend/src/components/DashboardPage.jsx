import React, { useEffect, useMemo, useState } from 'react';
import {
  Apple,
  Dumbbell,
  Activity,
  BookOpen,
  User,
  LogOut,
  Settings2,
  Droplet,
  Plus,
  Check,
  Clock,
  X,
  ChevronRight,
  TrendingDown,
  ShieldPlus,
  Sparkles,
  MessageCircleHeart,
} from 'lucide-react';
import GlucoseModal from './GlucoseModal';

const DashboardPage = ({
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
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem('meal_reminders');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 1, label: 'มื้อเช้า', time: '08:00', isDone: false },
          { id: 2, label: 'มื้อกลางวัน', time: '12:00', isDone: false },
          { id: 3, label: 'มื้อเย็น', time: '18:00', isDone: false },
        ];
  });
  const [isSettingReminders, setIsSettingReminders] = useState(false);

  useEffect(() => {
    localStorage.setItem('meal_reminders', JSON.stringify(reminders));
  }, [reminders]);

  const visibleReminders = useMemo(
    () => reminders.filter((item) => isSettingReminders || !item.isDone),
    [reminders, isSettingReminders]
  );

  const handleCheckMeal = (id) => {
    setReminders((prev) => prev.map((item) => (item.id === id ? { ...item, isDone: true } : item)));
  };

  const addReminder = () => {
    const newReminder = {
      id: Date.now(),
      label: 'ช่วงเวลาใหม่',
      time: '12:00',
      isDone: false,
    };
    setReminders([...reminders, newReminder]);
  };

  const deleteReminder = (id) => {
    setReminders(reminders.filter((item) => item.id !== id));
  };

  const updateReminder = (id, field, value) => {
    setReminders(reminders.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const getTreatmentStyle = () => {
    switch (treatment) {
      case 'ฉีดยา':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          border: 'border-orange-200',
          label: 'ดูแลด้วยการฉีดยา',
        };
      case 'ไม่มี':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          label: 'คุมอาหารและออกกำลังกาย',
        };
      default:
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          label: 'ทานยาสม่ำเสมอ',
        };
    }
  };

  const getGlucoseStatus = (value) => {
    if (!value || value === '-') return null;

    const num = parseInt(value, 10);
    if (num < 70) return { label: 'ต่ำกว่าปกติ', color: 'text-amber-700', bg: 'bg-amber-100' };
    if (num <= 140) return { label: 'อยู่ในเกณฑ์ดี', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (num <= 180) return { label: 'เริ่มสูง', color: 'text-orange-700', bg: 'bg-orange-100' };
    return { label: 'สูงกว่าปกติ', color: 'text-red-700', bg: 'bg-red-100' };
  };

  const treatmentStyle = getTreatmentStyle();
  const glucoseStatus = getGlucoseStatus(lastGlucose?.value);
  const hasGlucoseData = Boolean(lastGlucose);

  return (
    <div className="max-w-md mx-auto min-h-[100dvh] sm:h-full sm:min-h-0 bg-slate-50 flex flex-col overflow-visible relative">
      <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 rounded-b-[42px] shadow-sm mb-4 border-b border-slate-100 relative">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-black mb-1">Today Care</p>
            <h1 className="text-[30px] sm:text-[28px] font-black text-slate-800 tracking-tight leading-tight">
              สวัสดีคุณ {userName || 'ผู้ใช้งาน'}
            </h1>
            <p className="text-base text-emerald-700 font-bold mt-1">วันนี้มาเช็กสุขภาพกันแบบสบาย ๆ นะคะ</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-blue-600 p-3 rounded-[1.25rem] text-white shadow-lg shadow-blue-200">
              <User size={24} />
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-black text-slate-500 hover:text-red-500 transition-colors shadow-sm bg-white rounded-2xl border border-slate-100"
            >
              <LogOut size={18} />
              ออก
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-[1.75rem] border border-blue-100 shadow-sm">
            <p className="text-sm text-blue-700 font-black uppercase tracking-wider">BMI</p>
            <p className="text-3xl font-black text-blue-800 mt-1">{bmi || '0.0'}</p>
            <button
              onClick={onEditProfile}
              className="mt-3 inline-flex items-center gap-1.5 text-sm bg-blue-200 text-blue-700 px-3.5 py-2 rounded-full font-black"
            >
              <Settings2 size={12} />
              แก้ไขข้อมูล
            </button>
          </div>

          <div className="bg-emerald-50 p-4 rounded-[1.75rem] border border-emerald-100 shadow-sm">
            <p className="text-sm text-emerald-700 font-black uppercase tracking-wider">Diabetes Stage</p>
            <p className="text-3xl font-black text-emerald-800 mt-1">ระยะ {stage || '1'}</p>
            <div className={`mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-black ${treatmentStyle.bg} ${treatmentStyle.text} ${treatmentStyle.border}`}>
              <ShieldPlus size={14} />
              {treatmentStyle.label}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-visible pb-6 custom-scrollbar touch-pan-y">
        <div className="px-6 mb-5">
          <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-rose-50 p-2 rounded-xl text-rose-500">
                  <Droplet size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="font-black text-slate-800">น้ำตาลล่าสุด</p>
                  <p className="text-sm text-slate-400 font-bold">
                    {hasGlucoseData ? 'บันทึกได้ตลอดทั้งวัน' : 'ยังไม่มีข้อมูล ลองเริ่มบันทึกครั้งแรกได้เลย'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-2xl text-base font-black shadow-md flex items-center gap-1.5 active:scale-95 transition"
              >
                <Plus size={16} />
                บันทึก
              </button>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-3">
                <ValueChip label="ก่อนอาหาร" color="blue" value={beforeGlucose} />
                <span className="text-4xl font-light text-slate-300 mb-1">/</span>
                <ValueChip label="หลังอาหาร" color="orange" value={afterGlucose} />
              </div>

              <div className="text-right">
                <p className="text-sm font-black text-slate-500">mg/dL</p>
                {glucoseStatus ? (
                  <span className={`inline-flex mt-2 text-xs px-3 py-1.5 rounded-full font-black ${glucoseStatus.bg} ${glucoseStatus.color}`}>
                    {glucoseStatus.label}
                  </span>
                ) : (
                  <span className="inline-flex mt-2 text-xs px-3 py-1.5 rounded-full font-black bg-slate-100 text-slate-400">
                    รอบันทึกข้อมูล
                  </span>
                )}
                <p className="text-xs text-slate-400 font-bold mt-3">{lastGlucose?.time || '--:--'}</p>
                <p className="text-xs text-slate-300 font-medium">{lastGlucose?.date || 'วัน/เดือน/ปี'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 mb-5">
          <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" />
                  เตือนมื้ออาหาร
                </h3>
                <p className="text-sm text-slate-400 font-bold mt-1">
                  {isSettingReminders ? 'แก้ชื่อมื้ออาหารและเวลาได้ตามต้องการ' : 'ช่วยจัดจังหวะการกินให้สม่ำเสมอ'}
                </p>
              </div>

              <button
                onClick={() => setIsSettingReminders(!isSettingReminders)}
                className="text-sm font-black bg-slate-100 text-slate-500 px-3.5 py-2 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                {isSettingReminders ? 'เสร็จสิ้น' : 'ตั้งเวลา'}
              </button>
            </div>

            <div className="space-y-3">
              {visibleReminders.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    item.isDone ? 'bg-slate-50 opacity-40' : 'bg-white border-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {!isSettingReminders ? (
                      <button
                        onClick={() => handleCheckMeal(item.id)}
                        className="w-7 h-7 rounded-full border-2 border-indigo-200 flex items-center justify-center text-white hover:bg-indigo-500 transition-colors"
                        aria-label={`ทำเครื่องหมาย ${item.label}`}
                      >
                        {item.isDone && <Check size={14} strokeWidth={4} />}
                      </button>
                    ) : (
                      <button onClick={() => deleteReminder(item.id)} className="text-red-400 hover:text-red-600" aria-label={`ลบ ${item.label}`}>
                        <X size={18} />
                      </button>
                    )}

                    {isSettingReminders ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateReminder(item.id, 'label', e.target.value)}
                          className="text-xs font-bold border-b border-slate-200 outline-none w-24"
                        />
                        <input
                          type="time"
                          value={item.time}
                          onChange={(e) => updateReminder(item.id, 'time', e.target.value)}
                          className="text-xs border-b border-slate-200 outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-base font-black text-slate-700">{item.label}</p>
                        <p className="text-sm text-slate-400 font-bold italic">{item.time} น.</p>
                      </div>
                    )}
                  </div>

                  {!isSettingReminders && !item.isDone && <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"></div>}
                </div>
              ))}

              {!isSettingReminders && visibleReminders.length === 0 && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm font-bold text-emerald-700">
                  วันนี้ทำครบทุกมื้อแล้ว เก่งมากครับ
                </div>
              )}

              {isSettingReminders && (
                <button
                  onClick={addReminder}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-black flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-400 transition"
                >
                  <Plus size={14} />
                  เพิ่มช่วงเวลา
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 mb-5">
          <button
            onClick={() => onSelectChat()}
            className="w-full rounded-[30px] border border-indigo-100 bg-[linear-gradient(135deg,#eef4ff_0%,#f8fbff_48%,#ffffff_100%)] p-5 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4 text-left">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                <MessageCircleHeart size={26} />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 shadow-sm">
                  <Sparkles size={12} />
                  หมอ AI
                </div>
                <p className="mt-3 text-xl font-black text-slate-800">คุยกับหมอ AI ได้ทุกเวลา</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  ถามเรื่องอาหาร อาการ ค่าน้ำตาล หรือขอคำแนะนำสั้น ๆ ได้เลย
                </p>
              </div>
              <ChevronRight className="shrink-0 text-slate-300" />
            </div>
          </button>
        </div>

        <div className="px-6 mb-5">
          <button
            onClick={onSelectReport}
            className="w-full bg-white p-5 rounded-[28px] shadow-sm border border-slate-200 flex justify-between items-center group active:bg-slate-50 transition"
          >
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600 shadow-inner">
                <TrendingDown size={24} />
              </div>
              <div className="text-left">
                <p className="font-black text-slate-800">สรุปสุขภาพประจำสัปดาห์</p>
                <p className="text-sm text-slate-400 font-medium">
                  {hasGlucoseData ? 'ดูแนวโน้มค่าน้ำตาลและขอคำแนะนำจาก AI' : 'เริ่มบันทึกค่าน้ำตาลก่อน เพื่อดูรายงานได้ละเอียดขึ้น'}
                </p>
              </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </button>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <div className="grid grid-cols-2 gap-4">
            <MenuButton label="อาหาร" icon={<Apple size={36} />} color="bg-orange-500" onClick={() => onSelectChat('อาหาร')} />
            <MenuButton label="ออกกำลังกาย" icon={<Dumbbell size={36} />} color="bg-green-500" onClick={() => onSelectChat('ออกกำลังกาย')} />
            <MenuButton label="คุมน้ำตาล" icon={<Activity size={36} />} color="bg-blue-500" onClick={() => onSelectChat('คุมน้ำตาล')} />
            <MenuButton label="ความรู้เรื่องโรค" icon={<BookOpen size={36} />} color="bg-purple-500" onClick={() => onSelectChat('ความรู้เรื่องโรค')} />
          </div>

          <div className="mt-5 rounded-[28px] border border-rose-100 bg-rose-50/70 p-4">
            <p className="text-sm font-black uppercase tracking-wider text-rose-500 mb-1">ข้อมูลเฉพาะตัว</p>
            <p className="text-base text-slate-700 font-medium">
              ประวัติแพ้ยา:
              <span className="font-black text-slate-900"> {allergy || 'ไม่มี'}</span>
            </p>
          </div>
        </div>
      </div>

      <GlucoseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveGlucose}
        onNotice={onNotice}
      />
    </div>
  );
};

const ValueChip = ({ label, color, value }) => (
  <div className="flex flex-col items-center min-w-[92px]">
    <span className="text-5xl font-black text-slate-800 tracking-tighter leading-none">{value ?? '-'}</span>
    <span className={`text-xs font-black px-3 py-1.5 rounded-full mt-2 ${color === 'blue' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'}`}>
      {label}
    </span>
  </div>
);

const MenuButton = ({ label, icon, color, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white p-5 rounded-[32px] shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition border border-gray-100 group min-h-[152px]"
  >
    <div className={`${color} p-4 rounded-2xl text-white shadow-lg group-hover:rotate-6 transition-transform`}>
      {icon}
    </div>
    <span className="font-black text-gray-700 text-lg text-center leading-tight">{label}</span>
  </button>
);

export default DashboardPage;
