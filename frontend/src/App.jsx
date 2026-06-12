import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { CheckCircle2 } from 'lucide-react';
import AppDialog from './components/AppDialog';
import GlucoseModal from './components/GlucoseModal';
import LoginPage from './components/LoginPage';
import ProfileSetupPage from './components/ProfileSetupPage';
import RegisterPage from './components/RegisterPage';
import { API_URL } from './config';
import {
  clearNativeMealReminders,
  ensureNativeReminderNotificationsReady,
  isNativeAndroidApp,
  openExactAlarmSettings,
  scheduleNativeReminderTestNotification,
  syncNativeMealReminders,
} from './utils/nativeNotifications';
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
const PUSH_ENDPOINT_STORAGE_KEY = 'push_subscription_endpoint';
const DEFAULT_MEAL_REMINDERS = [
  { id: 'breakfast', label: 'อาหารเช้า', time: '08:00', isEnabled: true, completedSlotKey: '' },
  { id: 'lunch', label: 'อาหารกลางวัน', time: '12:00', isEnabled: true, completedSlotKey: '' },
  { id: 'dinner', label: 'อาหารเย็น', time: '18:00', isEnabled: true, completedSlotKey: '' },
];
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

const getScreenBackFallback = (screen) => {
  switch (screen) {
    case 'register':
      return 'login';
    case 'profile':
      return 'login';
    case 'category_detail':
    case 'chat':
    case 'edit_profile':
    case 'report':
      return 'dashboard';
    default:
      return null;
  }
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
    if (!saved) return DEFAULT_MEAL_REMINDERS;

    const parsed = JSON.parse(saved);
    return mergeWithDefaultMealReminders(parsed);
  } catch {
    return DEFAULT_MEAL_REMINDERS;
  }
}

function mergeWithDefaultMealReminders(reminders) {
  const reminderList = Array.isArray(reminders) ? reminders : [];
  const mergedDefaults = DEFAULT_MEAL_REMINDERS.map((defaultReminder) => {
    const matchedReminder = reminderList.find(
      (item) => String(item?.id || '') === String(defaultReminder.id)
    );

    return {
      ...defaultReminder,
      ...matchedReminder,
      id: defaultReminder.id,
      label: matchedReminder?.label || defaultReminder.label,
      time: matchedReminder?.time || defaultReminder.time,
      isEnabled: matchedReminder?.isEnabled !== false,
      completedSlotKey:
        typeof matchedReminder?.completedSlotKey === 'string'
          ? matchedReminder.completedSlotKey
          : defaultReminder.completedSlotKey,
    };
  });

  const extraReminders = reminderList
    .filter((item) => !DEFAULT_MEAL_REMINDERS.some((defaultReminder) => String(defaultReminder.id) === String(item?.id)))
    .map((item, index) => ({
      id: String(item?.id || `extra-${index + 1}`),
      label: String(item?.label || `มื้อเพิ่มเติม ${index + 1}`).trim(),
      time: String(item?.time || '10:00').trim(),
      isEnabled: item?.isEnabled !== false,
      completedSlotKey: typeof item?.completedSlotKey === 'string' ? item.completedSlotKey : '',
    }));

  return [...mergedDefaults, ...extraReminders];
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

function normalizeGlucoseRecord(record) {
  if (!record || typeof record !== 'object') return record;
  return {
    ...record,
    recordedAt: record.recordedAt || record.recorded_at || '',
    reminderSlotKey: record.reminderSlotKey || record.reminder_slot_key || '',
  };
}

function getRecordDate(record) {
  const parsedDate = new Date(record?.recordedAt || record?.recorded_at || '');
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function parseReminderMinutes(timeValue) {
  if (typeof timeValue !== 'string') return 0;
  const [hour = '0', minute = '0'] = timeValue.split(':');
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  if (Number.isNaN(parsedHour) || Number.isNaN(parsedMinute)) {
    return 0;
  }

  return parsedHour * 60 + parsedMinute;
}

function getActiveReminderForDate(reminders, date = new Date()) {
  const enabledReminders = [...(Array.isArray(reminders) ? reminders : [])]
    .filter((item) => item?.isEnabled !== false && item?.time)
    .sort((left, right) => parseReminderMinutes(left.time) - parseReminderMinutes(right.time));

  if (!enabledReminders.length) return null;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  let activeReminder = enabledReminders[0];

  enabledReminders.forEach((item) => {
    if (parseReminderMinutes(item.time) <= currentMinutes) {
      activeReminder = item;
    }
  });

  return activeReminder;
}

function getCurrentMealSlotGlucoseSummary(history, reminders, date = new Date()) {
  const activeReminder = getActiveReminderForDate(reminders, date);
  if (!activeReminder) {
    const historyList = Array.isArray(history) ? history : [];
    const latestRecord = historyList[0] || null;
    return {
      activeReminder: null,
      slotKey: '',
      beforeRecord: historyList.find((item) => item?.phase === 'before') || null,
      afterRecord: historyList.find((item) => item?.phase === 'after') || null,
      latestRecord,
    };
  }

  const currentSlotKey = getReminderAlertKey(activeReminder, date);
  let currentSlotRecords = (Array.isArray(history) ? history : []).filter(
    (item) => String(item?.reminder_slot_key || item?.reminderSlotKey || '') === currentSlotKey
  );

  if (!currentSlotRecords.length) {
    const enabledReminders = [...(Array.isArray(reminders) ? reminders : [])]
      .filter((item) => item?.isEnabled !== false && item?.time)
      .sort((left, right) => parseReminderMinutes(left.time) - parseReminderMinutes(right.time));
    const activeIndex = enabledReminders.findIndex((item) => item?.id === activeReminder.id);
    const slotStart = new Date(date);
    const [startHour = '0', startMinute = '0'] = String(activeReminder.time || '00:00').split(':');
    slotStart.setHours(Number.parseInt(startHour, 10), Number.parseInt(startMinute, 10), 0, 0);

    const nextReminder = activeIndex >= 0 ? enabledReminders[activeIndex + 1] : null;
    const slotEnd = new Date(slotStart);
    if (nextReminder?.time) {
      const [endHour = '23', endMinute = '59'] = String(nextReminder.time).split(':');
      slotEnd.setHours(Number.parseInt(endHour, 10), Number.parseInt(endMinute, 10), 0, 0);
    } else {
      slotEnd.setDate(slotEnd.getDate() + 1);
      slotEnd.setHours(0, 0, 0, 0);
    }

    currentSlotRecords = (Array.isArray(history) ? history : []).filter((item) => {
      const recordDate = getRecordDate(item);
      if (!recordDate) return false;
      return recordDate >= slotStart && recordDate < slotEnd;
    });
  }

  const beforeRecord = currentSlotRecords.find((item) => item?.phase === 'before') || null;
  const afterRecord = currentSlotRecords.find((item) => item?.phase === 'after') || null;
  const latestRecord = currentSlotRecords[0] || null;

  return {
    activeReminder,
    slotKey: currentSlotKey,
    beforeRecord,
    afterRecord,
    latestRecord,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

const IS_NATIVE_ANDROID = isNativeAndroidApp();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(DEFAULT_SCREEN);
  const [userData, setUserData] = useState(null);
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [reminders, setReminders] = useState(() => loadMealRemindersFromStorage());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [initialChatMsg, setInitialChatMsg] = useState('');
  const [isGlucoseModalOpen, setIsGlucoseModalOpen] = useState(false);
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
  const reminderSyncTimerRef = useRef(null);
  const pushSubscriptionRef = useRef(null);

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
    } catch {
      // Ignore audio failures on restricted browsers.
    }
  }, []);

  const getServiceWorkerRegistration = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    const existingRegistration = await navigator.serviceWorker.getRegistration();
    if (existingRegistration) return existingRegistration;
    return navigator.serviceWorker.register('/sw.js');
  }, []);

  const syncPushSubscriptionToServer = useCallback(async (subscription) => {
    const response = await fetch(`${API_URL}/push-subscriptions`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      throw new Error('save_subscription_failed');
    }

    window.localStorage.setItem(PUSH_ENDPOINT_STORAGE_KEY, subscription.endpoint);
  }, []);

  const removePushSubscriptionFromServer = useCallback(async (endpoint) => {
    if (!endpoint) return;

    try {
      await fetch(`${API_URL}/push-subscriptions`, {
        method: 'DELETE',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // Ignore cleanup failures.
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PUSH_ENDPOINT_STORAGE_KEY);
      }
    }
  }, []);

  const registerPushSubscription = useCallback(async () => {
    if (IS_NATIVE_ANDROID) {
      return false;
    }

    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return false;
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const keyResponse = await fetch(`${API_URL}/push-public-key`, {
        credentials: 'include',
      });

      if (!keyResponse.ok) {
        throw new Error('missing_push_public_key');
      }

      const { publicKey } = await keyResponse.json();
      if (!publicKey) {
        throw new Error('missing_push_public_key');
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    pushSubscriptionRef.current = subscription;
    await syncPushSubscriptionToServer(subscription.toJSON());
    return true;
  }, [getServiceWorkerRegistration, syncPushSubscriptionToServer]);

  const syncRemindersToBackend = useCallback(async (nextReminders) => {
    if (!userData) return;

    const sanitizedReminders = mergeWithDefaultMealReminders(nextReminders).map((item, index) => ({
      id: String(item.id || `reminder-${index + 1}`),
      label: String(item.label || '').trim(),
      time: String(item.time || '').trim(),
      isEnabled: item.isEnabled !== false,
    }));

    setReminders(mergeWithDefaultMealReminders(nextReminders));
    try {
      const response = await fetch(`${API_URL}/reminders`, {
        method: 'PUT',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify({ reminders: sanitizedReminders }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'save_reminders_failed');
      }

      const syncedReminders = Array.isArray(data.reminders) ? data.reminders : sanitizedReminders;
      setReminders((prev) =>
        mergeWithDefaultMealReminders(syncedReminders).map((item) => {
          const previous = prev.find((entry) => String(entry.id) === String(item.id));
          return {
            ...item,
            completedSlotKey: previous?.completedSlotKey || '',
          };
        })
      );
    } catch (error) {
      console.error('Save reminders error:', error);
    } finally {
      if (reminderSyncTimerRef.current) {
        window.clearTimeout(reminderSyncTimerRef.current);
      }
      reminderSyncTimerRef.current = window.setTimeout(() => {
        reminderSyncTimerRef.current = null;
      }, 2500);
    }
  }, [userData]);

  const requestNotificationPermission = useCallback(async () => {
    if (IS_NATIVE_ANDROID) {
      try {
        const status = await ensureNativeReminderNotificationsReady();
        setNotificationPermission(status.granted ? 'granted' : 'denied');

        if (!status.granted) {
          showAlert({
            title: 'ยังไม่ได้เปิดการแจ้งเตือน',
            message: 'กรุณาอนุญาตการแจ้งเตือนของแอปก่อน แล้วระบบจะเตือนตามเวลามื้ออาหารที่ตั้งไว้ให้อัตโนมัติ',
          });
          return false;
        }

        if (!status.exactGranted) {
          showAlert({
            title: 'ตั้งค่าแจ้งเตือนได้แล้ว',
            message:
              'เปิดสิทธิ์แจ้งเตือนเรียบร้อยแล้ว หากต้องการให้เตือนตรงเวลามากขึ้น กรุณาเปิดการตั้งค่า Exact alarms ของแอปในหน้าถัดไปค่ะ',
          });
          try {
            await openExactAlarmSettings();
          } catch (error) {
            console.error('Open exact alarm settings error:', error);
          }
        }

        playReminderSound();
        try {
          await scheduleNativeReminderTestNotification();
        } catch (error) {
          console.error('Schedule native reminder test error:', error);
        }
        return true;
      } catch (error) {
        console.error('Native notification permission error:', error);
        showAlert({
          title: 'เปิดการแจ้งเตือนไม่สำเร็จ',
          message: 'ยังไม่สามารถตั้งค่าการแจ้งเตือนของแอปได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ',
        });
        return false;
      }
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      showAlert({
        title: 'อุปกรณ์นี้ยังไม่รองรับ',
        message: 'อุปกรณ์หรือเบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนจากเว็บแอป',
      });
      return false;
    }

    if (window.Notification.permission === 'granted') {
      setNotificationPermission('granted');
      try {
        await registerPushSubscription();
      } catch (error) {
        console.error('Push subscription error:', error);
      }
      return true;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== 'granted') {
      showAlert({
        title: 'ยังไม่ได้เปิดการแจ้งเตือน',
        message: 'กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์ก่อน แล้วระบบจะเตือนตามเวลามื้ออาหารที่ตั้งไว้ให้ค่ะ',
      });
      return false;
    }

    playReminderSound();
    try {
      await registerPushSubscription();
    } catch (error) {
      console.error('Push subscription error:', error);
      showAlert({
        title: 'เปิดการแจ้งเตือนแล้ว',
        message: 'อนุญาตการแจ้งเตือนแล้ว แต่ยังเชื่อมอุปกรณ์ไม่สำเร็จ ลองกดอีกครั้งได้ค่ะ',
      });
    }
    return true;
  }, [playReminderSound, registerPushSubscription, showAlert]);

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
    if (IS_NATIVE_ANDROID) {
      ensureNativeReminderNotificationsReady()
        .then((status) => {
          setNotificationPermission(status.granted ? 'granted' : 'default');
        })
        .catch((error) => {
          console.error('Initial native notification check error:', error);
        });
      return undefined;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    const syncPermission = () => {
      setNotificationPermission(window.Notification.permission);
    };

    syncPermission();
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  useEffect(() => {
    if (!userData || notificationPermission !== 'granted') return;

    if (IS_NATIVE_ANDROID) {
      return;
    }

    registerPushSubscription().catch((error) => {
      console.error('Push subscription sync error:', error);
    });
  }, [notificationPermission, registerPushSubscription, userData]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (reminderToastTimerRef.current) {
        window.clearTimeout(reminderToastTimerRef.current);
      }
      if (reminderSyncTimerRef.current) {
        window.clearTimeout(reminderSyncTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !userData) return undefined;
    if (IS_NATIVE_ANDROID) return undefined;

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
      } catch {
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
        } catch {
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
      if (!Array.isArray(reminders) || reminders.length === 0) return;

      const currentMinute = getMinuteKey(new Date());
      reminders.forEach((reminder) => {
        if (!reminder?.time || !reminder?.label) return;
        if (reminder.isEnabled === false) return;
        if (String(reminder.time) !== currentMinute) return;
        triggerReminder(reminder);
      });
    };

    checkMealReminders();
    const interval = window.setInterval(checkMealReminders, 30000);
    return () => window.clearInterval(interval);
  }, [playReminderSound, reminders, showAlert, userData]);

  useEffect(() => {
    if (!IS_NATIVE_ANDROID || !userData) return undefined;

    syncNativeMealReminders(reminders).catch((error) => {
      console.error('Sync native meal reminders error:', error);
    });

    return undefined;
  }, [reminders, userData]);

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
        const normalizedData = data.map(normalizeGlucoseRecord);
        const sortedData = [...normalizedData].sort((a, b) => {
          const leftTime = new Date(a.recordedAt || a.recorded_at || 0).getTime();
          const rightTime = new Date(b.recordedAt || b.recorded_at || 0).getTime();
          return rightTime - leftTime || (b.id || 0) - (a.id || 0);
        });
        setGlucoseHistory(sortedData);
      }
    } catch (error) {
      console.error('Fetch glucose history error:', error);
    }
  }, [navigateToScreen]);

  const fetchReminders = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/reminders`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setReminders(loadMealRemindersFromStorage());
        }
        return;
      }

      const data = await response.json();
      if (Array.isArray(data.reminders)) {
        const incomingReminders =
          data.reminders.length > 0 ? data.reminders : loadMealRemindersFromStorage();
        setReminders((prev) =>
          mergeWithDefaultMealReminders(incomingReminders).map((item) => {
            const previous = prev.find((entry) => String(entry.id) === String(item.id));
            return {
              ...item,
              completedSlotKey: previous?.completedSlotKey || '',
            };
          })
        );
      }
    } catch (error) {
      console.error('Fetch reminders error:', error);
    }
  }, []);

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
      await fetchReminders();
      await fetchGlucoseHistory();
      if (IS_NATIVE_ANDROID) {
        try {
          const status = await ensureNativeReminderNotificationsReady();
          setNotificationPermission(status.granted ? 'granted' : 'default');
        } catch (error) {
          console.error('Native notification sync error:', error);
        }
      } else if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
        try {
          await registerPushSubscription();
        } catch (error) {
          console.error('Push subscription sync error:', error);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
      navigateToScreen('login', { replace: true });
    } finally {
      setIsCheckingSession(false);
    }
  }, [fetchGlucoseHistory, fetchReminders, navigateToScreen, registerPushSubscription]);

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

  useEffect(() => {
    if (!IS_NATIVE_ANDROID) return undefined;

    let listenerHandle;
    let isCancelled = false;

    const bindBackButton = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', () => {
        if (dialogState.isOpen) {
          closeDialog();
          return;
        }

        if (isGlucoseModalOpen) {
          setIsGlucoseModalOpen(false);
          return;
        }

        if (historyIndexRef.current > 0 && typeof window !== 'undefined') {
          window.history.back();
          return;
        }

        const fallbackScreen = getScreenBackFallback(currentScreen);
        if (fallbackScreen) {
          navigateToScreen(fallbackScreen, { replace: true });
          return;
        }

        CapacitorApp.exitApp();
      });

      if (isCancelled && listenerHandle) {
        await listenerHandle.remove();
      }
    };

    bindBackButton();

    return () => {
      isCancelled = true;
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [closeDialog, currentScreen, dialogState.isOpen, isGlucoseModalOpen, navigateToScreen]);

  const handleLogin = async (username, password) => {
    const validationError = validateUsername(username) || validatePassword(password);
    if (validationError) {
      showAlert({
        title: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
        message: validationError,
      });
      return false;
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
      await fetchReminders();
      await fetchGlucoseHistory();
      if (IS_NATIVE_ANDROID) {
        try {
          const status = await ensureNativeReminderNotificationsReady();
          setNotificationPermission(status.granted ? 'granted' : 'default');
        } catch (error) {
          console.error('Native notification sync error:', error);
        }
      } else if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
        try {
          await registerPushSubscription();
        } catch (error) {
          console.error('Push subscription sync error:', error);
        }
      }
    } catch {
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
          if (typeof window !== 'undefined') {
            const savedEndpoint = window.localStorage.getItem(PUSH_ENDPOINT_STORAGE_KEY);
            if (savedEndpoint) {
              await removePushSubscriptionFromServer(savedEndpoint);
            }
          }
          await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          if (IS_NATIVE_ANDROID) {
            try {
              await clearNativeMealReminders();
            } catch (nativeError) {
              console.error('Clear native reminders error:', nativeError);
            }
          }
          setUserData(null);
          setGlucoseHistory([]);
          setReminders(loadMealRemindersFromStorage());
          setIsGlucoseModalOpen(false);
          setInitialChatMsg('');
          setSelectedCategory(null);
          navigateToScreen('login', { replace: true });
        }
      },
    });
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
    const activeReminder = getActiveReminderForDate(reminders, now);
    const newData = {
      value: Number.parseInt(value, 10),
      phase,
      date: now.toLocaleDateString('th-TH'),
      time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      recordedAt: now.toISOString(),
      reminderSlotKey: activeReminder ? getReminderAlertKey(activeReminder, now) : '',
    };

    try {
      const response = await fetch(`${API_URL}/glucose`, {
        method: 'POST',
        headers: jsonHeaders,
        credentials: 'include',
        body: JSON.stringify(newData),
      });
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        showAlert({
          title: 'บันทึกค่าน้ำตาลไม่สำเร็จ',
          message: responseData.error || 'ยังไม่สามารถบันทึกค่าน้ำตาลได้ในขณะนี้',
        });
        return false;
      }

      await fetchGlucoseHistory();
      setShowToast(true);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setShowToast(false), 2800);
      return true;
    } catch (error) {
      console.error('Save glucose error:', error);
      showAlert({
        title: 'เชื่อมต่อไม่สำเร็จ',
        message: 'ยังไม่สามารถบันทึกค่าน้ำตาลได้ กรุณาลองใหม่อีกครั้ง',
      });
      return false;
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
    } catch {
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
  const dashboardGlucoseSummary = useMemo(
    () => getCurrentMealSlotGlucoseSummary(glucoseHistory, reminders, new Date()),
    [glucoseHistory, reminders]
  );

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

        <div className="app-screen relative flex w-full flex-col overflow-hidden">
          <div className="custom-scrollbar flex-1 min-h-0 overflow-hidden">
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
                  userData={userData}
                  glucoseSummary={dashboardGlucoseSummary}
                  onEditProfile={() => navigateToScreen('edit_profile')}
                  onOpenGlucoseModal={() => setIsGlucoseModalOpen(true)}
                  onLogout={handleLogout}
                  onOpenCategory={(category) => navigateToScreen('category_detail', { category })}
                  onOpenChat={() => navigateToChat('')}
                  onOpenReport={() => navigateToScreen('report')}
                  notificationPermission={notificationPermission}
                  onEnableNotifications={requestNotificationPermission}
                  mealReminders={reminders}
                  onMealRemindersChange={syncRemindersToBackend}
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

      <GlucoseModal
        isOpen={isGlucoseModalOpen}
        onClose={() => setIsGlucoseModalOpen(false)}
        onSave={handleSaveGlucose}
        onNotice={showAlert}
      />
    </div>
  );
}
