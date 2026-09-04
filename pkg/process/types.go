package process

// ProcessStatus は外部プロセスの稼働状態を表す型です。
type ProcessStatus string

const (
	// StatusStopped はプロセスが停止している状態です。
	StatusStopped ProcessStatus = "stopped"
	// StatusStarting はプロセスが起動中であることを示します。
	StatusStarting ProcessStatus = "starting"
	// StatusRunning はプロセスが正常に稼働している状態です。
	StatusRunning ProcessStatus = "running"
	// StatusFailed はプロセスの起動または実行が失敗した状態です。
	StatusFailed ProcessStatus = "failed"
)

// ProcessInfo は外部プロセスの詳細情報を保持する構造体です。
type ProcessInfo struct {
	Name      string        `json:"name"`
	PID       int           `json:"pid"`
	Status    ProcessStatus `json:"status"`
	Endpoint  string        `json:"endpoint"`
	LastError string        `json:"lastError,omitempty"`
}
