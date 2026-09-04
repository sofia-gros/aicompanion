package platform

import (
	"fmt"
	"syscall"
	"unsafe"
)

// SystemSpec はPCのハードウェアスペック情報とお勧めLLMの判定結果を保持します。
type SystemSpec struct {
	TotalRAMGB     int    `json:"totalRamGb"`     // 搭載RAM容量 (GB)
	AvailableRAMGB int    `json:"availableRamGb"` // 空きRAM容量 (GB)
	RecommendedTier string `json:"recommendedTier"` // 推奨LLMティアプリセット
	Recommendation  string `json:"recommendation"`  // ユーザー向け推薦メッセージ
}

type memoryStatusEx struct {
	cbSize                  uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

// GetSystemSpec は現在のWindows PCの搭載物理メモリ等を調査し、最適なLLMモデルを提案します。
func GetSystemSpec() SystemSpec {
	spec := SystemSpec{
		TotalRAMGB:      8,
		AvailableRAMGB:  4,
		RecommendedTier: "tier0_5b",
		Recommendation:  "8GB環境: 超軽量な0.5Bモデルが最も安定して動作します。",
	}

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	globalMemoryStatusEx := kernel32.NewProc("GlobalMemoryStatusEx")

	var memStatus memoryStatusEx
	memStatus.cbSize = uint32(unsafe.Sizeof(memStatus))

	ret, _, _ := globalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memStatus)))
	if ret != 0 {
		totalGB := int(memStatus.ullTotalPhys / (1024 * 1024 * 1024))
		availGB := int(memStatus.ullAvailPhys / (1024 * 1024 * 1024))

		spec.TotalRAMGB = totalGB
		spec.AvailableRAMGB = availGB

		if totalGB <= 8 {
			spec.RecommendedTier = "tier0_5b"
			spec.Recommendation = fmt.Sprintf("RAM %dGB 検出: 0.5B (約400MB) モデルを推奨します。軽量かつ高速に応答します。", totalGB)
		} else if totalGB <= 16 {
			spec.RecommendedTier = "tier1_5b"
			spec.Recommendation = fmt.Sprintf("RAM %dGB 検出: 1.5B (約1.1GB) モデルを推奨します。表現力と速度のバランスが優れています。", totalGB)
		} else {
			spec.RecommendedTier = "tier3b"
			spec.Recommendation = fmt.Sprintf("RAM %dGB 検出: 3B〜7B モデルを快適に稼働できます。高品質な対話をお楽しみください。", totalGB)
		}
	}

	return spec
}
