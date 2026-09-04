import React from 'react';

interface SubtitleProps {
  text: string;
  streamingText?: string;
}

/**
 * アバターの発話字幕およびストリーミング思考テキストを表示する吹き出しUI
 */
export const Subtitle: React.FC<SubtitleProps> = ({ text, streamingText }) => {
  const displayText = text || streamingText;
  if (!displayText) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[85%] z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-zinc-950/85 backdrop-blur-md text-zinc-100 px-5 py-3 rounded-2xl border border-zinc-700/60 shadow-2xl text-center">
        <p className="text-sm font-medium leading-relaxed tracking-wide">
          {displayText}
          {streamingText && <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />}
        </p>
      </div>
    </div>
  );
};
