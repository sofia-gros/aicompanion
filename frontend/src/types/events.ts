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
