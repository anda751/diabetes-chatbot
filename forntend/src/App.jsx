import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ProfileSetupPage from './components/ProfileSetupPage';
import AppDialog from './components/AppDialog';
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
const DashboardPage = lazy(() => import('./components/DashboardPage'));
const ChatBotPage = lazy(() => import('./components/ChatBotPage'));
const WeeklyReportPage = lazy(() => import('./components/WeeklyReportPage'));
const EditProfilePage = lazy(() => import('./components/EditProfilePage'));
const CategoryDetailPage = lazy(() => import('./components/CategoryDetailPage'));

const buildAppUrl = (screen) => {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}#/${screen || DEFAULT_SCREEN}`;
};

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [userData, setUserData] = useState(null);
  const [glucoseHistory, setGlucoseHistory] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [initialChatMsg, setInitialChatMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
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

  const closeDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const applyScreenState = useCallback((screen, options = {}) => {
    setCurrentScreen(screen || DEFAULT_SCREEN);
    setSelectedCategory(options.category ?? null);
    setInitialChatMsg(options.chatMessage ?? '');
  }, []);

  const updateBrowserHistory = useCallback((screen, options = {}, mode = 'push') => {
    if (typeof window === 'undefined') {
      return;
    }

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
    ({ title = 'ยืนยันการทำรายการ', message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', onConfirm }) => {
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
    if (typeof window === 'undefined') {
      return undefined;
    }

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
    } catch (error) {
      showAlert({
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ',
        message: 'การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleLogout = () => {
    showConfirm({
      title: 'ออกจากระบบ',
      message: 'คุณต้องการออกจากระบบใช่หรือไม่?',
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
    setTimeout(() => setShowToast(false), 3000);

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
    } catch (error) {
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
  const screenLoader = (
    <div className="min-h-[40dvh] flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
        <p className="text-sm font-bold text-slate-500">กำลังเปิดหน้าถัดไป...</p>
      </div>
    </div>
  );

  return (
    <div className="app-shell flex items-start sm:items-center justify-center font-sans overflow-x-hidden">
      <div
        className="
          app-surface relative w-full
          sm:h-[896px]
          sm:max-h-[92vh]
          sm:shadow-[0_25px_70px_rgba(15,23,42,0.18)]
          sm:rounded-[3rem]
          sm:border-[10px] sm:border-slate-900
          overflow-hidden transition-all duration-300
        "
      >
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-slate-900 rounded-b-3xl z-[100]"></div>

        {showToast && (
          <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-0 right-0 px-4 sm:px-6 z-[110] animate-in slide-in-from-top duration-500">
            <div className="bg-emerald-500/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-center gap-3 border border-emerald-400">
              <CheckCircle2 size={18} />
              <span className="font-black text-sm tracking-tight">บันทึกข้อมูลเรียบร้อย</span>
            </div>
          </div>
        )}

        <div className="app-screen w-full min-h-[100dvh] sm:h-full flex flex-col relative bg-white">
          <div className="flex-1 min-h-0 overflow-visible custom-scrollbar touch-pan-y">
            {!isAppReady && (
              <div className="min-h-[100dvh] flex items-center justify-center bg-white">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  <p className="text-sm font-bold text-slate-500">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
                </div>
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
              <Suspense fallback={screenLoader}>
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
                  onSelectChat={(category) =>
                    category
                      ? navigateToScreen('category_detail', { category })
                      : navigateToChat('')
                  }
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'category_detail' && (
              <Suspense fallback={screenLoader}>
                <CategoryDetailPage
                  category={selectedCategory}
                  userData={userData}
                  onBack={() => goBackInApp('dashboard')}
                  onSelectChat={navigateToChat}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'chat' && (
              <Suspense fallback={screenLoader}>
                <ChatBotPage
                  onBack={() => goBackInApp('dashboard')}
                  userData={{ ...userData, lastGlucose: glucoseHistory[0] }}
                  initialMessage={initialChatMsg}
                  onNotice={showAlert}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'edit_profile' && (
              <Suspense fallback={screenLoader}>
                <EditProfilePage
                  initialData={userData}
                  onSave={handleSaveData}
                  onCancel={() => goBackInApp('dashboard')}
                  onNotice={showAlert}
                />
              </Suspense>
            )}

            {isAppReady && currentScreen === 'report' && (
              <Suspense fallback={screenLoader}>
                <WeeklyReportPage
                  onBack={() => goBackInApp('dashboard')}
                  glucoseHistory={glucoseHistory}
                  onConsultAI={navigateToChat}
                />
              </Suspense>
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

      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar { width: 0px; display: none; }
          .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>
    </div>
  );
}

export default App;
