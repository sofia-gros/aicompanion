import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 予期せぬ例外からUI全体を守るエラーバウンダリコンポーネント
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100 select-none">
          <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center text-2xl mb-4">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-zinc-200">描画エラーが発生しました</h3>
          <p className="text-xs text-zinc-400 mt-2 max-w-md font-mono bg-zinc-900 p-3 rounded border border-zinc-800 text-left overflow-auto max-h-32">
            {this.state.error?.message || '不明なエラー'}
          </p>
          <div className="mt-4 flex gap-3">
            <Button size="sm" onClick={this.handleReset} className="bg-indigo-600 hover:bg-indigo-500">
              画面を復旧する
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
