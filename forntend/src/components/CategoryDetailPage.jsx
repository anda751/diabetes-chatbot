import React from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles } from 'lucide-react';
import { CATEGORY_LABEL_TO_KEY, CATEGORY_TOPICS } from '../data/aiTopics';

const getTopicKey = (category) => CATEGORY_LABEL_TO_KEY[category] || 'report';

export default function CategoryDetailPage({ category, onBack, onSelectChat }) {
  const topicKey = getTopicKey(category);
  const data = CATEGORY_TOPICS[topicKey] || CATEGORY_TOPICS.report;
  const Icon = data.icon;

  return (
    <div className="app-page app-page-transition flex flex-col bg-slate-50 sm:h-full">
      <div
        className={`${data.color} app-safe-top relative rounded-b-[2.5rem] px-6 pb-7 pt-4 text-white shadow-lg`}
      >
        <button
          onClick={onBack}
          className="touch-target absolute left-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex items-center justify-center rounded-2xl bg-white/20 transition hover:bg-white/30"
          aria-label="กลับ"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="flex flex-col items-center pt-8 text-center">
          <div className="mb-4 rounded-[1.5rem] bg-white p-4 text-slate-800 shadow-xl">
            <Icon size={30} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">{data.title}</h2>
          <p className="mt-2 max-w-[300px] text-sm leading-6 text-white/90">{data.subtitle}</p>
        </div>
      </div>

      <div className="app-scroll-region custom-scrollbar flex-1 space-y-4 px-5 py-5">
        <div className="rounded-[1.5rem] border border-white bg-white/95 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <Sparkles size={13} />
            คำถามตัวอย่าง
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            แตะคำถามที่ต้องการเพื่อคุยกับหมอ AI ได้ทันที ระบบจะพาไปหน้าแชตพร้อมข้อความให้เลย
          </p>
        </div>

        {data.questions.map((question, index) => (
          <button
            key={question}
            onClick={() => onSelectChat(question)}
            className="touch-target animate-fade-up w-full rounded-[1.5rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md active:scale-[0.99]"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-4">
              <div
                className={`${data.color} flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm`}
              >
                <MessageCircle size={18} />
              </div>
              <p className="flex-1 text-sm font-semibold leading-6 text-slate-700">{question}</p>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
          </button>
        ))}
      </div>

      <div className="app-bottom-docked bg-slate-50 px-5 pt-2">
        <button
          onClick={() => onSelectChat(`${data.title} ช่วยแนะนำแบบเข้าใจง่ายให้หน่อยค่ะ`)}
          className="touch-target w-full rounded-[1.75rem] bg-slate-900 py-4 text-base font-black text-white shadow-xl transition active:scale-[0.99]"
        >
          พิมพ์คำถามของฉันเอง
        </button>
      </div>
    </div>
  );
}
