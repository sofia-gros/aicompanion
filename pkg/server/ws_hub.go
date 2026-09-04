// Package server はOBS Direct配信および外部ブラウザ連携用ローカルサーバーを提供します。
package server

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // OBS Studio 等のローカルオリジンを許可
	},
}

// WSHub は接続中の全クライアント（OBS等）へイベントを一斉配信するハブです。
type WSHub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mutex      sync.RWMutex
}

// NewWSHub は新しいWebSocketブロードキャストハブを初期化します。
func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 64),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

// Run はクライアント接続およびメッセージ配信ループを開始します。
func (h *WSHub) Run() {
	for {
		select {
		case conn := <-h.register:
			h.mutex.Lock()
			h.clients[conn] = true
			h.mutex.Unlock()
		case conn := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				_ = conn.Close()
			}
			h.mutex.Unlock()
		case message := <-h.broadcast:
			h.mutex.RLock()
			for conn := range h.clients {
				err := conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					_ = conn.Close()
					delete(h.clients, conn)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// HandleWS はWebSocket接続を受け付けるHTTPハンドラーです。
func (h *WSHub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h.register <- conn

	// 切断検知ループ
	go func() {
		defer func() {
			h.unregister <- conn
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}

// BroadcastAvatarEvent はアバター同期イベントを全クライアントへ配信します。
func (h *WSHub) BroadcastAvatarEvent(event string, payload interface{}) error {
	data, err := json.Marshal(map[string]interface{}{
		"event": event,
		"data":  payload,
	})
	if err != nil {
		return err
	}
	h.broadcast <- data
	return nil
}
