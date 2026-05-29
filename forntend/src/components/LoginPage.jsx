import React, { useState } from 'react';
import { User, Lock, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';

const LoginPage = ({ onLogin, onGoToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    await onLogin(username, password);
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-white p-8 font-sans sm:h-full">
      <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-indigo-50 opacity-60 blur-3xl animate-pulse" />
      <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-slate-50 opacity-50 blur-3xl" />

      <div className="relative z-10 mb-12 text-center">
        <div className="group relative inline-block">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2.2rem] bg-indigo-600 shadow-2xl shadow-indigo-200 ring-8 ring-indigo-50/50 transition-transform duration-500 rotate-6 group-hover:rotate-12">
            <Sparkles size={36} className="fill-indigo-200 text-white" />
          </div>
          <div className="absolute -right-1 -bottom-1 rounded-full border border-slate-50 bg-white p-1.5 shadow-md">
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
        </div>

        <h1 className="mb-2 text-4xl font-black tracking-tighter text-slate-800">ยินดีต้อนรับ</h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Diabetes Care AI</p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
        <div className="group space-y-2">
          <label className="ml-5 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-indigo-600">
            ชื่อผู้ใช้งาน
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500">
              <User size={20} />
            </div>
            <input
              type="text"
              placeholder="กรอกชื่อผู้ใช้งาน"
              className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 py-4.5 pl-12 pr-4 font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="group space-y-2">
          <label className="ml-5 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-indigo-600">
            รหัสผ่าน
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-indigo-500">
              <Lock size={20} />
            </div>
            <input
              type="password"
              placeholder="กรอกรหัสผ่าน"
              className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 py-4.5 pl-12 pr-4 font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`group flex w-full transform items-center justify-center gap-3 rounded-[1.5rem] py-5 font-black shadow-xl transition-all active:scale-95 ${
            isLoading
              ? 'cursor-wait bg-indigo-400 text-white'
              : 'bg-indigo-600 text-white shadow-indigo-100 hover:-translate-y-1 hover:bg-indigo-700'
          }`}
        >
          {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          {!isLoading && <ArrowRight size={22} className="transition-transform group-hover:translate-x-1.5" />}
        </button>
      </form>

      <div className="relative z-10 mt-12 text-center">
        <div className="mb-3 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-slate-100" />
          <p className="text-xs font-bold text-slate-400">ยังไม่มีบัญชีใช่ไหม</p>
          <div className="h-px w-8 bg-slate-100" />
        </div>

        <button
          onClick={onGoToRegister}
          className="text-base font-black text-indigo-600 transition-all hover:text-indigo-800 hover:tracking-tight active:scale-90"
        >
          สร้างบัญชีใหม่ <span className="underline decoration-2 underline-offset-4">ที่นี่</span>
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
