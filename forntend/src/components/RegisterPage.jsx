import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Lock, User, UserCircle } from 'lucide-react';
import { API_URL } from '../config';
import { validateName, validatePassword, validateUsername } from '../utils/validation';

export default function RegisterPage({ onBack, onRegisterSuccess, onNotice }) {
  const [formData, setFormData] = useState({ username: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError =
      validateUsername(formData.username) ||
      validatePassword(formData.password) ||
      validateName(formData.name);

    if (validationError) {
      onNotice?.({
        title: 'ข้อมูลยังไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onRegisterSuccess?.('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้งานที่สมัครไว้');
      } else {
        onNotice?.({
          title: 'สมัครสมาชิกไม่สำเร็จ',
          message: data.message || data.error || 'กรุณาลองใหม่อีกครั้ง',
        });
      }
    } catch (_error) {
      onNotice?.({
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ',
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-safe-top app-safe-bottom flex min-h-[100dvh] flex-col bg-white px-6 py-6 sm:h-full sm:px-8">
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="touch-target inline-flex w-fit items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
      >
        <ArrowLeft size={18} />
        กลับ
      </button>

      <div className="mt-6 mb-8 text-center">
        <div className="mx-auto mb-5 flex h-18 w-18 items-center justify-center rounded-[1.75rem] bg-indigo-600 text-white shadow-xl shadow-indigo-100">
          <UserCircle size={34} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">สร้างบัญชีใหม่</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          กรอกข้อมูลพื้นฐานเพื่อเริ่มใช้งานระบบดูแลสุขภาพบนมือถือได้สะดวกขึ้น
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="ชื่อผู้ใช้งาน"
          icon={<User size={20} />}
          placeholder="กรอกชื่อผู้ใช้งาน"
          value={formData.username}
          onChange={(event) => setFormData((prev) => ({ ...prev, username: event.target.value.trim() }))}
          autoComplete="username"
        />

        <Field
          label="รหัสผ่าน"
          icon={<Lock size={20} />}
          type="password"
          placeholder="กรอกรหัสผ่าน"
          value={formData.password}
          onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
          autoComplete="new-password"
        />

        <Field
          label="ชื่อ-นามสกุล"
          icon={<UserCircle size={20} />}
          placeholder="กรอกชื่อ-นามสกุล"
          value={formData.name}
          onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
        />

        <button
          type="submit"
          disabled={loading}
          className={`touch-target flex w-full items-center justify-center gap-2 rounded-[1.5rem] py-4 text-base font-black shadow-lg transition active:scale-95 ${
            loading
              ? 'cursor-not-allowed bg-slate-300 text-white'
              : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              กำลังสร้างบัญชี...
            </>
          ) : (
            <>
              สมัครสมาชิก
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function Field({ label, icon, type = 'text', ...props }) {
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
          type={type}
          {...props}
          className="touch-target w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
          required
        />
      </div>
    </label>
  );
}
