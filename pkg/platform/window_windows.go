// Package platform はWindows OSネイティブAPIとの連携機能を提供します。
package platform

import (
	"golang.org/x/sys/windows"
)

var (
	user32           = windows.NewLazySystemDLL("user32.dll")
	setWindowLongPtr = user32.NewProc("SetWindowLongPtrW")
	getWindowLongPtr = user32.NewProc("GetWindowLongPtrW")
)

const (
	// WS_EX_TRANSPARENT はマウスイベントを透過させるスタイルです。
	WS_EX_TRANSPARENT = 0x00000020
	// WS_EX_LAYERED はレイヤードウィンドウを指定するスタイルです。
	WS_EX_LAYERED = 0x00080000
)

var gwlExStyle int32 = -20

// SetClickThrough は指定ウィンドウハンドルのマウス透過（Click-Through）状態を切り替えます。
func SetClickThrough(hwnd uintptr, enable bool) error {
	index := uintptr(gwlExStyle)
	currentStyle, _, _ := getWindowLongPtr.Call(hwnd, index)
	var newStyle uintptr
	if enable {
		newStyle = currentStyle | uintptr(WS_EX_TRANSPARENT) | uintptr(WS_EX_LAYERED)
	} else {
		newStyle = currentStyle &^ uintptr(WS_EX_TRANSPARENT)
	}
	setWindowLongPtr.Call(hwnd, index, newStyle)
	return nil
}

// LaunchOverlayBrowser は指定されたURLをタイトルバーのない独立したEdge Appウィンドウ（または既定ブラウザ）として起動します。
func LaunchOverlayBrowser(url string) error {
	verbPtr, _ := windows.UTF16PtrFromString("open")
	filePtr, _ := windows.UTF16PtrFromString("msedge.exe")
	paramsPtr, _ := windows.UTF16PtrFromString("--app=" + url + " --window-size=450,700 --no-first-run")

	err := windows.ShellExecute(0, verbPtr, filePtr, paramsPtr, nil, windows.SW_SHOWNORMAL)
	if err != nil {
		// Edge の起動に失敗した場合は、既定のブラウザでURLを開く
		urlPtr, _ := windows.UTF16PtrFromString(url)
		return windows.ShellExecute(0, verbPtr, urlPtr, nil, nil, windows.SW_SHOWNORMAL)
	}
	return nil
}
