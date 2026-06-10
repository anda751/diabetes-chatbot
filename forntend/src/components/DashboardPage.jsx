import React, { useEffect, useMemo, useState } from 'react';
import {
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
    description: 'เลือกกิจกรรมที่ปลอดภัยและเหมาะกับร่างกายในแต่ละวัน',
    icon: Dumbbell,
    iconClassName: 'bg-emerald-500 text-white',
  },
  {
    key: 'glucose',
    title: 'คุมน้ำตาล',
    description: 'เข้าใจค่าที่วัดได้ และดูแนวทางดูแลตัวเองให้ต่อเนื่อง',
    icon: Waves,
    iconClassName: 'bg-blue-500 text-white',
  },
  {
    key: 'knowledge',
    title: 'ความรู้เรื่องโรค',
    description: 'เรียนรู้การสังเกตอาการและดูแลตัวเองอย่างเหมาะสม',
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

const normalizeReminder = (reminder, fallback) => {
  return {
    id: reminder?.id || fallback.id,
    label: reminder?.label || fallback.label,
    time: reminder?.time || fallback.time,
    isEnabled: reminder?.isEnabled !== false,
    completedSlotKey: typeof reminder?.completedSlotKey === 'string' ? reminder.completedSlotKey : '',
  };
};

const loadMealReminders = (mealReminders) => {
  if (!Array.isArray(mealReminders) || mealReminders.length === 0) {
    return DEFAULT_MEAL_REMINDERS.map((item) => normalizeReminder(item, item));
  }

  const mergedDefaults = DEFAULT_MEAL_REMINDERS.map((defaultReminder) => {
    const matchedReminder = mealReminders.find(
      (item) => String(item?.id || '') === String(defaultReminder.id)
    );

    return normalizeReminder(matchedReminder || defaultReminder, defaultReminder);
  });

  const extraReminders = mealReminders
    .filter((item) => !DEFAULT_MEAL_REMINDERS.some((defaultReminder) => String(defaultReminder.id) === String(item?.id)))
    .map((item, index) =>
      normalizeReminder(item, {
        id: item?.id || `extra-${index + 1}`,
        label: item?.label || `มื้อเพิ่มเติม ${index + 1}`,
        time: item?.time || '10:00',
        isEnabled: item?.isEnabled !== false,
        completedSlotKey: item?.completedSlotKey || '',
      })
    );

  return [...mergedDefaults, ...extraReminders];
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

const buildCurrentMealSummary = (sortedReminders, now) => {
  const enabledReminders = sortedReminders.filter((item) => item.isEnabled !== false);
  if (!enabledReminders.length) {
    return 'ยังไม่ได้ตั้งเวลาแจ้งเตือนมื้ออาหาร';
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let activeReminder = enabledReminders[0];

  enabledReminders.forEach((item) => {
    if (parseReminderMinutes(item.time) <= currentMinutes) {
      activeReminder = item;
    }
  });

  return `รอบปัจจุบัน: ${activeReminder.label} เวลา ${activeReminder.time} น.`;
};

export default function DashboardPage({
  userData,
  glucoseSummary,
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

    return () => window.clearInterval(intervalId);
  }, []);

  const now = useMemo(() => new Date(timeMarker), [timeMarker]);
  const reminders = useMemo(() => loadMealReminders(mealReminders), [mealReminders]);
  const sortedReminders = useMemo(
    () => [...reminders].sort((left, right) => parseReminderMinutes(left.time) - parseReminderMinutes(right.time)),
    [reminders]
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

  const reminderSummaryText = useMemo(() => {
    if (visibleReminders.length === 0) {
      return 'วันนี้ทำครบทุกมื้อที่ตั้งไว้แล้ว ระบบจะเริ่มรอบใหม่ให้อัตโนมัติเมื่อถึงเวลามื้อถัดไปหรือวันใหม่';
    }

    return 'ระบบจะรีเซ็ตสถานะมื้ออาหารตามเวลาที่ตั้งไว้ และเริ่มใหม่ให้อัตโนมัติทุกวัน';
  }, [visibleReminders.length]);

  const currentMealSummary = useMemo(
    () => buildCurrentMealSummary(sortedReminders, now),
    [now, sortedReminders]
  );

  const beforeGlucose = glucoseSummary?.beforeRecord || null;
  const afterGlucose = glucoseSummary?.afterRecord || null;
  const latestGlucose = glucoseSummary?.latestRecord || null;
  const beforeTone = statusToneByValue(beforeGlucose?.value);
  const afterTone = statusToneByValue(afterGlucose?.value);

  const updateReminders = (updater) => {
    const nextValue = typeof updater === 'function' ? updater(reminders) : updater;
    if (typeof onMealRemindersChange === 'function') {
      onMealRemindersChange(nextValue);
    }
  };

  const handleAddReminder = () => {
    const extraCount = reminders.filter((item) => !DEFAULT_MEAL_REMINDERS.some((defaultReminder) => defaultReminder.id === item.id)).length;
    const nextReminder = {
      id: `extra-${Date.now()}`,
      label: `มื้อเพิ่มเติม ${extraCount + 1}`,
      time: '10:00',
      isEnabled: true,
      completedSlotKey: '',
    };

    updateReminders((previous) => [...previous, nextReminder]);
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
      })
    );
  };

  const handleRemoveReminder = (reminderId) => {
    updateReminders((previous) => previous.filter((item) => item.id !== reminderId));
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
      })
    );
  };

  return (
    <div className="app-page dashboard-page flex min-h-0 flex-col">
      <div className="app-scroll-region flex-1 px-4 pb-24 pt-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <p className="pt-1 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-400">Today Care</p>

              <div className="flex shrink-0 items-center gap-2">
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

            <div className="mt-4">
              <h1 className="max-w-[12rem] text-[1.85rem] font-black leading-[1.15] tracking-tight text-slate-900 sm:max-w-none sm:text-[2.05rem]">
                สวัสดีคุณ {userData?.name || userData?.username || 'ผู้ใช้งาน'}
              </h1>
              <p className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-600">
                วันนี้มาดูข้อมูลสำคัญและดูแลตัวเองทีละขั้นแบบสบาย ๆ กันนะคะ
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                BMI {userData?.bmi ? Number(userData.bmi).toFixed(1) : '-'}
              </span>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {userData?.stage ? `เบาหวานระยะ ${userData.stage}` : 'ยังไม่ได้ระบุระยะ'}
              </span>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Waves size={24} />
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">น้ำตาลรอบมื้อนี้</h2>
                <p className="mt-1 text-sm text-slate-500">แสดงทั้งค่าก่อนอาหารและหลังอาหารของรอบเวลาปัจจุบัน</p>
              </div>

              <button
                type="button"
                onClick={onOpenGlucoseModal}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-blue-700"
              >
                <Plus size={16} />
                บันทึก
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{currentMealSummary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    อัปเดตล่าสุด {formatThaiDateTime(latestGlucose?.recordedAt)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  {latestGlucose ? 'บันทึกรอบนี้แล้ว' : 'ยังไม่บันทึกรอบนี้'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <article className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Before Meal</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-4xl font-black tracking-tight text-slate-900">{beforeGlucose?.value ?? '-'}</p>
                    <span className="pb-1 text-xs font-semibold text-slate-400">mg/dL</span>
                  </div>
                  <span className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${beforeTone.className}`}>
                    {beforeTone.label}
                  </span>
                  <p className="mt-2 text-xs text-slate-400">{formatThaiDateTime(beforeGlucose?.recordedAt)}</p>
                </article>

                <article className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">After Meal</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-4xl font-black tracking-tight text-slate-900">{afterGlucose?.value ?? '-'}</p>
                    <span className="pb-1 text-xs font-semibold text-slate-400">mg/dL</span>
                  </div>
                  <span className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${afterTone.className}`}>
                    {afterTone.label}
                  </span>
                  <p className="mt-2 text-xs text-slate-400">{formatThaiDateTime(afterGlucose?.recordedAt)}</p>
                </article>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">BMI</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {userData?.bmi ? Number(userData.bmi).toFixed(1) : '-'}
                </p>
                <p className="mt-1 text-sm text-slate-500">ใช้ดูสมดุลของน้ำหนักและส่วนสูง</p>
              </article>

              <article className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Diabetes Stage</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {userData?.stage ? `ระยะ ${userData.stage}` : '-'}
                </p>
                <p className="mt-1 text-sm text-slate-500">ช่วยให้คำแนะนำเหมาะกับช่วงการดูแล</p>
              </article>
            </div>

            <button
              type="button"
              onClick={onEditProfile}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Edit3 size={15} />
              แก้ไขข้อมูลสุขภาพ
            </button>
          </section>

          <button
            type="button"
            onClick={onOpenReport}
            className="flex w-full items-center justify-between rounded-[28px] border border-slate-200/80 bg-white/95 px-5 py-5 text-left shadow-[0_14px_32px_rgba(15,23,42,0.07)] transition hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <LineChart size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">สรุปสุขภาพประจำสัปดาห์</h2>
                <p className="mt-1 text-sm text-slate-500">ดูแนวโน้มค่าน้ำตาลและคำแนะนำจาก AI</p>
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
                  className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_32px_rgba(15,23,42,0.1)]"
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${item.iconClassName}`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-4 text-[1.7rem] font-black tracking-tight text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </button>
              );
            })}
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <Bell size={22} />
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">แจ้งเตือนมื้ออาหาร</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  ทำเครื่องหมายมื้อที่รับประทานแล้ว ระบบจะรีเซ็ตตามเวลาที่ตั้งไว้โดยอัตโนมัติ
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

            {isSettingReminders ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <span className="font-semibold">แก้ชื่อมื้อ ปรับเวลา และเพิ่มมื้ออาหารได้ในหน้านี้</span>
                <button
                  type="button"
                  onClick={handleAddReminder}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 font-semibold text-white transition hover:bg-emerald-600"
                >
                  <Plus size={16} />
                  เพิ่มมื้ออาหาร
                </button>
              </div>
            ) : null}

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

            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{reminderSummaryText}</p>

            <div className="mt-4 space-y-3">
              {(isSettingReminders ? sortedReminders : visibleReminders).map((reminder) => {
                const currentSlotKey = buildReminderSlotKey(reminder, now);
                const isCompleted = reminder.completedSlotKey === currentSlotKey;
                const isDefaultReminder = DEFAULT_MEAL_REMINDERS.some((item) => item.id === reminder.id);

                return (
                  <div key={reminder.id} className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      {isSettingReminders ? (
                        <div className="flex w-full flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <label className="text-xs font-semibold text-slate-400">ชื่อมื้ออาหาร</label>
                              <input
                                type="text"
                                value={reminder.label}
                                onChange={(event) => handleReminderChange(reminder.id, 'label', event.target.value)}
                                className="mt-2 min-h-[48px] w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-400"
                                placeholder="เช่น อาหารว่างช่วงบ่าย"
                              />
                            </div>

                            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                              <span>เปิดใช้งาน</span>
                              <input
                                type="checkbox"
                                checked={reminder.isEnabled}
                                onChange={(event) => handleReminderChange(reminder.id, 'isEnabled', event.target.checked)}
                                className="h-4 w-4 accent-emerald-500"
                              />
                            </label>
                          </div>
                          <p className="text-sm text-slate-500">ตั้งเวลาเตือนให้ตรงกับมื้อที่ต้องการ แล้วระบบจะรีเซ็ตสถานะตามเวลานี้อัตโนมัติ</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-lg font-bold tracking-tight text-slate-900">{reminder.label}</p>
                            <p className="mt-1 text-sm text-slate-500">แจ้งเตือนเวลา {reminder.time} น.</p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-2 text-sm font-semibold ${
                              isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {isCompleted ? 'รับประทานแล้ว' : 'รอเช็กมื้อนี้'}
                          </span>
                        </>
                      )}
                    </div>

                    {isSettingReminders ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
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
                        {!isDefaultReminder ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveReminder(reminder.id)}
                            className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                          >
                            ลบมื้อนี้
                          </button>
                        ) : null}
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
            </div>
          </section>

          <button
            type="button"
            onClick={onOpenChat}
            className="flex w-full items-center justify-between rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] px-5 py-5 text-left text-white shadow-[0_18px_36px_rgba(29,78,216,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(29,78,216,0.32)]"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">AI Care</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">คุยกับหมอ AI</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100/90">ถามเรื่องอาหาร อาการ ค่าน้ำตาล หรือการดูแลตัวเองได้ทันที</p>
            </div>
            <ChevronRight className="text-blue-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
