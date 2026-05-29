import React, { useState } from 'react';
import { User, Lock, UserCircle, ArrowRight, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { validateName, validatePassword, validateUsername } from '../utils/validation';

const RegisterPage = ({ onBack, onRegisterSuccess, onNotice }) => {
  const [formData, setFormData] = useState({ username: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

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
    } catch (error) {
      onNotice?.({
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ',
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center overflow-visible bg-white p-8 sm:h-full">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 rotate-3">
          <UserCircle size={40} />
        </div>
        <h2 className="text-3xl font-black tracking-tighter text-slate-800">สร้างบัญชีใหม่</h2>
        <p className="mt-2 text-sm font-bold uppercase tracking-widest text-slate-400">
          เริ่มดูแลสุขภาพกับหมอ AI
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-4 top-4 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="กรอกชื่อผู้ใช้งาน"
            minLength={4}
            maxLength={20}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            onChange={(e) => setFormData({ ...formData, username: e.target.value.trim() })}
            disabled={loading}
            autoComplete="username"
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
          <input
            type="password"
            placeholder="กรอกรหัสผ่าน"
            minLength={4}
            maxLength={64}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            disabled={loading}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="relative">
          <UserCircle className="absolute left-4 top-4 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="กรอกชื่อ-นามสกุล"
            maxLength={80}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-12 pr-4 font-medium outline-none transition-all focus:border-indigo-200 focus:ring-2 focus:ring-indigo-100"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-black shadow-lg transition-all ${
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
              <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      <button
        onClick={onBack}
        disabled={loading}
        className="mt-6 text-sm font-bold text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-50"
      >
        ย้อนกลับไปหน้าเข้าสู่ระบบ
      </button>
    </div>
  );
};

export default RegisterPage;
