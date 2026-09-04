package websearch

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// Router はユーザー発話の解決レベル（Level 0〜3）を判定し、最適なエンジンへ振り分ける階層型情報ルーターです。
type Router struct {
	analyzer  *Analyzer
	wikipedia *WikipediaClient
	weather   *WeatherClient
	tavily    *TavilyClient
	cloudLLM  *CloudLLMClient
	searcher  *Searcher
	scraper   *Scraper
}

// NewRouter は新しい階層型情報ルーターインスタンスを初期化します。
func NewRouter() *Router {
	return &Router{
		analyzer:  NewAnalyzer(),
		wikipedia: NewWikipediaClient(),
		weather:   NewWeatherClient(),
		tavily:    NewTavilyClient(),
		cloudLLM:  NewCloudLLMClient(),
		searcher:  NewSearcher(),
		scraper:   NewScraper(),
	}
}

// DetermineLevel はユーザー入力から情報解決レベル（Level 0〜3）と検索クエリを判定します。
func (r *Router) DetermineLevel(userInput string) SearchIntent {
	trimmed := strings.TrimSpace(userInput)

	// 1. 日常会話・挨拶（Level 0: LLMのみ）の判定
	greetings := []string{"こんにちは", "おはよう", "こんばんは", "おやすみ", "ありがとう", "疲れた", "元気", "かわいい", "好き", "やあ", "バイバイ"}
	for _, g := range greetings {
		if strings.HasPrefix(trimmed, g) && len(trimmed) <= len(g)+6 {
			return SearchIntent{
				Level:  Level0LLMOnly,
				Reason: "日常の挨拶・感情表現",
			}
		}
	}

	// 2. 用語定義・確定事実・天気（Level 1: WikiやDuckDuckGo）判定
	weatherRegex := regexp.MustCompile(`(天気|気温|降水確率|雨降る|傘いる|台風)`)
	if weatherRegex.MatchString(trimmed) {
		query := r.analyzer.extractSearchQuery(trimmed)
		return SearchIntent{
			Level:       Level1FreeSearch,
			Query:       query,
			Reason:      "気象・天気データ（無料・キー不要）",
			FillerReply: "お天気情報を確認してみるね！少し待っててね！",
		}
	}

	factRegex := regexp.MustCompile(`(って何|とは|について教えて|歴史|誰|何者|作者|仕組み|原理)`)
	if factRegex.MatchString(trimmed) && !regexp.MustCompile(`(最新|今日|現在|今週|最近|ニュース|速報)`).MatchString(trimmed) {
		query := r.analyzer.extractSearchQuery(trimmed)
		return SearchIntent{
			Level:       Level1FreeSearch,
			Query:       query,
			Reason:      "確定事実・用語定義（Wikipedia/DuckDuckGo）",
			FillerReply: "ちょっと調べてみるね！",
		}
	}

	// 3. 最新時事・ニュース速報・Web検索要求（Level 2: OpenAPI / Tavily）判定
	newsRegex := regexp.MustCompile(`(最新|今日|現在|今週|最近|ニュース|速報|話題|トレンド|発表|出来事|調べて|検索して)`)
	if newsRegex.MatchString(trimmed) {
		query := r.analyzer.extractSearchQuery(trimmed)
		return SearchIntent{
			Level:       Level2CloudAPI,
			Query:       query,
			Reason:      "リアルタイム時事・外部検索要求",
			FillerReply: "最新の情報をネットで検索してみるよ〜！",
		}
	}

	// 4. 明示的なスクレイピング・Webサイト解析要求（Level 3: スクレイピング）判定
	scrapeRegex := regexp.MustCompile(`(スクレイピング|ページ読んで|サイト見て|URL)`)
	if scrapeRegex.MatchString(trimmed) {
		query := r.analyzer.extractSearchQuery(trimmed)
		return SearchIntent{
			Level:       Level3Scraping,
			Query:       query,
			Reason:      "Webページ解析・スクレイピング要求",
			FillerReply: "対象のページを直接確認してみるね！",
		}
	}

	return SearchIntent{
		Level:  Level0LLMOnly,
		Reason: "内部知識で対応可能な日常会話",
	}
}

// Dispatch は判定されたレベルと設定に応じて適切な情報取得を実行し、Gemini風の思考ログを段階的に送出します。
func (r *Router) Dispatch(
	ctx context.Context,
	cfg SearchConfig,
	userInput string,
	logger ActionTraceLogger,
) (*SearchResult, error) {
	if logger == nil {
		logger = func(stage string, msg string) {}
	}

	if !cfg.Enabled {
		logger("思考", "Web検索機能が無効に設定されているため、ローカル知識のみで対応します")
		return nil, nil
	}

	logger("思考", fmt.Sprintf("ユーザー発話を解析中... \"%s\"", userInput))
	intent := r.DetermineLevel(userInput)

	switch intent.Level {
	case Level0LLMOnly:
		logger("判定", fmt.Sprintf("レベル判定: Level 0 (LLMのみ) - 理由: %s", intent.Reason))
		return nil, nil

	case Level1FreeSearch:
		logger("判定", fmt.Sprintf("レベル判定: Level 1 (WikiやDuckDuckGo) - 理由: %s", intent.Reason))

		// 天気キーワードが含まれる場合は Open-Meteo を優先
		weatherRegex := regexp.MustCompile(`(天気|気温|降水確率|雨降る|傘いる|台風)`)
		if weatherRegex.MatchString(userInput) {
			logger("実行", fmt.Sprintf("気象APIで最新データを取得中: \"%s\"", intent.Query))
			res, err := r.weather.FetchWeather(ctx, intent.Query)
			if err == nil && res != nil {
				logger("取得", fmt.Sprintf("気象データ取得完了: %s", res.Snippet))
				return res, nil
			}
		}

		// Wikipedia で検索
		logger("実行", fmt.Sprintf("Wikipedia で用語を検索中: \"%s\"", intent.Query))
		wikiRes, err := r.wikipedia.FetchExtract(ctx, intent.Query)
		if err == nil && wikiRes != nil {
			logger("取得", fmt.Sprintf("Wikipedia から要約を取得完了 (タイトル: %s)", wikiRes.Title))
			return wikiRes, nil
		}

		// Wikipediaに該当がない場合は DuckDuckGo 簡易検索
		logger("実行", fmt.Sprintf("Wikipedia未検出のため DuckDuckGo で無料検索中: \"%s\"", intent.Query))
		ddgResults, ddgErr := r.searcher.Search(ctx, intent.Query, 2)
		if ddgErr == nil && len(ddgResults) > 0 {
			logger("取得", fmt.Sprintf("DuckDuckGo からスニペットを取得完了 (%s)", ddgResults[0].Title))
			return &SearchResult{
				Title:   ddgResults[0].Title,
				Snippet: ddgResults[0].Snippet,
				URL:     ddgResults[0].URL,
				Source:  "DuckDuckGo",
			}, nil
		}

		logger("通知", "無料検索で情報が見つかりませんでした。LLM内部知識で回答します")
		return nil, nil

	case Level2CloudAPI:
		logger("判定", fmt.Sprintf("レベル判定: Level 2 (外部API検索) - 理由: %s", intent.Reason))

		// 優先1: OpenAPI形式の外部APIキーが設定されている場合はそれを使用
		if cfg.CloudAPIKey != "" {
			logger("実行", fmt.Sprintf("OpenAPI形式クラウドAPIに問い合わせ中 (モデル: %s)", cfg.CloudAPIModel))
			answer, err := r.cloudLLM.Query(ctx, cfg.CloudAPIKey, cfg.CloudAPIBaseURL, cfg.CloudAPIModel, userInput)
			if err == nil && answer != "" {
				logger("取得", "OpenAPI形式クラウドAPIから最新知見の取得完了")
				return &SearchResult{
					Title:   "クラウドAI応答",
					Snippet: answer,
					URL:     cfg.CloudAPIBaseURL,
					Source:  "OpenAPI Cloud AI",
				}, nil
			}
			logger("警告", fmt.Sprintf("OpenAPIクラウドAPI照会エラー: %v", err))
		}

		// 優先2: OpenAPIキーがない、またはTavilyキーがある場合は Tavily AI を使用
		if cfg.TavilyAPIKey != "" {
			logger("実行", fmt.Sprintf("Tavily AI で高品質Web検索を実行中: \"%s\"", intent.Query))
			results, err := r.tavily.Search(ctx, cfg.TavilyAPIKey, intent.Query, 3)
			if err == nil && len(results) > 0 {
				logger("取得", fmt.Sprintf("Tavily から %d 件のWebスニペットを取得完了", len(results)))
				var combined strings.Builder
				for i, item := range results {
					combined.WriteString(fmt.Sprintf("[%d] %s: %s\n", i+1, item.Title, item.Snippet))
				}
				return &SearchResult{
					Title:   results[0].Title,
					Snippet: combined.String(),
					URL:     results[0].URL,
					Source:  "Tavily AI",
				}, nil
			}
			logger("警告", fmt.Sprintf("Tavily検索エラー: %v", err))
		}

		// APIキーが一切未登録、または両方失敗した場合は Level 3 (最終手段、スクレイピング) へフォールバック
		logger("判定", "外部APIキー未設定またはエラーのため、Level 3 (最終手段: スクレイピング) へ自動移行します")
		return r.fallbackScrape(ctx, intent.Query, logger)

	case Level3Scraping:
		logger("判定", fmt.Sprintf("レベル判定: Level 3 (最終手段、スクレイピング) - 理由: %s", intent.Reason))
		return r.fallbackScrape(ctx, intent.Query, logger)

	default:
		return nil, nil
	}
}

// fallbackScrape はAPIキー未登録時や失敗時の最終手段としてDuckDuckGo検索とgoqueryスクレイピングを実行します。
func (r *Router) fallbackScrape(ctx context.Context, query string, logger ActionTraceLogger) (*SearchResult, error) {
	logger("実行", fmt.Sprintf("DuckDuckGo HTML で検索実行中: \"%s\"", query))
	results, err := r.searcher.Search(ctx, query, 3)
	if err != nil || len(results) == 0 {
		logger("警告", fmt.Sprintf("自前Web検索で結果を取得できませんでした: %v", err))
		return nil, err
	}

	logger("取得", fmt.Sprintf("DuckDuckGo から %d 件の検索候補を取得。1件目のページ本文をスクレイピング中...", len(results)))
	top := results[0]
	content, scrapeErr := r.scraper.FetchAndExtract(ctx, top.URL, 500)
	snippet := top.Snippet
	if scrapeErr == nil && content != "" {
		snippet = content
		logger("解析", fmt.Sprintf("本文テキスト抽出完了 (文字数: %d文字)", len(content)))
	}

	return &SearchResult{
		Title:   top.Title,
		Snippet: snippet,
		URL:     top.URL,
		Source:  "WebScraper (DuckDuckGo + goquery)",
	}, nil
}
