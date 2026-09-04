import React, { useState } from 'react';
import {
  X,
  Globe,
  Key,
  Folder,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Lock,
  EyeOff,
  Server,
  HardDrive,
  Trash2,
  Cpu,
  Volume2,
  Sliders,
  Download,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';

type SettingsSection = 'web_search' | 'models' | 'voice_avatar' | 'storage' | 'security_about';

/**
 * アプリケーション環境設定モーダルコンポーネント (左右2ペイン ツリー＋詳細設定画面)
 * 階層型Web情報解決、LLMモデル・判定用超小型LLM、音声・アバター対話、保存先、セキュリティを集中管理します。
 */
export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    searchConfig,
    updateSearchConfig,
    modelDir,
    setModelDir,
    downloadedModels,
    activeModelFileName,
    switchActiveModel,
    config,
    updateConfig,
    clearChatMessages,
    addLog,
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<SettingsSection>('web_search');

  if (!isSettingsModalOpen) return null;

  const handleSelectFolder = async () => {
    try {
      const selected = await WailsBridge.selectModelDirectory();
      if (selected) {
        setModelDir(selected);
        addLog(`[設定] モデル保存先フォルダーを変更しました: ${selected}`);
      }
    } catch (err) {
      addLog(`[設定] フォルダー選択エラー: ${err}`);
    }
  };

  const handleClearHistory = async () => {
    try {
      await WailsBridge.clearConversationHistory();
      clearChatMessages();
      addLog('[セキュリティ] ローカル会話履歴および記憶データベースを完全消去しました');
    } catch (err) {
      addLog(`[セキュリティ] 履歴消去エラー: ${err}`);
    }
  };

  const handleDownloadClassifierModel = () => {
    WailsBridge.startModelDownload('smollm2_135m');
    addLog('[設定] 判定用超小型LLM (SmolLM2-135M 90MB) のダウンロードを開始しました');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl w-full max-w-4xl h-[620px] max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-zinc-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">システム設定 & 環境カスタマイズ</h2>
              <p className="text-[11px] text-zinc-400">モデル推論、自律Web検索、音声、ストレージ、セキュリティ方針</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルメインボディ (左右2ペイン構造) */}
        <div className="flex-1 flex overflow-hidden">
          {/* ==================== 左ペイン: 項目ツリー ==================== */}
          <div className="w-56 bg-zinc-950/70 border-r border-zinc-800 p-3 space-y-1 shrink-0 overflow-y-auto">
            <div className="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider">
              設定項目
            </div>

            {/* 1. 自律Web情報解決 */}
            <button
              onClick={() => setActiveSection('web_search')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeSection === 'web_search'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Web情報解決 & AIキー</span>
            </button>

            {/* 2. モデル & 判定用小型LLM */}
            <button
              onClick={() => setActiveSection('models')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeSection === 'models'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Cpu className="w-4 h-4 text-sky-400 shrink-0" />
              <span>モデル & 判定用小型LLM</span>
            </button>

            {/* 3. 音声 & アバター対話 */}
            <button
              onClick={() => setActiveSection('voice_avatar')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeSection === 'voice_avatar'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>音声 & アバター対話</span>
            </button>

            {/* 4. 保存先フォルダー & データ */}
            <button
              onClick={() => setActiveSection('storage')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeSection === 'storage'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              <span>保存先 & データ</span>
            </button>

            {/* 5. セキュリティ & このアプリについて */}
            <button
              onClick={() => setActiveSection('security_about')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeSection === 'security_about'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <span>セキュリティ & 情報</span>
            </button>
          </div>

          {/* ==================== 右ペイン: 項目ごとの詳細設定画面 ==================== */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-900/60 space-y-6">
            {/* ----------------- 1. Web情報解決 & AIキー ----------------- */}
            {activeSection === 'web_search' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    自律Web情報解決システム (Level 0〜3)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    発話から検索の必要性を判断し、最新時事や用語定義、天気を自動取得します
                  </p>
                </div>

                {/* マスタートグル */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  <div>
                    <div className="text-xs font-medium text-zinc-200">Web情報解決機能を有効にする</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      OFFにすると外部検索を一切行わず、完全ローカル知識のみで対話します
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchConfig.enabled}
                      onChange={(e) => updateSearchConfig({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* レベル解説カード */}
                <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-2.5">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-300">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>情報解決の4段階レベル優先順位</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                      <div className="font-semibold text-emerald-400">Level 0: LLMのみ</div>
                      <div className="text-zinc-400 mt-0.5">日常会話・感情表現。外部検索なしで高速応答。</div>
                    </div>
                    <div className="p-2 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                      <div className="font-semibold text-sky-400">Level 1: Wiki / DuckDuckGo</div>
                      <div className="text-zinc-400 mt-0.5">用語定義・歴史・天気。完全無料で即座に解決。</div>
                    </div>
                    <div className="p-2 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                      <div className="font-semibold text-indigo-400">Level 2: OpenAPI / Tavily</div>
                      <div className="text-zinc-400 mt-0.5">最新ニュース速報。OpenAPIキー最優先、またはTavily。</div>
                    </div>
                    <div className="p-2 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                      <div className="font-semibold text-amber-400">Level 3: スクレイピング</div>
                      <div className="text-zinc-400 mt-0.5">キー未登録時や失敗時の最終手段。DuckDuckGo+goquery。</div>
                    </div>
                  </div>
                </div>

                {/* OpenAPI形式 APIキー */}
                <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-semibold text-zinc-200">OpenAPI形式 APIキー (最優先)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded border border-indigo-800">
                      Google / OpenAI / Groq 互換
                    </span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-1">API Key</label>
                      <input
                        type="password"
                        value={searchConfig.cloudApiKey}
                        onChange={(e) => updateSearchConfig({ cloudApiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Base URL</label>
                        <input
                          type="text"
                          value={searchConfig.cloudApiBaseUrl}
                          onChange={(e) => updateSearchConfig({ cloudApiBaseUrl: e.target.value })}
                          placeholder="https://api.openai.com/v1"
                          className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">Model 名</label>
                        <input
                          type="text"
                          value={searchConfig.cloudApiModel}
                          onChange={(e) => updateSearchConfig({ cloudApiModel: e.target.value })}
                          placeholder="gpt-4o-mini / gemini-2.0-flash"
                          className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tavily AI 検索キー */}
                <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-xs font-semibold text-zinc-200">Tavily AI 検索 APIキー</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800">
                      AI専用Web検索
                    </span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">Tavily API Key</label>
                    <input
                      type="password"
                      value={searchConfig.tavilyApiKey}
                      onChange={(e) => updateSearchConfig({ tavilyApiKey: e.target.value })}
                      placeholder="tvly-..."
                      className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- 2. モデル & 判定用小型LLM ----------------- */}
            {activeSection === 'models' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-400" />
                    LLMモデル & レベル判定用超小型LLM設定
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    メイン推論モデルと、自律検索レベル判定用の超小型モデルを設定します
                  </p>
                </div>

                {/* メイン対話モデル */}
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="text-xs font-semibold text-zinc-200">アクティブ対話モデル</div>
                  <p className="text-[11px] text-zinc-400">
                    現在対話に使用しているGGUFモデルです。変更すると推論サーバーがホットリロードされます。
                  </p>
                  <select
                    value={activeModelFileName || downloadedModels[0] || ''}
                    onChange={(e) => switchActiveModel(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    {downloadedModels.length > 0 ? (
                      downloadedModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    ) : (
                      <option value="">ダウンロード済みモデルがありません</option>
                    )}
                  </select>
                </div>

                {/* 検索レベル判定方式の選択 */}
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="text-xs font-semibold text-zinc-200">自律検索レベル判定方式</div>
                  <p className="text-[11px] text-zinc-400">
                    ユーザー発話が Level 0〜3 のどれに該当するかを判定するエンジンを選択します。
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        searchConfig.classifierMode === 'regex'
                          ? 'border-indigo-500 bg-indigo-950/30'
                          : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="classifierMode"
                        value="regex"
                        checked={searchConfig.classifierMode === 'regex'}
                        onChange={() => updateSearchConfig({ classifierMode: 'regex' })}
                        className="sr-only"
                      />
                      <div className="font-semibold text-xs text-zinc-200">高速正規表現ルール (遅延0ms)</div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        ルールベースでミリ秒未満の超高速判定。PC負荷ゼロ。
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        searchConfig.classifierMode === 'llm'
                          ? 'border-indigo-500 bg-indigo-950/30'
                          : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="classifierMode"
                        value="llm"
                        checked={searchConfig.classifierMode === 'llm'}
                        onChange={() => updateSearchConfig({ classifierMode: 'llm' })}
                        className="sr-only"
                      />
                      <div className="font-semibold text-xs text-zinc-200">超小型LLM文脈判定 (高精度)</div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        超小型LLMで文脈や意図を柔軟に解析して判定。
                      </div>
                    </label>
                  </div>
                </div>

                {/* 判定用超小型モデルの指定 & 入手ボタン */}
                <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-zinc-200">判定用超小型モデル</div>
                      <div className="text-[11px] text-zinc-400">
                        大規模LLMに負荷をかけず、超小型モデル（SmolLM2-135M / Qwen2.5-0.5B）で瞬時に判定します
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadClassifierModel}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0"
                      title="SmolLM2-135M (約90MB) をダウンロード"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>判定用小型LLMを入手 (90MB)</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={searchConfig.classifierModel}
                    onChange={(e) => updateSearchConfig({ classifierModel: e.target.value })}
                    placeholder="qwen2.5-0.5b-instruct-q4_k_m.gguf / smollm2-135m-instruct-q4_k_m.gguf"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* ----------------- 3. 音声 & アバター対話 ----------------- */}
            {activeSection === 'voice_avatar' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    音声合成 & アバター対話設定
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    音声エンジン、話者ID、リップシンク感度、自発的発話をカスタマイズします
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="text-xs font-semibold text-zinc-200">音声合成エンジン (TTS)</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'windows-tts', label: 'Windows 標準' },
                      { id: 'voicevox', label: 'VOICEVOX' },
                      { id: 'style-bert-vits2', label: 'Style-Bert-VITS2' },
                    ].map((eng) => (
                      <button
                        key={eng.id}
                        onClick={() => updateConfig({ ttsEngine: eng.id as any })}
                        className={`p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                          config.ttsEngine === eng.id
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                            : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {eng.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 音量・感度スライダー */}
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 mb-1">
                      <span>音量</span>
                      <span>{Math.round((config.volume ?? 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.volume ?? 1}
                      onChange={(e) => updateConfig({ volume: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 mb-1">
                      <span>リップシンク感度</span>
                      <span>{(config.lipSyncSensitivity ?? 1).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3"
                      step="0.1"
                      value={config.lipSyncSensitivity ?? 1}
                      onChange={(e) => updateConfig({ lipSyncSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-300 mb-1">
                      <span>視線追従感度</span>
                      <span>{(config.eyeTrackingSensitivity ?? 1).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3"
                      step="0.1"
                      value={config.eyeTrackingSensitivity ?? 1}
                      onChange={(e) => updateConfig({ eyeTrackingSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- 4. 保存先フォルダー & データ ----------------- */}
            {activeSection === 'storage' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-400" />
                    ストレージ & ローカルデータ管理
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    GGUFモデルの保存先フォルダーおよび会話記憶データベースの管理
                  </p>
                </div>

                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="text-xs font-semibold text-zinc-200">GGUFモデル保存フォルダー</div>
                  <p className="text-[11px] text-zinc-400">
                    HuggingFace等からダウンロードされる大容量モデルの保存先です。別ドライブに変更可能です。
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={modelDir}
                      className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-300 font-mono select-all"
                    />
                    <button
                      onClick={handleSelectFolder}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap shadow-sm"
                    >
                      フォルダー変更
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="text-xs font-semibold text-zinc-200">会話記憶データベースの消去</div>
                  <p className="text-[11px] text-zinc-400">
                    ローカルSQLite（data/companion.db）に保存されている対話履歴および長期記憶ベクトルを完全に消去します。
                  </p>
                  <button
                    onClick={handleClearHistory}
                    className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>会話記憶を完全消去</span>
                  </button>
                </div>
              </div>
            )}

            {/* ----------------- 5. セキュリティ & このアプリについて ----------------- */}
            {activeSection === 'security_about' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    セキュリティ取扱方針 & アプリケーション情報
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    ユーザーデータの機密性・プライバシー保護への完全な取り組み
                  </p>
                </div>

                {/* アプリ基本情報 */}
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-xs text-white shadow">
                        AI
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100">AI Companion Studio</h4>
                        <p className="text-[10px] text-zinc-400">完全ローカル・プライバシー保護型 デスクトップAIパートナー</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 font-mono">
                      v1.0.0 (Stable)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800/80">
                    <div><span className="text-zinc-500">推論基盤:</span> llama-server (Job Object同期)</div>
                    <div><span className="text-zinc-500">フロントエンド:</span> Wails v2 + React 18 + Vite</div>
                    <div><span className="text-zinc-500">アバター描画:</span> PixiJS (Live2D) / Three.js (VRM)</div>
                    <div><span className="text-zinc-500">ローカルDB:</span> Pure-Go SQLite (Cgo非依存)</div>
                  </div>
                </div>

                {/* 4大セキュリティ保証カード */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1">
                    <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-[11px]">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>完全ローカル推論の保証</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-[10px]">
                      会話内容、感情データ、長期記憶はPC内（data/companion.db）にのみ保存され、外部送信されません。
                    </p>
                  </div>

                  <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1">
                    <div className="flex items-center space-x-1.5 text-sky-400 font-semibold text-[11px]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>APIキーの厳格なローカル保護</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-[10px]">
                      登録されたAPIキーはローカル設定にのみ保持され、当該プロバイダ直接通信以外で第三者へ送信されません。
                    </p>
                  </div>

                  <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1">
                    <div className="flex items-center space-x-1.5 text-amber-400 font-semibold text-[11px]">
                      <Globe className="w-3.5 h-3.5" />
                      <span>検索クエリの最小化分離</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-[10px]">
                      Web検索実行時、外部送信されるのは抽出された単語のみ。会話履歴や個人情報は付加されません。
                    </p>
                  </div>

                  <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-[11px]">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>トラッキング・テレメトリ 0%</span>
                    </div>
                    <p className="text-zinc-400 leading-relaxed text-[10px]">
                      Google Analyticsや広告タグなどのテレメトリ通信は一切組み込まれておらず完全プライベートです。
                    </p>
                  </div>
                </div>

                {/* Job Object プロセス隔離 */}
                <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-[11px]">
                    <Server className="w-3.5 h-3.5" />
                    <span>外部プロセスのOSレベル隔離 (Windows Job Object)</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    推論サーバー等の子プロセスはWindows Job Objectにより親プロセスと生命同期されています。
                    アプリ終了時にバックグラウンドでプロセスが孤立残留したり、不正通信を継続することはOSレベルで遮断されます。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="flex items-center justify-end px-6 py-2.5 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};


