import React from 'react';
import {
  Play,
  Square,
  Sparkles,
  Download,
  Radio,
  ExternalLink,
  UserPlus,
  CheckCircle2,
  Cpu,
  Settings,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';

/**
 * Godot Engine 風の上部メインツールバー（プロジェクト実行/停止制御、キャラ切替・作成、Tier設定、配信連携、設定モーダル）
 * 画面幅が狭くてもボタンが縦に崩れないレスポンシブ・折り返し防止設計
 */
export const Toolbar: React.FC = () => {
  const {
    config,
    updateConfig,
    setIsDownloaderOpen,
    setIsSettingsModalOpen,
    characters,
    activeCharacterId,
    selectCharacter,
    setIsCharacterModalOpen,
    isServicesRunning,
    setServicesRunning,
    downloadedModels,
    activeModelFileName,
    switchActiveModel,
    systemSpec,
    addLog,
  } = useAppStore();

  const handleCopyObsUrl = () => {
    const url = 'http://localhost:18923/avatar';
    navigator.clipboard.writeText(url);
    addLog('OBSブラウザソース用URLをクリップボードにコピーしました: ' + url);
  };

  const handleTierChange = async (tier: string) => {
    updateConfig({ llmTier: tier as any });
    await WailsBridge.setLLMPreset(tier);
    addLog(`LLM Tier 変更: ${tier}`);
  };

  const handleCharacterChange = (charId: string) => {
    selectCharacter(charId);
  };

  const handleStartServices = async () => {
    setServicesRunning(true);
    addLog('[System] 対話サービス（LLMサーバー・音声パイプライン）を開始しました');
    await WailsBridge.startServices();
  };

  const handleStopServices = async () => {
    setServicesRunning(false);
    addLog('[System] 対話サービスを停止しました (アバタープレビュー・キャラ作成は継続中)');
    await WailsBridge.stopServices();
  };

  const hasDownloadedModel = downloadedModels.some((m) => m.endsWith('.gguf'));

  return (
    <header className="h-10 bg-zinc-900 border-b border-zinc-800 flex flex-nowrap items-center justify-between px-2.5 draggable-header z-30 select-none overflow-x-auto overflow-y-hidden no-scrollbar min-w-0">
      <div className="flex items-center gap-2.5 shrink-0 no-drag">
        {/* ロゴ / タイトル */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-zinc-700/60 shrink-0">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center font-black text-xs text-white shrink-0">
            AI
          </div>
          <span className="text-xs font-bold tracking-wider text-zinc-200 uppercase whitespace-nowrap">
            Studio
          </span>
        </div>

        {/* コントロールボタン群 (プロジェクト実行 / 停止マスター制御) */}
        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 shrink-0">
          <Button
            size="xs"
            variant={isServicesRunning ? 'secondary' : 'ghost'}
            className={`gap-1 font-medium whitespace-nowrap shrink-0 ${
              isServicesRunning
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={handleStartServices}
            title="LLMサーバーおよび音声対話を開始します"
          >
            <Play className={`w-3 h-3 ${isServicesRunning ? 'fill-current text-emerald-400' : ''}`} />
            <span>{isServicesRunning ? '実行中' : '開始'}</span>
          </Button>
          <Button
            size="xs"
            variant={!isServicesRunning ? 'destructive' : 'ghost'}
            className={`gap-1 font-medium whitespace-nowrap shrink-0 ${
              !isServicesRunning
                ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            onClick={handleStopServices}
            title="LLMサーバーおよび音声対話を停止します（アバター描画・キャラ作成は継続）"
          >
            <Square className="w-3 h-3" />
            <span>停止</span>
          </Button>
        </div>

        {/* LLM推論サーバーステータスバッジ */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 shrink-0 text-[10px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isServicesRunning
                ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-zinc-600'
            }`}
          />
          <span className={isServicesRunning ? 'text-emerald-300 font-semibold' : 'text-zinc-500'}>
            LLM: {isServicesRunning ? '稼働中' : '停止中'}
          </span>
        </div>

        {/* キャラクター切り替えセレクトボックス */}
        <div className="flex items-center gap-1 pl-2 border-l border-zinc-700/60 shrink-0">
          <span className="text-[11px] text-zinc-400 flex items-center gap-1 whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
            キャラ:
          </span>
          <div className="w-28 shrink-0">
            <Select value={activeCharacterId} onValueChange={handleCharacterChange}>
              <SelectTrigger className="h-6 text-[11px] whitespace-nowrap">
                <SelectValue placeholder="キャラ選択" />
              </SelectTrigger>
              <SelectContent>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ダウンロード済みLLMモデル選択機能 ＆ PCスペック自動推奨バッジ */}
        <div className="flex items-center gap-1 pl-2 border-l border-zinc-700/60 shrink-0">
          <span className="text-[11px] text-zinc-400 whitespace-nowrap">モデル:</span>
          <div className="w-36 shrink-0">
            {downloadedModels.length > 0 ? (
              <Select value={activeModelFileName || downloadedModels[0]} onValueChange={(model) => switchActiveModel(model)}>
                <SelectTrigger className="h-6 text-[11px] whitespace-nowrap overflow-hidden">
                  <SelectValue placeholder="モデル選択" />
                </SelectTrigger>
                <SelectContent>
                  {downloadedModels.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m.replace('.gguf', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <button
                onClick={() => setIsDownloaderOpen(true)}
                className="h-6 px-2 text-[10px] text-zinc-400 hover:text-indigo-300 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-between w-full transition-colors"
                title="ローカルモデルが未ダウンロードです。クリックしてモデルを入手してください。"
              >
                <span>未ダウンロード</span>
                <Download className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
              </button>
            )}
          </div>
          {systemSpec && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1 whitespace-nowrap shrink-0"
              title={systemSpec.recommendation}
            >
              <Cpu className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
              RAM {systemSpec.totalRamGb}GB
            </span>
          )}
        </div>
      </div>

      {/* 右側アクションボタン群 */}
      <div className="flex items-center gap-1 shrink-0 no-drag pl-2">
        {/* モデル入手ボタン */}
        <Button
          size="xs"
          variant="outline"
          className={`h-6 gap-1 text-[11px] whitespace-nowrap shrink-0 ${
            hasDownloadedModel
              ? 'text-emerald-300 border-emerald-700/60 hover:bg-emerald-950/40'
              : 'text-indigo-300 border-indigo-700/60 hover:bg-indigo-950/40'
          }`}
          onClick={() => setIsDownloaderOpen(true)}
          title={hasDownloadedModel ? 'ローカルモデル導入済み (クリックで追加モデル管理)' : 'LLMモデルをダウンロード'}
        >
          {hasDownloadedModel ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          ) : (
            <Download className="w-3 h-3 shrink-0" />
          )}
          <span>モデル入手</span>
        </Button>

        {/* OBS連携ボタン */}
        <Button
          size="xs"
          variant="outline"
          className="h-6 gap-1 text-[11px] text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/40 whitespace-nowrap shrink-0"
          onClick={handleCopyObsUrl}
          title="OBSのブラウザソース用URLをクリップボードにコピー"
        >
          <Radio className="w-3 h-3 shrink-0" />
          <span>OBS</span>
        </Button>

        {/* 独立常駐オーバーレイ起動ボタン */}
        <Button
          size="xs"
          variant="outline"
          className="h-6 gap-1 text-[11px] text-zinc-200 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap shrink-0"
          onClick={() => WailsBridge.launchOverlayWindow()}
          title="デスクトップ常駐用の透過アバター別ウィンドウを起動します"
        >
          <ExternalLink className="w-3 h-3 text-indigo-400 shrink-0" />
          <span>常駐オーバーレイ</span>
        </Button>

        {/* システム & 検索設定モーダルボタン */}
        <Button
          size="xs"
          variant="outline"
          className="h-6 gap-1 text-[11px] text-zinc-200 border-zinc-700 hover:bg-zinc-800 whitespace-nowrap shrink-0"
          onClick={() => setIsSettingsModalOpen(true)}
          title="Web情報解決（Level 0〜3）および外部API・モデル保存先設定を開きます"
        >
          <Settings className="w-3 h-3 text-indigo-400 shrink-0" />
          <span>設定</span>
        </Button>
      </div>
    </header>
  );
};
