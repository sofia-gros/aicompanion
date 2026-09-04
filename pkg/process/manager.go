package process

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

// ManagedProcess は管理対象の単一外部プロセスを表します。
type ManagedProcess struct {
	Name     string
	Cmd      *exec.Cmd
	Endpoint string
	Status   ProcessStatus
	Cancel   context.CancelFunc
}

// Manager は外部推論プロセス群（llama-server等）のライフサイクルを一括管理するマネージャーです。
type Manager struct {
	jobObject *WindowsJobObject
	processes map[string]*ManagedProcess
	mutex     sync.RWMutex
}

// NewManager は新しいプロセスマネージャーを生成し、Windows Job Objectを初期化します。
func NewManager() (*Manager, error) {
	job, err := NewJobObject()
	if err != nil {
		return nil, fmt.Errorf("プロセスマネージャー初期化失敗: %w", err)
	}

	return &Manager{
		jobObject: job,
		processes: make(map[string]*ManagedProcess),
	}, nil
}

// StartProcess は外部プロセスを起動し、Job Objectへ登録して死活監視を開始します。
func (m *Manager) StartProcess(name string, exePath string, args []string, endpoint string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if existing, ok := m.processes[name]; ok && existing.Status == StatusRunning {
		return fmt.Errorf("プロセス %s は既に実行中です", name)
	}

	// 過去のクラッシュ等で孤立残留した古い同一プロセスを確実に終了（ポート衝突根絶）
	baseName := filepath.Base(exePath)
	killCmd := exec.Command("taskkill", "/F", "/IM", baseName)
	killCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	_ = killCmd.Run()
	time.Sleep(300 * time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, exePath, args...)
	cmd.Dir = filepath.Dir(exePath)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}

	// 外部プロセスの標準出力・エラー出力をログファイル (logs/<name>.log) に記録
	_ = os.MkdirAll("logs", 0755)
	if logFile, err := os.OpenFile(filepath.Join("logs", name+".log"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644); err == nil {
		cmd.Stdout = logFile
		cmd.Stderr = logFile
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("プロセス %s の起動に失敗しました: %w", name, err)
	}

	// Windows Job Objectへアタッチ（親プロセス連動強制終了の保証）
	hProcess := windows.Handle(cmd.Process.Pid)
	// OpenProcess で PROCESS_SET_QUOTA | PROCESS_TERMINATE 権限を取得
	handle, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(cmd.Process.Pid))
	if err == nil {
		_ = m.jobObject.AssignProcess(handle)
		_ = windows.CloseHandle(handle)
	} else {
		_ = m.jobObject.AssignProcess(hProcess)
	}

	managed := &ManagedProcess{
		Name:     name,
		Cmd:      cmd,
		Endpoint: endpoint,
		Status:   StatusStarting,
		Cancel:   cancel,
	}
	m.processes[name] = managed

	// バックグラウンド死活監視ルーチン
	go m.monitorProcess(name, managed)

	return nil
}

// monitorProcess はプロセスの終了とHTTPヘルスチェックを監視します。
func (m *Manager) monitorProcess(name string, p *ManagedProcess) {
	// エンドポイントがある場合はHealthCheckをポーリング
	if p.Endpoint != "" {
		go func() {
			for i := 0; i < 30; i++ {
				time.Sleep(500 * time.Millisecond)
				req, err := http.NewRequest(http.MethodGet, p.Endpoint, nil)
				if err == nil {
					resp, err := http.DefaultClient.Do(req)
					if err == nil && resp.StatusCode < 400 {
						resp.Body.Close()
						m.mutex.Lock()
						p.Status = StatusRunning
						m.mutex.Unlock()
						return
					}
					if resp != nil && resp.Body != nil {
						resp.Body.Close()
					}
				}
			}
		}()
	}

	// プロセスの終了待機
	_ = p.Cmd.Wait()

	m.mutex.Lock()
	p.Status = StatusStopped
	m.mutex.Unlock()
}

// StopProcess は指定した外部プロセスを停止します。
func (m *Manager) StopProcess(name string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	p, ok := m.processes[name]
	if !ok {
		return fmt.Errorf("プロセス %s は見つかりません", name)
	}

	if p.Cancel != nil {
		p.Cancel()
	}
	p.Status = StatusStopped
	return nil
}

// StopAll は管理中の全外部プロセスを停止し、Job Objectを解放します。
func (m *Manager) StopAll() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	for _, p := range m.processes {
		if p.Cancel != nil {
			p.Cancel()
		}
		p.Status = StatusStopped
	}

	if m.jobObject != nil {
		_ = m.jobObject.Close()
	}
}

// GetStatus は指定プロセスの稼働ステータスを取得します。
func (m *Manager) GetStatus(name string) ProcessStatus {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if p, ok := m.processes[name]; ok {
		return p.Status
	}
	return StatusStopped
}
