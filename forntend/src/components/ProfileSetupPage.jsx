import React, { useState } from 'react';
import { Scale, Ruler, Pill, Activity, ChevronRight, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateProfileForm } from '../utils/validation';

const ProfileSetupPage = ({ onSave, onNotice }) => {
  const [formData, setFormData] = useState({
    name: '',
    weight: '',
    height: '',
    stage: '1',
    treatment: 'กินยา',
    allergy: '',
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
    <div className="min-h-[100dvh] overflow-visible bg-white p-6 pb-10 sm:h-full">
      <h2 className="mb-2 text-2xl font-bold text-blue-800">ตั้งค่าโปรไฟล์สุขภาพ</h2>
      <p className="mb-6 text-gray-500">
        ข้อมูลนี้จะใช้ช่วยคำนวณและแนะนำการดูแลที่เหมาะกับคุณ
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold text-gray-700">
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
            <label className="flex items-center gap-1 font-bold text-gray-700">
              <Scale size={18} />
              น้ำหนัก (กก.)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border bg-gray-50 p-4 text-center text-xl outline-none transition-all focus:border-blue-500"
              placeholder="เช่น 65"
              min="20"
              max="300"
              step="0.1"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1 font-bold text-gray-700">
              <Ruler size={18} />
              ส่วนสูง (ซม.)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl border bg-gray-50 p-4 text-center text-xl outline-none transition-all focus:border-blue-500"
              placeholder="เช่น 165"
              min="100"
              max="250"
              step="0.1"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 font-bold text-gray-700">
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
            className="w-full rounded-2xl border border-red-100 bg-red-50 p-4 text-lg outline-none placeholder:text-red-300 focus:border-red-400"
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

        <button
          type="submit"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-blue-600 py-5 text-xl font-bold text-white shadow-xl transition-all hover:bg-blue-700 active:scale-95"
        >
          บันทึกและเริ่มใช้งาน <ChevronRight />
        </button>
      </form>
    </div>
  );
};

export default ProfileSetupPage;
