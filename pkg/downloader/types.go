package downloader

// DownloadProgressEvent はダウンロードの進捗状況をフロントエンドへ通知するペイロードです。
type DownloadProgressEvent struct {
	ModelKey         string  `json:"modelKey"`
	DownloadedBytes  int64   `json:"downloadedBytes"`
	TotalBytes       int64   `json:"totalBytes"`
	SpeedBytesPerSec float64 `json:"speedBytesPerSec"`
	Percent          float64 `json:"percent"`
	IsCompleted      bool    `json:"isCompleted"`
	Error            string  `json:"error,omitempty"`
}

// ModelMeta はダウンロード可能なモデルのメタ情報です。
type ModelMeta struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	FileName    string `json:"fileName"`
	URL         string `json:"url"`
	SizeDisplay string `json:"sizeDisplay"`
}
