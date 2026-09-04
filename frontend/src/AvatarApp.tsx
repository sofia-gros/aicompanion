import React, { useEffect, useRef, useState } from 'react';
import { Live2DCanvas } from './components/avatar/Live2DCanvas';
import { VRMCanvas } from './components/avatar/VRMCanvas';
import { Subtitle } from './components/avatar/Subtitle';
import { AudioService } from './services/audioService';
import { AvatarSpeakPayload } from './types/events';

/**
 * OBS Direct ブラウザソース専用の軽量アバター画面コンポーネント
 */
export const AvatarApp: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const initialText = searchParams.get('text') || '';
  const [subtitle, setSubtitle] = useState(initialText);
  const audioServiceRef = useRef<AudioService | null>(null);

  if (!audioServiceRef.current) {
    audioServiceRef.current = new AudioService();
  }

  useEffect(() => {
    // OBS配信用 WebSocket 接続
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || '127.0.0.1:18923';
    const wsUrl = `${protocol}//${host}/ws`;

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'avatar-speak') {
            const payload = msg.data as AvatarSpeakPayload;
            setSubtitle(payload.text);
            if (audioServiceRef.current) {
              audioServiceRef.current.pushChunk(payload);
            }
          }
        } catch {
          // JSONパース失敗無視
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const typeQuery = searchParams.get('type') || 'live2d';
  const modelQuery = searchParams.get('model');

  let initialModel = '/live2d/models/Hiyori/Hiyori.model3.json';
  if (modelQuery === 'Mao') initialModel = '/live2d/models/Mao/Mao.model3.json';
  if (modelQuery === 'Haru') initialModel = '/live2d/models/Haru/Haru.model3.json';

  const vrmUrl = searchParams.get('vrm') || '/vrm/Seed-san.vrm';

  const [modelPath] = useState(initialModel);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent select-none pointer-events-none">
      <div className="w-full h-full pointer-events-auto">
        {typeQuery === 'vrm' ? (
          <VRMCanvas modelUrl={vrmUrl} audioService={audioServiceRef.current!} />
        ) : (
          <Live2DCanvas modelPath={modelPath} audioService={audioServiceRef.current!} />
        )}
      </div>
      <Subtitle text={subtitle} />
    </div>
  );
};
