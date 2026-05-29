import React from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles } from 'lucide-react';
import { CATEGORY_LABEL_TO_KEY, CATEGORY_TOPICS } from '../data/aiTopics';

const getTopicKey = (category) => CATEGORY_LABEL_TO_KEY[category] || 'report';

const CategoryDetailPage = ({ category, onBack, onSelectChat }) => {
  const topicKey = getTopicKey(category);
  const data = CATEGORY_TOPICS[topicKey] || CATEGORY_TOPICS.report;
  const Icon = data.icon;

  return (
    <div className="min-h-[100dvh] sm:h-full bg-slate-50 flex flex-col">
      <div className={`${data.color} p-8 text-white rounded-b-[3rem] shadow-lg relative`}>
        <button
          onClick={onBack}
          className="absolute top-6 left-6 p-2 bg-white/20 rounded-full hover:bg-white/30 transition"
          aria-label="กลับ"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex flex-col items-center pt-6 text-center">
          <div className="bg-white p-4 rounded-3xl text-slate-800 shadow-xl mb-4">
            <Icon size={32} />
          </div>
          <h2 className="text-2xl font-black">{data.title}</h2>
          <p className="opacity-90 text-sm max-w-[280px] mt-2 leading-6">{data.subtitle}</p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        <div className="rounded-[1.75rem] border border-white bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <Sparkles size={13} />
            คำถามตัวอย่าง
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กดคำถามด้านล่างเพื่อเข้าไปคุยกับหมอ AI ต่อได้ทันที คำถามถูกจัดให้ตรงกับหัวข้อเดียวกันทั้งหน้า
          </p>
        </div>

        {data.questions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSelectChat(question)}
            className="w-full bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-4 text-left hover:border-blue-300 hover:shadow-md transition-all active:scale-95 group"
          >
            <div
              className={`${data.color} w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}
            >
              <MessageCircle size={20} />
            </div>
            <p className="flex-1 font-medium text-slate-700 leading-relaxed">{question}</p>
            <ChevronRight size={20} className="text-slate-300" />
          </button>
        ))}
      </div>

      <div className="p-6">
        <button
          onClick={() => onSelectChat(`${data.title} ช่วยแนะนำแบบเข้าใจง่ายให้หน่อยค่ะ`)}
          className="w-full bg-slate-800 text-white py-5 rounded-3xl font-black text-lg shadow-xl active:scale-95 transition-transform"
        >
          พิมพ์คำถามของฉันเอง
        </button>
      </div>
    </div>
  );
};

export default CategoryDetailPage;
