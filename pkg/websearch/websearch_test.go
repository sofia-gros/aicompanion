package websearch

import (
	"testing"
)

// TestExtractSearchQuery は検索クエリ整形処理をテストします。
func TestExtractSearchQuery(t *testing.T) {
	analyzer := NewAnalyzer()

	q := analyzer.extractSearchQuery("最新の日本の総理大臣について教えて！")
	if q == "" || q == "最新の日本の総理大臣について教えて！" {
		t.Errorf("クエリ整形失敗: '%s'", q)
	}

	filler := analyzer.GetRandomFiller()
	if filler == "" {
		t.Error("先行相槌の取得に失敗しました")
	}
}
