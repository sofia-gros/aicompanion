package websearch

import (
	"testing"
)

// TestDetermineLevel は階層ルーターの各レベル判定ロジックをテストします。
func TestDetermineLevel(t *testing.T) {
	router := NewRouter()

	tests := []struct {
		input string
		level ResolutionLevel
	}{
		{"おはようございます！", Level0LLMOnly},
		{"今日の東京の天気は？", Level1FreeSearch},
		{"明日は雨降るかな？", Level1FreeSearch},
		{"量子コンピュータって何？", Level1FreeSearch},
		{"夏目漱石とは誰？", Level1FreeSearch},
		{"今日の最新AIニュースを教えて！", Level2CloudAPI},
		{"最新のゲーム発表について検索して", Level2CloudAPI},
		{"このURLのページ読んでスクレイピングして", Level3Scraping},
	}

	for _, tt := range tests {
		intent := router.DetermineLevel(tt.input)
		if intent.Level != tt.level {
			t.Errorf("入力 '%s' のレベル期待値 %d, 実際 %d (理由: %s)", tt.input, tt.level, intent.Level, intent.Reason)
		}
	}
}
