import React, { useEffect, useState } from 'react';
import { X, Droplet, Utensils, Clock, CheckCircle2 } from 'lucide-react';
import { validateGlucoseValue } from '../utils/validation';

const GlucoseModal = ({ isOpen, onClose, onSave, onNotice }) => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="bg-white w-full max-w-[380px] rounded-[3rem] p-8 relative shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-10 animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 hover:rotate-90 transition-all p-2 rounded-full hover:bg-slate-50"
          aria-label="ปิดหน้าต่าง"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center">
          <div className="relative mb-5">
            <div className={`p-5 rounded-3xl transition-colors duration-500 ${mealPhase === 'before' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
              <Droplet size={38} fill="currentColor" className="animate-pulse" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-sm">
              <CheckCircle2 size={20} className="text-emerald-500 fill-white" />
            </div>
          </div>

          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-1">บันทึกค่าน้ำตาล</h3>
          <p className="text-slate-400 text-sm font-medium mb-6 text-center">
            เลือกช่วงเวลาและใส่ค่าที่วัดได้
          </p>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">
            ค่าที่แนะนำ
            <span className="text-blue-600">20 - 600 mg/dL</span>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-[2rem] gap-1 mb-8 w-full relative overflow-hidden">
            <button
              onClick={() => setMealPhase('before')}
              className={`flex-1 py-4 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest z-10 ${mealPhase === 'before' ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Clock size={16} strokeWidth={3} />
              ก่อนอาหาร
            </button>
            <button
              onClick={() => setMealPhase('after')}
              className={`flex-1 py-4 rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-2 transition-all uppercase tracking-widest z-10 ${mealPhase === 'after' ? 'bg-white text-orange-600 shadow-xl shadow-orange-500/10 scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Utensils size={16} strokeWidth={3} />
              หลังอาหาร
            </button>
          </div>

          <div className="relative w-full group flex flex-col items-center mb-8">
            <input
              type="number"
              autoFocus
              inputMode="numeric"
              min="20"
              max="600"
              step="1"
              className="w-full text-7xl font-black text-center text-slate-800 outline-none placeholder:text-slate-100 transition-all group-hover:scale-105"
              placeholder="000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className={`h-1.5 w-24 rounded-full transition-all duration-500 ${mealPhase === 'before' ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-orange-500 shadow-lg shadow-orange-500/50'}`} />
            <p className="text-slate-400 font-black mt-4 tracking-[0.3em] text-xs uppercase italic">mg/dL</p>
          </div>

          <button
            onClick={handleSave}
            className={`w-full py-5 rounded-[2rem] font-black text-xl shadow-2xl transition-all active:scale-95 text-white flex items-center justify-center gap-3 ${
              mealPhase === 'before' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
            }`}
          >
            <span>ยืนยันบันทึก</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlucoseModal;
