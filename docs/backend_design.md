# バックエンド設計書: Go Orchestrator アーキテクチャ

## 1. バックエンド技術スタック（最新安定版）

- **言語**: Go 1.24+ (最新安定版)
- **デスクトップバインディング**: Wails v2 (v2.11+)
- **ローカル配信・OBS連携**: Go標準 `net/http` + `github.com/gorilla/websocket` (ポート: `18923`)
- **データベース**: Pure-Go SQLite (`modernc.org/sqlite`) ※Cgo/GCC不要・Windows完全互換
- **プロセス制御**: Windows Native Job Object API (`golang.org/x/sys/windows`)
- **音声合成プロバイダー**: プラガブルインターフェース設計（Style-Bert-VITS2, VOICEVOX, Mock）
- **モデルダウンローダー**: レジューム（中断再開）対応 HTTP/HTTPS クライアント

---

## 2. パッケージ構成

```text
.
├── main.go                     # アプリケーション起動・Wails設定・ライフサイクル統合
├── app.go                      # WailsバインディングAPI定義 (フロントへ公開するRPC群)
├── pkg/
│   ├── server/                 # OBS Direct & 外部ブラウザ配信用ローカルHTTP/WSサーバー
│   │   ├── http_server.go      # 静的アバターHTML配信 & ポートバインド (:18923)
│   │   └── ws_hub.go           # WebSocketブロードキャストハブ (音声・字幕・表情同期)
│   ├── downloader/             # ワンクリック・モデル＆ツールダウンローダー
│   │   ├── client.go           # レジューム対応HTTPダウンロードエンジン
│   │   ├── progress.go         # 転送速度・残り時間算出 & イベント送出
│   │   └── types.go
│   ├── process/                # 外部プロセス（llama-server / TTS）管理
│   │   ├── job_windows.go      # Windows Job Object 実装 (プロセスツリー強制終了)
│   │   ├── manager.go          # プロセスライフサイクル・ヘルスチェック・再起動
│   │   └── types.go
│   ├── llm/                    # LLM Tier管理 & プロンプト・Few-Shot生成
│   │   ├── tier_manager.go     # スペック別モデルプリセット (0.5B / 1.5B / 3B / 7B / Cloud)
│   │   ├── prompt_builder.go   # Few-Shot注入 & キャラクター口調テンプレート
│   │   └── types.go
│   ├── pipeline/               # 対話ストリーミング＆句分割TTSパイプライン
│   │   ├── dialogue.go         # LLMストリーミング・プロンプト結合
│   │   ├── splitter.go         # リアルタイム句分割ロジック
│   │   └── types.go
│   ├── tts/                    # プラガブル音声合成エンジンプロバイダー層
│   │   ├── provider.go         # TTSProvider インターフェース定義 & ファクトリ
│   │   ├── stylebertvits2.go   # Style-Bert-VITS2 アダプター (:5000)
│   │   ├── voicevox.go         # VOICEVOX アダプター (:50021)
│   │   └── mock.go             # テスト・開発用モックプロバイダー
│   ├── memory/                 # 記憶管理 (Pure-Go SQLite)
│   │   ├── db.go               # SQLite接続・スキーママイグレーション
│   │   ├── short_term.go       # 短期記憶バッファ管理
│   │   ├── long_term.go        # 要約生成・ベクトルコサイン類似度検索
│   │   └── types.go
│   └── platform/               # OS固有処理 (Windows API)
│       ├── window_windows.go   # マウス透過 (WS_EX_TRANSPARENT) 制御
│       └── hotkey_windows.go   # グローバルショートカットキー検知
└── bin/
    ├── llama-server.exe        # C++製 LLM推論サーバー
    └── grammars/
        └── no_emoji.gbnf       # 絵文字排除GBNF文法
```

---

## 3. モデルダウンローダー設計 (`pkg/downloader/`)

Hugging Face等のリモートサーバーからGGUFモデルをバックグラウンド取得し、進捗をリアルタイム通知する。

```go
// pkg/downloader/client.go
package downloader

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ProgressCallback はダウンロード進捗を受け取るコールバック関数型です。
type ProgressCallback func(downloadedBytes int64, totalBytes int64, speedBytesPerSec float64, percent float64)

// DownloadFile は指定URLからファイルをレジューム対応でダウンロードします。
func DownloadFile(ctx context.Context, url string, destPath string, onProgress ProgressCallback) error {
	tmpPath := destPath + ".tmp"
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("保存先ディレクトリの作成に失敗しました: %w", err)
	}

	var startOffset int64 = 0
	if fi, err := os.Stat(tmpPath); err == nil {
		startOffset = fi.Size()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	if startOffset > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", startOffset))
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP接続に失敗しました: %w", err)
	}
	defer resp.Body.Close()

	var totalBytes int64
	if resp.StatusCode == http.StatusPartialContent {
		totalBytes = startOffset + resp.ContentLength
	} else if resp.StatusCode == http.StatusOK {
		totalBytes = resp.ContentLength
		startOffset = 0
	} else {
		return fmt.Errorf("無効なHTTPステータスコード: %d", resp.StatusCode)
	}

	outFlags := os.O_CREATE | os.O_WRONLY
	if startOffset > 0 {
		outFlags |= os.O_APPEND
	}
	file, err := os.OpenFile(tmpPath, outFlags, 0644)
	if err != nil {
		return fmt.Errorf("出力ファイルのオープンに失敗しました: %w", err)
	}
	defer file.Close()

	buf := make([]byte, 32*1024)
	downloaded := startOffset
	lastTime := time.Now()
	lastBytes := downloaded

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, wErr := file.Write(buf[:n]); wErr != nil {
				return fmt.Errorf("書き込み失敗: %w", wErr)
			}
			downloaded += int64(n)

			now := time.Now()
			elapsed := now.Sub(lastTime).Seconds()
			if elapsed >= 0.5 && onProgress != nil {
				speed := float64(downloaded-lastBytes) / elapsed
				percent := float64(downloaded) / float64(totalBytes) * 100
				onProgress(downloaded, totalBytes, speed, percent)
				lastTime = now
				lastBytes = downloaded
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("読み取りエラー: %w", err)
		}
	}

	file.Close()
	return os.Rename(tmpPath, destPath)
}
```

---

## 4. プロセス管理設計 (Windows Job Object)

Windows OSの `Job Object` を生成し、`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` を設定したジョブにすべての子プロセスを登録することで、親終了時のゾンビプロセス化を確実にゼロにします。

```go
// pkg/process/job_windows.go
package process

import (
	"fmt"
	"unsafe"
	"golang.org/x/sys/windows"
)

// WindowsJobObject は子プロセス群をグループ管理し、親終了時に自動連動終了させる構造体です。
type WindowsJobObject struct {
	handle windows.Handle
}

// NewJobObject は親プロセス終了時に全子プロセスを自動終了するJob Objectを初期化します。
func NewJobObject() (*WindowsJobObject, error) {
	hJob, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("Job Objectの作成に失敗しました: %w", err)
	}

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}

	_, err = windows.SetInformationJobObject(
		hJob,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		windows.CloseHandle(hJob)
		return nil, fmt.Errorf("Job Objectの制限設定に失敗しました: %w", err)
	}

	return &WindowsJobObject{handle: hJob}, nil
}

// AssignProcess は指定したプロセスのハンドルをJob Objectに登録します。
func (j *WindowsJobObject) AssignProcess(hProcess windows.Handle) error {
	return windows.AssignProcessToJobObject(j.handle, hProcess)
}

// Close はJob Objectのハンドルを解放します。
func (j *WindowsJobObject) Close() error {
	return windows.CloseHandle(j.handle)
}
```

---

## 5. プラガブル音声合成（TTS Provider）アーキテクチャ

### 5.1 インターフェース定義 (`pkg/tts/provider.go`)
```go
package tts

import (
	"context"
)

// AudioResult は音声合成結果を格納する構造体です。
type AudioResult struct {
	AudioData   []byte // WAV形式の音声バイナリ
	ContentType string // "audio/wav"
	DurationMs  int64  // 推定再生時間（ミリ秒）
}

// TTSOptions は話者や速度、感情パラメータを指定するオプションです。
type TTSOptions struct {
	SpeakerID int
	Speed     float32
	Pitch     float32
}

// TTSProvider は音声合成エンジンの共通インターフェースです。
type TTSProvider interface {
	Synthesize(ctx context.Context, text string, options TTSOptions) (*AudioResult, error)
	HealthCheck(ctx context.Context) error
	GetEngineType() string
}
```

### 5.2 VOICEVOX アダプター (`pkg/tts/voicevox.go`)
VOICEVOX (ポート `50021`) の `/audio_query` ➔ `/synthesis` を透過処理。

---

## 6. 会話ストリーミング ＆ リアルタイム句分割

`pkg/pipeline/splitter.go` により句読点（`。！？\n`）検知時に文を切り出し、TTSへ即時投入。

---

## 7. OBS Direct ＆ 外部配信サーバー (`pkg/server/`)

ポート `18923` で静的HTMLとWebSocketブロードキャストを提供。

---

## 8. LLM 最適化 ＆ Few-Shot プロンプト生成 (`pkg/llm/`)

小型モデル（0.5B/1.5B/3B）でも敬語化・キャラ崩壊を防ぐプロンプト生成エンジン。

---

## 9. 記憶管理設計 (Pure-Go SQLite)

Pure-Go SQLite (`modernc.org/sqlite`) によるWALモード高速永続化と、インメモリ並列コサイン類似度計算。

---

## 10. Windows プラットフォーム連携 (マウス透過)

`SetWindowLongPtr` による `WS_EX_TRANSPARENT` のトグル。

---

## 11. Wails バインディング RPC 一覧 (`app.go`)

| メソッド名 | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `SwitchDisplayMode` | `mode string` (`"studio"` / `"overlay"`) | `error` | スタジオ画面と常駐オーバーレイ画面の切り替え |
| `SetClickThrough` | `enabled bool` | `error` | マウス透過の有効/無効化 |
| `SetLLMPreset` | `tier string` | `error` | LLMモデルプリセットの動的切り替え |
| `SetTTSProvider` | `engine string, speakerID int` | `error` | 音声エンジンと話者の変更 |
| `GetSystemConfig` | なし | `SystemConfig` | 現在の全設定情報の取得 |
| `UpdateSystemConfig` | `cfg SystemConfig` | `error` | 設定の更新とDB永続化 |
| `ClearConversationHistory` | なし | `error` | 短期会話ログの消去 |
| `SetLive2DParameter` | `param string, value float64` | `error` | インスペクターからの手動パラメータテスト注入 |
| `StartModelDownload` | `modelKey string` | `error` | 指定モデルのバックグラウンドダウンロード開始 |
| `CancelModelDownload` | なし | `error` | 進行中ダウンロードの中断 |
| `GetAvailableModels` | なし | `[]ModelInfo` | ローカルに保存済みのGGUFモデル一覧の取得 |
