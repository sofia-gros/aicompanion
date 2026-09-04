import React, { useState, useRef, useEffect } from 'react';
import { Minimize2, Move } from 'lucide-react';
import { Live2DCanvas } from '../avatar/Live2DCanvas';
import { VRMCanvas } from '../avatar/VRMCanvas';
import { Subtitle } from '../avatar/Subtitle';
import { EmoteOverlay } from '../avatar/EmoteOverlay';
import { AudioService } from '../../services/audioService';
import { WailsBridge } from '../../services/wailsBridge';
import { useAppStore } from '../../stores/useAppStore';

interface DesktopOverlayProps {
  audioService: AudioService;
}

/**
 * デスクトップ常駐全画面透過オーバーレイコンポーネント
 * Wailsのフレームレス・最前面・全画面透過ウィンドウ内で、アバターをデスクトップ上に直接浮かび上がらせます。
 * マウスドラッグによる自由な移動、リアルタイム字幕、感情漫符、EscキーによるStudio復帰に対応します。
 */
export const DesktopOverlay: React.FC<DesktopOverlayProps> = ({ audioService }) => {
  const {
    currentSubtitle,
    streamingText,
    currentEmotion,
    avatarType,
    vrmModelUrl,
    activeModelPath,
    characters,
    activeCharacterId,
    config,
    updateConfig,
  } = useAppStore();

  const activeChar = characters.find((c) => c.id === activeCharacterId) || characters[0];

  // アバターの位置（初期値: 画面右下に自然に収まる位置）
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 420) : 100;
    const defaultY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 560) : 100;
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Esc キーで即座に Studio モードに復帰
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        WailsBridge.switchDisplayMode('studio');
        updateConfig({ displayMode: 'studio' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateConfig]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 左クリックでドラッグ移動開始（ボタン等のクリックを除く）
    if (e.button === 0) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReturnToStudio = () => {
    WailsBridge.switchDisplayMode('studio');
    updateConfig({ displayMode: 'studio' });
  };

  const displayText = currentSubtitle || streamingText;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-none"
    >
      {/* 画面右上のStudio復帰コントローラー（控えめな半透明UI） */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700/60 shadow-xl opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-[11px] font-medium text-zinc-300">
          常駐オーバーレイ稼働中
        </span>
        <button
          onClick={handleReturnToStudio}
          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-600/60 hover:bg-indigo-600 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
          title="EscキーでもStudioに戻れます"
        >
          <Minimize2 className="w-3 h-3" />
          <span>Studio復帰 (Esc)</span>
        </button>
      </div>

      {/* デスクトップ上に浮かぶアバターユニット (Live2D/VRM + 字幕 + コントロールハンドル) */}
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: '380px',
          height: '520px',
        }}
        className="absolute top-0 left-0 pointer-events-auto flex flex-col items-center group cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        {/* 移動ハンドル & ミニバー (ホバー時に表示) */}
        <div className="w-full flex items-center justify-between px-2 py-1 bg-zinc-950/70 backdrop-blur-md rounded-t-lg border border-zinc-800/80 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <Move className="w-3 h-3 text-indigo-400" />
            <span>ドラッグして移動</span>
          </div>
          <span className="font-mono text-zinc-500">{activeChar.name}</span>
        </div>

        {/* アバター描画キャンバス */}
        <div className="relative w-full flex-1 overflow-hidden">
          {avatarType === 'vrm' ? (
            <VRMCanvas
              modelUrl={vrmModelUrl || activeChar?.vrmModelPath || '/vrm/Seed-san.vrm'}
              audioService={audioService}
              sensitivity={config.lipSyncSensitivity}
              eyeSensitivity={config.eyeTrackingSensitivity}
            />
          ) : (
            <Live2DCanvas
              modelPath={activeModelPath}
              audioService={audioService}
              emotion={currentEmotion}
              sensitivity={config.lipSyncSensitivity}
              eyeSensitivity={config.eyeTrackingSensitivity}
            />
          )}
          {/* 感情漫符 */}
          <EmoteOverlay
            emotion={currentEmotion}
            enabled={activeChar?.enableEmoteEffect ?? true}
          />
        </div>

        {/* 字幕オーバーレイ */}
        <div className="w-full px-2 pb-1">
          <Subtitle text={displayText} />
        </div>
      </div>
    </div>
  );
};
