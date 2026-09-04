// Package downloader はHugging Face等からGGUFモデルを自動取得するエンジンを提供します。
package downloader

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ProgressCallback はダウンロード進捗を受け取るコールバック関数型です。
type ProgressCallback func(downloadedBytes int64, totalBytes int64, speedBytesPerSec float64, percent float64)

// Manager はモデルのダウンロードおよびキャンセル処理を管理するマネージャーです。
type Manager struct {
	cancelFunc context.CancelFunc
	isBusy     bool
	mutex      sync.Mutex
}

// NewManager は新しいダウンローダーマネージャーを生成します。
func NewManager() *Manager {
	return &Manager{}
}

// DownloadFile は指定URLからファイルをレジューム（中断再開）対応でダウンロードします。
func (m *Manager) DownloadFile(ctx context.Context, url string, destPath string, onProgress ProgressCallback) error {
	m.mutex.Lock()
	if m.isBusy {
		m.mutex.Unlock()
		return fmt.Errorf("他のダウンロードが既に実行中です")
	}
	ctx, cancel := context.WithCancel(ctx)
	m.cancelFunc = cancel
	m.isBusy = true
	m.mutex.Unlock()

	defer func() {
		m.mutex.Lock()
		m.isBusy = false
		m.cancelFunc = nil
		m.mutex.Unlock()
	}()

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

	buf := make([]byte, 64*1024)
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
				return fmt.Errorf("ファイル書き込み失敗: %w", wErr)
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

	_ = file.Close()
	if err := os.Rename(tmpPath, destPath); err != nil {
		return fmt.Errorf("完了ファイルのリネームに失敗しました: %w", err)
	}

	// 完了イベント (100%) の確実な送出
	if onProgress != nil {
		onProgress(totalBytes, totalBytes, 0, 100.0)
	}

	return nil
}

// Cancel は実行中のダウンロードを中断します。
func (m *Manager) Cancel() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.cancelFunc != nil {
		m.cancelFunc()
	}
}
