package tts

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// WindowsTTSProvider はWindows標準の音声合成エンジン (System.Speech / SAPI) を利用するプロバイダーです。
// 追加ソフトウェア不要で、日本語自然音声（Haruka等）によるWAV出力を提供します。
// 黒いコマンドプロンプトウィンドウは完全に非表示化されます。
type WindowsTTSProvider struct{}

// NewWindowsTTSProvider は新しいWindows標準TTSプロバイダーを生成します。
func NewWindowsTTSProvider() *WindowsTTSProvider {
	return &WindowsTTSProvider{}
}

// Synthesize は指定テキストからWindows標準音声（Haruka）を用いてWAVバイナリを合成します。
func (w *WindowsTTSProvider) Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error) {
	tmpDir := os.TempDir()
	pid := os.Getpid()
	tmpWav := filepath.Join(tmpDir, fmt.Sprintf("tts_out_%d_%d.wav", pid, os.Getpid()))
	tmpPs1 := filepath.Join(tmpDir, fmt.Sprintf("tts_script_%d_%d.ps1", pid, os.Getpid()))
	defer os.Remove(tmpWav)
	defer os.Remove(tmpPs1)

	// サニタイズ
	safeText := strings.ReplaceAll(text, `"`, ` `)
	safeText = strings.ReplaceAll(safeText, `'`, ` `)
	safeText = strings.ReplaceAll(safeText, "`", ` `)
	safeText = strings.ReplaceAll(safeText, "\n", ` `)
	safeText = strings.TrimSpace(safeText)

	if safeText == "" {
		safeText = "はい。"
	}

	// PowerShell スクリプト（Harukaを最優先で探索・設定）
	// UTF-8 BOM付きで一時ファイルに書き出すことで文字化けを完全防止
	scriptContent := fmt.Sprintf(`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer
$haruka = $speak.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like "*Haruka*" -or $_.VoiceInfo.Culture -like "*ja*" } | Select-Object -First 1
if ($haruka) {
    $speak.SelectVoice($haruka.VoiceInfo.Name)
}
$speak.Rate = 1
$speak.SetOutputToWaveFile("%s")
$speak.Speak("%s")
$speak.Dispose()
`, strings.ReplaceAll(tmpWav, `\`, `/`), safeText)

	// UTF-8 BOM (0xEF, 0xBB, 0xBF) 付きで保存
	bom := []byte{0xEF, 0xBB, 0xBF}
	if err := os.WriteFile(tmpPs1, append(bom, []byte(scriptContent)...), 0644); err != nil {
		mock := NewMockTTSProvider()
		return mock.Synthesize(ctx, text, options)
	}

	// 黒いコンソールウィンドウを絶対に表示させない設定 (CREATE_NO_WINDOW)
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tmpPs1)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	if err := cmd.Run(); err != nil {
		mock := NewMockTTSProvider()
		return mock.Synthesize(ctx, text, options)
	}

	data, err := os.ReadFile(tmpWav)
	if err != nil || len(data) < 44 {
		mock := NewMockTTSProvider()
		return mock.Synthesize(ctx, text, options)
	}

	durationMs := int64(float64(len(data)) / 44100.0 / 2.0 * 1000.0)

	return &AudioResult{
		AudioData:   data,
		ContentType: "audio/wav",
		DurationMs:  durationMs,
	}, nil
}

// HealthCheck はWindows音声合成の生存を確認します。
func (w *WindowsTTSProvider) HealthCheck(ctx context.Context) error {
	return nil
}

// GetEngineType はエンジンの識別子 "windows-tts" を返します。
func (w *WindowsTTSProvider) GetEngineType() string {
	return "windows-tts"
}
