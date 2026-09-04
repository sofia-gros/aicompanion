import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { Live2DCanvas } from '../avatar/Live2DCanvas';
import { VRMCanvas } from '../avatar/VRMCanvas';
import { Subtitle } from '../avatar/Subtitle';
import { EmoteOverlay } from '../avatar/EmoteOverlay';
import { AudioService } from '../../services/audioService';
import { useAppStore } from '../../stores/useAppStore';

interface ViewportProps {
  audioService: AudioService;
}

/**
 * Godot Engine 風の中央メインビューポート
 * （Live2D / VRM切替、背景切替、マウスドラッグ位置調整、ホイールズーム、位置リセット対応）
 */
export const Viewport: React.FC<ViewportProps> = ({ audioService }) => {
  const {
    viewportBg,
    setViewportBg,
    currentSubtitle,
    streamingText,
    currentEmotion,
    config,
    activeModelPath,
    avatarType,
    setAvatarType,
    vrmModelUrl,
    characters,
    activeCharacterId,
  } = useAppStore();

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeChar = characters.find((c) => c.id === activeCharacterId) || characters[0];

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(Number((prev + delta).toFixed(1)), 0.5), 2.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 右クリックまたはCtrl+クリックまたは中クリックでパン移動
    if (e.button === 1 || e.button === 2 || e.ctrlKey) {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetTransform = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const getBgStyle = () => {
    switch (viewportBg) {
      case 'green':
        return { backgroundColor: '#00FF00' };
      case 'magenta':
        return { backgroundColor: '#FF00FF' };
      case 'dark':
        return { backgroundColor: '#18181b' };
      case 'checker':
      default:
        return {
          backgroundImage: `
            linear-gradient(45deg, #18181b 25%, transparent 25%), 
            linear-gradient(-45deg, #18181b 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #18181b 75%), 
            linear-gradient(-45deg, transparent 75%, #18181b 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          backgroundColor: '#09090b',
        };
    }
  };

  return (
    <div
      className="relative w-full h-full flex flex-col bg-zinc-950 overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ビューポート上部ツールバー */}
      <div className="h-8 bg-zinc-900/90 border-b border-zinc-800 px-3 flex items-center justify-between z-10 text-[11px]">
        {/* レンダラー種別切替 (Live2D / VRM) */}
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="font-semibold text-zinc-300">Renderer:</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
            <button
              onClick={() => setAvatarType('live2d')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                avatarType === 'live2d' ? 'bg-indigo-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Live2D
            </button>
            <button
              onClick={() => setAvatarType('vrm')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                avatarType === 'vrm' ? 'bg-emerald-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              VRM (3D)
            </button>
          </div>
        </div>

        {/* ズーム ＆ 位置調整コントローラー */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 font-mono text-zinc-300">
          <button
            onClick={() => setZoom((z) => Math.max(Number((z - 0.1).toFixed(1)), 0.5))}
            className="p-1 hover:bg-zinc-800 rounded cursor-pointer text-zinc-400 hover:text-white"
            title="ズームアウト"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[10px] w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(Number((z + 0.1).toFixed(1)), 2.5))}
            className="p-1 hover:bg-zinc-800 rounded cursor-pointer text-zinc-400 hover:text-white"
            title="ズームイン"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={handleResetTransform}
            className="p-1 hover:bg-zinc-800 rounded cursor-pointer text-zinc-400 hover:text-white ml-0.5"
            title="表示位置・拡大率をリセット"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* 背景モード切り替えボタン群 */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
          <button
            onClick={() => setViewportBg('checker')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              viewportBg === 'checker' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            透過
          </button>
          <button
            onClick={() => setViewportBg('green')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              viewportBg === 'green' ? 'bg-emerald-900/80 text-emerald-200 font-medium' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            緑背景
          </button>
          <button
            onClick={() => setViewportBg('magenta')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              viewportBg === 'magenta' ? 'bg-fuchsia-900/80 text-fuchsia-200 font-medium' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            紫背景
          </button>
          <button
            onClick={() => setViewportBg('dark')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              viewportBg === 'dark' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            黒
          </button>
        </div>
      </div>

      {/* メイン描画エリア */}
      <div className="relative flex-1 w-full h-full overflow-hidden" style={getBgStyle()}>
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="w-full h-full"
        >
          {avatarType === 'live2d' ? (
            <Live2DCanvas
              modelPath={activeModelPath}
              audioService={audioService}
              emotion={currentEmotion}
              sensitivity={config.lipSyncSensitivity}
              eyeSensitivity={config.eyeTrackingSensitivity}
            />
          ) : (
            <VRMCanvas
              modelUrl={vrmModelUrl}
              audioService={audioService}
              sensitivity={config.lipSyncSensitivity}
              eyeSensitivity={config.eyeTrackingSensitivity}
            />
          )}
        </div>

        {/* 感情漫符オーバーレイ (頭上にフワフワ浮遊) */}
        <EmoteOverlay
          emotion={currentEmotion}
          enabled={activeChar?.enableEmoteEffect ?? true}
        />

        {/* リアルタイム字幕吹き出し */}
        <Subtitle text={currentSubtitle || streamingText} />

        {/* 操作ヒント */}
        <div className="absolute bottom-2 left-2 text-[10px] text-zinc-500 pointer-events-none bg-zinc-950/60 px-1.5 py-0.5 rounded border border-zinc-800/60 flex items-center gap-1 font-mono">
          <Move className="w-2.5 h-2.5 text-zinc-400" />
          <span>右ドラッグ: 位置移動 / ホイール: ズーム</span>
        </div>
      </div>
    </div>
  );
};
