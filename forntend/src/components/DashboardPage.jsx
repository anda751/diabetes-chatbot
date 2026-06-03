import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Apple,
  Bell,
  BookOpen,
  ChevronRight,
  Clock3,
  Dumbbell,
  Edit3,
  LineChart,
  LogOut,
  Plus,
  UserCircle2,
  Waves,
} from 'lucide-react';

const DEFAULT_MEAL_REMINDERS = [
  { id: 'breakfast', label: 'อาหารเช้า', time: '08:00', isEnabled: true, completedSlotKey: '' },
  { id: 'lunch', label: 'อาหารกลางวัน', time: '12:00', isEnabled: true, completedSlotKey: '' },
  { id: 'dinner', label: 'อาหารเย็น', time: '18:00', isEnabled: true, completedSlotKey: '' },
];

const categoryCards = [
  {
    key: 'food',
    title: 'อาหาร',
    description: 'ดูคำแนะนำเรื่องมื้ออาหารและของว่างที่เหมาะกับคุณ',
    icon: Apple,
    iconClassName: 'bg-orange-500 text-white',
  },
  {
    key: 'exercise',
    title: 'ออกกำลังกาย',
    description: 'เลือกกิจกรรมที่ปลอดภัยและเหมาะกับร่างกาย',
    icon: Dumbbell,
    iconClassName: 'bg-emerald-500 text-white',
  },
  {
    key: 'glucose',
    title: 'คุมน้ำตาล',
    description: 'ติดตามค่าน้ำตาลและเข้าใจค่าที่วัดได้ง่ายขึ้น',
    icon: Waves,
    iconClassName: 'bg-blue-500 text-white',
  },
  {
    key: 'knowledge',
    title: 'ความรู้เรื่องโรค',
    description: 'เรียนรู้การดูแลตัวเองและสัญญาณที่ควรระวัง',
    icon: BookOpen,
    iconClassName: 'bg-rose-500 text-white',
  },
];

const getDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseReminderMinutes = (timeValue) => {
  if (typeof timeValue !== 'string') return 0;
  const [hour = '0', minute = '0'] = timeValue.split(':');
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) {
    return 0;
  }
  return parsedHour * 60 + parsedMinute;
};

const buildReminderSlotKey = (reminder, date = new Date()) =>
  `${getDayKey(date)}:${reminder.id}:${reminder.time}`;

const createReminderId = (label, index) =>
  `reminder-${index}-${String(label || 'meal')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '-')}`;

const normalizeReminder = (reminder, index) => {
  const fallback = DEFAULT_MEAL_REMINDERS[index] || DEFAULT_MEAL_REMINDERS[0];
  return {
    id: reminder?.id || fallback.id || createReminderId(reminder?.label, index),
    label: reminder?.label || fallback.label || `มื้อที่ ${index + 1}`,
    time: reminder?.time || fallback.time || '08:00',
    isEnabled: reminder?.isEnabled !== false,
    completedSlotKey: typeof reminder?.completedSlotKey === 'string' ? reminder.completedSlotKey : '',
  };
};

const loadMealReminders = (mealReminders) => {
  if (!Array.isArray(mealReminders) || mealReminders.length === 0) {
    return DEFAULT_MEAL_REMINDERS.map((item, index) => normalizeReminder(item, index));
  }

  return mealReminders.map((item, index) => normalizeReminder(item, index));
};

const formatThaiDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusToneByValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return {
      label: 'ยังไม่มีข้อมูล',
      className: 'bg-slate-100 text-slate-500',
    };
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return {
      label: 'ยังไม่มีข้อมูล',
      className: 'bg-slate-100 text-slate-500',
    };
  }

  if (numericValue < 70) {
    return {
      label: 'ต่ำกว่าปกติ',
      className: 'bg-amber-100 text-amber-700',
    };
  }

  if (numericValue <= 140) {
    return {
      label: 'อยู่ในเกณฑ์ดี',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (numericValue <= 180) {
    return {
      label: 'ค่อนข้างสูง',
      className: 'bg-orange-100 text-orange-700',
    };
  }

  return {
    label: 'สูงกว่าที่ควร',
    className: 'bg-rose-100 text-rose-700',
  };
};

function DashboardPage({
  userData,
  onEditProfile,
  onOpenGlucoseModal,
  onLogout,
  onOpenCategory,
  onOpenChat,
  onOpenReport,
  notificationPermission,
  onEnableNotifications,
  mealReminders,
  onMealRemindersChange,
}) {
  const [isSettingReminders, setIsSettingReminders] = useState(false);
  const [timeMarker, setTimeMarker] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeMarker(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const now = useMemo(() => new Date(timeMarker), [timeMarker]);

  const reminders = useMemo(() => loadMealReminders(mealReminders), [mealReminders]);

  const sortedReminders = useMemo(
    () =>
      [...reminders].sort((left, right) => parseReminderMinutes(left.time) - parseReminderMinutes(right.time)),
    [reminders],
  );

  const visibleReminders = useMemo(() => {
    if (isSettingReminders) {
      return sortedReminders;
    }

    return sortedReminders.filter((item) => {
      if (item.isEnabled === false) return false;
      const currentSlotKey = buildReminderSlotKey(item, now);
      return String(item.completedSlotKey || '') !== currentSlotKey;
    });
  }, [isSettingReminders, now, sortedReminders]);

  const reminderSyncLabel = useMemo(() => {
    if (visibleReminders.length === 0) {
      return 'ครบทุกมื้อของวันนี้แล้ว ระบบจะเริ่มใหม่ตามเวลาที่ตั้งไว้';
    }

    return 'สถานะมื้ออาหารจะอิงตามเวลาที่ตั้งไว้ และรีเซ็ตใหม่อัตโนมัติทุกวัน';
  }, [visibleReminders.length]);

  const latestGlucose = userData?.lastGlucose || null;
  const glucoseTone = statusToneByValue(latestGlucose?.value);

  const updateReminders = (updater) => {
    const nextValue = typeof updater === 'function' ? updater(reminders) : updater;
    if (typeof onMealRemindersChange === 'function') {
      onMealRemindersChange(nextValue);
    }
  };

  const handleReminderChange = (reminderId, field, value) => {
    updateReminders((previous) =>
      previous.map((item) => {
        if (item.id !== reminderId) return item;

        const nextReminder = { ...item, [field]: value };
        if (field === 'time') {
          nextReminder.completedSlotKey = '';
        }
        return nextReminder;
      }),
    );
  };

  const handleCheckMeal = (reminderId) => {
    const timestamp = new Date();
    updateReminders((previous) =>
      previous.map((item) => {
        if (item.id !== reminderId) return item;
        return {
          ...item,
          completedSlotKey: buildReminderSlotKey(item, timestamp),
        };
      }),
    );
  };

  return (
    <div className="app-page dashboard-page">
      <div className="app-scroll-region px-4 pb-28 pt-5 sm:px-5">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <section className="rounded-[32px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-400">Today Care</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                  สวัสดีคุณ {userData?.name || userData?.username || 'ผู้ใช้งาน'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  วันนี้มาดูแลสุขภาพกันแบบสบาย ๆ ทีละขั้นนะคะ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                  aria-label="แก้ไขข้อมูลส่วนตัว"
                >
                  <UserCircle2 size={22} />
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-[28px] border border-blue-100 bg-blue-50/80 p-4 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">BMI</p>
                <p className="mt-3 text-5xl font-black tracking-tight text-blue-700">
                  {userData?.bmi ? Number(userData.bmi).toFixed(1) : '-'}
                </p>
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300"
                >
                  <Edit3 size={15} />
                  แก้ไขข้อมูล
                </button>
              </article>

              <article className="rounded-[28px] border border-emerald-100 bg-emerald-50/90 p-4 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">Diabetes Stage</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-emerald-800">
                  {userData?.stage ? `ระยะ ${userData.stage}` : 'ยังไม่ได้ระบุ'}
                </p>
                <p className="mt-4 inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
                  วางแผนการดูแลให้เหมาะกับคุณ
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                  <Waves size={24} />
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">น้ำตาลล่าสุด</h2>
                <p className="mt-1 text-sm text-slate-500">บันทึกไว้เพื่อติดตามแนวโน้มในแต่ละวัน</p>
              </div>

              <button
                type="button"
                onClick={onOpenGlucoseModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(244,63,94,0.28)] transition hover:bg-rose-600"
              >
                <Plus size={16} />
                บันทึก
              </button>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-end gap-3">
                  <p className="text-6xl font-black tracking-tight text-slate-900">
                    {latestGlucose?.value ?? '-'}
                  </p>
                  <span className="pb-2 text-sm font-semibold text-slate-400">mg/dL</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {latestGlucose?.timeLabel || 'ยังไม่มีการบันทึกในรอบนี้'}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className={`inline-flex rounded-full px-3 py-2 text-sm font-semibold ${glucoseTone.className}`}>
                  {glucoseTone.label}
                </span>
                <p className="mt-3 text-xs text-slate-400">{formatThaiDateTime(latestGlucose?.recordedAt)}</p>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={onOpenReport}
            className="flex w-full items-center justify-between rounded-[30px] border border-slate-200/80 bg-white/95 px-5 py-5 text-left shadow-[0_16px_34px_rgba(15,23,42,0.07)] transition hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <LineChart size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">สรุปสุขภาพประจำสัปดาห์</h2>
                <p className="mt-1 text-sm text-slate-500">ดูแนวโน้มน้ำตาลและคำแนะนำจาก AI</p>
              </div>
            </div>
            <ChevronRight className="text-slate-300" />
          </button>

          <section className="grid gap-3 sm:grid-cols-2">
            {categoryCards.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onOpenCategory(item.key)}
                  className="group rounded-[30px] border border-slate-200/80 bg-white/95 p-5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.11)]"
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${item.iconClassName}`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <Bell size={22} />
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">แจ้งเตือนมื้ออาหาร</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  ทำเครื่องหมายมื้อที่รับประทานแล้วได้เลย ระบบจะรีเซ็ตใหม่ตามเวลาที่ตั้งไว้
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingReminders((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                <Clock3 size={16} />
                {isSettingReminders ? 'เสร็จสิ้น' : 'ตั้งเวลา'}
              </button>
            </div>

            {notificationPermission !== 'granted' ? (
              <button
                type="button"
                onClick={onEnableNotifications}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-600"
              >
                <Bell size={16} />
                เปิดการแจ้งเตือน
              </button>
            ) : null}

            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{reminderSyncLabel}</p>

            <div className="mt-4 space-y-3">
              {(isSettingReminders ? sortedReminders : visibleReminders).map((reminder) => {
                const currentSlotKey = buildReminderSlotKey(reminder, now);
                const isCompleted = reminder.completedSlotKey === currentSlotKey;

                return (
                  <div
                    key={reminder.id}
                    className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold tracking-tight text-slate-900">{reminder.label}</p>
                        <p className="mt-1 text-sm text-slate-500">แจ้งเตือนเวลา {reminder.time} น.</p>
                      </div>

                      {isSettingReminders ? (
                        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                          <span>เปิดใช้งาน</span>
                          <input
                            type="checkbox"
                            checked={reminder.isEnabled}
                            onChange={(event) =>
                              handleReminderChange(reminder.id, 'isEnabled', event.target.checked)
                            }
                            className="h-4 w-4 accent-emerald-500"
                          />
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-2 text-sm font-semibold ${
                            isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isCompleted ? 'รับประทานแล้ว' : 'รอเช็กมื้อนี้'}
                        </span>
                      )}
                    </div>

                    {isSettingReminders ? (
                      <div className="mt-4 flex items-center gap-3">
                        <input
                          type="time"
                          value={reminder.time}
                          onChange={(event) => handleReminderChange(reminder.id, 'time', event.target.value)}
                          className="min-h-[48px] rounded-2xl border border-slate-200 px-4 text-base text-slate-900 outline-none transition focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleReminderChange(reminder.id, 'completedSlotKey', '')}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                        >
                          รีเซ็ตสถานะ
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCheckMeal(reminder.id)}
                        className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        ทำเครื่องหมายว่ารับประทานแล้ว
                      </button>
                    )}
                  </div>
                );
              })}

              {!isSettingReminders && visibleReminders.length === 0 ? (
                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-700">
                  วันนี้ครบทุกมื้อที่ตั้งไว้แล้ว เดี๋ยวระบบจะเริ่มใหม่ให้อัตโนมัติในวันถัดไป
                </div>
              ) : null}
            </div>
          </section>

          <button
            type="button"
            onClick={onOpenChat}
            className="flex w-full items-center justify-between rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] px-5 py-5 text-left text-white shadow-[0_18px_36px_rgba(29,78,216,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(29,78,216,0.32)]"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">AI Care</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">คุยกับหมอ AI</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100/90">
                ถามเรื่องอาหาร อาการ ค่าน้ำตาล หรือการดูแลตัวเองได้ทุกวัน
              </p>
            </div>
            <ChevronRight className="text-blue-100" />
          </button>

          <section className="rounded-[28px] border border-rose-100 bg-rose-50/90 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-rose-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700">ข้อมูลเฉพาะตัว</p>
                <p className="mt-1 text-sm leading-6 text-rose-700/85">
                  คำแนะนำในแอปนี้ใช้เพื่อช่วยดูแลตัวเองเบื้องต้น หากมีอาการผิดปกติรุนแรงควรพบแพทย์ทันที
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
