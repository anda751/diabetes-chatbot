import React, { useState } from 'react';
import { Scale, Ruler, Activity, ChevronLeft, Save, Pill, AlertCircle, User, CheckCircle2 } from 'lucide-react';
import { validateProfileForm } from '../utils/validation';

const EditProfilePage = ({ onSave, onCancel, initialData, onNotice }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    weight: initialData?.weight || '',
    height: initialData?.height || '',
    stage: initialData?.stage || '1',
    treatment: initialData?.treatment || 'กินยา',
    allergy: initialData?.allergy || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
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
    <div className="flex min-h-[100dvh] flex-col bg-white sm:h-full">
      <div className="flex items-center gap-4 border-b p-4">
        <button onClick={onCancel} className="rounded-full p-2 transition hover:bg-gray-100" aria-label="กลับ">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">แก้ไขโปรไฟล์สุขภาพ</h2>
          <p className="text-sm text-gray-500">ปรับข้อมูลให้เป็นปัจจุบัน เพื่อให้คำแนะนำแม่นยำขึ้น</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-visible p-6 pb-10">
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold text-gray-600">
            <User size={18} />
            ชื่อ-นามสกุล
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border bg-gray-50 p-4 text-lg outline-none transition-all focus:border-blue-500"
            placeholder="เช่น คุณสมชาย ใจดี"
            maxLength={80}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-bold text-gray-600">
              <Scale size={18} />
              น้ำหนัก (กก.)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border-2 border-blue-50 bg-gray-50 p-4 text-center text-xl outline-none focus:border-blue-500"
              min="20"
              max="300"
              step="0.1"
              placeholder="เช่น 65"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-bold text-gray-600">
              <Ruler size={18} />
              ส่วนสูง (ซม.)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border bg-gray-50 p-4 text-center text-xl outline-none transition-all focus:border-blue-500"
              min="100"
              max="250"
              step="0.1"
              placeholder="เช่น 165"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold text-gray-600">
            <Activity size={18} />
            ระยะของโรค
          </label>
          <select
            className="w-full rounded-2xl border bg-white p-4 text-lg outline-none transition-all focus:border-blue-500"
            value={formData.stage}
            onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
          >
            <option value="1">ระยะที่ 1 (เริ่มดูแลและควบคุมได้)</option>
            <option value="2">ระยะที่ 2 (ต้องติดตามใกล้ชิดมากขึ้น)</option>
            <option value="3">ระยะที่ 3 (เริ่มมีภาวะแทรกซ้อน)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold text-red-700">
            <AlertCircle size={18} />
            ประวัติการแพ้ยา
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border border-red-100 bg-red-50 p-4 text-lg outline-none transition-all focus:border-red-400"
            placeholder="ถ้าไม่มีให้เว้นว่างได้"
            maxLength={200}
            value={formData.allergy}
            onChange={(e) => setFormData({ ...formData, allergy: e.target.value })}
          />
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-orange-50 p-5 shadow-sm">
          <label className="mb-4 flex items-center gap-2 font-bold text-orange-800">
            <Pill size={20} />
            รูปแบบการดูแลน้ำตาลปัจจุบัน
          </label>

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, treatment: 'กินยา' })}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 py-4 font-bold transition-all ${
                  formData.treatment === 'กินยา'
                    ? 'scale-[1.02] border-blue-600 bg-blue-600 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span>กินยา</span>
                {formData.treatment === 'กินยา' && <CheckCircle2 size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, treatment: 'ฉีดยา' })}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 py-4 font-bold transition-all ${
                  formData.treatment === 'ฉีดยา'
                    ? 'scale-[1.02] border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span>ฉีดยา</span>
                {formData.treatment === 'ฉีดยา' && <CheckCircle2 size={14} />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, treatment: 'ไม่มี' })}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 py-4 font-bold transition-all ${
                formData.treatment === 'ไม่มี'
                  ? 'scale-[1.02] border-emerald-600 bg-emerald-600 text-white shadow-md'
                  : 'border-gray-200 bg-white text-gray-400'
              }`}
            >
              ไม่มี (คุมอาหารและออกกำลังกาย)
              {formData.treatment === 'ไม่มี' && <CheckCircle2 size={18} />}
            </button>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-5 text-xl font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
          >
            <Save size={20} />
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;
