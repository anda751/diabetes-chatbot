import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronLeft, Mic, MicOff, Send, Sparkles, User } from 'lucide-react';
import { API_URL } from '../config';
import { CHAT_QUICK_PROMPTS } from '../data/aiTopics';
import { validateChatMessage } from '../utils/validation';

const isLocalHostname = (hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

function getVoiceSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const secureContext = window.isSecureContext || isLocalHostname(window.location.hostname);

  if (!SpeechRecognition) {
    return {
      supported: false,
      message: 'เบราว์เซอร์นี้ยังไม่รองรับการพิมพ์ด้วยเสียง แนะนำให้ใช้ Google Chrome',
    };
  }

  if (!secureContext) {
    return {
      supported: false,
      message: 'การพิมพ์ด้วยเสียงบน Chrome มือถือจะใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost เท่านั้น',
    };
  }

  return {
    supported: true,
    message: 'หมอ AI จะตอบตามข้อมูลสุขภาพที่บันทึกไว้',
    SpeechRecognition,
  };
}

export default function ChatBotPage({ onBack, userData, initialMessage, onNotice }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: `สวัสดีค่ะคุณ ${userData?.name || 'ผู้ใช้งาน'} ถามเรื่องอาหาร อาการ ค่าน้ำตาล หรือการดูแลเบาหวานได้เลยนะคะ`,
      sender: 'bot',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micState, setMicState] = useState({
    supported: false,
    message: 'กำลังตรวจสอบไมโครโฟน...',
  });

  const scrollContainerRef = useRef(null);
  const composerRef = useRef(null);
  const inputRef = useRef(null);
  const hasSentInitial = useRef(false);
  const recognitionRef = useRef(null);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.sender === 'user'),
    [messages]
  );

  useEffect(() => {
    const support = getVoiceSupport();
    setMicState({ supported: support.supported, message: support.message });

    if (!support.supported) {
      recognitionRef.current = null;
      return;
    }

    recognitionRef.current = new support.SpeechRecognition();
    recognitionRef.current.lang = 'th-TH';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setInput(transcript);
      setIsListening(false);
    };
    recognitionRef.current.onerror = (event) => {
      setIsListening(false);

      const errorMap = {
        'not-allowed': 'Chrome ยังไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณาอนุญาตไมโครโฟนแล้วลองใหม่',
        'service-not-allowed':
          'Chrome ยังไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณาอนุญาตไมโครโฟนแล้วลองใหม่',
        'audio-capture': 'ไม่พบไมโครโฟน หรือไมโครโฟนยังไม่พร้อมใช้งาน',
        network: 'การพิมพ์ด้วยเสียงมีปัญหาด้านเครือข่าย กรุณาลองใหม่อีกครั้ง',
      };

      onNotice?.({
        title: 'ใช้งานไมโครโฟนไม่สำเร็จ',
        message:
          errorMap[event.error] ||
          'ยังไม่สามารถรับเสียงได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      });
    };
  }, [onNotice]);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [isLoading, messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '0px';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleViewportShift = () => {
      composerRef.current?.scrollIntoView({ block: 'nearest' });
    };

    window.visualViewport?.addEventListener('resize', handleViewportShift);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportShift);
  }, []);

  const ensureMicrophoneAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  };

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!micState.supported || !recognitionRef.current) {
      onNotice?.({
        title: 'ยังใช้ไมโครโฟนไม่ได้',
        message: micState.message,
      });
      return;
    }

    try {
      await ensureMicrophoneAccess();
      recognitionRef.current.start();
    } catch (error) {
      let message =
        'ยังไม่สามารถเปิดไมโครโฟนได้ กรุณาตรวจสอบสิทธิ์ไมโครโฟนของ Chrome แล้วลองใหม่';

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        message = 'Chrome ยังไม่ได้รับสิทธิ์ใช้ไมโครโฟน กรุณากดอนุญาตก่อน';
      } else if (error?.name === 'NotFoundError') {
        message = 'ไม่พบไมโครโฟนบนอุปกรณ์นี้';
      } else if (error?.name === 'SecurityError') {
        message = 'Chrome มือถือจะใช้ไมโครโฟนได้เมื่อเปิดผ่าน HTTPS หรือ localhost เท่านั้น';
      }

      onNotice?.({
        title: 'เปิดไมโครโฟนไม่สำเร็จ',
        message,
      });
      setIsListening(false);
    }
  };

  const handleSend = useCallback(async (overrideMsg) => {
    const textToSend = typeof overrideMsg === 'string' ? overrideMsg : input;
    if (isLoading) return;

    const validationError = validateChatMessage(textToSend);
    if (validationError) {
      if (!overrideMsg) {
        onNotice?.({
          title: 'ข้อความยังไม่พร้อมส่ง',
          message: validationError,
        });
      }
      return;
    }

    const normalizedText = textToSend.trim();
    setMessages((prev) => [...prev, { id: Date.now(), text: normalizedText, sender: 'user' }]);

    if (!overrideMsg) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: normalizedText, userData }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.text || data?.error || data?.message || 'ส่งคำถามไม่สำเร็จ');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: data.text || 'ยังไม่มีคำตอบจากระบบในขณะนี้',
          sender: 'bot',
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text:
            error.message ||
            'ขออภัยค่ะ ตอนนี้ระบบเชื่อมต่อหมอ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          sender: 'bot',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, onNotice, userData]);

  useEffect(() => {
    if (initialMessage && !hasSentInitial.current) {
      handleSend(initialMessage);
      hasSentInitial.current = true;
    }
  }, [handleSend, initialMessage]);

  return (
    <div className="app-page app-page-transition mx-auto flex max-w-md flex-col overflow-x-hidden bg-[#F6FAFD] sm:h-full">
      <div className="app-safe-top sticky top-0 z-10 border-b border-sky-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="touch-target mt-0.5 rounded-2xl p-2 text-slate-600 transition hover:bg-slate-50 active:scale-95"
            aria-label="กลับ"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black leading-tight text-slate-900">คุยกับหมอ AI</h2>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                พร้อมตอบคำถาม
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              ถามได้ทั้งเรื่องอาหาร อาการ ค่าน้ำตาล และการดูแลตัวเองแบบเข้าใจง่าย
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="app-scroll-region custom-scrollbar flex-1 bg-[#F6FAFD] px-4 pt-4 pb-6"
      >
        {!hasUserMessages && (
          <div className="animate-fade-up mb-4 rounded-[1.75rem] border border-sky-100 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-500">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">เริ่มถามได้เลย</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  แตะคำถามตัวอย่าง หรือพิมพ์คำถามสั้น ๆ ที่กังวลอยู่ตอนนี้ได้ทันที
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {CHAT_QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => handleSend(prompt.text)}
                  disabled={isLoading}
                  className="touch-target animate-fade-up rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 active:scale-[0.98]"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex max-w-[88%] items-start gap-2.5 ${
                  msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white'
                      : 'border border-sky-100 bg-white text-sky-600'
                  }`}
                >
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div
                  className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-7 shadow-sm ${
                    msg.sender === 'user'
                      ? 'rounded-tr-md bg-sky-600 text-white'
                      : 'rounded-tl-md border border-sky-100 bg-white text-slate-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-md border border-sky-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-sky-400" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:0.15s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-sky-400 [animation-delay:0.3s]" />
                  <span className="ml-2 text-sm font-medium text-slate-500">กำลังตอบ...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={composerRef}
        className="app-bottom-docked sticky bottom-0 z-10 border-t border-sky-100 bg-white/96 px-4 pt-3 backdrop-blur-md"
      >
        <p className="mb-3 text-xs leading-5 text-slate-500">
          คำแนะนำ: พิมพ์เป็นประโยคสั้นและชัดเจน เช่น “ค่าน้ำตาล 180 สูงไหม”
        </p>

        <div className="flex min-w-0 items-end gap-3">
          <button
            type="button"
            onClick={toggleListening}
            disabled={!micState.supported}
            className={`touch-target shrink-0 rounded-2xl p-4 transition active:scale-95 ${
              !micState.supported
                ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                : isListening
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-600'
            }`}
            aria-label={isListening ? 'หยุดฟังเสียง' : 'เริ่มฟังเสียง'}
          >
            {isListening ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <div className="min-w-0 flex-1 rounded-2xl border border-sky-100 bg-slate-50 px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] font-medium text-slate-700 outline-none placeholder:text-slate-400"
                placeholder={isListening ? 'กำลังฟังเสียงของคุณ...' : 'พิมพ์คำถามที่นี่'}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={1000}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isLoading}
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className={`touch-target shrink-0 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  input.trim() && !isLoading
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-100 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                }`}
                aria-label="ส่งข้อความ"
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Send size={18} />
                  ส่ง
                </span>
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 flex-1 text-[11px] font-medium text-slate-400">
                {micState.message}
              </p>
              <p className="shrink-0 text-[11px] font-bold text-slate-300">{input.length}/1000</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
