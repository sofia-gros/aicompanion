package llm

import (
	"fmt"
	"strings"
	"sync"
)

// CharacterProfile はAIキャラクターの性格、口調ルール、一人称/二人称、対話例を定義する構造体です。
type CharacterProfile struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Personality  string      `json:"personality"`
	ToneRule     string      `json:"toneRule"`
	FirstPerson  string      `json:"firstPerson"`
	SecondPerson string      `json:"secondPerson"`
	TTSEngine    string      `json:"ttsEngine"`
	SpeakerID    int         `json:"speakerId"`
	Examples     [][2]string `json:"examples"`
}

// PromptBuilder は小型LLMでもキャラクター再現度を100%維持するプロンプトを構築します。
type PromptBuilder struct {
	mutex   sync.RWMutex
	profile CharacterProfile
}

// NewDefaultPromptBuilder はデフォルトのAIコンパニオン（ひより）プロファイルを生成します。
func NewDefaultPromptBuilder() *PromptBuilder {
	return &PromptBuilder{
		profile: CharacterProfile{
			ID:           "hiyori",
			Name:         "ひより",
			Personality:  "いつも明るく元気いっぱいで、ユーザーの作業やゲームを全力で応援してくれる女の子。",
			ToneRule:     "タメ口で親友のように話す。「〜だよ！」「〜だね！」「〜かな？」。絵文字は絶対に出力しないこと。",
			FirstPerson:  "わたし",
			SecondPerson: "あなた",
			TTSEngine:    "windows-tts",
			SpeakerID:    0,
			Examples: [][2]string{
				{"こんにちは！", "こんにちは！今日も会えて嬉しいよ！"},
				{"いま何してるの？", "あなたの作業を特等席で見守っているよ！"},
				{"疲れたよ〜", "お疲れさま！無理しないで少し休憩しよう？"},
			},
		},
	}
}

// SetProfile はアクティブなキャラクター設定を更新します。
func (b *PromptBuilder) SetProfile(profile CharacterProfile) {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	b.profile = profile
}

// GetProfile は現在のキャラクター設定を返します。
func (b *PromptBuilder) GetProfile() CharacterProfile {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	return b.profile
}

// BuildPrompt は長期記憶・短期ログ・ユーザー入力を結合したChatML形式プロンプトを構築します。
func (b *PromptBuilder) BuildPrompt(longTermMemories []string, historyLogs [][2]string, currentInput string) string {
	return b.BuildPromptWithContext(longTermMemories, historyLogs, "", currentInput)
}

// BuildPromptWithContext はリアルタイムWeb検索コンテキストを含むChatML形式プロンプトを構築します。
func (b *PromptBuilder) BuildPromptWithContext(longTermMemories []string, historyLogs [][2]string, webContext string, currentInput string) string {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	var sb strings.Builder

	// 1. システムプロンプト (ChatML形式)
	sb.WriteString("<|im_start|>system\n")
	sb.WriteString(fmt.Sprintf("あなたはキャラクター「%s」です。\n", b.profile.Name))
	if b.profile.FirstPerson != "" {
		sb.WriteString(fmt.Sprintf("あなたの一人称は「%s」です。自分を指すときは必ず「%s」を使ってください。\n", b.profile.FirstPerson, b.profile.FirstPerson))
	}
	if b.profile.SecondPerson != "" {
		sb.WriteString(fmt.Sprintf("相手（ユーザー）の呼び方は「%s」です。\n", b.profile.SecondPerson))
	}
	sb.WriteString(fmt.Sprintf("【性格・役割】\n%s\n", b.profile.Personality))
	sb.WriteString(fmt.Sprintf("【口調ルール】\n%s\n", b.profile.ToneRule))
	sb.WriteString("【重要ルール】絵文字や顔文字は絶対に出力しないでください。セリフのみを自然な日本語で返答してください。\n")

	if len(b.profile.Examples) > 0 {
		sb.WriteString("【対話の例】\n")
		for _, ex := range b.profile.Examples {
			sb.WriteString(fmt.Sprintf("ユーザー: %s\n%s: %s\n", ex[0], b.profile.Name, ex[1]))
		}
	}

	if len(longTermMemories) > 0 {
		sb.WriteString("【思い出・過去の会話記憶】\n- " + strings.Join(longTermMemories, "\n- ") + "\n")
	}

	if webContext != "" {
		sb.WriteString("【リアルタイム検索・参考情報】\n以下の最新情報・外部データを踏まえ、あなたのキャラクター口調を崩さずに自然に答えてください。\n" + webContext + "\n")
	}

	sb.WriteString("<|im_end|>\n")

	// 2. 短期記憶ログ
	for _, h := range historyLogs {
		sb.WriteString(fmt.Sprintf("<|im_start|>user\n%s<|im_end|>\n", h[0]))
		sb.WriteString(fmt.Sprintf("<|im_start|>assistant\n%s<|im_end|>\n", h[1]))
	}

	// 3. 今回のユーザー入力
	sb.WriteString(fmt.Sprintf("<|im_start|>user\n%s<|im_end|>\n", currentInput))
	sb.WriteString("<|im_start|>assistant\n")

	return sb.String()
}
