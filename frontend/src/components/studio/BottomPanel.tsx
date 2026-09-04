import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Terminal,
  Activity,
  Send,
  Mic,
  MicOff,
  Trash2,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore, ChatMessage } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';
import { SpeechService } from '../../services/speechService';
import { AudioService } from '../../services/audioService';

interface BottomPanelProps {
  audioService: AudioService;
}

/**
 * Godot Engine 風の下部パネル（リッチ対話テストチャット、PTT、コンソールログ、パフォーマンスモニター）
 */
export const BottomPanel: React.FC<BottomPanelProps> = ({ audioService }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'console' | 'perf'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    characters,
    activeCharacterId,
    logs,
    tokensPerSec,
    firstAudioLatencyMs,
    fps,
    systemSpec,
    companionState,
    isMicListening,
    setIsMicListening,
    chatMessages,
    addChatMessage,
    clearChatMessages,
    addLog,
  } = useAppStore();

  const activeChar = characters.find((c) => c.id === activeCharacterId) || characters[0];
  const speechServiceRef = useRef<SpeechService | null>(null);

  // チャットログが更新されたら最下部へ自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    speechServiceRef.current = new SpeechService(
      (text, isFinal) => {
        setInputMessage(text);
        if (isFinal && text.trim().length > 0) {
          addLog(`[STT マイク認識]: ${text}`);
          addChatMessage({
            id: `user-${Date.now()}`,
            sender: 'user',
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          WailsBridge.sendMessage(text);
          setInputMessage('');
        }
      },
      (listening) => {
        setIsMicListening(listening);
      }
    );

    return () => {
      speechServiceRef.current?.stop();
    };
  }, []);

  // PTT (Push-to-Talk) キーボード監視 (Spaceキー長押し)
  useEffect(() => {
    if (!activeChar?.enablePushToTalk) return;

    let isSpaceDown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space' && !isSpaceDown) {
        e.preventDefault();
        isSpaceDown = true;
        speechServiceRef.current?.start();
        addLog('[PTT] Space長押し中: マイク認識開始');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpaceDown) {
        e.preventDefault();
        isSpaceDown = false;
        speechServiceRef.current?.stop();
        addLog('[PTT] Space解除: マイク認識停止');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeChar?.enablePushToTalk]);

  const toggleMic = () => {
    if (!speechServiceRef.current) return;
    if (isMicListening) {
      speechServiceRef.current.stop();
      addLog('マイク音声認識を停止しました');
    } else {
      const started = speechServiceRef.current.start();
      if (started) {
        addLog('マイク音声認識を開始しました (話しかけてください)');
      } else {
        addLog('マイクへのアクセス権限がないか、非対応です');
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;

    setInputMessage('');
    addChatMessage({
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    addLog(`User: ${text}`);
    await WailsBridge.sendMessage(text);
  };

  // 過去のセリフを音声再読み上げ
  const handleReplayVoice = (msg: ChatMessage) => {
    if (msg.audioBase64) {
      audioService.pushChunk({
        seqId: 1,
        isLast: true,
        text: msg.text,
        audioFormat: 'audio/wav',
        audioBase64: msg.audioBase64,
        emotion: (msg.emotion as any) || 'neutral',
        durationMs: 0,
      });
      addLog(`[Voice] セリフを再再生しました: "${msg.text}"`);
    } else {
      // 音声データがない場合は即座に再送信
      WailsBridge.sendMessage(msg.text);
    }
  };

  return (
    <div className="h-full bg-zinc-900 border-t border-zinc-800 flex flex-col select-none">
      {/* タブバー */}
      <div className="h-7 px-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
              activeTab === 'chat' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3 h-3 text-indigo-400" />
            対話テスト ({chatMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
              activeTab === 'console' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3 h-3 text-amber-400" />
            コンソールログ ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('perf')}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
              activeTab === 'perf' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3 h-3 text-emerald-400" />
            パフォーマンス
          </button>
        </div>

        {/* ステータスバッジ ＆ PTT案内 */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 pr-2 font-mono">
          {activeChar?.enablePushToTalk && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
              PTT: Space長押し
            </span>
          )}
          <span className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                companionState === 'speaking'
                  ? 'bg-emerald-400 animate-pulse'
                  : companionState === 'thinking'
                  ? 'bg-amber-400 animate-pulse'
                  : companionState === 'listening'
                  ? 'bg-rose-400 animate-pulse'
                  : 'bg-zinc-500'
              }`}
            />
            State: {companionState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 p-2 overflow-hidden flex flex-col">
        {/* ==================== 1. チャット対話テスト ==================== */}
        {activeTab === 'chat' && (
          <form onSubmit={handleSend} className="flex-1 flex flex-col justify-between gap-2 overflow-hidden">
            {/* チャットメッセージ履歴（吹き出しUI） */}
            <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-zinc-950/60 rounded border border-zinc-800/80 text-xs">
              {chatMessages.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">メッセージを入力して会話を始めましょう</p>
              ) : (
                chatMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-0.5`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 px-1 font-mono">
                        <span>{isUser ? 'あなた' : msg.characterName || activeChar.name}</span>
                        <span>{msg.timestamp}</span>
                        {msg.emotion && msg.emotion !== 'neutral' && (
                          <span className="text-pink-400 font-sans">({msg.emotion})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 group max-w-[85%]">
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleReplayVoice(msg)}
                            className="p-1 rounded bg-zinc-800 hover:bg-indigo-600 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                            title="このセリフを音声で再読み上げ"
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        )}
                        <div
                          className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-zinc-800 text-zinc-100 rounded-bl-sm border border-zinc-700/60'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 入力バー */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  type="button"
                  variant={isMicListening ? 'destructive' : 'outline'}
                  onClick={toggleMic}
                  className="gap-1 font-medium whitespace-nowrap shrink-0"
                  title={isMicListening ? 'マイク入力を停止' : 'マイク音声入力を開始'}
                >
                  {isMicListening ? (
                    <MicOff className="w-3.5 h-3.5 animate-pulse" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{isMicListening ? '認識中' : 'マイク'}</span>
                </Button>

                {/* 音量レベルメーター (マイク入力中) */}
                {isMicListening && (
                  <div className="w-14 h-3 bg-zinc-950 rounded border border-zinc-800 overflow-hidden flex items-center px-0.5" title="マイク入力音量">
                    <div className="h-2 w-3/4 bg-emerald-500 rounded animate-pulse transition-all" />
                  </div>
                )}
              </div>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isMicListening
                    ? 'マイクに向かって話しかけてください...'
                    : activeChar?.enablePushToTalk
                    ? 'Space長押しで発話、またはテキスト入力...'
                    : 'メッセージを入力... (例: こんにちは！調子はどう？)'
                }
                className="flex-1 h-7 bg-zinc-950 border border-zinc-700 rounded px-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <Button size="xs" type="submit" className="gap-1 bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap shrink-0">
                <Send className="w-3 h-3" />
                <span>送信</span>
              </Button>
            </div>
          </form>
        )}

        {/* ==================== 2. コンソールログ ==================== */}
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col gap-1 overflow-hidden">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 px-1">
              <span>システム実行ログ</span>
              <button
                onClick={async () => {
                  await WailsBridge.clearConversationHistory();
                  clearChatMessages();
                  addLog('[System] 会話記憶データベースを初期化しました');
                }}
                className="hover:text-rose-400 cursor-pointer flex items-center gap-1 transition-colors"
                title="保存されている会話記憶をリセット"
              >
                <Trash2 className="w-3 h-3" />
                <span>記憶消去</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[11px] text-zinc-300 space-y-1 p-2 bg-zinc-950 rounded border border-zinc-800">
              {logs.map((log, i) => {
                // Gemini風タグ [タグ名] の検出
                const match = log.match(/^(\[\d{1,2}:\d{2}:\d{2}\])?\s*\[([^\]]+)\](.*)$/);
                if (match) {
                  const timestamp = match[1] || '';
                  const tag = match[2];
                  const content = match[3];

                  let tagStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
                  if (tag.includes('思考')) {
                    tagStyle = 'bg-purple-950/80 text-purple-300 border-purple-800/80';
                  } else if (tag.includes('判定')) {
                    tagStyle = 'bg-sky-950/80 text-sky-300 border-sky-800/80';
                  } else if (tag.includes('実行')) {
                    tagStyle = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
                  } else if (tag.includes('取得')) {
                    tagStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
                  } else if (tag.includes('解析')) {
                    tagStyle = 'bg-teal-950/80 text-teal-300 border-teal-800/80';
                  } else if (tag.includes('生成')) {
                    tagStyle = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
                  } else if (tag.includes('エラー') || tag.includes('失敗')) {
                    tagStyle = 'bg-rose-950/80 text-rose-300 border-rose-800/80';
                  } else if (tag.includes('警告')) {
                    tagStyle = 'bg-yellow-950/80 text-yellow-300 border-yellow-800/80';
                  }

                  return (
                    <div key={i} className="leading-relaxed flex items-start space-x-1.5 break-all">
                      {timestamp && <span className="text-[10px] text-zinc-500 shrink-0 select-none">{timestamp}</span>}
                      <span className={`px-1.5 py-0.2 rounded border text-[10px] font-semibold shrink-0 select-none ${tagStyle}`}>
                        {tag}
                      </span>
                      <span className="text-zinc-200">{content}</span>
                    </div>
                  );
                }

                return (
                  <div key={i} className="leading-relaxed text-zinc-400">
                    {log}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== 3. パフォーマンスメトリクス ==================== */}
        {activeTab === 'perf' && (
          <div className="flex-1 grid grid-cols-4 gap-2.5 p-2 font-mono text-xs">
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500">推論速度 (Tokens/sec)</span>
              <span className="text-base font-bold text-indigo-400">
                {tokensPerSec > 0 ? `${tokensPerSec.toFixed(1)} tok/s` : '待機中'}
              </span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500">初声発話遅延 (First Latency)</span>
              <span className="text-base font-bold text-emerald-400">
                {firstAudioLatencyMs > 0 ? `${firstAudioLatencyMs} ms` : '未計測'}
              </span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500">アバター描画 (FPS)</span>
              <span className="text-base font-bold text-teal-400">{fps} FPS</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500">PC環境 / 推奨モデル</span>
              <span className="text-xs font-semibold text-amber-400 truncate">
                {systemSpec ? `RAM ${systemSpec.totalRamGb}GB (${systemSpec.recommendedTier})` : '検知中...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
