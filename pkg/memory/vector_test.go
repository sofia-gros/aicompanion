package memory

import (
	"math"
	"testing"
)

// TestCosineSimilarity はコサイン類似度計算の精度とエッジケースを検証します。
func TestCosineSimilarity(t *testing.T) {
	// 同一ベクトル（類似度 1.0）
	v1 := []float32{1.0, 2.0, 3.0}
	v2 := []float32{1.0, 2.0, 3.0}
	sim := CosineSimilarity(v1, v2)
	if math.Abs(float64(sim-1.0)) > 1e-5 {
		t.Errorf("同一ベクトルの類似度が1.0ではありません: %f", sim)
	}

	// 直交ベクトル（類似度 0.0）
	v3 := []float32{1.0, 0.0}
	v4 := []float32{0.0, 1.0}
	simOrthogonal := CosineSimilarity(v3, v4)
	if math.Abs(float64(simOrthogonal)) > 1e-5 {
		t.Errorf("直交ベクトルの類似度が0.0ではありません: %f", simOrthogonal)
	}

	// 空ベクトル（エラーハンドリング 0.0）
	if simEmpty := CosineSimilarity(nil, nil); simEmpty != 0.0 {
		t.Errorf("空ベクトルの結果が0.0ではありません: %f", simEmpty)
	}
}
