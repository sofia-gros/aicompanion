# フロントエンド設計書: Godot風Studio UI + Live2D + WebAudio

## 1. フロントエンド技術スタック（最新安定版）

- **フレームワーク**: React 19 / 18 + TypeScript 5.x + Vite 6.x
- **UIライブラリ**: **shadcn/ui** (Tailwind CSS + Radix UI Primitives + Lucide React アイコン)
- **レイアウト管理**: `react-resizable-panels` (Godotライクなリサイズ・ドッキングパネル)
- **アバター描画（Live2D本命）**:
  - **Live2D (プライマリ/標準)**: PixiJS v7 (`pixi.js@^7.4.2`) + `pixi-live2d-display/cubism4` + Live2D Cubism Core 4
  - **VRM (オプショナル/互換)**: Three.js (`three@^0.170.0`) + `@pixiv/three-vrm@^3.0.0`
- **音声・解析**: Web Audio API (`AudioContext`, `AnalyserNode`, `AudioBufferSourceNode`)
- **状態管理**: Zustand (高速・軽量・マルチウィンドウ対応)

---

## 2. ディレクトリ構造

```text
frontend/
├── index.html                  # Studio画面用エントリーポイント
├── avatar.html                 # 独立アバター/OBSブラウザソース用エントリーポイント
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── components.json             # shadcn/ui 設定
├── public/
│   ├── live2d/
│   │   ├── live2dcubismcore.min.js  # Cubism Core SDK
│   │   └── models/                 # Live2Dモデルデータ (.model3.json)
│   └── vrm/models/
└── src/
    ├── main.tsx                # Studio エントリーポイント
    ├── avatarMain.tsx          # 独立アバター/OBS用エントリーポイント
    ├── App.tsx                 # Godot風 Studio メインコンポーネント
    ├── AvatarApp.tsx           # 単体透過/グリーンバック描画コンポーネント
    ├── components/
    │   ├── ui/                 # shadcn/ui コンポーネント群 (Button, Slider, Tabs, Dialog, Progress, etc.)
    │   ├── studio/
    │   │   ├── Toolbar.tsx     # 上部メインツールバー (実行・停止・モード切替・モデル入手)
    │   │   ├── SceneTree.tsx   # 左: ノードヒエラルキー (Avatar, LLM, TTS, Window)
    │   │   ├── Viewport.tsx    # 中央: 2D/3Dビューポート (背景切替, 視線テスト)
    │   │   ├── Inspector.tsx   # 右: 全パラメータインスペクター (スライダー・設定)
    │   │   ├── BottomPanel.tsx # 下部: デバッグコンソール & リアルタイム対話テスト
    │   │   └── ModelDownloaderModal.tsx # ワンクリック・モデル入手モーダル
    │   └── avatar/
    │       ├── Live2DCanvas.tsx # PixiJS + Live2D レンダラー (最軽量・高精細)
    │       ├── VRMCanvas.tsx    # Three.js + VRM レンダラー (互換用)
    │       └── Subtitle.tsx     # 字幕吹き出し
    ├── services/
    │   ├── audioService.ts     # 音声再生キュー・スケジューリング
    │   ├── lipsyncService.ts   # AnalyserNodeによる音量解析＆平滑化
    │   └── wailsBridge.ts      # Wails Events & Go RPCラッパー
    ├── stores/
    │   └── useAppStore.ts      # 全設定・対話ステート・接続情報の統合ストア
    └── types/
        ├── events.ts           # Wails / WebSocket イベント型定義
        └── config.ts           # SystemConfig 型定義
```

---

## 3. 型定義仕様 (`src/types/events.ts`)

```typescript
export interface AvatarSpeakPayload {
  seqId: number;
  isLast: boolean;
  text: string;
  audioFormat: string; // "audio/wav"
  audioBase64: string;
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
  durationMs: number;
}

export interface LLMTokenPayload {
  token: string;
  isFirst: boolean;
}

export interface SystemStatusPayload {
  llmReady: boolean;
  ttsReady: boolean;
  activeTTS: string;
  activeTier: string;
}

export interface DownloadProgressPayload {
  modelKey: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  percent: number;
  isCompleted: boolean;
  error?: string;
}

export interface SystemConfig {
  displayMode: 'studio' | 'overlay';
  isClickThrough: boolean;
  llmTier: 'tier0_5b' | 'tier1_5b' | 'tier3b' | 'tier7b' | 'cloud';
  ttsEngine: 'voicevox' | 'style-bert-vits2' | 'mock';
  speakerId: number;
  volume: number;
  lipSyncSensitivity: number;
  eyeTrackingSensitivity: number;
}
```

---

## 4. ワンクリック・モデルダウンローダーUI (`ModelDownloaderModal.tsx`)

エンドユーザーがブラウザを開くことなく、ワンクリックで推奨GGUFモデルを入手可能にするダイアログ。

```typescript
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { DownloadProgressPayload } from '../../types/events';

interface ModelItem {
  key: string;
  name: string;
  size: string;
  desc: string;
  recommendedFor: string;
}

const AVAILABLE_MODELS: ModelItem[] = [
  { key: 'qwen2.5-0.5b', name: 'Qwen2.5-0.5B-Instruct (Q4_K_M)', size: '398 MB', desc: '極小メモリ消費・超高速', recommendedFor: '8GB PC・超軽量' },
  { key: 'qwen2.5-1.5b', name: 'Qwen2.5-1.5B-Instruct (Q4_K_M)', size: '1.1 GB', desc: '日本語対話バランス最優秀', recommendedFor: '8GB PC・推奨' },
  { key: 'qwen2.5-3b',   name: 'Qwen2.5-3B-Instruct (Q4_K_M)',   size: '2.1 GB', desc: '豊かな語彙とキャラクター性', recommendedFor: 'ミドルレンジPC' },
  { key: 'qwen2.5-7b',   name: 'Qwen2.5-7B-Instruct (Q4_K_M)',   size: '4.7 GB', desc: '最高峰のロールプレイ性能',   recommendedFor: 'ハイスペックPC' },
];

export const ModelDownloaderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  progress: DownloadProgressPayload | null;
  onStartDownload: (key: string) => void;
  onCancelDownload: () => void;
}> = ({ isOpen, onClose, progress, onStartDownload, onCancelDownload }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 text-zinc-100 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">モデル入手マネージャー (GGUF Downloader)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {AVAILABLE_MODELS.map((m) => (
            <div key={m.key} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">{m.recommendedFor}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{m.desc} (サイズ: {m.size})</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={progress !== null && !progress.isCompleted}
                onClick={() => onStartDownload(m.key)}
              >
                ダウンロード
              </Button>
            </div>
          ))}

          {progress && !progress.isCompleted && (
            <div className="p-4 rounded-lg bg-zinc-950 border border-indigo-900/50 space-y-2">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>ダウンロード中: {progress.modelKey}</span>
                <span>{progress.percent.toFixed(1)}% ({(progress.speedBytesPerSec / 1024 / 1024).toFixed(1)} MB/s)</span>
              </div>
              <Progress value={progress.percent} className="h-2 bg-zinc-800" />
              <div className="flex justify-end pt-1">
                <Button size="xs" variant="destructive" onClick={onCancelDownload}>キャンセル</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 5. 音声再生キュー ＆ リップシンクエンジン (`audioService.ts`)

```typescript
import { AvatarSpeakPayload } from '../types/events';

export interface QueuedAudioChunk {
  seqId: number;
  isLast: boolean;
  audioBuffer: AudioBuffer;
  text: string;
  emotion: string;
}

export class AudioService {
  private ctx: AudioContext;
  private queue: QueuedAudioChunk[] = [];
  private nextExpectedSeq: number = 1;
  private isPlaying: boolean = false;
  private analyser: AnalyserNode;
  private nextStartTime: number = 0;
  private onEmotionChange?: (emotion: string) => void;

  constructor(onEmotionChange?: (emotion: string) => void) {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.ctx.destination);
    this.onEmotionChange = onEmotionChange;
  }

  public async pushChunk(payload: AvatarSpeakPayload) {
    const rawData = atob(payload.audioBase64);
    const bytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      bytes[i] = rawData.charCodeAt(i);
    }
    
    const audioBuffer = await this.ctx.decodeAudioData(bytes.buffer);
    this.queue.push({
      seqId: payload.seqId,
      isLast: payload.isLast,
      audioBuffer,
      text: payload.text,
      emotion: payload.emotion,
    });
    this.queue.sort((a, b) => a.seqId - b.seqId);
    
    this.processQueue();
  }

  private processQueue() {
    if (this.queue.length === 0) return;
    const nextChunkIndex = this.queue.findIndex(c => c.seqId === this.nextExpectedSeq);
    if (nextChunkIndex === -1) return;
    
    const chunk = this.queue.splice(nextChunkIndex, 1)[0];
    this.nextExpectedSeq++;
    
    if (this.onEmotionChange) {
      this.onEmotionChange(chunk.emotion);
    }

    this.playBuffer(chunk);
  }

  private playBuffer(chunk: QueuedAudioChunk) {
    const source = this.ctx.createBufferSource();
    source.buffer = chunk.audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.ctx.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + chunk.audioBuffer.duration;
    this.isPlaying = true;

    source.onended = () => {
      if (chunk.isLast && this.queue.length === 0) {
        this.isPlaying = false;
        this.nextExpectedSeq = 1;
        this.nextStartTime = 0;
      }
      this.processQueue();
    };
  }

  public getMouthOpen(sensitivity: number = 1.0): number {
    if (!this.isPlaying) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return Math.min(1.0, (average / 60) * sensitivity);
  }
}
```

---

## 6. Live2D レンダラー設計 (`Live2DCanvas.tsx`)

PixiJS v7 Application で Live2D モデルを描画し、毎フレーム Ticker で `audioService.getMouthOpen()` を `ParamMouthOpenY` に反映。
