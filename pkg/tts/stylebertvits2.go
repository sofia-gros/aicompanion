package tts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// StyleBertVITS2Provider は Style-Bert-VITS2 HTTP API (ポート 5000) と通信するプロバイダーです。
type StyleBertVITS2Provider struct {
	client  *http.Client
	baseURL string
	modelID int
	speaker int
}

// NewStyleBertVITS2Provider は Style-Bert-VITS2 プロバイダーを生成します。
func NewStyleBertVITS2Provider(baseURL string, modelID, speaker int) *StyleBertVITS2Provider {
	if baseURL == "" {
		baseURL = "http://127.0.0.1:5000"
	}
	return &StyleBertVITS2Provider{
		client:  &http.Client{},
		baseURL: baseURL,
		modelID: modelID,
		speaker: speaker,
	}
}

// Synthesize は指定テキストから Style-Bert-VITS2 経由で WAV 音声を合成します。
func (s *StyleBertVITS2Provider) Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error) {
	speaker := s.speaker
	if options.SpeakerID > 0 {
		speaker = options.SpeakerID
	}

	payload := map[string]interface{}{
		"text":        text,
		"model_id":    s.modelID,
		"speaker_id":  speaker,
		"sdp_ratio":   0.2,
		"noise":       0.6,
		"noisew":      0.8,
		"length":      1.0,
		"language":    "JP",
		"auto_split":  false, // バックエンドで句分割済みのためfalse
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("リクエストJSON生成失敗: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/voice", s.baseURL), bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("リクエスト作成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Style-Bert-VITS2 通信エラー: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Style-Bert-VITS2 HTTPエラーステータス: %d", resp.StatusCode)
	}

	audioData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("音声バイナリ読み取り失敗: %w", err)
	}

	durationMs := int64(float64(len(audioData)) / 88200.0 * 1000.0) // 44.1kHz 16bitステレオ目安

	return &AudioResult{
		AudioData:   audioData,
		ContentType: "audio/wav",
		DurationMs:  durationMs,
	}, nil
}

// HealthCheck は Style-Bert-VITS2 サーバーの死活監視を行います。
func (s *StyleBertVITS2Provider) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/", s.baseURL), nil)
	if err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("Style-Bert-VITS2 接続失敗: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// GetEngineType は識別子を返します。
func (s *StyleBertVITS2Provider) GetEngineType() string {
	return "style-bert-vits2"
}
