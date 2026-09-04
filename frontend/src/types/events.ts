/**
 * フロントエンドおよびOBS配信で使用する通信イベント・データ型の定義
 */

/**
 * 発話音声およびリップシンク・字幕情報を含むペイロード
 */
export interface AvatarSpeakPayload {
  /** シーケンス番号 (1から始まる連番) */
  seqId: number;
  /** 当該ターンの最終文であるかどうか */
  isLast: boolean;
  /** 発話された文テキスト */
  text: string;
  /** 音声MIMEタイプ (例: "audio/wav") */
  audioFormat: string;
  /** Base64エンコードされた音声バイナリ */
  audioBase64: string;
  /** 感情タグ ("neutral" | "happy" | "sad" | "angry" | "surprised") */
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
  /** 推定再生時間 (ミリ秒) */
  durationMs: number;
}

/**
 * リアルタイム字幕描画用のストリーミングトークン
 */
export interface LLMTokenPayload {
  token: string;
  isFirst: boolean;
}

/**
 * バックエンドの初期化・稼働状態情報
 */
export interface SystemStatusPayload {
  llmReady: boolean;
  ttsReady: boolean;
  activeTTS: string;
  activeTier: string;
}

/**
 * PCのハードウェアスペックおよび推奨モデル情報
 */
export interface SystemSpec {
  totalRamGb: number;
  availableRamGb: number;
  recommendedTier: string;
  recommendation: string;
}

/**
 * モデルダウンロードの進捗状況
 */
export interface DownloadProgressPayload {
  modelKey: string;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  percent: number;
  isCompleted: boolean;
  error?: string;
}

/**
 * アプリケーションのシステム設定
 */
export interface SystemConfig {
  displayMode: 'studio' | 'overlay';
  isClickThrough: boolean;
  llmTier: 'tier0_5b' | 'tier1_5b' | 'tier3b' | 'tier7b' | 'cloud';
  ttsEngine: 'windows-tts' | 'voicevox' | 'style-bert-vits2' | 'mock';
  speakerId: number;
  volume: number;
  lipSyncSensitivity: number;
  eyeTrackingSensitivity: number;
}

/**
 * 階層型Web情報解決・検索設定
 */
export interface SearchConfig {
  /** Web情報解決機能の有効/無効 */
  enabled: boolean;
  /** Tavily AI APIキー */
  tavilyApiKey: string;
  /** OpenAPI形式 / Google Gemini / OpenAI 互換APIキー */
  cloudApiKey: string;
  /** API Base URL (例: https://api.openai.com/v1) */
  cloudApiBaseUrl: string;
  /** 使用モデル名 (例: gpt-4o-mini, gemini-2.0-flash) */
  cloudApiModel: string;
  /** レベル判定方式 ("regex" | "llm") */
  classifierMode: 'regex' | 'llm';
  /** 判定用超小型モデル名 */
  classifierModel: string;
}

/**
 * PCのリアルタイムリソース使用状況（CPU, RAM, ROM/ディスク, GPU）
 */
export interface SystemUsage {
  /** CPU使用率 (0.0〜100.0%) */
  cpuPercent: number;
  /** RAM使用率 (0.0〜100.0%) */
  ramPercent: number;
  /** 使用中RAM容量 (GB) */
  ramUsedGb: number;
  /** 搭載総RAM容量 (GB) */
  ramTotalGb: number;
  /** ストレージ使用率 (0.0〜100.0%) */
  romPercent: number;
  /** ストレージ空き容量 (GB) */
  romFreeGb: number;
  /** ストレージ総容量 (GB) */
  romTotalGb: number;
  /** GPU / VRAM情報またはアクセラレータ状況 */
  gpuInfo: string;
}


