package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// HTTPServer はOBS Direct用のアバター画面配信およびWebSocket通信を提供するローカルHTTPサーバーです。
type HTTPServer struct {
	server  *http.Server
	hub     *WSHub
	distDir string
	port    int
}

// NewHTTPServer は新しいHTTP/WSサーバーインスタンスを生成します。
func NewHTTPServer(port int, distDir string) *HTTPServer {
	if port <= 0 {
		port = 18923
	}
	hub := NewWSHub()
	go hub.Run()

	return &HTTPServer{
		hub:     hub,
		distDir: distDir,
		port:    port,
	}
}

// Start はポートをバインドしてバックグラウンドでHTTPサーバーを起動します。
func (s *HTTPServer) Start() error {
	mux := http.NewServeMux()

	// 配信ディレクトリの実体パスを探索
	resolvedDist := s.distDir
	candidates := []string{
		s.distDir,
		filepath.Join("frontend", "dist"),
		"dist",
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "dist"),
			filepath.Join(exeDir, "frontend", "dist"),
			filepath.Join(filepath.Dir(exeDir), "dist"),
			filepath.Join(filepath.Dir(exeDir), "frontend", "dist"),
			filepath.Join(filepath.Dir(filepath.Dir(exeDir)), "frontend", "dist"),
		)
	}
	for _, cand := range candidates {
		if _, err := os.Stat(filepath.Join(cand, "avatar.html")); err == nil {
			resolvedDist, _ = filepath.Abs(cand)
			break
		}
	}

	// 1. WebSocket エンドポイント
	mux.HandleFunc("/ws", s.hub.HandleWS)

	// 2. /avatar および /avatar.html エンドポイント (avatar.html を確実に配信)
	serveAvatar := func(w http.ResponseWriter, r *http.Request) {
		avatarHTML := filepath.Join(resolvedDist, "avatar.html")
		if _, err := os.Stat(avatarHTML); err == nil {
			http.ServeFile(w, r, avatarHTML)
			return
		}
		// ビルド前フォールバック
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, "<html><body style='background:transparent;color:#00ff00;font-family:sans-serif;'><h3>AI Companion Viewport (Ready)</h3><p>Connecting to websocket...</p></body></html>")
	}
	mux.HandleFunc("/avatar", serveAvatar)
	mux.HandleFunc("/avatar.html", serveAvatar)

	// 3. 静的アセット配信 (JS, CSS, Live2Dモデルデータ)
	mux.Handle("/", http.FileServer(http.Dir(resolvedDist)))

	s.server = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		_ = s.server.ListenAndServe()
	}()

	return nil
}

// Stop はHTTPサーバーを正常終了させます。
func (s *HTTPServer) Stop(ctx context.Context) error {
	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	return nil
}

// Hub はWebSocketハブの参照を返します。
func (s *HTTPServer) Hub() *WSHub {
	return s.hub
}
