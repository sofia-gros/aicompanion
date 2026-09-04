package websearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CloudLLMClient はOpenAI互換API（OpenAI, Google Gemini, Groq等）と通信するクライアントです。
type CloudLLMClient struct {
	client *http.Client
}

// NewCloudLLMClient は新しいクラウドLLMクライアントインスタンスを生成します。
func NewCloudLLMClient() *CloudLLMClient {
	return &CloudLLMClient{
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// Query はクラウドLLMに問い合わせを行い、得られた回答テキストを返します。
func (c *CloudLLMClient) Query(ctx context.Context, apiKey string, baseURL string, model string, prompt string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("クラウドAPIキーが設定されていません")
	}

	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	if model == "" {
		model = "gpt-4o-mini"
	}

	endpoint := baseURL + "/chat/completions"

	reqBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"temperature": 0.7,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("リクエストJSON作成失敗: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("HTTPリクエスト作成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("クラウドAPI通信エラー: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("クラウドAPIがエラーステータスを返しました (HTTP %d)", resp.StatusCode)
	}

	var data struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", fmt.Errorf("クラウドAPIレスポンス解析失敗: %w", err)
	}

	if len(data.Choices) == 0 {
		return "", fmt.Errorf("クラウドAPIの応答候補が空でした")
	}

	return strings.TrimSpace(data.Choices[0].Message.Content), nil
}
