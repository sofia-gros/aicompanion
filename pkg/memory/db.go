// Package memory はPure-Go SQLiteによる会話ログ・長期記憶管理を提供します。
package memory

import (
	"bytes"
	"database/sql"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// Store はSQLiteデータベースへのアクセスを統括するストア構造体です。
type Store struct {
	db    *sql.DB
	mutex sync.RWMutex
}

// NewStore は指定パスのSQLiteデータベースに接続し、マイグレーションを実行します。
func NewStore(dbPath string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("DBディレクトリ作成失敗: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("SQLite接続失敗: %w", err)
	}

	// PRAGMA による高並行・低遅延化
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA cache_size = -32000;", // 32MBキャッシュ
		"PRAGMA temp_store = MEMORY;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("PRAGMA設定失敗 (%s): %w", p, err)
		}
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("DBマイグレーション失敗: %w", err)
	}

	return store, nil
}

// migrate は必要なテーブルとインデックスを作成します。
func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS conversation_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_conv_created ON conversation_logs(created_at);

	CREATE TABLE IF NOT EXISTS long_term_memories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		summary TEXT NOT NULL,
		embedding BLOB NOT NULL,
		dimension INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := s.db.Exec(schema)
	return err
}

// AddLog は新しい会話ログ（短期記憶）を保存します。
func (s *Store) AddLog(sessionID, role, content string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	query := "INSERT INTO conversation_logs (session_id, role, content) VALUES (?, ?, ?)"
	_, err := s.db.Exec(query, sessionID, role, content)
	return err
}

// GetRecentLogs は直近N件の会話ログを取得します。
func (s *Store) GetRecentLogs(limit int) ([][2]string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	query := `
	SELECT role, content FROM conversation_logs 
	ORDER BY id DESC LIMIT ?
	`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reversed [][2]string
	for rows.Next() {
		var role, content string
		if err := rows.Scan(&role, &content); err != nil {
			return nil, err
		}
		reversed = append(reversed, [2]string{role, content})
	}

	// 古い順に並び替え
	n := len(reversed)
	result := make([][2]string, n)
	for i := 0; i < n; i++ {
		result[i] = reversed[n-1-i]
	}

	return result, nil
}

// ClearLogs は短期会話ログを全消去します。
func (s *Store) ClearLogs() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, err := s.db.Exec("DELETE FROM conversation_logs")
	return err
}

// AddLongTermMemory は要約文と埋め込みベクトルを保存します。
func (s *Store) AddLongTermMemory(summary string, embedding []float32) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	buf := new(bytes.Buffer)
	for _, f := range embedding {
		_ = binary.Write(buf, binary.LittleEndian, f)
	}

	query := "INSERT INTO long_term_memories (summary, embedding, dimension) VALUES (?, ?, ?)"
	_, err := s.db.Exec(query, summary, buf.Bytes(), len(embedding))
	return err
}

// SearchSimilarMemories はクエリベクトルと類似する長期記憶上位K件を返します。
func (s *Store) SearchSimilarMemories(queryEmbedding []float32, topK int) ([]string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	rows, err := s.db.Query("SELECT summary, embedding, dimension FROM long_term_memories")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type scoredMemory struct {
		summary string
		score   float32
	}
	var scored []scoredMemory

	for rows.Next() {
		var summary string
		var blob []byte
		var dim int
		if err := rows.Scan(&summary, &blob, &dim); err != nil {
			continue
		}

		vec := make([]float32, dim)
		buf := bytes.NewReader(blob)
		_ = binary.Read(buf, binary.LittleEndian, &vec)

		sim := CosineSimilarity(queryEmbedding, vec)
		scored = append(scored, scoredMemory{summary: summary, score: sim})
	}

	// 上位K件を抽出
	var summaries []string
	for i, m := range scored {
		if i >= topK {
			break
		}
		summaries = append(summaries, m.summary)
	}

	return summaries, nil
}

// Close はデータベース接続を安全に閉じます。
func (s *Store) Close() error {
	return s.db.Close()
}
