package websearch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CityCoord は都市名と地理座標の対応を表します。
type CityCoord struct {
	Name      string
	Latitude  float64
	Longitude float64
}

// WeatherClient はOpen-Meteo APIと通信して天気情報を取得するクライアントです。
type WeatherClient struct {
	client *http.Client
	cities map[string]CityCoord
}

// NewWeatherClient は新しい天気クライアントインスタンスを生成します。
func NewWeatherClient() *WeatherClient {
	cities := map[string]CityCoord{
		"東京": {Name: "東京", Latitude: 35.6895, Longitude: 139.6917},
		"大阪": {Name: "大阪", Latitude: 34.6937, Longitude: 135.5023},
		"名古屋": {Name: "名古屋", Latitude: 35.1815, Longitude: 136.9066},
		"札幌": {Name: "札幌", Latitude: 43.0618, Longitude: 141.3545},
		"福岡": {Name: "福岡", Latitude: 33.5904, Longitude: 130.4017},
		"横浜": {Name: "横浜", Latitude: 35.4437, Longitude: 139.6380},
		"京都": {Name: "京都", Latitude: 35.0116, Longitude: 135.7681},
		"神戸": {Name: "神戸", Latitude: 34.6901, Longitude: 135.1955},
		"仙台": {Name: "仙台", Latitude: 38.2682, Longitude: 140.8694},
		"広島": {Name: "広島", Latitude: 34.3853, Longitude: 132.4553},
		"那覇": {Name: "那覇", Latitude: 26.2124, Longitude: 127.6809},
		"沖縄": {Name: "那覇", Latitude: 26.2124, Longitude: 127.6809},
	}

	return &WeatherClient{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		cities: cities,
	}
}

// FetchWeather は都市名からOpen-Meteo APIを利用して本日の天気・気温・降水確率を取得します。
func (w *WeatherClient) FetchWeather(ctx context.Context, query string) (*SearchResult, error) {
	// クエリから都市名を判別（デフォルトは東京）
	targetCity := w.cities["東京"]
	for name, coord := range w.cities {
		if strings.Contains(query, name) {
			targetCity = coord
			break
		}
	}

	endpoint := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current_weather=true&hourly=precipitation_probability,temperature_2m&timezone=Asia%%2FTokyo",
		targetCity.Latitude,
		targetCity.Longitude,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("天気リクエスト作成失敗: %w", err)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("天気API通信エラー: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("天気APIがエラーステータスを返しました (HTTP %d)", resp.StatusCode)
	}

	var data struct {
		CurrentWeather struct {
			Temperature float64 `json:"temperature"`
			WindSpeed   float64 `json:"windspeed"`
			WeatherCode int     `json:"weathercode"`
		} `json:"current_weather"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("天気レスポンス解析失敗: %w", err)
	}

	weatherDesc := w.codeToJapanese(data.CurrentWeather.WeatherCode)
	snippet := fmt.Sprintf(
		"【%sの現在の気象情報】天気: %s、気温: %.1f℃、風速: %.1fm/s（データ提供: Open-Meteo）",
		targetCity.Name,
		weatherDesc,
		data.CurrentWeather.Temperature,
		data.CurrentWeather.WindSpeed,
	)

	return &SearchResult{
		Title:   fmt.Sprintf("%sの天気予報", targetCity.Name),
		Snippet: snippet,
		URL:     "https://open-meteo.com/",
		Source:  "Open-Meteo",
	}, nil
}

// codeToJapanese はWMO気象コードを分かりやすい日本語表現に変換します。
func (w *WeatherClient) codeToJapanese(code int) string {
	switch code {
	case 0:
		return "快晴"
	case 1, 2, 3:
		return "晴れ時々曇り"
	case 45, 48:
		return "霧"
	case 51, 53, 55:
		return "霧雨"
	case 61, 63, 65:
		return "雨"
	case 71, 73, 75:
		return "雪"
	case 80, 81, 82:
		return "にわか雨"
	case 95, 96, 99:
		return "雷雨"
	default:
		return "曇り"
	}
}
