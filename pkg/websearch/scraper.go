package websearch

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Scraper は指定されたWebページのHTMLを取得し、本文テキストを抽出・クリーニングする構造体です。
type Scraper struct {
	client    *http.Client
	userAgent string
}

// NewScraper は新しいWebスクレイパーインスタンスを初期化します。
func NewScraper() *Scraper {
	return &Scraper{
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	}
}

// FetchAndExtract は指定URLのページを取得し、広告や不要タグを除去した本文テキストを抽出します。
func (s *Scraper) FetchAndExtract(ctx context.Context, targetURL string, maxChars int) (string, error) {
	if maxChars <= 0 {
		maxChars = 600
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return "", fmt.Errorf("リクエスト作成失敗: %w", err)
	}
	req.Header.Set("User-Agent", s.userAgent)
	req.Header.Set("Accept-Language", "ja,en;q=0.9")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ページ取得通信失敗: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ステータスコードエラー (HTTP %d)", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return "", fmt.Errorf("HTML解析失敗: %w", err)
	}

	// 1. ノイズ要素（スクリプト、スタイル、ナビゲーション、フッター等）を完全削除
	doc.Find("script, style, noscript, nav, header, footer, svg, iframe, form, aside").Remove()

	// 2. 本文候補の親要素を探索 (article, main, または body)
	var bodyText string
	article := doc.Find("article, main, .content, #content, .post-content")
	if article.Length() > 0 {
		bodyText = article.First().Text()
	} else {
		bodyText = doc.Find("body").Text()
	}

	// 3. 空白や改行の正規化
	spaceRegex := regexp.MustCompile(`[\t\r\n]+`)
	cleaned := spaceRegex.ReplaceAllString(bodyText, " ")
	multiSpaceRegex := regexp.MustCompile(` {2,}`)
	cleaned = multiSpaceRegex.ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)

	// 4. 文字数制限
	runes := []rune(cleaned)
	if len(runes) > maxChars {
		cleaned = string(runes[:maxChars]) + "..."
	}

	return cleaned, nil
}
