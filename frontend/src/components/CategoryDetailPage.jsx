import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, MessageCircle, Sparkles } from 'lucide-react';
import { API_URL } from '../config';
import { CATEGORY_LABEL_TO_KEY, CATEGORY_TOPICS } from '../data/aiTopics';

const getTopicKey = (category) => {
  if (category && CATEGORY_TOPICS[category]) {
    return category;
  }

  return CATEGORY_LABEL_TO_KEY[category] || 'report';
};

const isFriendlyQuestion = (question) => {
  const text = String(question || '').trim();
  if (!text) return false;
  if (text.length < 8 || text.length > 120) return false;
  if (!/[ก-๙]/.test(text)) return false;

  const blockedPhrases = [
    'expressing confusion',
    'general',
    'report',
    'food',
    'exercise',
    'glucose',
    'medicine',
    'symptom',
  ];

  const normalized = text.toLowerCase();
  return !blockedPhrases.some((phrase) => normalized.includes(phrase));
};

const mergeQuestions = (popularQuestions, fallbackQuestions) => {
  const merged = [];
  const seen = new Set();

  [...popularQuestions, ...fallbackQuestions].forEach((question) => {
    const normalized = String(question || '').trim();
    if (!isFriendlyQuestion(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    merged.push(normalized);
  });

  return merged.slice(0, 5);
};

const formatThaiDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function CategoryDetailPage({ category, onBack, onSelectChat }) {
  const topicKey = getTopicKey(category);
  const data = CATEGORY_TOPICS[topicKey] || CATEGORY_TOPICS.report;
  const Icon = data.icon;
  const [popularQuestions, setPopularQuestions] = useState([]);
  const [myQuestions, setMyQuestions] = useState([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [isLoadingMyQuestions, setIsLoadingMyQuestions] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    const fetchPopularQuestions = async () => {
      setIsLoadingPopular(true);

      try {
        const response = await fetch(
          `${API_URL}/questions/popular?category=${encodeURIComponent(topicKey)}&limit=5`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch popular questions: ${response.status}`);
        }

        const payload = await response.json();
        const nextQuestions = Array.isArray(payload?.questions)
          ? payload.questions
              .map((item) => String(item?.questionText || item?.question_text || '').trim())
              .filter(isFriendlyQuestion)
          : [];

        if (!isCancelled) {
          setPopularQuestions(nextQuestions);
        }
      } catch (error) {
        if (!isCancelled) {
          console.warn('Popular question fetch failed:', error);
          setPopularQuestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPopular(false);
        }
      }
    };

    fetchPopularQuestions();

    return () => {
      isCancelled = true;
    };
  }, [topicKey]);

  useEffect(() => {
    let isCancelled = false;

    const fetchMyQuestions = async () => {
      setIsLoadingMyQuestions(true);

      try {
        const response = await fetch(
          `${API_URL}/questions/history?category=${encodeURIComponent(topicKey)}&limit=5`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch user question history: ${response.status}`);
        }

        const payload = await response.json();
        const nextQuestions = Array.isArray(payload?.questions)
          ? payload.questions
              .map((item) => ({
                questionText: String(item?.questionText || item?.question_text || '').trim(),
                intentKey: String(item?.intentKey || item?.intent_key || '').trim(),
                count: Number(item?.count || 0),
                updatedAt: item?.updatedAt || item?.updated_at || '',
              }))
              .filter((item) => isFriendlyQuestion(item.questionText))
          : [];

        if (!isCancelled) {
          setMyQuestions(nextQuestions);
        }
      } catch (error) {
        if (!isCancelled) {
          console.warn('User question history fetch failed:', error);
          setMyQuestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMyQuestions(false);
        }
      }
    };

    fetchMyQuestions();

    return () => {
      isCancelled = true;
    };
  }, [topicKey]);

  const questions = useMemo(
    () => mergeQuestions(popularQuestions, data.questions || []),
    [data.questions, popularQuestions]
  );

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
            คำถามยอดนิยมในหมวดนี้
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ระบบจะเรียงจากคำถามที่ผู้ใช้ถามบ่อยที่สุดในหมวดนี้ และจะเปลี่ยนอัตโนมัติเมื่อมีคำถามอื่นถูกถามมากขึ้น
          </p>
        </div>

        {isLoadingPopular ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">
            กำลังโหลดคำถามยอดนิยม...
          </div>
        ) : null}

        {questions.map((question, index) => (
          <button
            key={`${topicKey}-${question}`}
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

        <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <Clock3 size={13} />
            คำถามของฉันในหมวดนี้
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ดูย้อนกลับได้ว่าคุณเคยถามอะไรไว้ในหมวดนี้บ้าง แยกตามบัญชีผู้ใช้ของคุณเอง
          </p>

          {isLoadingMyQuestions ? (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
              กำลังโหลดประวัติคำถามของคุณ...
            </div>
          ) : myQuestions.length > 0 ? (
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {myQuestions.map((item) => (
                <button
                  key={`${item.intentKey}-${item.questionText}`}
                  onClick={() => onSelectChat(item.questionText)}
                  className="touch-target w-full rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-start gap-3">
                    <div className={`${data.color} mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white`}>
                      <MessageCircle size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-6 text-slate-700">{item.questionText}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        ถามไว้ {item.count > 1 ? `${item.count} ครั้ง` : '1 ครั้ง'}
                        {formatThaiDateTime(item.updatedAt) ? ` · ล่าสุด ${formatThaiDateTime(item.updatedAt)}` : ''}
                      </p>
                    </div>
                  </div>
                  </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-400">
              ยังไม่มีคำถามของคุณในหมวดนี้ ลองถามสักครั้งแล้วจะเห็นประวัติที่นี่
            </div>
          )}
        </div>
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
