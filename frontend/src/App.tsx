import React, { useEffect, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Toolbar } from './components/studio/Toolbar';
import { SceneTree } from './components/studio/SceneTree';
import { Viewport } from './components/studio/Viewport';
import { Inspector } from './components/studio/Inspector';
import { BottomPanel } from './components/studio/BottomPanel';
import { ModelDownloaderModal } from './components/studio/ModelDownloaderModal';
import { CharacterModal } from './components/studio/CharacterModal';
import { SettingsModal } from './components/studio/SettingsModal';
import { DesktopOverlay } from './components/studio/DesktopOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioService } from './services/audioService';
import { WailsBridge } from './services/wailsBridge';
import { useAppStore } from './stores/useAppStore';

/**
 * AI Companion Studio メインアプリケーションコンポーネント (Godot風 4ペインレイアウト)
 */
export const App: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState('char:hiyori:profile');
  const audioServiceRef = useRef<AudioService | null>(null);

  const {
    characters,
    activeCharacterId,
    isServicesRunning,
    currentSubtitle,
    setCurrentSubtitle,
    streamingText,
    appendStreamingText,
    clearStreamingText,
    isAudioPlaying,
    setIsAudioPlaying,
    setCurrentEmotion,
    downloadProgress,
    setDownloadProgress,
    isDownloaderOpen,
    setIsDownloaderOpen,
    isCharacterModalOpen,
    setIsCharacterModalOpen,
    setDownloadedModels,
    setSystemSpec,
    setTokensPerSec,
    setFirstAudioLatencyMs,
    setFps,
    setServicesRunning,
    addChatMessage,
    addLog,
    setSearchConfig,
    config,
    updateConfig,
  } = useAppStore();

  const activeChar = characters.find((c) => c.id === activeCharacterId) || characters[0];
  const tokenStartTimeRef = useRef<number>(0);
  const tokenCountRef = useRef<number>(0);
  const sendTimeRef = useRef<number>(0);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const subtitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!audioServiceRef.current) {
    audioServiceRef.current = new AudioService(
      (emotion) => setCurrentEmotion(emotion),
      (isPlaying) => setIsAudioPlaying(isPlaying)
    );
  }

  // 音声再生終了後2秒で吹き出し（字幕・思考テキスト）を自動消去するタイマー
  useEffect(() => {
    if (isAudioPlaying) {
      // 発話・再生中は消去タイマーを即座にキャンセル
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
        subtitleTimerRef.current = null;
      }
    } else {
      // 音声再生が終了した場合、2秒後に吹き出しを消去
      if (currentSubtitle || streamingText) {
        if (subtitleTimerRef.current) {
          clearTimeout(subtitleTimerRef.current);
        }
        subtitleTimerRef.current = setTimeout(() => {
          setCurrentSubtitle('');
          clearStreamingText();
          setCurrentEmotion('neutral');
          subtitleTimerRef.current = null;
        }, 2000);
      }
    }

    return () => {
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
      }
    };
  }, [isAudioPlaying, currentSubtitle, streamingText, setCurrentSubtitle, clearStreamingText, setCurrentEmotion]);

  // 自発的発話（独り言・見守り）タイマー
  useEffect(() => {
    if (!isServicesRunning || !(activeChar?.enableProactiveSpeech ?? true)) {
      return;
    }

    const intervalMin = activeChar?.proactiveIntervalMinutes || 5;
    const intervalMs = intervalMin * 60 * 1000;

    const proactiveTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastActiveTimeRef.current >= intervalMs) {
        lastActiveTimeRef.current = now;
        addLog(`[Proactive] ${activeChar.name} が自発的に声をかけました`);
        sendTimeRef.current = Date.now();
        WailsBridge.sendMessage('（ユーザーが集中して作業しています。短く優しく息抜きや応援の声をかけてあげてください）');
      }
    }, 30000); // 30秒ごとにアイドル判定

    return () => clearInterval(proactiveTimer);
  }, [isServicesRunning, activeChar?.enableProactiveSpeech, activeChar?.proactiveIntervalMinutes]);

  useEffect(() => {
    // 起動時システムスペック＆ダウンロード済みモデル取得
    WailsBridge.getSystemSpec().then((spec) => {
      setSystemSpec(spec);
      addLog(`[System] PCスペック検知: RAM ${spec.totalRamGb}GB / 推奨: ${spec.recommendedTier}`);
    });
    WailsBridge.getDownloadedModels().then((models) => {
      setDownloadedModels(models);
      if (models.length > 0) {
        addLog(`[System] 導入済みローカルモデル: ${models.join(', ')}`);
      }
    });
    WailsBridge.getSearchConfig().then((cfg) => {
      setSearchConfig(cfg);
    });

    // 起動時アクティブキャラクター設定をLLMに同期
    WailsBridge.setCharacterProfile(activeChar);
    WailsBridge.setTTSProvider(activeChar.ttsEngine, activeChar.speakerId);

    // FPS 計測ループ
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let animId: number;
    const calcFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = now;
      }
      animId = requestAnimationFrame(calcFps);
    };
    animId = requestAnimationFrame(calcFps);

    // Wails イベントリスナーの登録
    const cleanup = WailsBridge.onEvent({
      onSpeak: (payload) => {
        lastActiveTimeRef.current = Date.now();
        addLog(`[TTS] 音声チャンク受信 seqId=${payload.seqId} "${payload.text}"`);
        setCurrentSubtitle(payload.text);
        if (payload.seqId === 1 && sendTimeRef.current > 0) {
          const latency = Date.now() - sendTimeRef.current;
          setFirstAudioLatencyMs(latency);
        }
        if (audioServiceRef.current) {
          audioServiceRef.current.pushChunk(payload);
        }
        addChatMessage({
          id: `ai-${Date.now()}-${payload.seqId}`,
          sender: 'assistant',
          characterName: activeChar.name,
          text: payload.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: payload.emotion,
          audioBase64: payload.audioBase64,
        });
      },
      onToken: (payload) => {
        appendStreamingText(payload.token, payload.isFirst);
        if (payload.isFirst) {
          tokenStartTimeRef.current = performance.now();
          tokenCountRef.current = 1;
        } else {
          tokenCountRef.current++;
          const elapsedSec = (performance.now() - tokenStartTimeRef.current) / 1000.0;
          if (elapsedSec > 0.2) {
            setTokensPerSec(tokenCountRef.current / elapsedSec);
          }
        }
      },
      onProgress: (payload) => {
        setDownloadProgress(payload);
        if (payload.isCompleted) {
          addLog(`[Downloader] モデルダウンロード完了: ${payload.modelKey}`);
          WailsBridge.getDownloadedModels().then((models) => setDownloadedModels(models));
        }
      },
      onDownloadedModelsUpdated: (models) => {
        setDownloadedModels(models);
        addLog(`[Downloader] モデル一覧を更新しました: ${models.length}個のモデルが利用可能`);
      },
      onSystemLog: (msg) => {
        addLog(msg);
      },
      onSystemStatus: (status) => {
        if (status.llmReady !== undefined) {
          setServicesRunning(status.llmReady);
        }
        if (status.model) {
          addLog(`[System] 実機推論モデル準備完了: ${status.model}`);
        }
      },
      onDisplayModeChanged: (mode) => {
        updateConfig({ displayMode: mode });
      },
    });

    return () => {
      cleanup();
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleStartDownload = async (key: string) => {
    addLog(`[Downloader] ダウンロード開始要求: ${key}`);
    await WailsBridge.startModelDownload(key);
  };

  const handleCancelDownload = async () => {
    addLog(`[Downloader] ダウンロード中断要求`);
    await WailsBridge.cancelModelDownload();
    setDownloadProgress(null);
  };

  // デスクトップ常駐全画面透過オーバーレイモードの場合
  if (config.displayMode === 'overlay') {
    return (
      <ErrorBoundary>
        <DesktopOverlay audioService={audioServiceRef.current!} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col w-screen h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
        {/* 上部メインツールバー */}
        <Toolbar />

        {/* メイン 4ペイン スプリットレイアウト */}
        <div className="flex-1 w-full h-full overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full w-full">
            {/* 左ペイン: Scene Hierarchy */}
            <Panel defaultSize={20} minSize={15} maxSize={30}>
              <SceneTree selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            </Panel>

            <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />

            {/* 中央ペイン: 上部 Viewport + 下部 BottomPanel */}
            <Panel defaultSize={55} minSize={30}>
              <PanelGroup direction="vertical">
                {/* 中央上部: Viewport */}
                <Panel defaultSize={70} minSize={40}>
                  <ErrorBoundary>
                    <Viewport audioService={audioServiceRef.current!} />
                  </ErrorBoundary>
                </Panel>

                <PanelResizeHandle className="h-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-row-resize" />

                {/* 中央下部: BottomPanel (対話テスト・ログ) */}
                <Panel defaultSize={30} minSize={15}>
                  <BottomPanel audioService={audioServiceRef.current} />
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-indigo-500 transition-colors cursor-col-resize" />

            {/* 右ペイン: Inspector */}
            <Panel defaultSize={25} minSize={20} maxSize={40}>
              <Inspector selectedNodeId={selectedNodeId} />
            </Panel>
          </PanelGroup>
        </div>

        {/* モデル入手モーダル */}
        <ModelDownloaderModal
          isOpen={isDownloaderOpen}
          onClose={() => setIsDownloaderOpen(false)}
          progress={downloadProgress}
          onStartDownload={handleStartDownload}
          onCancelDownload={handleCancelDownload}
        />

        {/* キャラクター作成・編集モーダル */}
        <CharacterModal
          isOpen={isCharacterModalOpen}
          onClose={() => setIsCharacterModalOpen(false)}
        />

        {/* システム & 階層型検索設定モーダル */}
        <SettingsModal />
      </div>
    </ErrorBoundary>
  );
};
