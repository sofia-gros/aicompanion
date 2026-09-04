package pipeline

// AvatarSpeakEvent はフロントエンドおよびOBSへ配信する発話音声ペイロードです。
type AvatarSpeakEvent struct {
	SeqID       int    `json:"seqId"`
	IsLast      bool   `json:"isLast"`
	Text        string `json:"text"`
	AudioFormat string `json:"audioFormat"`
	AudioBase64 string `json:"audioBase64"`
	Emotion     string `json:"emotion"`
	DurationMs  int64  `json:"durationMs"`
}

// LLMTokenEvent はリアルタイム字幕表示用のトークンイベントです。
type LLMTokenEvent struct {
	Token   string `json:"token"`
	IsFirst bool   `json:"isFirst"`
}

// SystemStatusEvent はバックエンドの初期化・稼働状態を伝えるイベントです。
type SystemStatusEvent struct {
	LLMReady   bool   `json:"llmReady"`
	TTSReady   bool   `json:"ttsReady"`
	ActiveTTS  string `json:"activeTTS"`
	ActiveTier string `json:"activeTier"`
}
