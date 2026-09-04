// Package llm はLLMのスペック別Tier管理およびFew-Shotプロンプト生成を提供します。
package llm

// LLMTier はPCスペックに応じた推奨モデルティアを表す型です。
type LLMTier string

const (
	// Tier0_5B はRAM 8GB以下・超軽量環境向けの 0.5B モデルです。
	Tier0_5B LLMTier = "tier0_5b"
	// Tier1_5B はRAM 8GB環境向けの推奨 1.5B モデルです。
	Tier1_5B LLMTier = "tier1_5b"
	// Tier3B はミドルレンジPC（VRAM 4GB+）向けの 3B モデルです。
	Tier3B LLMTier = "tier3b"
	// Tier7B はハイスペックPC（VRAM 8GB+）向けの標準 7B モデルです。
	Tier7B LLMTier = "tier7b"
	// TierCloud は外部API（Groq, Gemini等）を利用するティアです。
	TierCloud LLMTier = "cloud"
)

// TierConfig は各ティアの推論パラメータおよびモデルファイル名です。
type TierConfig struct {
	Tier        LLMTier `json:"tier"`
	ModelName   string  `json:"modelName"`
	FileName    string  `json:"fileName"`
	ContextSize int     `json:"contextSize"`
	GPULayers   int     `json:"gpuLayers"`
	DownloadURL string  `json:"downloadUrl"`
}

// TierManager はPCスペック別モデル設定を管理します。
type TierManager struct {
	currentTier LLMTier
	configs     map[LLMTier]TierConfig
}

// NewTierManager はティアマネージャーを初期化します（デフォルトは8GB PC向け 1.5B）。
func NewTierManager() *TierManager {
	configs := map[LLMTier]TierConfig{
		Tier0_5B: {
			Tier:        Tier0_5B,
			ModelName:   "Qwen2.5-0.5B-Instruct (Q4_K_M)",
			FileName:    "qwen2.5-0.5b-instruct-q4_k_m.gguf",
			ContextSize: 4096,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
		},
		Tier1_5B: {
			Tier:        Tier1_5B,
			ModelName:   "Qwen2.5-1.5B-Instruct (Q4_K_M)",
			FileName:    "qwen2.5-1.5b-instruct-q4_k_m.gguf",
			ContextSize: 4096,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
		},
		Tier3B: {
			Tier:        Tier3B,
			ModelName:   "Qwen2.5-3B-Instruct (Q4_K_M)",
			FileName:    "qwen2.5-3b-instruct-q4_k_m.gguf",
			ContextSize: 8192,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
		},
		Tier7B: {
			Tier:        Tier7B,
			ModelName:   "Qwen2.5-7B-Instruct (Q4_K_M)",
			FileName:    "qwen2.5-7b-instruct-q4_k_m.gguf",
			ContextSize: 8192,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
		},
		"gemma2_2b_q4": {
			Tier:        "gemma2_2b_q4",
			ModelName:   "Gemma-2-2B-IT (Q4_K_M)",
			FileName:    "gemma-2-2b-it-q4_k_m.gguf",
			ContextSize: 4096,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
		},
		"gemma2_2b_q8": {
			Tier:        "gemma2_2b_q8",
			ModelName:   "Gemma-2-2B-IT (Q8_0)",
			FileName:    "gemma-2-2b-it-q8_0.gguf",
			ContextSize: 4096,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q8_0.gguf",
		},
		"llama3_2_1b": {
			Tier:        "llama3_2_1b",
			ModelName:   "Llama-3.2-1B-Instruct (Q4_K_M)",
			FileName:    "llama-3.2-1b-instruct-q4_k_m.gguf",
			ContextSize: 4096,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
		},
		"llama3_2_3b": {
			Tier:        "llama3_2_3b",
			ModelName:   "Llama-3.2-3B-Instruct (Q4_K_M)",
			FileName:    "llama-3.2-3b-instruct-q4_k_m.gguf",
			ContextSize: 8192,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
		},
		"phi3_5_mini": {
			Tier:        "phi3_5_mini",
			ModelName:   "Phi-3.5-mini-3.8B-Instruct (Q4_K_M)",
			FileName:    "phi-3.5-mini-instruct-q4_k_m.gguf",
			ContextSize: 8192,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
		},
		"gemma2_9b_q4": {
			Tier:        "gemma2_9b_q4",
			ModelName:   "Gemma-2-9B-IT (Q4_K_M)",
			FileName:    "gemma-2-9b-it-q4_k_m.gguf",
			ContextSize: 8192,
			GPULayers:   99,
			DownloadURL: "https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf",
		},
		TierCloud: {
			Tier:        TierCloud,
			ModelName:   "Cloud API (Groq / Gemini)",
			FileName:    "",
			ContextSize: 8192,
			GPULayers:   0,
		},
	}

	return &TierManager{
		currentTier: Tier1_5B, // 8GB環境推奨デフォルト
		configs:     configs,
	}
}

// GetCurrentConfig は現在選択されているティアの設定を取得します。
func (m *TierManager) GetCurrentConfig() TierConfig {
	return m.configs[m.currentTier]
}

// SetTier はアクティブなティアを変更します。
func (m *TierManager) SetTier(tier LLMTier) {
	if _, ok := m.configs[tier]; ok {
		m.currentTier = tier
	}
}

// GetAllConfigs は全ティアの設定リストを返します。
func (m *TierManager) GetAllConfigs() []TierConfig {
	list := make([]TierConfig, 0, len(m.configs))
	for _, c := range m.configs {
		list = append(list, c)
	}
	return list
}
