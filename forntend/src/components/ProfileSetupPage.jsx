import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Pill,
  Ruler,
  Scale,
  User,
} from 'lucide-react';
import { validateProfileForm } from '../utils/validation';

export default function ProfileSetupPage({ onSave, onNotice }) {
  const [formData, setFormData] = useState({
    name: '',
    weight: '',
    height: '',
    stage: '1',
    treatment: 'กินยา',
    allergy: '',
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationError = validateProfileForm(formData);

    if (validationError) {
      onNotice?.({
        title: 'ข้อมูลสุขภาพยังไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    onSave(formData);
  };

  return (
    <div className="app-safe-top app-safe-bottom min-h-[100dvh] bg-white sm:h-full">
      <div className="border-b border-slate-100 bg-white px-6 pb-5 pt-3">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">ตั้งค่าโปรไฟล์สุขภาพ</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          ข้อมูลนี้จะช่วยให้ระบบคำนวณและแนะนำการดูแลที่เหมาะกับคุณมากขึ้น
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
        <Field
          label="ชื่อ-นามสกุล"
          icon={<User size={18} />}
          placeholder="เช่น คุณสมชาย ใจดี"
          value={formData.name}
          onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="น้ำหนัก (กก.)"
            icon={<Scale size={18} />}
            type="number"
            inputMode="decimal"
            placeholder="เช่น 65"
            value={formData.weight}
            onChange={(event) => setFormData((prev) => ({ ...prev, weight: event.target.value }))}
          />
          <Field
            label="ส่วนสูง (ซม.)"
            icon={<Ruler size={18} />}
            type="number"
            inputMode="decimal"
            placeholder="เช่น 165"
            value={formData.height}
            onChange={(event) => setFormData((prev) => ({ ...prev, height: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <label className="pl-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            ระยะของโรค
          </label>
          <div className="relative">
            <Activity size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={formData.stage}
              onChange={(event) => setFormData((prev) => ({ ...prev, stage: event.target.value }))}
              className="touch-target w-full appearance-none rounded-[1.5rem] border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
            >
              <option value="1">ระยะที่ 1 ดูแลและคุมได้ดี</option>
              <option value="2">ระยะที่ 2 ต้องติดตามใกล้ชิดขึ้น</option>
              <option value="3">ระยะที่ 3 เริ่มมีภาวะแทรกซ้อน</option>
            </select>
          </div>
        </div>

        <Field
          label="ประวัติการแพ้ยา"
          icon={<AlertCircle size={18} />}
          placeholder="ถ้าไม่มีให้เว้นว่างได้"
          value={formData.allergy}
          onChange={(event) => setFormData((prev) => ({ ...prev, allergy: event.target.value }))}
          tone="danger"
        />

        <div className="rounded-[2rem] border border-orange-100 bg-orange-50 p-5 shadow-sm">
          <label className="mb-4 flex items-center gap-2 text-sm font-black text-orange-800">
            <Pill size={18} />
            รูปแบบการดูแลน้ำตาลปัจจุบัน
          </label>

          <div className="grid gap-3">
            <TreatmentButton
              active={formData.treatment === 'กินยา'}
              onClick={() => setFormData((prev) => ({ ...prev, treatment: 'กินยา' }))}
              label="ทานยา"
              tone="blue"
            />
            <TreatmentButton
              active={formData.treatment === 'ฉีดยา'}
              onClick={() => setFormData((prev) => ({ ...prev, treatment: 'ฉีดยา' }))}
              label="ฉีดยา"
              tone="orange"
            />
            <TreatmentButton
              active={formData.treatment === 'ไม่มี'}
              onClick={() => setFormData((prev) => ({ ...prev, treatment: 'ไม่มี' }))}
              label="ยังไม่ได้ใช้ยา"
              description="คุมอาหารและออกกำลังกาย"
              tone="emerald"
            />
          </div>
        </div>

        <button
          type="submit"
          className="touch-target flex w-full items-center justify-center gap-2 rounded-[1.75rem] bg-blue-600 py-4 text-base font-black text-white shadow-xl shadow-blue-100 transition active:scale-95"
        >
          บันทึกและเริ่มใช้งาน
          <ChevronRight size={18} />
        </button>
      </form>
    </div>
  );
}

function Field({ label, icon, type = 'text', tone = 'default', ...props }) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-100 bg-red-50 focus:border-red-200 focus:ring-red-100/70'
      : 'border-slate-200 bg-slate-50 focus:border-indigo-200 focus:ring-indigo-100/70';

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
          className={`touch-target w-full rounded-[1.5rem] border py-4 pl-12 pr-4 text-base font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 focus:bg-white focus:ring-4 ${toneClass}`}
        />
      </div>
    </label>
  );
}

function TreatmentButton({ active, onClick, label, description, tone }) {
  const toneMap = {
    blue: active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-500',
    orange: active ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-500',
    emerald: active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex w-full items-center justify-between rounded-[1.5rem] border-2 px-4 py-4 text-left font-black transition active:scale-[0.99] ${toneMap[tone]}`}
    >
      <div>
        <p className="text-base">{label}</p>
        {description && <p className={`mt-1 text-xs font-semibold ${active ? 'text-white/80' : 'text-slate-400'}`}>{description}</p>}
      </div>
      {active && <CheckCircle2 size={18} />}
    </button>
  );
}
