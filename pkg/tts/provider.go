// Package tts は音声合成エンジン（Style-Bert-VITS2, VOICEVOX等）のプロバイダー層を提供します。
package tts

import (
	"context"
)

// AudioResult は音声合成結果を格納する構造体です。
type AudioResult struct {
	// AudioData はWAVまたはMP3形式の音声バイナリデータです。
	AudioData []byte
	// ContentType はMIMEタイプ（例: "audio/wav"）です。
	ContentType string
	// DurationMs は推定される音声再生時間（ミリ秒）です。
	DurationMs int64
}

// TTSOptions は音声合成時の話者や速度、感情パラメータを指定するオプションです。
type TTSOptions struct {
	// SpeakerID は話者識別IDです。
	SpeakerID int
	// Speed は発話速度の倍率（デフォルト: 1.0）です。
	Speed float32
	// Pitch は音高の調整値（デフォルト: 0.0）です。
	Pitch float32
}

// TTSProvider は各種音声合成エンジンの差異を吸収する共通インターフェースです。
type TTSProvider interface {
	// Synthesize は指定されたテキストから音声バイナリを同期生成します。
	Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error)

	// HealthCheck は音声合成サーバーの死活監視を行います。
	HealthCheck(ctx context.Context) error

	// GetEngineType はエンジンの識別子（"voicevox", "style-bert-vits2", "mock"）を返します。
	GetEngineType() string
}
