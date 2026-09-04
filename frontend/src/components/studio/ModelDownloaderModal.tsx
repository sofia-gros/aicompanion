import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { DownloadProgressPayload } from '../../types/events';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';
import { Cpu, CheckCircle2, Download, FolderOpen, Tag, HardDrive } from 'lucide-react';

export interface ExtendedModelItem {
  key: string;
  name: string;
  brand: 'Google' | 'Meta' | 'Qwen' | 'Microsoft' | 'HuggingFace';
  params: string;
  quant: string;
  size: string;
  desc: string;
  recommendedFor: string;
  isClassifier?: boolean;
}

export const EXTENDED_AVAILABLE_MODELS: ExtendedModelItem[] = [
  // 検索レベル・意図判定用 超小型クラス (135M / 90MB)
  {
    key: 'smollm2_135m',
    name: 'SmolLM2 135M-Instruct',
    brand: 'HuggingFace',
    params: '135M',
    quant: 'Q4_K_M',
    size: '90 MB',
    desc: '【高速判定用】検索レベルやユーザー意図を瞬時にミリ秒判定する超小型モデル（判定用サーバー用）',
    recommendedFor: '全環境推奨・検索判定必須',
    isClassifier: true,
  },
  // 8GB 超軽量クラス (0.5B〜1.5B)
  {
    key: 'tier0_5b',
    name: 'Qwen 2.5 0.5B-Instruct',
    brand: 'Qwen',
    params: '0.5B',
    quant: 'Q4_K_M',
    size: '398 MB',
    desc: '最少メモリ消費・ミリ秒単位の超高速応答',
    recommendedFor: '8GB PC・超軽量',
  },
  {
    key: 'llama3_2_1b',
    name: 'Llama 3.2 1B-Instruct',
    brand: 'Meta',
    params: '1B',
    quant: 'Q4_K_M',
    size: '800 MB',
    desc: 'Meta社最新の超軽量1Bモデル・高速かつ安定',
    recommendedFor: '8GB PC・軽量',
  },
  {
    key: 'tier1_5b',
    name: 'Qwen 2.5 1.5B-Instruct',
    brand: 'Qwen',
    params: '1.5B',
    quant: 'Q4_K_M',
    size: '1.1 GB',
    desc: '日本語対話品質と軽快さの最優秀バランス',
    recommendedFor: '8GB PC・推奨',
  },

  // 2B〜3B 高知能クラス (Gemma 2 / Llama 3.2 / Qwen)
  {
    key: 'gemma2_2b_q4',
    name: 'Gemma 2 2B-IT',
    brand: 'Google',
    params: '2B',
    quant: 'Q4_K_M',
    size: '1.6 GB',
    desc: 'Google最新作・2Bクラス世界最高峰の推論力',
    recommendedFor: '8GB PC・高知能',
  },
  {
    key: 'gemma2_2b_q8',
    name: 'Gemma 2 2B-IT (高精度版)',
    brand: 'Google',
    params: '2B',
    quant: 'Q8_0',
    size: '2.7 GB',
    desc: 'Google 2Bの量子化劣化ゼロ・最高精度モデル',
    recommendedFor: '8GB〜16GB PC',
  },
  {
    key: 'llama3_2_3b',
    name: 'Llama 3.2 3B-Instruct',
    brand: 'Meta',
    params: '3B',
    quant: 'Q4_K_M',
    size: '2.0 GB',
    desc: 'Meta最新3B・高い論理思考力と自然な会話力',
    recommendedFor: 'ミドルPC (8GB〜16GB)',
  },
  {
    key: 'tier3b',
    name: 'Qwen 2.5 3B-Instruct',
    brand: 'Qwen',
    params: '3B',
    quant: 'Q4_K_M',
    size: '2.1 GB',
    desc: '豊かな語彙力と高いキャラクター演技力',
    recommendedFor: 'ミドルPC (VRAM 4GB+)',
  },
  {
    key: 'phi3_5_mini',
    name: 'Phi-3.5-mini 3.8B-Instruct',
    brand: 'Microsoft',
    params: '3.8B',
    quant: 'Q4_K_M',
    size: '2.3 GB',
    desc: 'Microsoft製・128K長文脈と圧倒的な数学/論理力',
    recommendedFor: 'ミドルPC (VRAM 4GB+)',
  },

  // ハイスペッククラス (7B〜9B)
  {
    key: 'tier7b',
    name: 'Qwen 2.5 7B-Instruct',
    brand: 'Qwen',
    params: '7B',
    quant: 'Q4_K_M',
    size: '4.7 GB',
    desc: '7Bクラス世界最高峰のロールプレイ・感情表現',
    recommendedFor: 'ハイスペック (VRAM 8GB+)',
  },
  {
    key: 'gemma2_9b_q4',
    name: 'Gemma 2 9B-IT',
    brand: 'Google',
    params: '9B',
    quant: 'Q4_K_M',
    size: '5.5 GB',
    desc: 'Google最新9B・人間並みの深遠な対話知能',
    recommendedFor: 'ハイスペック (16GB RAM+)',
  },
];

interface ModelDownloaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: DownloadProgressPayload | null;
  onStartDownload: (key: string) => void;
  onCancelDownload: () => void;
}

/**
 * Google Gemma 2 / Meta Llama 3.2 / Qwen 2.5 / Microsoft Phi-3.5 厳選モデル入手ダイアログ
 * （ダウンロード保存先フォルダーの自由指定に対応）
 */
export const ModelDownloaderModal: React.FC<ModelDownloaderModalProps> = ({
  isOpen,
  onClose,
  progress,
  onStartDownload,
  onCancelDownload,
}) => {
  const { systemSpec, downloadedModels, modelDir, setModelDir, addLog } = useAppStore();

  const isDownloading = progress !== null && !progress.isCompleted;

  const handleSelectFolder = async () => {
    const selected = await WailsBridge.selectModelDirectory();
    if (selected) {
      setModelDir(selected);
      addLog(`[System] モデル保存先フォルダーを変更しました: ${selected}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 text-zinc-100 border-zinc-800 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" />
            ローカルLLMモデル入手 (Gemma 2 / Llama 3.2 / Qwen / Phi 厳選)
          </DialogTitle>
        </DialogHeader>

        {/* 保存先フォルダー設定バー */}
        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate pr-2">
            <HardDrive className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-zinc-400 shrink-0">保存先フォルダー:</span>
            <span className="font-mono text-zinc-200 truncate" title={modelDir}>
              {modelDir}
            </span>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={handleSelectFolder}
            className="gap-1 shrink-0 text-[11px] border-zinc-700 hover:bg-zinc-800 cursor-pointer"
          >
            <FolderOpen className="w-3 h-3" />
            変更...
          </Button>
        </div>

        {/* PCスペック自動診断とお勧め通知 */}
        {systemSpec && (
          <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 flex items-start gap-2.5 text-xs text-indigo-200">
            <Cpu className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-white">PC環境診断: </span>
              <span>{systemSpec.recommendation}</span>
            </div>
          </div>
        )}

        <div className="space-y-2 mt-1">
          {EXTENDED_AVAILABLE_MODELS.map((m) => {
            const isDownloaded = downloadedModels.some(
              (f) =>
                f.toLowerCase().includes(m.key.toLowerCase().replace('tier', '')) ||
                (m.key === 'tier0_5b' && f.includes('0.5b')) ||
                f.toLowerCase().includes(m.params.toLowerCase())
            );
            const isRecommended =
              systemSpec?.recommendedTier === m.key ||
              (Boolean(systemSpec && systemSpec.totalRamGb <= 8) && (m.key === 'tier0_5b' || m.key === 'tier1_5b'));

            return (
              <div
                key={m.key}
                className={`p-3 rounded-lg border transition-colors ${
                  isRecommended
                    ? 'bg-indigo-950/20 border-indigo-600/60 shadow-sm'
                    : 'bg-zinc-800/50 border-zinc-700/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-zinc-100">{m.name}</span>
                      {/* ブランドバッジ */}
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                          m.brand === 'Google'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                            : m.brand === 'Meta'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800/60'
                            : m.brand === 'Microsoft'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : m.brand === 'HuggingFace'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                        }`}
                      >
                        {m.brand}
                      </span>
                      {/* 量子化バッジ */}
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {m.quant}
                      </span>
                      {m.isClassifier && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40">
                          判定専用
                        </span>
                      )}
                      {isRecommended && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-600 text-white">
                          推奨
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {m.desc} (容量: <span className="text-zinc-200 font-mono">{m.size}</span>)
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isDownloaded ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled
                        className="gap-1 bg-emerald-950/40 border-emerald-800/60 text-emerald-400 text-xs opacity-90 cursor-default"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        入手済み
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant={isRecommended ? 'default' : 'outline'}
                        disabled={isDownloading}
                        onClick={() => onStartDownload(m.key)}
                        className="cursor-pointer gap-1 text-xs whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        入手
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ダウンロード進行バー */}
          {progress && !progress.isCompleted && (
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-indigo-900/60 space-y-2 mt-3 animate-in fade-in sticky bottom-0 z-10 shadow-xl">
              <div className="flex justify-between text-xs text-zinc-300 font-medium">
                <span>
                  ダウンロード中: <span className="text-indigo-400">{progress.modelKey}</span>
                </span>
                <span>
                  {progress.percent.toFixed(1)}% (
                  {(progress.speedBytesPerSec / 1024 / 1024).toFixed(1)} MB/s)
                </span>
              </div>
              <Progress value={progress.percent} className="h-2 bg-zinc-800" />
              <div className="flex justify-end pt-0.5">
                <Button size="xs" variant="destructive" onClick={onCancelDownload}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
