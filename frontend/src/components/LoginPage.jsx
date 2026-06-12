import React, { useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, Sparkles, User } from 'lucide-react';

export default function LoginPage({ onLogin, onGoToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    await onLogin(username, password);
    setIsLoading(false);
  };

  return (
    <div className="app-page app-page-transition app-safe-top app-safe-bottom relative flex flex-col justify-center overflow-hidden bg-white px-6 py-8 sm:h-full sm:px-8">
      <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-indigo-50 opacity-60 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-sky-50 opacity-70 blur-3xl" />

      <div className="relative z-10 mb-10 text-center">
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-indigo-600 text-white shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50">
          <Sparkles size={34} className="fill-indigo-200" />
          <div className="absolute -bottom-1 -right-1 rounded-full border border-slate-50 bg-white p-1.5 shadow-md">
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-slate-900">ยินดีต้อนรับ</h1>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.28em] text-slate-400">
          Diabetes Care AI
        </p>
        <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-slate-500">
          เข้าสู่ระบบเพื่อดูแลค่าน้ำตาล พูดคุยกับหมอ AI และติดตามสุขภาพได้ทุกวัน
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
        <Field
          label="ชื่อผู้ใช้งาน"
          icon={<User size={20} />}
          type="text"
          placeholder="กรอกชื่อผู้ใช้งาน"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />

        <Field
          label="รหัสผ่าน"
          icon={<Lock size={20} />}
          type="password"
          placeholder="กรอกรหัสผ่าน"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={isLoading}
          className={`touch-target flex w-full items-center justify-center gap-3 rounded-[1.5rem] py-4 text-base font-black shadow-xl transition-all active:scale-95 ${
            isLoading
              ? 'cursor-wait bg-indigo-400 text-white'
              : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
          }`}
        >
          {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          {!isLoading && <ArrowRight size={20} />}
        </button>
      </form>

      <div className="relative z-10 mt-10 text-center">
        <p className="text-sm font-semibold text-slate-400">ยังไม่มีบัญชีใช่ไหม</p>
        <button
          type="button"
          onClick={onGoToRegister}
          className="touch-target mt-2 text-base font-black text-indigo-600 transition hover:text-indigo-800"
        >
          สร้างบัญชีใหม่
        </button>
      </div>
    </div>
  );
}

function Field({ label, icon, ...props }) {
  return (
    <label className="block space-y-2">
      <span className="pl-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </span>
      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          {...props}
          className="touch-target w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
          required
        />
      </div>
    </label>
  );
}
