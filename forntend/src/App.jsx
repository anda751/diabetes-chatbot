import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import AppDialog from './components/AppDialog';
import LoginPage from './components/LoginPage';
import ProfileSetupPage from './components/ProfileSetupPage';
import RegisterPage from './components/RegisterPage';
import { API_URL } from './config';
import {
  validateChatMessage,
  validateGlucosePhase,
  validateGlucoseValue,
  validatePassword,
  validateProfileForm,
  validateUsername,
} from './utils/validation';

const jsonHeaders = { 'Content-Type': 'application/json' };
const DEFAULT_SCREEN = 'login';
const REMINDER_STORAGE_KEY = 'meal_reminders';
const REMINDER_ALERTS_KEY = 'meal_reminder_alerts';
const APP_SCREENS = [
  'login',
  'register',
  'profile',
  'dashboard',
  'category_detail',
  'chat',
  'edit_profile',
  'report',
];

const DashboardPage = lazy(() => import('./components/DashboardPage'));
const ChatBotPage = lazy(() => import('./components/ChatBotPage'));
const WeeklyReportPage = lazy(() => import('./components/WeeklyReportPage'));
const EditProfilePage = lazy(() => import('./components/EditProfilePage'));
const CategoryDetailPage = lazy(() => import('./components/CategoryDetailPage'));

const buildAppUrl = (screen) => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}#/${screen || DEFAULT_SCREEN}`;
};

function EmptyScreen({ title, message }) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-3xl bg-slate-100" />
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function ScreenLoader({ label }) {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center px-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
        <p className="text-sm font-bold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function loadMealRemindersFromStorage() {
  if (typeof window === 'undefined') return [];

  try {
    const saved = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (_error) {
    return [];
  }
}

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinuteKey(date = new Date()) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function getReminderAlertKey(reminder, date = new Date()) {
  return `${getTodayKey(date)}:${reminder.id}:${reminder.time}`;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(DEFAULT_SCREEN);
  const [userData, setUserData] = useState(null);
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [initialChatMsg, setInitialChatMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [reminderToast, setReminderToast] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'alert',
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก',
    onConfirm: null,
  });

  const historyIndexRef = useRef(0);
  const toastTimerRef = useRef(null);
  const reminderToastTimerRef = useRef(null);
  const reminderDialogRef = useRef('');

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const applyScreenState = useCallback((screen, options = {}) => {
    setCurrentScreen(screen || DEFAULT_SCREEN);
    setSelectedCategory(options.category ?? null);
    setInitialChatMsg(options.chatMessage ?? '');
  }, []);

  const updateBrowserHistory = useCallback((screen, options = {}, mode = 'push') => {
    if (typeof window === 'undefined') return;

    const nextIndex =
      mode === 'replace'
        ? typeof options.navIndex === 'number'
          ? options.navIndex
          : historyIndexRef.current
        : historyIndexRef.current + 1;

    historyIndexRef.current = nextIndex;

    const state = {
      appScreen: screen,
      category: options.category ?? null,
      chatMessage: options.chatMessage ?? '',
      navIndex: nextIndex,
    };

    const url = buildAppUrl(screen);
    if (mode === 'replace') {
      window.history.replaceState(state, '', url);
      return;
    }

    window.history.pushState(state, '', url);
  }, []);

  const navigateToScreen = useCallback(
    (screen, options = {}) => {
      applyScreenState(screen, options);
      updateBrowserHistory(screen, options, options.replace ? 'replace' : 'push');
    },
    [applyScreenState, updateBrowserHistory]
  );

  const goBackInApp = useCallback(
    (fallbackScreen, fallbackOptions = {}) => {
      if (typeof window !== 'undefined' && historyIndexRef.current > 0) {
        window.history.back();
        return;
      }

      navigateToScreen(fallbackScreen, { ...fallbackOptions, replace: true });
    },
    [navigateToScreen]
  );

  const showAlert = useCallback(({ title = 'แจ้งเตือน', message, confirmText = 'ตกลง' }) => {
    setDialogState({
      isOpen: true,
      title,
      message,
      variant: 'alert',
      confirmText,
      cancelText: 'ยกเลิก',
      onConfirm: null,
    });
  }, []);

  const showConfirm = useCallback(
    ({
      title = 'ยืนยันการทำรายการ',
      message,
      confirmText = 'ยืนยัน',
      cancelText = 'ยกเลิก',
      onConfirm,
    }) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        variant: 'confirm',
        confirmText,
        cancelText,
        onConfirm,
      });
    },
    []
  );

  const handleDialogConfirm = useCallback(() => {
    const action = dialogState.onConfirm;
    closeDialog();
    if (typeof action === 'function') {
      action();
    }
  }, [closeDialog, dialogState.onConfirm]);

  const playReminderSound = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const context = window.__mealReminderAudioContext || new AudioContextClass();
      window.__mealReminderAudioContext = context;

      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
    } catch (_error) {
      // Ignore audio failures on restricted browsers.
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showAlert({
        title: 'อุปกรณ์นี้ยังไม่รองรับ',
        message: 'เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนจากเว็บแอป',
      });
      return false;
    }

    if (window.Notification.permission === 'granted') {
      setNotificationPermission('granted');
      return true;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      showAlert({
        title: 'ยังไม่ได้เปิดการแจ้งเตือน',
        message: 'กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์ เพื่อให้ระบบเตือนเวลาอาหารได้',
      });
      return false;
    }

    playReminderSound();
    return true;
  }, [playReminderSound, showAlert]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const keyboardOffset = Math.max(0, window.innerHeight - height - offsetTop);

      document.documentElement.style.setProperty('--app-vh', `${height}px`);
      document.documentElement.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    const syncPermission = () => {
      setNotificationPermission(window.Notification.permission);
    };

    syncPermission();
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (reminderToastTimerRef.current) {
        window.clearTimeout(reminderToastTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !userData) return undefined;

    const triggerReminder = (reminder) => {
      const now = new Date();
      const alertKey = getReminderAlertKey(reminder, now);

      try {
        const storedAlerts = JSON.parse(window.localStorage.getItem(REMINDER_ALERTS_KEY) || '{}');
        if (storedAlerts[alertKey]) return;

        storedAlerts[alertKey] = now.toISOString();
        const todayPrefix = `${getTodayKey(now)}:`;
        const prunedAlerts = Object.fromEntries(
          Object.entries(storedAlerts).filter(([key]) => key.startsWith(todayPrefix))
        );
        window.localStorage.setItem(REMINDER_ALERTS_KEY, JSON.stringify(prunedAlerts));
      } catch (_error) {
        // Ignore storage issues and continue with current alert.
      }

      const title = `ถึงเวลาทาน${reminder.label}`;
      const body = `ถึงเวลา ${reminder.time} น. อย่าลืมทานอาหารให้ตรงเวลาเพื่อช่วยคุมน้ำตาลนะคะ`;

      if ('Notification' in window && window.Notification.permission === 'granted') {
        try {
          const notification = new window.Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `meal-reminder-${reminder.id}`,
            renotify: true,
            requireInteraction: false,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (_error) {
          // Ignore Notification constructor failures.
        }
      }

      if (navigator.vibrate) {
        navigator.vibrate([180, 120, 180]);
      }

      playReminderSound();

      if (document.visibilityState === 'visible' && reminderDialogRef.current !== alertKey) {
        reminderDialogRef.current = alertKey;
        setReminderToast({
          title,
          message: `${body} ระบบจะแจ้งเตือนต่อเมื่อเว็บแอปยังเปิดอยู่`,
        });
        if (reminderToastTimerRef.current) {
          window.clearTimeout(reminderToastTimerRef.current);
        }
        reminderToastTimerRef.current = window.setTimeout(() => {
          setReminderToast(null);
        }, 5000);
      }
    };

    const checkMealReminders = () => {
      const reminders = loadMealRemindersFromStorage();
      if (!Array.isArray(reminders) || reminders.length === 0) return;

      const currentMinute = getMinuteKey(new Date());
      reminders.forEach((reminder) => {
        if (!reminder?.time || !reminder?.label) return;
        if (String(reminder.time) !== currentMinute) return;
        triggerReminder(reminder);
      });
    };

    checkMealReminders();
    const interval = window.setInterval(checkMealReminders, 30000);
    return () => window.clearInterval(interval);
  }, [playReminderSound, showAlert, userData]);

  const fetchGlucoseHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/glucose`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setUserData(null);
          setGlucoseHistory([]);
          navigateToScreen('login', { replace: true });
        }
        return;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const sortedData = [...data].sort((a, b) => (b.id || 0) - (a.id || 0));
        setGlucoseHistory(sortedData);
      }
    } catch (error) {
      console.error('Fetch glucose history error:', error);
    }
  }, [navigateToScreen]);

  const checkSession = useCallback(async () => {
    setIsCheckingSession(true);
    try {
      const response = await fetch(`${API_URL}/session`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setUserData(null);
        setGlucoseHistory([]);
        navigateToScreen('login', { replace: true });
        return;
      }

      const data = await response.json();
      setUserData(data.user);
      navigateToScreen(data.user.weight ? 'dashboard' : 'profile', { replace: true });
      await fetchGlucoseHistory();
    } catch (error) {
      console.error('Session check error:', error);
      navigateToScreen('login', { replace: true });
    } finally {
      setIsCheckingSession(false);
    }
  }, [fetchGlucoseHistory, navigateToScreen]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const initialState = window.history.state;
    if (initialState?.appScreen) {
      historyIndexRef.current = initialState.navIndex || 0;
      applyScreenState(initialState.appScreen, initialState);
    } else {
      updateBrowserHistory(DEFAULT_SCREEN, { navIndex: 0 }, 'replace');
    }

    const handlePopState = (event) => {
      const nextState = event.state;
      if (nextState?.appScreen) {
        historyIndexRef.current = nextState.navIndex || 0;
        applyScreenState(nextState.appScreen, nextState);
        return;
      }

      historyIndexRef.current = 0;
      applyScreenState(DEFAULT_SCREEN);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyScreenState, updateBrowserHistory]);

  const handleLogin = async (username, password) => {
    const validationError = validateUsername(username) || validatePassword(password);
    if (validationError) {
      showAlert({
        title: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert({
          title: 'เข้าสู่ระบบไม่สำเร็จ',
          message: data.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
        });
        return;
      }

      setUserData(data.user);
      navigateToScreen(data.user.weight ? 'dashboard' : 'profile', { replace: true });
      await fetchGlucoseHistory();
    } catch (_error) {
      showAlert({
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ',
        message: 'การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'ออกจากระบบ',
      message: 'คุณต้องการออกจากระบบใช่หรือไม่',
      confirmText: 'ออกจากระบบ',
      onConfirm: async () => {
        try {
          await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          setUserData(null);
          setGlucoseHistory([]);
          setInitialChatMsg('');
          setSelectedCategory(null);
          navigateToScreen('login', { replace: true });
        }
      },
    });
  };

  const getLatestByPhase = (phase) => {
    const record = glucoseHistory.find((item) => item.phase === phase);
    return record ? record.value : '-';
  };

  const handleSaveGlucose = async (value, phase) => {
    if (!userData) return;

    const validationError = validateGlucoseValue(value) || validateGlucosePhase(phase);
    if (validationError) {
      showAlert({
        title: 'ค่าน้ำตาลไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    const now = new Date();
    const newData = {
      id: Date.now(),
      value: parseInt(value, 10),
      phase,
      date: now.toLocaleDateString('th-TH'),
      time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    };

    setGlucoseHistory((prev) => [newData, ...prev]);
    setShowToast(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setShowToast(false), 2800);

    try {
      const response = await fetch(`${API_URL}/glucose`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify(newData),
      });

      if (response.ok) {
        await fetchGlucoseHistory();
      }
    } catch (error) {
      console.error('Save glucose error:', error);
    }
  };

  const handleSaveData = async (data) => {
    if (!userData) return;

    const validationError = validateProfileForm(data);
    if (validationError) {
      showAlert({
        title: 'ข้อมูลสุขภาพไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    const weight = parseFloat(data.weight) || 0;
    const height = parseFloat(data.height) || 0;
    const heightMeters = height / 100;
    const calculatedBmi =
      weight > 0 && heightMeters > 0 ? (weight / (heightMeters * heightMeters)).toFixed(1) : '0.0';

    const infoToUpdate = {
      name: data.name,
      weight,
      height,
      bmi: calculatedBmi,
      stage: data.stage,
      allergy: data.allergy || 'ไม่มี',
      treatment: data.treatment || 'กินยา',
    };

    try {
      const response = await fetch(`${API_URL}/update-profile`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify(infoToUpdate),
      });

      const responseData = await response.json();

      if (!response.ok) {
        showAlert({
          title: 'บันทึกข้อมูลไม่สำเร็จ',
          message: responseData.error || 'ยังไม่สามารถอัปเดตข้อมูลสุขภาพได้ในขณะนี้',
        });
        return;
      }

      setUserData(responseData.user);
      navigateToScreen('dashboard', { replace: true });
    } catch (_error) {
      showAlert({
        title: 'เชื่อมต่อไม่สำเร็จ',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleRegisterSuccess = (message) => {
    navigateToScreen('login', { replace: true });
    if (message) {
      showAlert({
        title: 'สมัครสมาชิกสำเร็จ',
        message,
      });
    }
  };

  const navigateToChat = (msg = '') => {
    const validationError = msg ? validateChatMessage(msg) : '';
    if (validationError) {
      showAlert({
        title: 'ข้อความยังไม่พร้อมส่ง',
        message: validationError,
      });
      return;
    }

    navigateToScreen('chat', { chatMessage: msg });
  };

  const isAppReady = !isCheckingSession;

  return (
    <div className="app-shell flex items-start justify-center overflow-x-hidden font-sans sm:items-center">
      <div
        className="
          app-surface relative w-full
          sm:h-[896px]
          sm:max-h-[92vh]
          sm:rounded-[3rem]
          sm:border-[10px] sm:border-slate-900
          overflow-hidden transition-all duration-300
        "
      >
        <div className="absolute left-1/2 top-0 z-[100] hidden h-7 w-36 -translate-x-1/2 rounded-b-3xl bg-slate-900 sm:block" />

        {showToast && (
          <div className="absolute left-0 right-0 top-[max(1rem,env(safe-area-inset-top))] z-[110] px-4 sm:px-6">
            <div className="animate-fade-up flex items-center justify-center gap-3 rounded-2xl border border-emerald-400 bg-emerald-500/95 px-5 py-3 text-white shadow-xl backdrop-blur-md">
              <CheckCircle2 size={18} />
              <span className="text-sm font-black tracking-tight">บันทึกข้อมูลเรียบร้อย</span>
            </div>
          </div>
        )}

        {reminderToast && (
          <div className="pointer-events-none absolute left-0 right-0 top-[max(4.75rem,calc(env(safe-area-inset-top)+4rem))] z-[109] px-4 sm:px-6">
            <div className="animate-fade-up pointer-events-auto rounded-2xl border border-sky-200 bg-white/96 px-4 py-3 shadow-xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{reminderToast.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{reminderToast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReminderToast(null)}
                  className="touch-target rounded-xl px-3 py-2 text-xs font-black text-sky-600 transition hover:bg-sky-50"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="app-screen relative flex w-full flex-col">
          <div className="custom-scrollbar flex-1 min-h-0 overflow-visible touch-pan-y">
            {!isAppReady && (
              <div className="flex min-h-[var(--app-vh)] items-center justify-center bg-white">
                <ScreenLoader label="กำลังตรวจสอบการเข้าสู่ระบบ..." />
              </div>
            )}

            {isAppReady && currentScreen === 'login' && (
              <LoginPage onLogin={handleLogin} onGoToRegister={() => navigateToScreen('register')} />
            )}

            {isAppReady && currentScreen === 'register' && (
              <RegisterPage
                onBack={() => goBackInApp('login')}
                onRegisterSuccess={handleRegisterSuccess}
                onNotice={showAlert}
              />
            )}

            {isAppReady && currentScreen === 'profile' && (
              <ProfileSetupPage onSave={handleSaveData} onNotice={showAlert} />
            )}

            {isAppReady && currentScreen === 'dashboard' && (
              <Suspense fallback={<ScreenLoader label="กำลังเปิดหน้าหลัก..." />}>
                <DashboardPage
                  userName={userData?.name}
                  bmi={userData?.bmi}
                  stage={userData?.stage}
                  allergy={userData?.allergy}
                  treatment={userData?.treatment}
                  beforeGlucose={getLatestByPhase('before')}
                  afterGlucose={getLatestByPhase('after')}
                  lastGlucose={glucoseHistory[0]}
                  onSaveGlucose={handleSaveGlucose}
                  onSelectReport={() => navigateToScreen('report')}
                  onEditProfile={() => navigateToScreen('edit_profile')}
                  onLogout={handleLogout}
                  onNotice={showAlert}
                  notificationPermission={notificationPermission}
                  onEnableNotifications={requestNotificationPermission}
                  onSelectChat={(category) =>
                    category ? navigateToScreen('category_detail', { category }) : navigateToChat('')
                  }
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'category_detail' && (
              <Suspense fallback={<ScreenLoader label="กำลังเปิดหมวดคำแนะนำ..." />}>
                <CategoryDetailPage
                  category={selectedCategory}
                  userData={userData}
                  onBack={() => goBackInApp('dashboard')}
                  onSelectChat={navigateToChat}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'chat' && (
              <Suspense fallback={<ScreenLoader label="กำลังเปิดหน้าคุยกับหมอ AI..." />}>
                <ChatBotPage
                  onBack={() => goBackInApp('dashboard')}
                  userData={{ ...userData, lastGlucose: glucoseHistory[0] }}
                  initialMessage={initialChatMsg}
                  onNotice={showAlert}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'edit_profile' && (
              <Suspense fallback={<ScreenLoader label="กำลังเปิดหน้าแก้ไขข้อมูล..." />}>
                <EditProfilePage
                  initialData={userData}
                  onSave={handleSaveData}
                  onCancel={() => goBackInApp('dashboard')}
                  onNotice={showAlert}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'report' && (
              <Suspense fallback={<ScreenLoader label="กำลังโหลดรายงานสุขภาพ..." />}>
                <WeeklyReportPage
                  onBack={() => goBackInApp('dashboard')}
                  glucoseHistory={glucoseHistory}
                  onConsultAI={navigateToChat}
                />
              </Suspense>
            )}

            {isAppReady && !APP_SCREENS.includes(currentScreen) && (
              <EmptyScreen
                title="ไม่พบหน้าที่ต้องการ"
                message="กรุณาย้อนกลับไปหน้าก่อนหน้า หรือลองเข้าสู่ระบบใหม่อีกครั้ง"
              />
            )}
          </div>
        </div>
      </div>

      <AppDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        variant={dialogState.variant}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={handleDialogConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
