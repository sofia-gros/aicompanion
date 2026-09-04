package memory

import "time"

// ConversationLog は短期記憶用の対話レコードです。
type ConversationLog struct {
	ID        int64     `json:"id"`
	SessionID string    `json:"sessionId"`
	Role      string    `json:"role"` // "user" または "assistant"
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// LongTermMemory は長期記憶用の要約・埋め込みレコードです。
type LongTermMemory struct {
	ID        int64     `json:"id"`
	Summary   string    `json:"summary"`
	Embedding []float32 `json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}
