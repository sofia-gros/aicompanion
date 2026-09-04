package pipeline

import (
	"strings"
	"unicode/utf8"
)

// SentenceSplitter はトークンストリームから句単位の文字列をリアルタイムに切り出すバッファです。
type SentenceSplitter struct {
	buffer      strings.Builder
	delimiters  string
	maxChunkLen int
}

// NewSentenceSplitter は句分割バッファを生成します。
func NewSentenceSplitter() *SentenceSplitter {
	return &SentenceSplitter{
		delimiters:  "。！？!?\n",
		maxChunkLen: 45, // 45文字超過でTTS遅延防止のため強制分割
	}
}

// Feed は受信トークンをバッファに追加し、完成した句があればスライスで返します。
func (s *SentenceSplitter) Feed(token string) []string {
	var completed []string
	for _, r := range token {
		s.buffer.WriteRune(r)
		// 区切り文字検知または最大長到達で文確定
		if strings.ContainsRune(s.delimiters, r) || utf8.RuneCountInString(s.buffer.String()) >= s.maxChunkLen {
			text := strings.TrimSpace(s.buffer.String())
			if utf8.RuneCountInString(text) > 0 {
				completed = append(completed, text)
			}
			s.buffer.Reset()
		}
	}
	return completed
}

// Flush はストリーム終了時にバッファに残っている未送信テキストを排出します。
func (s *SentenceSplitter) Flush() string {
	text := strings.TrimSpace(s.buffer.String())
	s.buffer.Reset()
	return text
}
