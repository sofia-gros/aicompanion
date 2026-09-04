package pipeline

import (
	"testing"
)

// TestSentenceSplitter は句分割バッファの句読点検出と強制分割を検証します。
func TestSentenceSplitter(t *testing.T) {
	splitter := NewSentenceSplitter()

	// 1. 句読点による分割テスト
	tokens := []string{"こん", "にちは", "！", "今日も", "いい", "天気", "だね", "。"}
	var results []string
	for _, tok := range tokens {
		sentences := splitter.Feed(tok)
		results = append(results, sentences...)
	}

	if len(results) != 2 {
		t.Fatalf("期待される文数 2 に対して実際は %d: %v", len(results), results)
	}
	if results[0] != "こんにちは！" {
		t.Errorf("1文目の不一致: %s", results[0])
	}
	if results[1] != "今日もいい天気だね。" {
		t.Errorf("2文目の不一致: %s", results[1])
	}

	// 2. 残存フラッシュテスト
	splitter.Feed("まだ終わってない")
	flushed := splitter.Flush()
	if flushed != "まだ終わってない" {
		t.Errorf("フラッシュ結果の不一致: %s", flushed)
	}
}
