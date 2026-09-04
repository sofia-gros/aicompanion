package tts

import (
	"bytes"
	"context"
	"encoding/binary"
	"math"
)

// MockTTSProvider は外部TTSエンジンなしで安全にテスト音声（WAV形式）を生成するモックです。
type MockTTSProvider struct{}

// NewMockTTSProvider は新しいモックTTSプロバイダーを生成します。
func NewMockTTSProvider() *MockTTSProvider {
	return &MockTTSProvider{}
}

// Synthesize は指定テキストからダミーのWAV音声データを生成します。
func (m *MockTTSProvider) Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error) {
	// 文字数に応じて再生時間（秒）を概算（1文字あたり約120ms）
	charCount := len([]rune(text))
	if charCount == 0 {
		charCount = 1
	}
	durationSec := float64(charCount) * 0.12
	if durationSec < 0.5 {
		durationSec = 0.5
	}
	durationMs := int64(durationSec * 1000)

	// サンプリングレート 24,000Hz, 16bit モノラルのサイン波WAVを生成
	sampleRate := 24000
	numSamples := int(float64(sampleRate) * durationSec)
	audioBuffer := new(bytes.Buffer)

	// 1. RIFFヘッダー
	audioBuffer.WriteString("RIFF")
	dataSize := numSamples * 2
	totalSize := uint32(36 + dataSize)
	_ = binary.Write(audioBuffer, binary.LittleEndian, totalSize)
	audioBuffer.WriteString("WAVE")

	// 2. fmt チャンク
	audioBuffer.WriteString("fmt ")
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint32(16))     // チャンクサイズ
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint16(1))      // リニアPCM
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint16(1))      // モノラル
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint32(sampleRate*2)) // バイトレート
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint16(2))      // ブロックサイズ
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint16(16))     // ビット数

	// 3. data チャンク
	audioBuffer.WriteString("data")
	_ = binary.Write(audioBuffer, binary.LittleEndian, uint32(dataSize))

	// リップシンクが反応するように可聴域（440Hzの音）を生成
	frequency := 440.0
	for i := 0; i < numSamples; i++ {
		t := float64(i) / float64(sampleRate)
		// フェードイン・フェードアウト
		envelope := 1.0
		if i < 1000 {
			envelope = float64(i) / 1000.0
		} else if i > numSamples-1000 {
			envelope = float64(numSamples-i) / 1000.0
		}
		sample := int16(math.Sin(2*math.Pi*frequency*t) * 16000 * envelope)
		_ = binary.Write(audioBuffer, binary.LittleEndian, sample)
	}

	return &AudioResult{
		AudioData:   audioBuffer.Bytes(),
		ContentType: "audio/wav",
		DurationMs:  durationMs,
	}, nil
}

// HealthCheck はモックサーバーの健全性を確認します（常に成功）。
func (m *MockTTSProvider) HealthCheck(ctx context.Context) error {
	return nil
}

// GetEngineType は識別子 "mock" を返します。
func (m *MockTTSProvider) GetEngineType() string {
	return "mock"
}
