import React, { useRef, useState, useEffect } from 'react';
import { Mic, MicOff, Maximize2, Move, Lock, Unlock, RotateCcw } from 'lucide-react';

interface CameraBubbleProps {
  stream: MediaStream | null;
  audioStream?: MediaStream | null;
  username: string;
  isMuted: boolean;
  isCameraOn: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  isMobile?: boolean;
}

export const CameraBubble: React.FC<CameraBubbleProps> = ({
  stream,
  audioStream,
  username,
  isMuted,
  isCameraOn,
  isFocused = false,
  onFocus,
  isMobile = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const storageKey = 'localCameraBubble';
  
  // Draggable and Resizable state restored from localStorage
  const [size, setSize] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { width, height } = JSON.parse(saved);
        if (isMobile) {
          const clampedWidth = Math.max(80, Math.min(200, width));
          const clampedHeight = Math.max(60, Math.min(150, height));
          return { width: clampedWidth, height: clampedHeight };
        }
        return { width, height };
      } catch (e) {}
    }
    return isMobile ? { width: 100, height: 75 } : { width: 220, height: 160 };
  });

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { width, height, x, y } = JSON.parse(saved);
        const w = isMobile ? Math.max(80, Math.min(200, width)) : width;
        const h = isMobile ? Math.max(60, Math.min(150, height)) : height;
        const cleanX = Math.max(10, Math.min(window.innerWidth - w - 10, x));
        const cleanY = Math.max(10, Math.min(window.innerHeight - h - 10, y));
        return { x: cleanX, y: cleanY };
      } catch (e) {}
    }
    return isMobile ? { x: 10, y: 70 } : { x: 20, y: 80 };
  });

  useEffect(() => {
    if (isMobile) {
      setSize((prev) => {
        const nextW = Math.max(80, Math.min(200, prev.width));
        const nextH = Math.max(60, Math.min(150, prev.height));
        return { width: nextW, height: nextH };
      });
      setPosition((prev) => {
        const cleanX = Math.max(10, Math.min(window.innerWidth - 100 - 10, prev.x));
        const cleanY = Math.max(10, Math.min(window.innerHeight - 75 - 10, prev.y));
        return { x: cleanX, y: cleanY };
      });
    } else {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const { width, height } = JSON.parse(saved);
          setSize({ width, height });
        } catch (e) {}
      } else {
        setSize({ width: 220, height: 160 });
      }
    }
  }, [isMobile]);
  
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true); // Default: locked
  const [showDimensions, setShowDimensions] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const isResizing = resizeHandle !== null;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const dimensionsTimeout = useRef<number | null>(null);

  // Audio Level Analyser
  useEffect(() => {
    if (!audioStream || isMuted) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let animationFrameId: number;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      
      source = audioContext.createMediaStreamSource(audioStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        
        let total = 0;
        for (let i = 0; i < bufferLength; i++) {
          total += dataArray[i];
        }
        const average = total / bufferLength;
        setIsSpeaking(average > 8);
        animationFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn("Failed to initialize audio analyzer", err);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [audioStream, isMuted]);

  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      videoRef.current.srcObject = stream;
      console.log("CAMERA ATTACHED", { peerId: "local" });
    }
  }, [stream, isCameraOn]);

  useEffect(() => {
    if (audioStream) {
      console.log("AUDIO ATTACHED", { peerId: "local" });
    }
  }, [audioStream]);

  // Drag logic
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onFocus) onFocus();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { x: position.x, y: position.y };
  };

  // Resize start logic
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFocus) onFocus();
    setResizeHandle(handle);
    resizeStart.current = { x: e.clientX, y: e.clientY };
    sizeStart.current = { width: size.width, height: size.height };
    posStart.current = { x: position.x, y: position.y };
  };

  // Double click cycling sizes: 100x75 -> 140x105 -> 180x135 -> back (or mobile cycles)
  const handleDoubleClick = () => {
    let nextWidth = 240;
    let nextHeight = 180;
    if (isMobile) {
      if (size.width === 100 && size.height === 75) {
        nextWidth = 140;
        nextHeight = 105;
      } else if (size.width === 140 && size.height === 105) {
        nextWidth = 180;
        nextHeight = 135;
      } else {
        nextWidth = 100;
        nextHeight = 75;
      }
    } else {
      if (size.width === 120 && size.height === 90) {
        nextWidth = 240;
        nextHeight = 180;
      } else if (size.width === 240 && size.height === 180) {
        nextWidth = 420;
        nextHeight = 315;
      } else if (size.width === 420 && size.height === 315) {
        nextWidth = 640;
        nextHeight = 480;
      } else {
        nextWidth = 120;
        nextHeight = 90;
      }
    }

    const newX = Math.max(10, Math.min(window.innerWidth - nextWidth - 10, position.x));
    const newY = Math.max(10, Math.min(window.innerHeight - nextHeight - 10, position.y));

    setSize({ width: nextWidth, height: nextHeight });
    setPosition({ x: newX, y: newY });
    localStorage.setItem(storageKey, JSON.stringify({ width: nextWidth, height: nextHeight, x: newX, y: newY }));
  };

  // Reset bubble settings
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultX = isMobile ? 10 : 20;
    const defaultY = isMobile ? 70 : 80;
    const defaultWidth = isMobile ? 100 : 220;
    const defaultHeight = isMobile ? 75 : 160;

    setSize({ width: defaultWidth, height: defaultHeight });
    setPosition({ x: defaultX, y: defaultY });
    localStorage.removeItem(storageKey);
  };

  // Touch event handlers for mobile gestures (drag and pinch resize)
  const touchStart = useRef({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (onFocus) onFocus();
    if (e.touches.length === 1) {
      // Single touch = drag
      setIsDragging(true);
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      posStart.current = { x: position.x, y: position.y };
    } else if (e.touches.length === 2) {
      // Double touch = pinch resize
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(dist);
      sizeStart.current = { width: size.width, height: size.height };
      posStart.current = { x: position.x, y: position.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;
      
      const newX = Math.max(10, Math.min(window.innerWidth - size.width - 10, posStart.current.x + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - size.height - 10, posStart.current.y + dy));
      
      setPosition({ x: newX, y: newY });
    } else if (e.touches.length === 2 && initialPinchDistance !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistance;
      
      let newWidth = sizeStart.current.width * factor;
      let newHeight = sizeStart.current.height * factor;

      // Maintain aspect ratio
      const ratio = sizeStart.current.width / sizeStart.current.height;
      newHeight = newWidth / ratio;

      const minW = 80;
      const maxW = 200;
      const minH = 60;
      const maxH = 150;

      newWidth = Math.max(minW, Math.min(maxW, newWidth));
      newHeight = Math.max(minH, Math.min(maxH, newHeight));

      const dx = newWidth - size.width;
      const dy = newHeight - size.height;
      let newX = position.x - dx / 2;
      let newY = position.y - dy / 2;

      newX = Math.max(10, Math.min(window.innerWidth - newWidth - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - newHeight - 10, newY));

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setInitialPinchDistance(null);
    localStorage.setItem(storageKey, JSON.stringify({ width: size.width, height: size.height, x: position.x, y: position.y }));
  };

  // Dimensions tooltip visibility handler
  useEffect(() => {
    if (isResizing) {
      setShowDimensions(true);
      if (dimensionsTimeout.current) {
        window.clearTimeout(dimensionsTimeout.current);
        dimensionsTimeout.current = null;
      }
    } else if (showDimensions && !isResizing) {
      dimensionsTimeout.current = window.setTimeout(() => {
        setShowDimensions(false);
      }, 1500);
    }
  }, [size, isResizing]);

  // Non-passive mouse-wheel scaling listener
  useEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      
      let newWidth = size.width * zoomFactor;
      let newHeight = size.height * zoomFactor;

      if (aspectRatioLocked) {
        const ratio = size.width / size.height;
        if (e.deltaY < 0) {
          newHeight = newWidth / ratio;
        } else {
          newWidth = newHeight * ratio;
        }
      }

      const minW = 80;
      const maxW = isMobile ? 200 : 800;
      const minH = 60;
      const maxH = isMobile ? 150 : 600;

      newWidth = Math.max(minW, Math.min(maxW, newWidth));
      newHeight = Math.max(minH, Math.min(maxH, newHeight));

      const dx = newWidth - size.width;
      const dy = newHeight - size.height;
      let newX = position.x - dx / 2;
      let newY = position.y - dy / 2;

      newX = Math.max(10, Math.min(window.innerWidth - newWidth - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - newHeight - 10, newY));

      setShowDimensions(true);
      if (dimensionsTimeout.current) {
        window.clearTimeout(dimensionsTimeout.current);
      }
      dimensionsTimeout.current = window.setTimeout(() => {
        setShowDimensions(false);
      }, 1500);

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
      localStorage.setItem(storageKey, JSON.stringify({ width: newWidth, height: newHeight, x: newX, y: newY }));
    };

    bubble.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      bubble.removeEventListener('wheel', onWheel);
    };
  }, [size, position, aspectRatioLocked, isMobile]);

  // Drag and drag-resize handling logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        const newX = Math.max(10, Math.min(window.innerWidth - size.width - 10, posStart.current.x + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - size.height - 10, posStart.current.y + dy));
        
        setPosition({ x: newX, y: newY });
        localStorage.setItem(storageKey, JSON.stringify({ width: size.width, height: size.height, x: newX, y: newY }));
      }

      if (isResizing && resizeHandle) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        
        let newWidth = sizeStart.current.width;
        let newHeight = sizeStart.current.height;
        let newX = posStart.current.x;
        let newY = posStart.current.y;

        const minW = 80;
        const minH = 60;
        const maxW = 800;
        const maxH = 600;

        if (resizeHandle.includes('e')) {
          newWidth = sizeStart.current.width + dx;
        } else if (resizeHandle.includes('w')) {
          newWidth = sizeStart.current.width - dx;
        }

        if (resizeHandle.includes('s')) {
          newHeight = sizeStart.current.height + dy;
        } else if (resizeHandle.includes('n')) {
          newHeight = sizeStart.current.height - dy;
        }

        if (aspectRatioLocked) {
          const ratio = sizeStart.current.width / sizeStart.current.height;
          if (resizeHandle === 'nw' || resizeHandle === 'ne' || resizeHandle === 'sw' || resizeHandle === 'se') {
            if (Math.abs(dx) > Math.abs(dy)) {
              newWidth = Math.max(minW, Math.min(maxW, newWidth));
              newHeight = newWidth / ratio;
            } else {
              newHeight = Math.max(minH, Math.min(maxH, newHeight));
              newWidth = newHeight * ratio;
            }
          } else if (resizeHandle === 'n' || resizeHandle === 's') {
            newHeight = Math.max(minH, Math.min(maxH, newHeight));
            newWidth = newHeight * ratio;
          } else if (resizeHandle === 'e' || resizeHandle === 'w') {
            newWidth = Math.max(minW, Math.min(maxW, newWidth));
            newHeight = newWidth / ratio;
          }
        }

        newWidth = Math.max(minW, Math.min(maxW, newWidth));
        newHeight = Math.max(minH, Math.min(maxH, newHeight));

        if (resizeHandle.includes('w')) {
          const widthDiff = newWidth - sizeStart.current.width;
          newX = posStart.current.x - widthDiff;
        }
        if (resizeHandle.includes('n')) {
          const heightDiff = newHeight - sizeStart.current.height;
          newY = posStart.current.y - heightDiff;
        }

        newX = Math.max(10, Math.min(window.innerWidth - newWidth - 10, newX));
        newY = Math.max(10, Math.min(window.innerHeight - newHeight - 10, newY));

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
        localStorage.setItem(storageKey, JSON.stringify({ width: newWidth, height: newHeight, x: newX, y: newY }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle, size, position, aspectRatioLocked]);

  return (
    <div
      ref={bubbleRef}
      onMouseDown={onFocus}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        position: 'absolute',
        zIndex: isFocused ? 10000 : 1000
      }}
      className={`glass-premium rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10 transition-all ${
        isDragging ? 'shadow-indigo-500/20 scale-[1.02] cursor-grabbing border-indigo-500/30' : ''
      } ${
        isSpeaking ? 'ring-2 ring-emerald-500 shadow-emerald-500/20' : ''
      }`}
    >
      {/* Edge and Corner Resizers */}
      {!isMobile && (
        <>
          <div onMouseDown={(e) => handleResizeStart(e, 'n')} className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize z-50 hover:bg-indigo-500/20 transition-colors" />
          <div onMouseDown={(e) => handleResizeStart(e, 's')} className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize z-50 hover:bg-indigo-500/20 transition-colors" />
          <div onMouseDown={(e) => handleResizeStart(e, 'w')} className="absolute top-0 bottom-0 left-0 w-1.5 cursor-w-resize z-50 hover:bg-indigo-500/20 transition-colors" />
          <div onMouseDown={(e) => handleResizeStart(e, 'e')} className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize z-50 hover:bg-indigo-500/20 transition-colors" />
          
          <div onMouseDown={(e) => handleResizeStart(e, 'nw')} className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-[60]" />
          <div onMouseDown={(e) => handleResizeStart(e, 'ne')} className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-[60]" />
          <div onMouseDown={(e) => handleResizeStart(e, 'sw')} className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-[60]" />
          <div onMouseDown={(e) => handleResizeStart(e, 'se')} className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-[60]" />
        </>
      )}

      {/* Title/Drag Bar */}
      <div 
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
        className="px-3 py-1.5 bg-slate-900/80 border-b border-white/5 flex items-center justify-between text-[10px] text-gray-300 select-none cursor-grab"
      >
        <span className="font-semibold truncate max-w-[100px]" title={`${username} (You)`}>
          {username} (You)
        </span>
        <div className="flex items-center gap-1.5 text-gray-400">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
            className={`p-0.5 hover:text-indigo-400 transition-colors cursor-pointer ${aspectRatioLocked ? 'text-indigo-400' : 'text-gray-400/60'}`}
            title={aspectRatioLocked ? "Lock (🔒) active. Keep ratio" : "Unlock (🔓) active. Stretch free"}
          >
            {aspectRatioLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleReset}
            className="p-0.5 hover:text-indigo-400 transition-colors text-gray-400/60 cursor-pointer"
            title="Reset Settings"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <Move className="w-3 h-3" />
          {isMuted ? (
            <MicOff className="w-3 h-3 text-rose-400" />
          ) : (
            <Mic className="w-3 h-3 text-emerald-400" />
          )}
        </div>
      </div>

      {/* Video Content */}
      <div className="flex-1 bg-slate-950/60 relative flex items-center justify-center">
        {isCameraOn && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]" // mirror local camera
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-white text-base font-bold select-none">
              {username.substring(0, 2).toUpperCase()}
            </div>
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
              Camera Off
            </span>
          </div>
        )}

        {/* Temporary dimension indicator tooltip overlay */}
        {showDimensions && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-[10001] pointer-events-none transition-opacity duration-300">
            <span className="bg-slate-900/90 border border-white/10 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-indigo-300 shadow-xl">
              {Math.round(size.width)} × {Math.round(size.height)}
            </span>
          </div>
        )}

        {/* Diagonal Resize Assist Indicator */}
        {!isMobile && (
          <div
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 group z-50"
            title="Resize bubble"
          >
            <Maximize2 className="w-2.5 h-2.5 text-gray-400/60 group-hover:text-indigo-400 transition-colors" />
          </div>
        )}
      </div>
    </div>
  );
};
