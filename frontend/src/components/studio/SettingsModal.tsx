import React, { useState } from 'react';
import { X, Globe, Key, Folder, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';

/**
 * アプリケーション環境設定モーダルコンポーネント
 * 階層型Web情報解決（Level 0〜3）、外部APIキー、モデル保存先フォルダーを設定・管理します。
 */
export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    searchConfig,
    updateSearchConfig,
    modelDir,
    setModelDir,
    addLog,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'search' | 'storage'>('search');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-zinc-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">システム & 検索設定</h2>
              <p className="text-xs text-zinc-400">階層型情報解決（Level 0〜3）とモデル保存先を管理</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'search'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Web情報解決 & AIキー</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'storage'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>保存先フォルダー</span>
          </button>
        </div>

        {/* モーダル本文 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Web情報解決機能マスタートグル */}
              <div className="flex items-center justify-between p-4 bg-zinc-950/60 rounded-xl border border-zinc-800">
                <div>
                  <div className="text-sm font-medium text-zinc-200">自律Web情報解決・検索機能</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    発話内容から必要性をLLMが判断し、最新時事や用語定義、天気を自動取得して会話に反映します
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

              {/* 解決レベル解説カード */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-300">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span>階層型情報解決システム（Level 0〜3）の優先順位</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                    <div className="font-semibold text-emerald-400">Level 0: LLMのみ</div>
                    <div className="text-zinc-400 mt-1">日常会話・感情表現。外部検索を行わず完全ローカル知識で高速応答。</div>
                  </div>
                  <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                    <div className="font-semibold text-sky-400">Level 1: Wiki / DuckDuckGo</div>
                    <div className="text-zinc-400 mt-1">用語定義・歴史・天気データ。完全無料・APIキー不要で高速検索。</div>
                  </div>
                  <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                    <div className="font-semibold text-indigo-400">Level 2: OpenAPI / Tavily</div>
                    <div className="text-zinc-400 mt-1">最新ニュース・時事速報。OpenAPI形式キーを最優先、またはTavilyキーで取得。</div>
                  </div>
                  <div className="p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800/80">
                    <div className="font-semibold text-amber-400">Level 3: スクレイピング</div>
                    <div className="text-zinc-400 mt-1">キー未登録時やエラー時の最終手段。DuckDuckGo + goquery で自前抽出。</div>
                  </div>
                </div>
              </div>

              {/* OpenAPI形式 / クラウドAI設定 */}
              <div className="space-y-3 p-4 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-zinc-200">OpenAPI形式 APIキー（最優先）</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-950 text-indigo-300 rounded border border-indigo-800">
                    Google / OpenAI / Groq 互換
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Google Gemini, ChatGPT (OpenAI), Groq などのOpenAI互換APIキーが設定されている場合、最新時事検索で最優先利用されます。
                </p>
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={searchConfig.cloudApiKey}
                      onChange={(e) => updateSearchConfig({ cloudApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Base URL</label>
                      <input
                        type="text"
                        value={searchConfig.cloudApiBaseUrl}
                        onChange={(e) => updateSearchConfig({ cloudApiBaseUrl: e.target.value })}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">Model 名</label>
                      <input
                        type="text"
                        value={searchConfig.cloudApiModel}
                        onChange={(e) => updateSearchConfig({ cloudApiModel: e.target.value })}
                        placeholder="gpt-4o-mini / gemini-2.0-flash"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tavily AI 設定 */}
              <div className="space-y-3 p-4 bg-zinc-950/40 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-semibold text-zinc-200">Tavily AI 検索 APIキー</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800">
                    AI専用Web検索
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  OpenAPIキーがない場合、またはTavilyキーがある場合に使用されます。月1,000回の無料検索枠があり、高精度な要約スニペットを取得できます。
                </p>
                <div className="pt-1">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Tavily API Key</label>
                  <input
                    type="password"
                    value={searchConfig.tavilyApiKey}
                    onChange={(e) => updateSearchConfig({ tavilyApiKey: e.target.value })}
                    placeholder="tvly-..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-zinc-200">GGUFモデルダウンロード保存先</span>
                </div>
                <p className="text-xs text-zinc-400">
                  HuggingFace等からダウンロードされる大容量LLMモデル（GGUFファイル）を保存・探索するフォルダーです。
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={modelDir}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-lg text-xs text-zinc-300 font-mono select-all"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap shadow-sm"
                  >
                    フォルダー変更
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-800 bg-zinc-950/60">
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
