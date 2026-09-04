package websearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// TavilyClient はAIエージェント特化検索API（Tavily AI）と通信するクライアントです。
type TavilyClient struct {
	client *http.Client
}

// NewTavilyClient は新しいTavilyクライアントインスタンスを生成します。
func NewTavilyClient() *TavilyClient {
	return &TavilyClient{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Search はTavily AI APIを用いて高品質なWeb検索結果を取得します。
func (t *TavilyClient) Search(ctx context.Context, apiKey string, query string, maxResults int) ([]SearchResult, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("Tavily APIキーが設定されていません")
	}
	if maxResults <= 0 {
		maxResults = 3
	}

	reqBody := map[string]interface{}{
		"api_key":      apiKey,
		"query":        query,
		"search_depth": "basic",
		"max_results":  maxResults,
		"include_raw_content": false,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("リクエストJSON作成失敗: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.tavily.com/search", bytes.NewReader(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("リクエスト作成失敗: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Tavily通信エラー: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Tavilyがエラーステータスを返しました (HTTP %d)", resp.StatusCode)
	}

	var data struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("Tavilyレスポンス解析失敗: %w", err)
	}

	var list []SearchResult
	for _, item := range data.Results {
		list = append(list, SearchResult{
			Title:   item.Title,
			Snippet: item.Content,
			URL:     item.URL,
			Source:  "Tavily AI",
		})
	}

	return list, nil
}
