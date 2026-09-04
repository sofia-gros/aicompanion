package websearch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// WikipediaClient はWikipedia日本語版APIと通信し、用語・人物・確定事実の要約を取得するクライアントです。
type WikipediaClient struct {
	client *http.Client
}

// NewWikipediaClient は新しいWikipediaクライアントインスタンスを生成します。
func NewWikipediaClient() *WikipediaClient {
	return &WikipediaClient{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// FetchExtract は指定されたタイトルのWikipedia記事から導入部要約テキストを取得します。
func (w *WikipediaClient) FetchExtract(ctx context.Context, title string) (*SearchResult, error) {
	endpoint := fmt.Sprintf(
		"https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=%s&format=json&redirects=1",
		url.QueryEscape(title),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("Wikipediaリクエスト作成失敗: %w", err)
	}
	req.Header.Set("User-Agent", "AICompanion/1.0 (Desktop AI Companion Bot)")

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Wikipedia通信エラー: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Wikipediaがエラーステータスを返しました (HTTP %d)", resp.StatusCode)
	}

	var data struct {
		Query struct {
			Pages map[string]struct {
				PageID  int    `json:"pageid"`
				Title   string `json:"title"`
				Extract string `json:"extract"`
			} `json:"pages"`
		} `json:"query"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("Wikipediaレスポンス解析失敗: %w", err)
	}

	for pageID, page := range data.Query.Pages {
		if pageID == "-1" || page.Extract == "" {
			continue
		}

		extract := strings.TrimSpace(page.Extract)
		// 最大400文字にトリム
		runes := []rune(extract)
		if len(runes) > 400 {
			extract = string(runes[:400]) + "..."
		}

		pageURL := fmt.Sprintf("https://ja.wikipedia.org/wiki/%s", url.PathEscape(page.Title))

		return &SearchResult{
			Title:   page.Title + " (Wikipedia)",
			Snippet: extract,
			URL:     pageURL,
			Source:  "Wikipedia",
		}, nil
	}

	return nil, fmt.Errorf("該当するWikipedia記事が見つかりませんでした: %s", title)
}
