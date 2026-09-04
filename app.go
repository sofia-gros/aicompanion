package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"aicompanion/pkg/downloader"
	"aicompanion/pkg/llm"
	"aicompanion/pkg/memory"
	"aicompanion/pkg/pipeline"
	"aicompanion/pkg/platform"
	"aicompanion/pkg/process"
	"aicompanion/pkg/server"
	"aicompanion/pkg/tts"
	"aicompanion/pkg/websearch"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SystemConfig はアプリケーション全体の動的設定情報を保持する構造体です。
type SystemConfig struct {
	DisplayMode            string  `json:"displayMode"`            // "studio" または "overlay"
	IsClickThrough         bool    `json:"isClickThrough"`         // マウス透過状態
	LLMTier                string  `json:"llmTier"`                // "tier0_5b", "tier1_5b", "tier3b", "tier7b", "cloud"
	TTSEngine              string  `json:"ttsEngine"`              // "voicevox", "style-bert-vits2", "mock"
	SpeakerID              int     `json:"speakerId"`              // 話者ID
	Volume                 float32 `json:"volume"`                 // 音量 (0.0〜1.0)
	LipSyncSensitivity     float32 `json:"lipSyncSensitivity"`     // リップシンク感度
	EyeTrackingSensitivity float32 `json:"eyeTrackingSensitivity"` // 視線追従感度

	// Web検索・外部API連携設定
	WebSearchEnabled bool   `json:"webSearchEnabled"` // Web検索機能の有効/無効
	TavilyAPIKey     string `json:"tavilyApiKey"`     // Tavily AI APIキー
	CloudAPIKey      string `json:"cloudApiKey"`      // OpenAI互換 / Gemini APIキー
	CloudAPIBaseURL  string `json:"cloudApiBaseUrl"`  // Base URL
	CloudAPIModel    string `json:"cloudApiModel"`    // モデル名
}

// App はWailsアプリケーションのメインコントローラー構造体です。
type App struct {
	ctx          context.Context
	config       SystemConfig
	procManager  *process.Manager
	tierManager  *llm.TierManager
	promptBuild  *llm.PromptBuilder
	memStore     *memory.Store
	pipeline     *pipeline.DialoguePipeline
	downManager  *downloader.Manager
	httpServer   *server.HTTPServer
	searchRouter *websearch.Router
	ttsVoicevox  *tts.VoicevoxProvider
	ttsSBV2      *tts.StyleBertVITS2Provider
	ttsMock      *tts.MockTTSProvider
	activeTTS    tts.TTSProvider
	modelDir     string
	mutex        sync.RWMutex
}

// NewApp は新しいAppインスタンスを初期化します。
func NewApp() *App {
	procMgr, _ := process.NewManager()
	tierMgr := llm.NewTierManager()
	promptB := llm.NewDefaultPromptBuilder()
	searchR := websearch.NewRouter()
	downMgr := downloader.NewManager()
	httpSrv := server.NewHTTPServer(18923, "frontend/dist")

	memStore, _ := memory.NewStore("data/companion.db")

	mockTTS := tts.NewMockTTSProvider()
	winTTS := tts.NewWindowsTTSProvider()
	vvTTS := tts.NewVoicevoxProvider("http://127.0.0.1:50021", 3)
	sbv2TTS := tts.NewStyleBertVITS2Provider("http://127.0.0.1:5000", 0, 0)

	// デフォルトは追加ソフト不要で日本語を喋る Windows 標準音声
	activeTTS := tts.TTSProvider(winTTS)
	pipe := pipeline.NewDialoguePipeline(activeTTS, "http://127.0.0.1:8080/v1/chat/completions", false)

	return &App{
		config: SystemConfig{
			DisplayMode:            "studio",
			IsClickThrough:         false,
			LLMTier:                "tier1_5b",
			TTSEngine:              "windows-tts",
			SpeakerID:              0,
			Volume:                 1.0,
			LipSyncSensitivity:     1.0,
			EyeTrackingSensitivity: 1.0,
			WebSearchEnabled:       true,
		},
		modelDir:     "models",
		procManager:  procMgr,
		tierManager:  tierMgr,
		promptBuild:  promptB,
		memStore:     memStore,
		pipeline:     pipe,
		downManager:  downMgr,
		httpServer:   httpSrv,
		searchRouter: searchR,
		ttsVoicevox:  vvTTS,
		ttsSBV2:      sbv2TTS,
		ttsMock:      mockTTS,
		activeTTS:    activeTTS,
	}
}

// startup はWails起動時に呼び出され、コンテキスト保持とサーバー開始を行います。
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.httpServer.Start()
	go a.ensureLLMServer()
}
// GetSystemSpec は現在のPCスペックと推奨LLMモデル情報を取得します。
func (a *App) GetSystemSpec() platform.SystemSpec {
	return platform.GetSystemSpec()
}

// StartServices はLLM推論サーバーおよび対話音声パイプラインを開始します。
func (a *App) StartServices() error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	go a.ensureLLMServer()
	return nil
}

// StopServices はLLM推論サーバーおよび音声対話を停止します。
// （アバターのLive2D/VRM描画や視線追従は維持され、キャラクター作成やプレビューが可能です）
func (a *App) StopServices() error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.procManager != nil {
		a.procManager.StopAll()
	}
	a.pipeline.SetMockMode(false)
	runtime.EventsEmit(a.ctx, "system-status", map[string]interface{}{
		"llmReady": false,
		"stopped":  true,
	})
	return nil
}

// findAssetPath は実行ファイル相対またはカレントディレクトリから指定ファイルの実体パスを探索します。
func findAssetPath(relPaths ...string) string {
	target := filepath.Join(relPaths...)
	if _, err := os.Stat(target); err == nil {
		abs, _ := filepath.Abs(target)
		return abs
	}

	exe, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exe)
		// exeDir/target
		cand1 := filepath.Join(exeDir, target)
		if _, err := os.Stat(cand1); err == nil {
			return cand1
		}
		// exeDir/../target (build/binから見た親)
		cand2 := filepath.Join(filepath.Dir(exeDir), target)
		if _, err := os.Stat(cand2); err == nil {
			return cand2
		}
		// exeDir/../../target
		cand3 := filepath.Join(filepath.Dir(filepath.Dir(exeDir)), target)
		if _, err := os.Stat(cand3); err == nil {
			return cand3
		}
	}
	return ""
}

// ensureLLMServer はローカルにGGUFモデルとllama-server.exeが存在する場合、プロセスを起動して実機推論へ確実に接続します。
func (a *App) ensureLLMServer() {
	a.ensureLLMServerWithModel("")
}

// ensureLLMServerWithModel は指定されたモデルファイル（または自動探索モデル）で推論サーバーを起動します。
func (a *App) ensureLLMServerWithModel(specifiedModel string) {
	a.mutex.RLock()
	targetDir := a.modelDir
	if targetDir == "" {
		targetDir = "models"
	}
	a.mutex.RUnlock()

	serverPath := findAssetPath("bin", "llama-server.exe")
	var modelPath string

	if specifiedModel != "" {
		cand := filepath.Join(targetDir, specifiedModel)
		if _, err := os.Stat(cand); err == nil {
			modelPath = cand
		} else {
			cand2 := findAssetPath("models", specifiedModel)
			if _, err := os.Stat(cand2); err == nil {
				modelPath = cand2
			}
		}
	}

	if modelPath == "" {
		// 1. targetDir内の.ggufモデルを探索
		if entries, err := os.ReadDir(targetDir); err == nil {
			for _, e := range entries {
				if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".gguf") {
					modelPath = filepath.Join(targetDir, e.Name())
					break
				}
			}
		}
	}

	// 2. なければfindAssetPathで探索
	if modelPath == "" {
		modelPath = findAssetPath("models", "qwen2.5-0.5b-instruct-q4_k_m.gguf")
	}
	if modelPath == "" {
		modelsDir := findAssetPath("models")
		if modelsDir != "" {
			entries, _ := os.ReadDir(modelsDir)
			for _, e := range entries {
				if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".gguf") {
					modelPath = filepath.Join(modelsDir, e.Name())
					break
				}
			}
		}
	}

	if modelPath != "" {
		if abs, err := filepath.Abs(modelPath); err == nil {
			modelPath = abs
		} else {
			modelPath = filepath.Clean(modelPath)
		}
	}
	if serverPath != "" {
		if abs, err := filepath.Abs(serverPath); err == nil {
			serverPath = abs
		} else {
			serverPath = filepath.Clean(serverPath)
		}
	}

	emitLog := func(msg string) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "system-log", msg)
		}
	}

	if serverPath == "" {
		emitLog("[LLM] 推論サーバー実行ファイル (llama-server.exe) が見つかりません (bin/llama-server.exe)")
		return
	}
	if modelPath == "" {
		emitLog(fmt.Sprintf("[LLM] 有効なGGUFモデルが見つかりません (%s 内を探索)", targetDir))
		return
	}

	emitLog(fmt.Sprintf("[LLM] ローカル推論サーバーを起動中... (モデル: %s)", filepath.Base(modelPath)))

	args := []string{
		"-m", modelPath,
		"--host", "127.0.0.1",
		"--port", "8080",
		"-c", "4096",
		"-ngl", "99", // 自動GPUオフロードで圧倒的推論速度を実現
		"--keep", "-1",
	}

	// Windows Job Object で安全に起動
	if err := a.procManager.StartProcess("llama-server", serverPath, args, "http://127.0.0.1:8080"); err != nil {
		emitLog(fmt.Sprintf("[LLM] プロセス起動失敗: %v", err))
		return
	}

	// サーバーが応答するまで最大20秒間ヘルスチェック
	client := &http.Client{Timeout: 1 * time.Second}
	for i := 0; i < 20; i++ {
		time.Sleep(1 * time.Second)
		resp, err := client.Get("http://127.0.0.1:8080/health")
		if err == nil && resp.StatusCode == http.StatusOK {
			_ = resp.Body.Close()
			// 実機推論モードへ切り替え
			a.pipeline.SetMockMode(false)
			emitLog(fmt.Sprintf("[LLM] 推論サーバー稼働開始 (モデル: %s, ポート: 8080)", filepath.Base(modelPath)))
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "system-status", map[string]interface{}{
					"llmReady": true,
					"model":    filepath.Base(modelPath),
				})
			}
			return
		}
		if resp != nil {
			_ = resp.Body.Close()
		}
	}

	emitLog("[LLM] 推論サーバーのヘルスチェックがタイムアウトしました (ポート 8080)")
}

// shutdown はWails終了時に呼び出され、外部プロセスとリソースを安全にクローズします。
func (a *App) shutdown(ctx context.Context) {
	if a.procManager != nil {
		a.procManager.StopAll()
	}
	if a.httpServer != nil {
		_ = a.httpServer.Stop(ctx)
	}
	if a.memStore != nil {
		_ = a.memStore.Close()
	}
}

// SendMessage はユーザーからの発言を受け取り、階層情報解決（Level 0〜4）を経て対話ストリーミングと音声合成を開始します。
func (a *App) SendMessage(text string) error {
	a.mutex.RLock()
	searchCfg := websearch.SearchConfig{
		Enabled:         a.config.WebSearchEnabled,
		TavilyAPIKey:    a.config.TavilyAPIKey,
		CloudAPIKey:     a.config.CloudAPIKey,
		CloudAPIBaseURL: a.config.CloudAPIBaseURL,
		CloudAPIModel:   a.config.CloudAPIModel,
	}
	a.mutex.RUnlock()

	if a.memStore != nil {
		_ = a.memStore.AddLog("default", "user", text)
	}

	history, _ := a.memStore.GetRecentLogs(10)

	// 長期記憶の類似度検索 (Top 3件)
	var longMemories []string
	if a.memStore != nil {
		qVec := memory.GenerateSimpleEmbedding(text)
		similar, err := a.memStore.SearchSimilarMemories(qVec, 3)
		if err == nil {
			longMemories = similar
		}
	}

	// バックグラウンドで階層情報検索 & ストリーミング推論＆TTS実行
	go func() {
		// Gemini風のアクションログ送出関数
		logger := func(stage string, message string) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "system-log", fmt.Sprintf("[%s] %s", stage, message))
			}
		}

		var webContext string
		var fillerReply string

		if a.searchRouter != nil && searchCfg.Enabled {
			intent := a.searchRouter.DetermineLevel(text)
			if intent.Level != websearch.Level0LLMOnly {
				fillerReply = intent.FillerReply
				// 先行相槌をTTSで発話（初声遅延ゼロ化）
				if fillerReply != "" && a.activeTTS != nil {
					go func() {
						opts := tts.TTSOptions{
							SpeakerID: a.config.SpeakerID,
							Speed:     1.0,
						}
						if res, err := a.activeTTS.Synthesize(context.Background(), fillerReply, opts); err == nil && res != nil {
							speakEvt := pipeline.AvatarSpeakEvent{
								SeqID:       1,
								IsLast:      false,
								Text:        fillerReply,
								AudioFormat: res.ContentType,
								AudioBase64: base64.StdEncoding.EncodeToString(res.AudioData),
								Emotion:     "happy",
								DurationMs:  res.DurationMs,
							}
							runtime.EventsEmit(a.ctx, "avatar-speak", speakEvt)
							_ = a.httpServer.Hub().BroadcastAvatarEvent("avatar-speak", speakEvt)
						}
					}()
				}

				// 階層情報ルーターによる検索実行
				res, err := a.searchRouter.Dispatch(context.Background(), searchCfg, text, logger)
				if err == nil && res != nil {
					webContext = fmt.Sprintf("【出典: %s (%s)】\n%s", res.Title, res.Source, res.Snippet)
				}
			} else {
				logger("思考", "日常対話・内部知識と判定 (外部検索スキップ)")
			}
		}

		prompt := a.promptBuild.BuildPromptWithContext(longMemories, history, webContext, text)

		var fullReply string
		_ = a.pipeline.ProcessUserInput(
			context.Background(),
			prompt,
			func(t pipeline.LLMTokenEvent) {
				fullReply += t.Token
				runtime.EventsEmit(a.ctx, "llm-token", t)
			},
			func(s pipeline.AvatarSpeakEvent) {
				// 先行相槌があった場合は SeqID をオフセットして整列
				if fillerReply != "" {
					s.SeqID += 1
				}
				// Wailsフロントエンドへ送出
				runtime.EventsEmit(a.ctx, "avatar-speak", s)
				// OBSブラウザソースへWebSocketブロードキャスト
				_ = a.httpServer.Hub().BroadcastAvatarEvent("avatar-speak", s)
			},
		)

		if a.memStore != nil && fullReply != "" {
			_ = a.memStore.AddLog("default", "assistant", fullReply)
			// 記憶ワーカーへ通知（自動長期記憶化）
			worker := memory.NewMemoryWorker(a.memStore)
			worker.RecordTurn(text, fullReply)
		}
	}()

	return nil
}

// GetSearchConfig は現在のWeb検索および外部API設定を取得します。
func (a *App) GetSearchConfig() websearch.SearchConfig {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return websearch.SearchConfig{
		Enabled:         a.config.WebSearchEnabled,
		TavilyAPIKey:    a.config.TavilyAPIKey,
		CloudAPIKey:     a.config.CloudAPIKey,
		CloudAPIBaseURL: a.config.CloudAPIBaseURL,
		CloudAPIModel:   a.config.CloudAPIModel,
	}
}

// SaveSearchConfig はWeb検索および外部API設定を保存・更新します。
func (a *App) SaveSearchConfig(cfg websearch.SearchConfig) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.config.WebSearchEnabled = cfg.Enabled
	a.config.TavilyAPIKey = cfg.TavilyAPIKey
	a.config.CloudAPIKey = cfg.CloudAPIKey
	a.config.CloudAPIBaseURL = cfg.CloudAPIBaseURL
	a.config.CloudAPIModel = cfg.CloudAPIModel

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "system-log", "[設定] Web検索・API設定を更新しました")
	}
	return nil
}

// SwitchDisplayMode はスタジオ画面の表示モード設定を更新します（ウィンドウサイズは変更しません）。
func (a *App) SwitchDisplayMode(mode string) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.config.DisplayMode = mode
	return nil
}

// LaunchOverlayWindow はStudioウィンドウとは独立した透過アバター別ウィンドウをデスクトップ上に起動します。
func (a *App) LaunchOverlayWindow() error {
	avatarURL := "http://127.0.0.1:18923/avatar.html"
	return platform.LaunchOverlayBrowser(avatarURL)
}

// SetClickThrough はマウス透過状態（WS_EX_TRANSPARENT）を切り替えます。
func (a *App) SetClickThrough(enabled bool) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.config.IsClickThrough = enabled
	_ = platform.SetClickThrough(0, enabled)
	return nil
}

// SetLLMPreset はLLMティアプリセットを切り替えます（必要に応じて新モデルで推論サーバーを自動再起動）。
func (a *App) SetLLMPreset(tier string) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.config.LLMTier = tier
	a.tierManager.SetTier(llm.LLMTier(tier))

	cfg := a.tierManager.GetCurrentConfig()
	if cfg.FileName != "" {
		go a.ensureLLMServerWithModel(cfg.FileName)
	}
	return nil
}

// SetCharacterProfile はアクティブなキャラクター設定（名前、性格、口調、一人称/二人称、対話例）をLLMプロンプトビルダーに即座に反映します。
func (a *App) SetCharacterProfile(profile llm.CharacterProfile) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.promptBuild.SetProfile(profile)
	if profile.TTSEngine != "" {
		a.config.TTSEngine = profile.TTSEngine
		a.config.SpeakerID = profile.SpeakerID
	}
	return nil
}

// SetTTSProvider は音声エンジンと話者IDを切り替えます。
func (a *App) SetTTSProvider(engine string, speakerID int) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	a.config.TTSEngine = engine
	a.config.SpeakerID = speakerID

	switch engine {
	case "windows-tts":
		winTTS := tts.NewWindowsTTSProvider()
		a.activeTTS = winTTS
		a.pipeline.SetTTSProvider(winTTS)
	case "voicevox":
		a.activeTTS = a.ttsVoicevox
		a.pipeline.SetTTSProvider(a.ttsVoicevox)
	case "style-bert-vits2":
		a.activeTTS = a.ttsSBV2
		a.pipeline.SetTTSProvider(a.ttsSBV2)
	default:
		winTTS := tts.NewWindowsTTSProvider()
		a.activeTTS = winTTS
		a.pipeline.SetTTSProvider(winTTS)
	}
	return nil
}

// GetModelDirectory は現在のモデルダウンロード保存先ディレクトリを返します。
func (a *App) GetModelDirectory() string {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	if a.modelDir == "" {
		return "models"
	}
	return a.modelDir
}

// SetModelDirectory はモデルダウンロード保存先ディレクトリを設定します。
func (a *App) SetModelDirectory(dir string) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("モデル保存先ディレクトリの作成に失敗しました: %w", err)
	}
	a.modelDir = dir
	return nil
}

// SelectModelDirectory はWindowsのフォルダ選択ダイアログを開いて保存先ディレクトリを選択させます。
func (a *App) SelectModelDirectory() (string, error) {
	selected, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "モデルダウンロード保存先フォルダーの選択",
	})
	if err != nil {
		return "", err
	}
	if selected != "" {
		_ = a.SetModelDirectory(selected)
		return selected, nil
	}
	return a.GetModelDirectory(), nil
}

// GetDownloadedModels はローカルにダウンロード済みのGGUFモデル一覧を返します。
func (a *App) GetDownloadedModels() []string {
	a.mutex.RLock()
	dir := a.modelDir
	if dir == "" {
		dir = "models"
	}
	a.mutex.RUnlock()

	var models []string
	entries, err := os.ReadDir(dir)
	if err != nil {
		return models
	}
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".gguf" {
			models = append(models, e.Name())
		}
	}
	return models
}

// GetSystemConfig は現在の設定情報を取得します。
func (a *App) GetSystemConfig() SystemConfig {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return a.config
}

// UpdateSystemConfig は設定情報を更新します。
func (a *App) UpdateSystemConfig(cfg SystemConfig) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()
	a.config = cfg
	return nil
}

// ClearConversationHistory は短期記憶ログを消去します。
func (a *App) ClearConversationHistory() error {
	if a.memStore != nil {
		return a.memStore.ClearLogs()
	}
	return nil
}

// SetLive2DParameter はテスト用パラメータを反映します。
func (a *App) SetLive2DParameter(param string, value float64) error {
	runtime.EventsEmit(a.ctx, "test-param", map[string]interface{}{
		"param": param,
		"value": value,
	})
	return nil
}

// StartModelDownload は指定モデルのダウンロードをバックグラウンドで開始します。
func (a *App) StartModelDownload(modelKey string) error {
	a.mutex.RLock()
	dir := a.modelDir
	if dir == "" {
		dir = "models"
	}
	a.mutex.RUnlock()

	_ = os.MkdirAll(dir, 0755)

	var targetURL string
	var fileName string

	for _, c := range a.tierManager.GetAllConfigs() {
		if string(c.Tier) == modelKey || c.FileName == modelKey {
			targetURL = c.DownloadURL
			fileName = c.FileName
			break
		}
	}
	if targetURL == "" {
		// デフォルトフォールバック (Qwen2.5-1.5B)
		targetURL = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
		fileName = "qwen2.5-1.5b-instruct-q4_k_m.gguf"
	}

	destPath := filepath.Join(dir, fileName)

	go func() {
		_ = a.downManager.DownloadFile(
			context.Background(),
			targetURL,
			destPath,
			func(downloadedBytes int64, totalBytes int64, speedBytesPerSec float64, percent float64) {
				runtime.EventsEmit(a.ctx, "download-progress", downloader.DownloadProgressEvent{
					ModelKey:         modelKey,
					DownloadedBytes:  downloadedBytes,
					TotalBytes:       totalBytes,
					SpeedBytesPerSec: speedBytesPerSec,
					Percent:          percent,
					IsCompleted:      percent >= 100.0,
				})
				if percent >= 100.0 {
					go a.ensureLLMServerWithModel(fileName)
				}
			},
		)
	}()

	return nil
}

// CancelModelDownload は実行中のモデルダウンロードを中断します。
func (a *App) CancelModelDownload() error {
	a.downManager.Cancel()
	return nil
}
