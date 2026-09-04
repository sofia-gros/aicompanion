package websearch

import (
	"math/rand"
	"strings"
)

// Analyzer はユーザー発言から検索クエリを生成・整形し、先行相槌を管理する補助エンジンです。
type Analyzer struct {
	fillerReplies []string
}

// NewAnalyzer は補助エンジンの新しいインスタンスを生成します。
func NewAnalyzer() *Analyzer {
	return &Analyzer{
		fillerReplies: []string{
			"ちょっと調べてみるね！",
			"ネットで最新情報を確認してみるよ〜！",
			"気になったから検索してみるね、少し待ってて！",
			"最新の情報をチェック中だよ！",
		},
	}
}

// GetRandomFiller はランダムな先行相槌メッセージを返します。
func (a *Analyzer) GetRandomFiller() string {
	return a.fillerReplies[rand.Intn(len(a.fillerReplies))]
}

// extractSearchQuery はユーザー発言から検索エンジンに適したキーワードを抽出・整形します。
func (a *Analyzer) extractSearchQuery(text string) string {
	// 余分な依頼語や末尾フレーズの除去
	cleaned := text
	removePhrases := []string{
		"について教えて", "を教えて", "教えて", "って何？", "って何", "とは？", "とは",
		"を調べて", "調べて", "検索して", "知ってる？", "知ってる", "ください", "お願い",
	}
	for _, p := range removePhrases {
		cleaned = strings.ReplaceAll(cleaned, p, "")
	}

	// 記号除去
	cleaned = strings.ReplaceAll(cleaned, "？", " ")
	cleaned = strings.ReplaceAll(cleaned, "?", " ")
	cleaned = strings.ReplaceAll(cleaned, "！", " ")
	cleaned = strings.ReplaceAll(cleaned, "!", " ")
	cleaned = strings.ReplaceAll(cleaned, "、", " ")
	cleaned = strings.TrimSpace(cleaned)

	// 空になった場合は元の発言を利用
	if cleaned == "" {
		cleaned = text
	}

	return cleaned
}
