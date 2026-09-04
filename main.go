package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "Desktop AI Companion Studio",
		Width:            1280,
		Height:           800,
		MinWidth:         1024,
		MinHeight:        650,
		Frameless:        false, // 初期起動時はStudioモード（通常枠）
		BackgroundColour: &options.RGBA{R: 18, G: 18, B: 24, A: 255},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Windows: &windows.Options{
			WebviewIsTransparent: true, // 透過ウィンドウ切り替え用
			WindowIsTranslucent:  true,
			DisableWindowIcon:    false,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Wails Error:", err.Error())
	}
}
