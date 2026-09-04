import React, { useEffect, useState } from 'react';
import { Sparkles, Heart, Zap, AlertCircle, CloudRain } from 'lucide-react';

interface EmoteOverlayProps {
  emotion: string;
  enabled: boolean;
}

/**
 * モデルの頭上に浮かび上がるアニメーション漫符（感情エフェクト）コンポーネント
 */
export const EmoteOverlay: React.FC<EmoteOverlayProps> = ({ emotion, enabled }) => {
  const [activeEmote, setActiveEmote] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !emotion || emotion === 'neutral') {
      setActiveEmote(null);
      return;
    }

    setActiveEmote(emotion);
    const timer = setTimeout(() => {
      setActiveEmote(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [emotion, enabled]);

  if (!enabled || !activeEmote) return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center animate-bounce">
      {activeEmote === 'happy' && (
        <div className="flex items-center gap-1 bg-pink-500/80 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg border border-pink-300">
          <Heart className="w-4 h-4 fill-current text-white animate-pulse" />
          <span>Happy!</span>
        </div>
      )}
      {activeEmote === 'surprised' && (
        <div className="flex items-center gap-1 bg-amber-500/80 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg border border-amber-300">
          <Zap className="w-4 h-4 fill-current text-white" />
          <span>Surprised!</span>
        </div>
      )}
      {activeEmote === 'angry' && (
        <div className="flex items-center gap-1 bg-rose-600/80 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg border border-rose-300">
          <AlertCircle className="w-4 h-4 text-white" />
          <span>Angry!</span>
        </div>
      )}
      {activeEmote === 'sad' && (
        <div className="flex items-center gap-1 bg-sky-600/80 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-lg border border-sky-300">
          <CloudRain className="w-4 h-4 text-white" />
          <span>Sad...</span>
        </div>
      )}
    </div>
  );
};
