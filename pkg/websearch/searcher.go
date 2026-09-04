package websearch

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Searcher は外部検索エンジンからリアルタイムWeb検索を実行する構造体です。
type Searcher struct {
	client    *http.Client
	userAgent string
}

// NewSearcher は新しい検索実行インスタンスを生成します。
func NewSearcher() *Searcher {
	return &Searcher{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}
}

// Search は指定されたクエリでDuckDuckGo HTML検索を実行し、上位の検索結果リストを返します。
func (s *Searcher) Search(ctx context.Context, query string, maxResults int) ([]SearchResult, error) {
	if maxResults <= 0 {
		maxResults = 3
	}

	// DuckDuckGo HTML検索エンドポイント
	endpoint := "https://html.duckduckgo.com/html/"
	formData := url.Values{}
	formData.Set("q", query)
	formData.Set("kl", "jp-jp") // 日本語優先

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, fmt.Errorf("検索リクエストの作成に失敗しました: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("Accept-Language", "ja,en-US;q=0.9,en;q=0.8")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("検索通信に失敗しました: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("検索サーバーがエラーを返しました (HTTP %d)", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("検索結果HTMLの解析に失敗しました: %w", err)
	}

	var results []SearchResult

	// DuckDuckGo HTML の検索結果要素を抽出
	doc.Find(".result").Each(func(i int, sel *goquery.Selection) {
		if len(results) >= maxResults {
			return
		}

		// タイトルとリンク
		titleSel := sel.Find(".result__title .result__a")
		title := strings.TrimSpace(titleSel.Text())
		rawHref, exists := titleSel.Attr("href")

		// スニペット（概要文）
		snippetSel := sel.Find(".result__snippet")
		snippet := strings.TrimSpace(snippetSel.Text())

		if !exists || title == "" || snippet == "" {
			return
		}

		// DuckDuckGoのリダイレクトURL (/l/?uddg=...) をデコード
		targetURL := s.cleanURL(rawHref)

		results = append(results, SearchResult{
			Title:   title,
			Snippet: snippet,
			URL:     targetURL,
		})
	})

	return results, nil
}

// cleanURL はDuckDuckGoのリダイレクトURLから実際の実体URLを復元します。
func (s *Searcher) cleanURL(rawHref string) string {
	if strings.Contains(rawHref, "uddg=") {
		u, err := url.Parse(rawHref)
		if err == nil {
			realURL := u.Query().Get("uddg")
			if realURL != "" {
				return realURL
			}
		}
	}
	return rawHref
}
