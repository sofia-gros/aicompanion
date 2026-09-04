package tts

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// VoicevoxProvider は VOICEVOX HTTP API (ポート 50021) と通信するプロバイダーです。
type VoicevoxProvider struct {
	client  *http.Client
	baseURL string
	speaker int
}

// NewVoicevoxProvider は VOICEVOX プロバイダーのインスタンスを生成します。
func NewVoicevoxProvider(baseURL string, defaultSpeaker int) *VoicevoxProvider {
	if baseURL == "" {
		baseURL = "http://127.0.0.1:50021"
	}
	if defaultSpeaker <= 0 {
		defaultSpeaker = 3 // デフォルト: ずんだもん(ノーマル)
	}
	return &VoicevoxProvider{
		client:  &http.Client{},
		baseURL: baseURL,
		speaker: defaultSpeaker,
	}
}

// Synthesize は指定テキストから VOICEVOX 経由で WAV 音声を合成します。
func (v *VoicevoxProvider) Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error) {
	speaker := v.speaker
	if options.SpeakerID > 0 {
		speaker = options.SpeakerID
	}

	// 1. クエリ生成 (POST /audio_query?text=...&speaker=...)
	queryURL := fmt.Sprintf("%s/audio_query?text=%s&speaker=%d", v.baseURL, url.QueryEscape(text), speaker)
	reqQuery, err := http.NewRequestWithContext(ctx, http.MethodPost, queryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("audio_query リクエストの作成に失敗しました: %w", err)
	}

	respQuery, err := v.client.Do(reqQuery)
	if err != nil {
		return nil, fmt.Errorf("audio_query 通信エラー: %w", err)
	}
	defer respQuery.Body.Close()

	if respQuery.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("audio_query HTTPエラーステータス: %d", respQuery.StatusCode)
	}

	queryData, err := io.ReadAll(respQuery.Body)
	if err != nil {
		return nil, fmt.Errorf("audio_query レスポンスの読み取りに失敗しました: %w", err)
	}

	// 2. 音声合成実行 (POST /synthesis?speaker=...)
	synthURL := fmt.Sprintf("%s/synthesis?speaker=%d", v.baseURL, speaker)
	reqSynth, err := http.NewRequestWithContext(ctx, http.MethodPost, synthURL, bytes.NewReader(queryData))
	if err != nil {
		return nil, fmt.Errorf("synthesis リクエストの作成に失敗しました: %w", err)
	}
	reqSynth.Header.Set("Content-Type", "application/json")

	respSynth, err := v.client.Do(reqSynth)
	if err != nil {
		return nil, fmt.Errorf("synthesis 通信エラー: %w", err)
	}
	defer respSynth.Body.Close()

	if respSynth.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("synthesis HTTPエラーステータス: %d", respSynth.StatusCode)
	}

	audioData, err := io.ReadAll(respSynth.Body)
	if err != nil {
		return nil, fmt.Errorf("synthesis 音声バイナリの取得に失敗しました: %w", err)
	}

	// 音声時間概算（16bit, 24kHzモノラル = 1秒あたり48,000バイト）
	durationMs := int64(float64(len(audioData)) / 48000.0 * 1000.0)

	return &AudioResult{
		AudioData:   audioData,
		ContentType: "audio/wav",
		DurationMs:  durationMs,
	}, nil
}

// HealthCheck は VOICEVOX サーバーの稼働状態を確認します。
func (v *VoicevoxProvider) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/version", v.baseURL), nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("VOICEVOX 接続失敗: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// GetEngineType はエンジンの識別子を返します。
func (v *VoicevoxProvider) GetEngineType() string {
	return "voicevox"
}
