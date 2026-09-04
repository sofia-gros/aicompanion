// Package process は外部推論エンジンおよび音声サーバーのプロセスライフサイクルを管理します。
package process

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

// WindowsJobObject は子プロセス群をグループ管理し、親プロセス終了時に連動して強制終了させるJob Objectです。
type WindowsJobObject struct {
	handle windows.Handle
}

// NewJobObject は親プロセス終了時に全子プロセスをOSレベルで自動終了するJob Objectを生成します。
func NewJobObject() (*WindowsJobObject, error) {
	hJob, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("Windows Job Objectの作成に失敗しました: %w", err)
	}

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{
			LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
		},
	}

	_, err = windows.SetInformationJobObject(
		hJob,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		windows.CloseHandle(hJob)
		return nil, fmt.Errorf("Job Objectへの終了制限フラグ設定に失敗しました: %w", err)
	}

	return &WindowsJobObject{handle: hJob}, nil
}

// AssignProcess は指定したプロセスハンドルをJob Objectに登録します。
func (j *WindowsJobObject) AssignProcess(hProcess windows.Handle) error {
	if j.handle == 0 {
		return fmt.Errorf("Job Objectハンドルが無効です")
	}
	return windows.AssignProcessToJobObject(j.handle, hProcess)
}

// Close はJob Objectのハンドルを解放します。
func (j *WindowsJobObject) Close() error {
	if j.handle == 0 {
		return nil
	}
	err := windows.CloseHandle(j.handle)
	j.handle = 0
	return err
}
