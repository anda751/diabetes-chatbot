import React from 'react';

export default function Welcome({ onStart }) {
  return (
    <div className="min-h-[100dvh] w-full bg-linear-to-b from-blue-500 to-blue-700 flex flex-col items-center justify-center text-white p-6 relative">
      <div className="text-center space-y-4 mb-20 animate-bounce">
        <div className="text-[120px] drop-shadow-lg">💙</div>
        <h1 className="text-6xl font-black tracking-tight">น้องดูแล</h1>
        <p className="text-2xl font-light opacity-90">เพื่อนคู่คิด มิตรดูแลเบาหวาน</p>
      </div>

      <div className="absolute bottom-16 w-full max-w-md px-6">
        <button 
          onClick={onStart}
          className="w-full bg-white text-blue-600 text-3xl font-bold py-6 rounded-full shadow-2xl active:scale-95 transition-all hover:bg-blue-50 cursor-pointer"
        >
          เริ่มต้นใช้งาน ➔
        </button>
      </div>
    </div>
  );
}
