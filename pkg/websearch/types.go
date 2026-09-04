// Package websearch は階層型Web検索・情報解決（Level 0〜3）およびGemini風思考ログ機能を提供します。
package websearch

// ResolutionLevel はユーザー発話の解決レベル（Level 0〜4）を表します。
type ResolutionLevel int

const (
// Level0LLMOnly はツール不要の日常会話・雑談・LLM内部知識レベルです。
	Level0LLMOnly ResolutionLevel = 0
	// Level1FreeSearch は百科事典・用語定義・無料検索レベル（Wikipedia/DuckDuckGo）です。
	Level1FreeSearch ResolutionLevel = 1
	// Level2CloudAPI は高度な外部AI・API検索レベル（OpenAPI形式優先、またはTavily）です。
	Level2CloudAPI ResolutionLevel = 2
	// Level3Scraping は最終手段としての自前Web検索・スクレイピングレベル（DuckDuckGo+goquery）です。
	Level3Scraping ResolutionLevel = 3
)

// SearchConfig はWeb検索および外部APIの動作設定を保持する構造体です。
type SearchConfig struct {
	Enabled         bool   `json:"enabled"`         // Web情報解決機能の有効/無効
	TavilyAPIKey    string `json:"tavilyApiKey"`    // Tavily AI APIキー
	CloudAPIKey     string `json:"cloudApiKey"`     // OpenAI互換 / Google Gemini APIキー
	CloudAPIBaseURL string `json:"cloudApiBaseUrl"` // API Base URL (例: https://api.openai.com/v1)
	CloudAPIModel   string `json:"cloudApiModel"`   // 使用モデル名 (例: gpt-4o-mini, gemini-2.0-flash)
	ClassifierMode  string `json:"classifierMode"`  // レベル判定方式 ("regex": 高速正規表現, "llm": 超小型LLM推論)
	ClassifierModel string `json:"classifierModel"` // 判定に使用する超小型モデル名 (例: qwen2.5-0.5b-instruct-q4_k_m.gguf)
}

// SearchResult は検索で得られた1件の情報を表します。
type SearchResult struct {
	Title   string `json:"title"`   // タイトル
	Snippet string `json:"snippet"` // 要約・スニペット文
	URL     string `json:"url"`     // ソースURL
	Source  string `json:"source"`  // 提供元 (Wikipedia, Open-Meteo, Tavily, WebScraper 等)
}

// SearchIntent は発話解析による解決方針を表します。
type SearchIntent struct {
	Level       ResolutionLevel `json:"level"`       // 判定された情報レベル
	Query       string          `json:"query"`       // 最適化された検索クエリ
	Reason      string          `json:"reason"`      // 判定理由
	FillerReply string          `json:"fillerReply"` // 先行相槌テキスト
}

// ActionTraceLogger はGemini風の思考・アクションログを段階的に送出する関数型です。
type ActionTraceLogger func(stage string, message string)
