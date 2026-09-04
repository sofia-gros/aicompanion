package memory

import (
	"crypto/sha256"
	"fmt"
	"math"
	"strings"
	"sync"
)

// MemoryWorker は会話ログから長期記憶を定期的に要約・ベクトル化して保存するバックグラウンドワーカーです。
type MemoryWorker struct {
	store      *Store
	turnCount  int
	turnThreshold int
	mutex      sync.Mutex
}

// NewMemoryWorker は新しい記憶ワーカーを初期化します。
func NewMemoryWorker(store *Store) *MemoryWorker {
	return &MemoryWorker{
		store:         store,
		turnThreshold: 5, // 5ターンごとに長期記憶要約を実行
	}
}

// RecordTurn は会話ターン数をカウントし、閾値に達したら長期記憶化を実行します。
func (w *MemoryWorker) RecordTurn(userText, replyText string) {
	w.mutex.Lock()
	w.turnCount++
	count := w.turnCount
	w.mutex.Unlock()

	if count%w.turnThreshold == 0 {
		go w.ConsolidateMemories()
	}
}

// GenerateSimpleEmbedding はテキストから固定長（128次元）の特徴ベクトルを決定論的に生成します。
func GenerateSimpleEmbedding(text string) []float32 {
	dim := 128
	vec := make([]float32, dim)

	words := strings.Fields(text)
	for _, word := range words {
		hash := sha256.Sum256([]byte(word))
		for i := 0; i < dim; i++ {
			byteVal := float32(hash[i%32])
			vec[i] += byteVal / 255.0
		}
	}

	// L2正規化
	var norm float32
	for _, v := range vec {
		norm += v * v
	}
	if norm > 0 {
		sqrtNorm := float32(math.Sqrt(float64(norm)))
		for i := range vec {
			vec[i] /= sqrtNorm
		}
	}

	return vec
}

// ConsolidateMemories は直近の会話ログから要約を作成し、長期記憶DBへ格納します。
func (w *MemoryWorker) ConsolidateMemories() {
	logs, err := w.store.GetRecentLogs(10)
	if err != nil || len(logs) == 0 {
		return
	}

	var sb strings.Builder
	for _, l := range logs {
		sb.WriteString(fmt.Sprintf("%s: %s\n", l[0], l[1]))
	}

	// 簡易要約（直近の対話ダイジェスト）
	summary := fmt.Sprintf("ユーザーとの直近の対話記録: %s", logs[len(logs)-1][1])
	vec := GenerateSimpleEmbedding(sb.String())

	_ = w.store.AddLongTermMemory(summary, vec)
}
