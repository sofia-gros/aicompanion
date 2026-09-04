import React, { useState } from 'react';
import {
  X,
  Globe,
  Key,
  Folder,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Info,
  Lock,
  EyeOff,
  Server,
  HardDrive,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { WailsBridge } from '../../services/wailsBridge';

/**
 * アプリケーション環境設定モーダルコンポーネント
 * 階層型Web情報解決（Level 0〜3）、外部APIキー、モデル保存先フォルダー、およびアプリ情報・セキュリティ取扱方針を管理します。
 */
export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    searchConfig,
    updateSearchConfig,
    modelDir,
    setModelDir,
    clearChatMessages,
    addLog,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'search' | 'storage' | 'about'>('search');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-zinc-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">システム設定 & 情報</h2>
              <p className="text-xs text-zinc-400">Web情報解決、保存先フォルダー、セキュリティ・プライバシー保護方針</p>
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
          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'about'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>このアプリについて & セキュリティ</span>
          </button>
        </div>

        {/* モーダル本文 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ==================== 1. Web情報解決 & AIキー タブ ==================== */}
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

          {/* ==================== 2. 保存先フォルダー タブ ==================== */}
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

          {/* ==================== 3. このアプリについて & セキュリティ タブ ==================== */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {/* アプリケーション基本情報 */}
              <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-md">
                      AI
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">AI Companion Studio</h3>
                      <p className="text-[11px] text-zinc-400">完全ローカル・プライバシー保護型 デスクトップAIパートナー</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 font-mono">
                    v1.0.0 (Stable)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/80">
                  <div>
                    <span className="text-zinc-500">推論基盤:</span> llama-server (Job Object同期)
                  </div>
                  <div>
                    <span className="text-zinc-500">フレームワーク:</span> Wails v2 + React 18 + Vite
                  </div>
                  <div>
                    <span className="text-zinc-500">描画エンジン:</span> PixiJS (Live2D) / Three.js (VRM)
                  </div>
                  <div>
                    <span className="text-zinc-500">ローカルDB:</span> Pure-Go SQLite (data/sqlite.db)
                  </div>
                </div>
              </div>

              {/* セキュリティ・プライバシー取扱保証宣言 */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-200">機密情報・プライバシー保護への完全な取り組み</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  本アプリケーションは、ユーザーのプライバシーと機密情報の完全な保護を最優先原則として設計されています。
                  いかなるユーザーデータも無断で外部に流出することはありません。
                </p>
              </div>

              {/* 4大セキュリティ保証カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. 完全ローカル推論 */}
                <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1.5">
                  <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
                    <HardDrive className="w-4 h-4" />
                    <span>完全ローカル推論の保証</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    会話内容、感情データ、長期記憶はすべてあなたのPC内（`data/sqlite.db`）にのみ保存されます。外部サーバーへ会話ログが送信されることは絶対にありません。
                  </p>
                </div>

                {/* 2. APIキーのローカル隔離 */}
                <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1.5">
                  <div className="flex items-center space-x-2 text-sky-400 font-semibold">
                    <Lock className="w-4 h-4" />
                    <span>APIキーの厳格な保護</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    登録されたOpenAPI互換キーやTavilyキーはローカル設定ファイルにのみ保存され、当該プロバイダとの直接通信以外で第三者へ送信・共有されることはありません。
                  </p>
                </div>

                {/* 3. 検索時のクエリ最小化 */}
                <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                    <Globe className="w-4 h-4" />
                    <span>検索クエリの最小化分離</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Web情報解決（Level 1〜3）実行時、外部に送信されるのは抽出された「検索単語」のみです。過去の会話履歴や個人情報が検索リクエストに付加されることはありません。
                  </p>
                </div>

                {/* 4. テレメトリ・トラッキング 0% */}
                <div className="p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/90 space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                    <EyeOff className="w-4 h-4" />
                    <span>トラッキング・解析コード 0%</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    Google Analyticsや広告タグ、匿名の利用状況収集などのテレメトリ通信は一切組み込まれていません。完全なプライベート環境で安心してご利用いただけます。
                  </p>
                </div>
              </div>

              {/* プロセス安全性 & データ管理 */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-200">プロセスの生命同期（Windows Job Object）</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  本アプリはOS標準の Windows Job Object を利用し、推論サーバー（llama-server.exe）などの外部プロセスを厳格に管理しています。
                  アプリ終了時にバックグラウンドでプロセスが孤立残留したり、不正に通信を継続することはOSレベルで完全に防止されます。
                </p>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-zinc-300">会話記憶データの完全消去</div>
                    <div className="text-[11px] text-zinc-500">保存された短期ログおよび長期記憶ベクトルをデータベースから完全に消去します</div>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 shrink-0"
                    title="データベース内の会話ログ・長期記憶をリセット"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>記憶消去</span>
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

