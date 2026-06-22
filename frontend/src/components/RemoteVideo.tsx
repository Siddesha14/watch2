import React, { useRef, useEffect } from 'react';
import { Monitor } from 'lucide-react';

interface RemoteVideoProps {
  screenShareStream: MediaStream | null;
  peerId?: string | null;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  screenShareStream,
  peerId
}) => {
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Bind screen share stream to element
  useEffect(() => {
    console.log("REMOTE VIDEO STREAM", screenShareStream);
    if (screenVideoRef.current && screenShareStream) {
      screenVideoRef.current.srcObject = screenShareStream;
    }
    const screenStream = screenShareStream;
    console.log(
      "ATTACH SCREEN",
      peerId,
      screenStream?.id
    );
  }, [screenShareStream, peerId]);

  return (
    <div 
      id="stage-video-wrapper"
      className="w-full h-full bg-black overflow-hidden relative flex items-center justify-center group"
    >
      {/* 1. Screen Share Mode */}
      {screenShareStream ? (
        <div className="w-full h-full flex items-center justify-center relative bg-black">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain bg-black"
          />
          
          {/* Overlay info */}
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-indigo-400" />
            <span>Live Screen Stream</span>
          </div>
        </div>
      ) : (
        /* 2. Placeholder / Empty State (Part 11) */
        <div className="text-center p-8 flex flex-col items-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6 glow-primary">
            <Monitor className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          
          <h2 className="text-lg font-bold text-gray-200 mb-2">Waiting for screen broadcast...</h2>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            Invite friends to join the room and click "Share Screen" in the control dock to start streaming!
          </p>
        </div>
      )}
    </div>
  );
};
