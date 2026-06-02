import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Droplet, Utensils, X } from 'lucide-react';
import { validateGlucoseValue } from '../utils/validation';

export default function GlucoseModal({ isOpen, onClose, onSave, onNotice }) {
  const [value, setValue] = useState('');
  const [mealPhase, setMealPhase] = useState('before');

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setMealPhase('before');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const validationError = validateGlucoseValue(value);

    if (validationError) {
      onNotice?.({
        title: 'ค่าน้ำตาลไม่ถูกต้อง',
        message: validationError,
      });
      return;
    }

    onSave(parseInt(value, 10), mealPhase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="animate-slide-up relative z-10 w-full max-w-[380px] rounded-[2.25rem] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <button
          onClick={onClose}
          className="touch-target absolute right-4 top-4 inline-flex items-center justify-center rounded-2xl text-slate-300 transition hover:bg-slate-50 hover:text-slate-600"
          aria-label="ปิดหน้าต่าง"
        >
          <X size={22} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div
              className={`rounded-[1.75rem] p-5 transition-colors ${
                mealPhase === 'before' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
              }`}
            >
              <Droplet size={36} fill="currentColor" />
            </div>
            <div className="absolute -bottom-2 -right-2 rounded-full bg-white p-1 shadow-sm">
              <CheckCircle2 size={18} className="fill-white text-emerald-500" />
            </div>
          </div>

          <h3 className="text-2xl font-black tracking-tight text-slate-900">บันทึกค่าน้ำตาล</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            เลือกช่วงเวลาและใส่ค่าที่วัดได้ เพื่อให้ระบบสรุปแนวโน้มได้แม่นยำขึ้น
          </p>

          <div className="mt-5 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            ช่วงค่าที่แนะนำ <span className="ml-2 text-blue-600">20 - 600 mg/dL</span>
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <PhaseButton
              active={mealPhase === 'before'}
              onClick={() => setMealPhase('before')}
              icon={<Clock size={16} strokeWidth={3} />}
              label="ก่อนอาหาร"
              tone="blue"
            />
            <PhaseButton
              active={mealPhase === 'after'}
              onClick={() => setMealPhase('after')}
              icon={<Utensils size={16} strokeWidth={3} />}
              label="หลังอาหาร"
              tone="orange"
            />
          </div>

          <div className="mt-7 w-full">
            <input
              type="number"
              autoFocus
              inputMode="numeric"
              min="20"
              max="600"
              step="1"
              className="w-full bg-transparent text-center text-6xl font-black tracking-tight text-slate-800 outline-none placeholder:text-slate-200"
              placeholder="000"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSave()}
            />
            <p className="mt-3 text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              mg/dL
            </p>
          </div>

          <button
            onClick={handleSave}
            className={`touch-target mt-8 flex w-full items-center justify-center rounded-[1.75rem] py-4 text-base font-black text-white shadow-xl transition active:scale-95 ${
              mealPhase === 'before'
                ? 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'
                : 'bg-orange-500 shadow-orange-100 hover:bg-orange-600'
            }`}
          >
            ยืนยันบันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

function PhaseButton({ active, onClick, icon, label, tone }) {
  const toneClass =
    tone === 'blue'
      ? active
        ? 'border-blue-600 bg-blue-600 text-white shadow-blue-100'
        : 'border-slate-200 bg-white text-slate-500'
      : active
        ? 'border-orange-500 bg-orange-500 text-white shadow-orange-100'
        : 'border-slate-200 bg-white text-slate-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex items-center justify-center gap-2 rounded-[1.5rem] border-2 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] transition active:scale-[0.99] ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  );
}
