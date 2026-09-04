package pipeline

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"aicompanion/pkg/tts"
)

// DispatchCallback は生成された発話イベントをフロントエンドおよびOBSへ送出するコールバックです。
type DispatchCallback func(event AvatarSpeakEvent)

// TokenCallback は受信したテキストトークンをリアルタイムに画面へ通知するコールバックです。
type TokenCallback func(event LLMTokenEvent)

// DialoguePipeline はLLMストリーミング推論と非同期並列TTS音声合成を統括するパイプラインです。
type DialoguePipeline struct {
	ttsProvider tts.TTSProvider
	httpClient  *http.Client
	llmEndpoint string
	isMock      bool
	mutex       sync.RWMutex
}

// NewDialoguePipeline は新しい対話パイプラインを初期化します。
func NewDialoguePipeline(provider tts.TTSProvider, llmEndpoint string, isMock bool) *DialoguePipeline {
	if llmEndpoint == "" {
		llmEndpoint = "http://127.0.0.1:8080/completion"
	}
	return &DialoguePipeline{
		ttsProvider: provider,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		llmEndpoint: llmEndpoint,
		isMock:      isMock,
	}
}

// SetTTSProvider は使用する音声合成プロバイダーを動的に切り替えます。
func (p *DialoguePipeline) SetTTSProvider(provider tts.TTSProvider) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.ttsProvider = provider
}

// SetMockMode はモックモードの有効/無効を切り替えます。
func (p *DialoguePipeline) SetMockMode(mock bool) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.isMock = mock
}

// ProcessUserInput はユーザー発言からLLM応答をストリーミング生成し、並列TTS音声チャンクを送出します。
func (p *DialoguePipeline) ProcessUserInput(
	ctx context.Context,
	prompt string,
	onToken TokenCallback,
	onSpeak DispatchCallback,
) error {
	p.mutex.RLock()
	currentTTS := p.ttsProvider
	llmURL := p.llmEndpoint
	p.mutex.RUnlock()

	var seqCounter int32 = 0
	splitter := NewSentenceSplitter()
	var wg sync.WaitGroup

	// 実機LLMストリーミング通信 (POST /completion)
	reqBody := map[string]interface{}{
		"prompt":      prompt,
		"stream":      true,
		"temperature": 0.7,
		"stop":        []string{"</s>", "<|im_end|>", "<|user|>", "<|im_start|>"},
	}
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("リクエストJSON生成失敗: %w", err)
	}

	endpoint := llmURL
	if !strings.HasSuffix(endpoint, "/completion") && strings.HasSuffix(endpoint, "/v1/chat/completions") {
		endpoint = strings.Replace(endpoint, "/v1/chat/completions", "/completion", 1)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
	if err != nil {
		return fmt.Errorf("LLMリクエスト作成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)

	if err != nil || (resp != nil && resp.StatusCode != http.StatusOK) {
		if resp != nil {
			_ = resp.Body.Close()
		}
		// サーバー未起動または推論準備中の場合、明確なステータス案内をストリーミング送出
		infoText := "ローカルLLM推論サーバーを起動中、またはモデルをロードしています。少々お待ちいただくか、上部メニューの『モデル入手』をご確認ください。"
		for _, r := range infoText {
			if onToken != nil {
				onToken(LLMTokenEvent{Token: string(r), IsFirst: seqCounter == 0})
			}
			time.Sleep(20 * time.Millisecond)
		}
		res, synthErr := currentTTS.Synthesize(ctx, infoText, tts.TTSOptions{})
		if synthErr == nil && onSpeak != nil {
			onSpeak(AvatarSpeakEvent{
				SeqID:       1,
				IsLast:      true,
				Text:        infoText,
				AudioFormat: res.ContentType,
				AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
				Emotion:     "neutral",
				DurationMs:  res.DurationMs,
			})
		}
		return nil
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	isFirstToken := true

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		dataStr := strings.TrimPrefix(line, "data: ")
		if dataStr == "[DONE]" {
			break
		}

		var dataObj struct {
			Content string `json:"content"`
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(dataStr), &dataObj); err != nil {
			continue
		}

		token := dataObj.Content
		if token == "" && len(dataObj.Choices) > 0 {
			token = dataObj.Choices[0].Delta.Content
		}

		if token != "" && onToken != nil {
			onToken(LLMTokenEvent{Token: token, IsFirst: isFirstToken})
			isFirstToken = false
		}

		// 句分割処理
		sentences := splitter.Feed(token)
		for _, sent := range sentences {
			seq := atomic.AddInt32(&seqCounter, 1)
			wg.Add(1)
			go func(sText string, sSeq int) {
				defer wg.Done()
				res, err := currentTTS.Synthesize(ctx, sText, tts.TTSOptions{})
				if err == nil && onSpeak != nil {
					onSpeak(AvatarSpeakEvent{
						SeqID:       sSeq,
						IsLast:      false,
						Text:        sText,
						AudioFormat: res.ContentType,
						AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
						Emotion:     "neutral",
						DurationMs:  res.DurationMs,
					})
				}
			}(sent, int(seq))
		}
	}

	// 残存バッファの最終フラッシュ
	if remaining := splitter.Flush(); remaining != "" {
		seq := atomic.AddInt32(&seqCounter, 1)
		wg.Add(1)
		go func(sText string, sSeq int) {
			defer wg.Done()
			res, err := currentTTS.Synthesize(ctx, sText, tts.TTSOptions{})
			if err == nil && onSpeak != nil {
				onSpeak(AvatarSpeakEvent{
					SeqID:       sSeq,
					IsLast:      true,
					Text:        sText,
					AudioFormat: res.ContentType,
					AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
					Emotion:     "happy",
					DurationMs:  res.DurationMs,
				})
			}
		}(remaining, int(seq))
	}

	wg.Wait()
	return nil
}

// ProcessUserInputDirectCloud はローカル推論を行わず、直接クラウドAPI（Gemini/OpenAI等）のストリーミングエンドポイントへリクエストして対話と音声合成を実行します。
func (p *DialoguePipeline) ProcessUserInputDirectCloud(
	ctx context.Context,
	apiKey string,
	baseURL string,
	model string,
	prompt string,
	onToken TokenCallback,
	onSpeak DispatchCallback,
) error {
	p.mutex.RLock()
	currentTTS := p.ttsProvider
	p.mutex.RUnlock()

	if baseURL == "" {
		baseURL = "https://api.openai.com/v1/chat/completions"
	}
	if model == "" {
		model = "gpt-4o-mini"
	}

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"stream":      true,
		"temperature": 0.7,
	}
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("クラウドAPIリクエストJSON作成失敗: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return fmt.Errorf("クラウドAPIリクエスト生成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := p.httpClient.Do(req)
	if err != nil || (resp != nil && resp.StatusCode >= 400) {
		status := 0
		if resp != nil {
			status = resp.StatusCode
			_ = resp.Body.Close()
		}
		infoText := fmt.Sprintf("クラウドAPI通信に失敗しました (ステータス: %d)。APIキーやネットワーク接続をご確認ください。", status)
		for _, r := range infoText {
			if onToken != nil {
				onToken(LLMTokenEvent{Token: string(r), IsFirst: false})
			}
		}
		res, synthErr := currentTTS.Synthesize(ctx, infoText, tts.TTSOptions{})
		if synthErr == nil && onSpeak != nil {
			onSpeak(AvatarSpeakEvent{
				SeqID:       1,
				IsLast:      true,
				Text:        infoText,
				AudioFormat: res.ContentType,
				AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
				Emotion:     "neutral",
				DurationMs:  res.DurationMs,
			})
		}
		return nil
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	isFirstToken := true
	var seqCounter int32 = 0
	splitter := NewSentenceSplitter()
	var wg sync.WaitGroup

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		dataStr := strings.TrimPrefix(line, "data: ")
		if dataStr == "[DONE]" {
			break
		}

		var dataObj struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(dataStr), &dataObj); err != nil {
			continue
		}

		var token string
		if len(dataObj.Choices) > 0 {
			token = dataObj.Choices[0].Delta.Content
		}

		if token != "" && onToken != nil {
			onToken(LLMTokenEvent{Token: token, IsFirst: isFirstToken})
			isFirstToken = false
		}

		sentences := splitter.Feed(token)
		for _, sent := range sentences {
			seq := atomic.AddInt32(&seqCounter, 1)
			wg.Add(1)
			go func(sText string, sSeq int) {
				defer wg.Done()
				res, err := currentTTS.Synthesize(ctx, sText, tts.TTSOptions{})
				if err == nil && onSpeak != nil {
					onSpeak(AvatarSpeakEvent{
						SeqID:       sSeq,
						IsLast:      false,
						Text:        sText,
						AudioFormat: res.ContentType,
						AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
						Emotion:     "neutral",
						DurationMs:  res.DurationMs,
					})
				}
			}(sent, int(seq))
		}
	}

	if remaining := splitter.Flush(); remaining != "" {
		seq := atomic.AddInt32(&seqCounter, 1)
		wg.Add(1)
		go func(sText string, sSeq int) {
			defer wg.Done()
			res, err := currentTTS.Synthesize(ctx, sText, tts.TTSOptions{})
			if err == nil && onSpeak != nil {
				onSpeak(AvatarSpeakEvent{
					SeqID:       sSeq,
					IsLast:      true,
					Text:        sText,
					AudioFormat: res.ContentType,
					AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
					Emotion:     "happy",
					DurationMs:  res.DurationMs,
				})
			}
		}(remaining, int(seq))
	}

	wg.Wait()
	return nil
}
