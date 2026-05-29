import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const AppDialog = ({
  isOpen,
  title,
  message,
  variant = 'alert',
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isConfirm = variant === 'confirm';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.28)] animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isConfirm ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
            }`}
          >
            {isConfirm ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 whitespace-pre-line">{message}</p>
          </div>
        </div>

        <div className={`mt-6 grid gap-3 ${isConfirm ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {isConfirm && (
            <button
              onClick={onCancel}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-500 transition hover:bg-slate-50"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-3 text-sm font-black text-white transition ${
              isConfirm ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppDialog;
