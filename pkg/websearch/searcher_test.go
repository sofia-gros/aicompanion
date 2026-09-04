package websearch

import (
	"context"
	"testing"
	"time"
)

// TestSearchLive はDuckDuckGo HTML検索の実通信をテストします。
func TestSearchLive(t *testing.T) {
	searcher := NewSearcher()
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	results, err := searcher.Search(ctx, "Golang", 2)
	if err != nil {
		t.Logf("外部通信スキップまたは一時エラー: %v", err)
		return
	}

	if len(results) == 0 {
		t.Log("検索結果が0件でした（ネットワーク環境またはレート制限）")
		return
	}

	t.Logf("取得件数: %d件, 1件目タイトル: %s, URL: %s", len(results), results[0].Title, results[0].URL)
}
