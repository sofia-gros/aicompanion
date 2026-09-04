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

// SystemUsage はPCのリアルタイムリソース使用状況（CPU, RAM, ROM/ディスク, GPU）を保持します。
type SystemUsage struct {
	CPUPercent  float64 `json:"cpuPercent"`  // CPU使用率 (0.0〜100.0%)
	RAMPercent  float64 `json:"ramPercent"`  // RAM使用率 (0.0〜100.0%)
	RAMUsedGB   float64 `json:"ramUsedGb"`   // 使用中RAM容量 (GB)
	RAMTotalGB  float64 `json:"ramTotalGb"`  // 搭載総RAM容量 (GB)
	ROMPercent  float64 `json:"romPercent"`  // ストレージ使用率 (0.0〜100.0%)
	ROMFreeGB   float64 `json:"romFreeGb"`   // ストレージ空き容量 (GB)
	ROMTotalGB  float64 `json:"romTotalGb"`  // ストレージ総容量 (GB)
	GPUInfo     string  `json:"gpuInfo"`     // GPU / VRAM情報またはアクセラレータ状況
}

var (
	lastIdleTime   uint64
	lastKernelTime uint64
	lastUserTime   uint64
	hasPrevCPUTime bool
)

type filetime struct {
	dwLowDateTime  uint32
	dwHighDateTime uint32
}

func filetimeToUint64(ft filetime) uint64 {
	return (uint64(ft.dwHighDateTime) << 32) | uint64(ft.dwLowDateTime)
}

// GetSystemUsage は現在のWindows PCのCPU使用率、RAM使用状況、ディスク空き状況を測定します。
func GetSystemUsage(targetPath string) SystemUsage {
	usage := SystemUsage{
		GPUInfo: "GPUアクセラレーション有効 (自動オフロード)",
	}

	kernel32 := syscall.NewLazyDLL("kernel32.dll")

	// 1. CPU使用率測定 (GetSystemTimes)
	getSystemTimes := kernel32.NewProc("GetSystemTimes")
	var idleTime, kernelTime, userTime filetime
	r, _, _ := getSystemTimes.Call(
		uintptr(unsafe.Pointer(&idleTime)),
		uintptr(unsafe.Pointer(&kernelTime)),
		uintptr(unsafe.Pointer(&userTime)),
	)
	if r != 0 {
		currIdle := filetimeToUint64(idleTime)
		currKernel := filetimeToUint64(kernelTime)
		currUser := filetimeToUint64(userTime)

		if hasPrevCPUTime {
			idleDiff := currIdle - lastIdleTime
			kernelDiff := currKernel - lastKernelTime
			userDiff := currUser - lastUserTime
			totalDiff := kernelDiff + userDiff

			if totalDiff > 0 && totalDiff >= idleDiff {
				usage.CPUPercent = float64(totalDiff-idleDiff) / float64(totalDiff) * 100.0
			}
		}
		lastIdleTime = currIdle
		lastKernelTime = currKernel
		lastUserTime = currUser
		hasPrevCPUTime = true
	}

	// 2. RAM使用状況測定 (GlobalMemoryStatusEx)
	globalMemoryStatusEx := kernel32.NewProc("GlobalMemoryStatusEx")
	var memStatus memoryStatusEx
	memStatus.cbSize = uint32(unsafe.Sizeof(memStatus))
	ret, _, _ := globalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memStatus)))
	if ret != 0 {
		totalGB := float64(memStatus.ullTotalPhys) / (1024 * 1024 * 1024)
		availGB := float64(memStatus.ullAvailPhys) / (1024 * 1024 * 1024)
		usedGB := totalGB - availGB

		usage.RAMTotalGB = totalGB
		usage.RAMUsedGB = usedGB
		usage.RAMPercent = float64(memStatus.dwMemoryLoad)
	}

	// 3. ストレージ (ROM) 使用状況測定 (GetDiskFreeSpaceExW)
	getDiskFreeSpaceEx := kernel32.NewProc("GetDiskFreeSpaceExW")
	if targetPath == "" {
		targetPath = "."
	}
	pathPtr, err := syscall.UTF16PtrFromString(targetPath)
	if err == nil {
		var freeBytesAvailable, totalNumberOfBytes, totalNumberOfFreeBytes uint64
		res, _, _ := getDiskFreeSpaceEx.Call(
			uintptr(unsafe.Pointer(pathPtr)),
			uintptr(unsafe.Pointer(&freeBytesAvailable)),
			uintptr(unsafe.Pointer(&totalNumberOfBytes)),
			uintptr(unsafe.Pointer(&totalNumberOfFreeBytes)),
		)
		if res != 0 && totalNumberOfBytes > 0 {
			totalDiskGB := float64(totalNumberOfBytes) / (1024 * 1024 * 1024)
			freeDiskGB := float64(totalNumberOfFreeBytes) / (1024 * 1024 * 1024)
			usedDiskGB := totalDiskGB - freeDiskGB

			usage.ROMTotalGB = totalDiskGB
			usage.ROMFreeGB = freeDiskGB
			usage.ROMPercent = (usedDiskGB / totalDiskGB) * 100.0
		}
	}

	return usage
}
