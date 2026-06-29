import React, { useEffect, useState, useRef } from 'react';
import socketService from '../services/socket';
import webrtcService from '../services/webrtc';
import { TopBar } from '../components/TopBar';
import { ParticipantList } from '../components/ParticipantList';
import { ChatPanel } from '../components/ChatPanel';
import { ControlDock } from '../components/ControlDock';
import { RemoteVideo } from '../components/RemoteVideo';
import { CameraBubble } from '../components/CameraBubble';
import { RemoteCameraBubble } from '../components/RemoteCameraBubble';
import { sessionService } from '../services/sessionService';

interface RemoteStreamsValue {
  cameraStream: MediaStream | null;
  audioStream: MediaStream | null;
  screenStream: MediaStream | null;
}

interface Participant {
  socketId: string;
  username: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
}

interface ChatMessage {
  id: string;
  senderSocketId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface RoomProps {
  roomId: string;
  username: string;
  onLeave: () => void;
}

export const Room: React.FC<RoomProps> = ({ roomId, username, onLeave }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [_localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  
  // A/V Toggles
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  
  // Streams
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  
  // Remote Streams map: peerSocketId -> { cameraStream, audioStream, screenStream }
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStreamsValue>>(new Map());
  const remoteStreamsRef = useRef(remoteStreams);

  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // Connection State
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [hostName, setHostName] = useState('System');

  // Fullscreen, drag-focus, and message notifications (toasts)
  const [theaterMode, setTheaterMode] = useState(false);
  const [focusedBubbleId, setFocusedBubbleId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; username: string; text: string }[]>([]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = document.fullscreenElement !== null;
      const stageContainer = document.getElementById('stage-container');
      if (isFs && document.fullscreenElement === stageContainer) {
        setTheaterMode(true);
      } else {
        setTheaterMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Sidebars
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 768);
  const [participantsOpen, setParticipantsOpen] = useState(() => window.innerWidth >= 768);

  const [cameraBubblesMenuOpen, setCameraBubblesMenuOpen] = useState(false);
  const [hiddenBubbles, setHiddenBubbles] = useState<string[]>(() => {
    const saved = localStorage.getItem('hiddenBubbles');
    return saved ? JSON.parse(saved) : [];
  });

  const handleToggleHideBubble = (name: string) => {
    setHiddenBubbles((prev) => {
      let next;
      if (prev.includes(name)) {
        next = prev.filter((n) => n !== name);
      } else {
        next = [...prev, name];
      }
      localStorage.setItem('hiddenBubbles', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleCameraBubblesMenu = () => {
    const nextVal = !cameraBubblesMenuOpen;
    setCameraBubblesMenuOpen(nextVal);
    if (nextVal && isMobile) {
      setChatOpen(false);
      setParticipantsOpen(false);
    }
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // References for sidebar state to prevent stale closures in socket handlers
  const chatOpenRef = useRef(chatOpen);
  const participantsOpenRef = useRef(participantsOpen);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    participantsOpenRef.current = participantsOpen;
  }, [participantsOpen]);

  // Reference for socket connection check
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    // 1. Connect Socket
    const socket = socketService.connect();
    setConnectionState('connecting');

    // Store room ID in socket object so webrtc can reference it
    (socket as any).roomId = roomId;

    // Join room
    console.log("JOINING ROOM:", roomId, "AS USER:", username);
    socketService.joinRoom(roomId, username).then((res) => {
      console.log("JOIN RESPONSE RECEIVED:", res);
      if (res.success && res.room) {
        sessionService.saveSession(roomId, username);
        console.log("PARTICIPANTS IN ROOM:", res.room.participants);
        setConnectionState('connected');
        setParticipants(res.room.participants);
        setLocalParticipant(res.localParticipant);
        
        // Find host name
        const host = res.room.participants.find((p: any) => p.isHost);
        setHostName(host ? host.username : 'Unknown');
        
        // Sync media state disabled

        // Initialize WebRTC connection logic
        webrtcService.init(
          // On remote track received
          (peerSocketId, stream, type, trackId) => {
            console.log("REMOTE STREAM UPDATED", peerSocketId, stream);
            console.log(`UI onRemoteTrack: ${peerSocketId} added ${type}`);
            
            console.log(
              "REMOTE TRACK CALLBACK",
              peerSocketId,
              type,
              stream?.id
            );

            if (type === 'camera-video') {
              console.log(`REMOTE CAMERA TRACK RECEIVED:\n${peerSocketId}\n${stream.id}\n${trackId}`);
            } else if (type === 'screen-video') {
              console.log("SCREEN SHARE STARTED", { peerId: peerSocketId });
            }

            setRemoteStreams((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(peerSocketId) || { cameraStream: null, audioStream: null, screenStream: null };
              
              const updated = { ...existing };
              if (type === 'camera-video') {
                updated.cameraStream = stream;
              } else if (type === 'microphone-audio') {
                updated.audioStream = stream;
              } else if (type === 'screen-video') {
                updated.screenStream = stream;
              }
              
              newMap.set(peerSocketId, updated);

              console.log(
                "STATE UPDATE",
                peerSocketId,
                {
                  cameraStream: !!updated.cameraStream,
                  audioStream: !!updated.audioStream,
                  screenStream: !!updated.screenStream
                }
              );

              return newMap;
            });
          },
          // On remote track removed
          (peerSocketId, _streamId, type) => {
            console.log(`UI onRemoteTrackRemoved: ${peerSocketId} removed ${type}`);
            
            if (type === 'camera-video') {
              console.log(`CAMERA REMOVED:\n${peerSocketId}`);
              console.log("CAMERA REMOVED", { peerId: peerSocketId });
            } else if (type === 'microphone-audio') {
              console.log("AUDIO REMOVED", { peerId: peerSocketId });
            } else if (type === 'screen-video') {
              console.log("SCREEN SHARE STOPPED", { peerId: peerSocketId });
            }

            setRemoteStreams((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(peerSocketId);
              if (existing) {
                const updated = { ...existing };
                if (type === 'camera-video') {
                  updated.cameraStream = null;
                } else if (type === 'microphone-audio') {
                  updated.audioStream = null;
                } else if (type === 'screen-video') {
                  updated.screenStream = null;
                }
                newMap.set(peerSocketId, updated);
              }
              return newMap;
            });
          },
          // On connection state change
          (peerSocketId, state) => {
            console.log(`Peer PC state changed: ${peerSocketId} is ${state}`);
            if (state === 'connected') {
              console.log("PEER CONNECTED", { peerId: peerSocketId });
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
              console.log("PEER DISCONNECTED", { peerId: peerSocketId });
            }
          }
        );

        // Connect WebRTC: Only B (the new user) creates offers to existing participants (p)
        res.room.participants.forEach((p: any) => {
          if (p.socketId !== socket.id) {
            console.log("CREATING CONNECTION (GUEST -> HOST/PEER) TO:", p.socketId);
            webrtcService.connectToPeer(p.socketId).then(() => {
              // Send current metadata mapping
              webrtcService.sendAllTrackMetadataToPeer(p.socketId, roomId);
            });
          }
        });
      } else {
        sessionService.clearSession();
        setConnectionState('disconnected');
        alert(res.error || 'Failed to join room');
        onLeave();
      }
    });

    // 2. Bind Socket Listeners
    socket.on('user-joined', ({ participant, room }) => {
      console.log("USER-JOINED BROADCAST:", participant.username, participant.socketId);
      console.log("TOTAL PARTICIPANTS IN ROOM NOW:", room.participants.length);
      setParticipants(room.participants);
      
      // WEBRTC GLARE RESOLUTION:
      // Host / Existing Peer A does NOT call connectToPeer here.
      // We wait for the newcomer to initiate connection (send offer).
      // We only send our metadata so they can map our tracks when they receive them.
      webrtcService.sendAllTrackMetadataToPeer(participant.socketId, roomId);
    });

    socket.on('user-left', ({ socketId, room }) => {
      console.log("USER-LEFT BROADCAST FOR SOCKET:", socketId);
      
      const streamObj = remoteStreamsRef.current.get(socketId);
      if (streamObj) {
        if (streamObj.cameraStream) {
          console.log(`CAMERA REMOVED:\n${socketId}`);
          console.log("CAMERA REMOVED", { peerId: socketId });
        }
        if (streamObj.audioStream) {
          console.log("AUDIO REMOVED", { peerId: socketId });
        }
        if (streamObj.screenStream) {
          console.log("SCREEN SHARE STOPPED", { peerId: socketId });
        }
      }
      console.log("PEER DISCONNECTED", { peerId: socketId });

      if (room) {
        console.log("TOTAL PARTICIPANTS IN ROOM NOW:", room.participants.length);
        setParticipants(room.participants);
        const host = room.participants.find((p: any) => p.isHost);
        setHostName(host ? host.username : 'System');
      }
      // Remove remote streams and close peer connection
      webrtcService.closeConnection(socketId);
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(socketId);
        return newMap;
      });
    });

    socket.on('room-updated', (room) => {
      setParticipants(room.participants);
      const host = room.participants.find((p: any) => p.isHost);
      setHostName(host ? host.username : 'System');
      
      const local = room.participants.find((p: any) => p.socketId === socket.id);
      if (local) {
        setLocalParticipant(local);
      }
      
      // Screen share state
      if (!room.screenShareHost) {
        // Clear remote screen sharing states
      }
    });

    socket.on('screen-share-started', ({ hostSocketId }) => {
      console.log(`Screen sharing started by ${hostSocketId}`);
    });

    socket.on('screen-share-stopped', () => {
      console.log('Screen sharing stopped by host');
    });

    socket.on('message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      if (!chatOpenRef.current) {
        setUnreadCount((c) => c + 1);
        
        // Add message toast notification (Part 8)
        const newToast = { id: message.id, username: message.username, text: message.text };
        setToasts((prev) => [...prev, newToast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== message.id));
        }, 4000);
      }
    });

    // Cleanup
    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('room-updated');
      socket.off('screen-share-started');
      socket.off('screen-share-stopped');
      socket.off('message');
      socketService.leaveRoom();
      webrtcService.clearAll();
      hasJoinedRef.current = false;
    };
  }, [roomId, username, onLeave]);

  // Audio / Video control actions
  const handleToggleMic = async () => {
    try {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);

      if (nextMuted) {
        webrtcService.stopMic();
      } else {
        await webrtcService.startCameraAndMic(isCameraOn, true);
      }

      socketService.updateState(roomId, { isMuted: nextMuted });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCamera = async () => {
    try {
      const nextCamera = !isCameraOn;
      setIsCameraOn(nextCamera);

      if (!nextCamera) {
        webrtcService.stopCamera();
        setLocalCameraStream(null);
      } else {
        const stream = await webrtcService.startCameraAndMic(true, !isMuted);
        setLocalCameraStream(stream);
      }

      socketService.updateState(roomId, { isCameraOn: nextCamera });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isSharingScreen) {
        webrtcService.stopScreenShare(roomId);
        setLocalScreenStream(null);
        setIsSharingScreen(false);
      } else {
        const stream = await webrtcService.startScreenShare(roomId);
        setLocalScreenStream(stream);
        setIsSharingScreen(true);
      }
    } catch (err) {
      console.error('Error sharing screen:', err);
      setIsSharingScreen(false);
    }
  };

  // Chat message sending
  const handleSendMessage = (text: string) => {
    socketService.sendMessage(roomId, text);
  };

  const handleToggleChat = () => {
    const nextChatOpen = !chatOpen;
    setChatOpen(nextChatOpen);
    if (nextChatOpen) {
      handleClearUnread();
      if (isMobile) {
        setParticipantsOpen(false);
        setCameraBubblesMenuOpen(false);
      }
    }
  };

  const handleToggleParticipants = () => {
    const nextParticipantsOpen = !participantsOpen;
    setParticipantsOpen(nextParticipantsOpen);
    if (nextParticipantsOpen && isMobile) {
      setChatOpen(false);
      setCameraBubblesMenuOpen(false);
    }
  };

  // Video sync emitters disabled

  const handleLeaveRoom = () => {
    sessionService.clearSession();
    webrtcService.clearAll();
    socketService.leaveRoom();
    onLeave();
  };

  // Fullscreen support on the stage container
  const handleToggleFullscreen = () => {
    const container = document.getElementById('stage-container');
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handleClearUnread = () => {
    setUnreadCount(0);
  };

  // Calculate screen share details
  
  // Find if someone else is screen sharing
  let activeRemoteScreenStream: MediaStream | null = null;
  let screenShareHostId: string | null = null;

  participants.forEach((p) => {
    if (p.socketId !== socketService.socket?.id) {
      const streamObj = remoteStreams.get(p.socketId);
      if (streamObj?.screenStream) {
        activeRemoteScreenStream = streamObj.screenStream;
        screenShareHostId = p.socketId;
      }
    }
  });

  // Calculate stage stream and host ownership based on priority:
  // Priority: 1. Remote screen share, 2. Local screen share, 3. null (placeholder)
  const activeStageStream = activeRemoteScreenStream || localScreenStream;
  const activeScreenHostId = activeRemoteScreenStream 
    ? screenShareHostId 
    : (localScreenStream ? socketService.socket?.id : null);

  // Custom playback events disabled

  return (
    <div id="room-container" className="h-[100dvh] w-screen flex flex-col justify-between overflow-hidden bg-[#0a0b0d] text-white relative">
      
      {/* Top Navigation */}
      {!theaterMode && (
        <TopBar
          roomId={roomId}
          participantCount={participants.length}
          connectionState={connectionState}
          hostName={hostName}
          isMobile={isMobile}
        />
      )}

      {/* Main View Area */}
      <div className="flex-1 flex gap-4 px-4 overflow-hidden py-4 z-10 relative">
        
        {/* Backdrop for mobile drawers */}
        {isMobile && (participantsOpen || chatOpen) && (
          <div 
            className="fixed inset-0 bg-black/60 z-45 animate-in fade-in duration-200"
            onClick={() => {
              setParticipantsOpen(false);
              setChatOpen(false);
            }}
          />
        )}

        {/* Central WebRTC Media Stage / Theater Mode Container */}
        <div 
          id="stage-container"
          className={
            theaterMode 
              ? "fixed inset-0 w-screen h-screen z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden" 
              : "flex-1 h-full flex flex-col justify-center relative overflow-hidden"
          }
        >
          {/* Active Stream */}
          <RemoteVideo
            screenShareStream={activeStageStream}
            peerId={activeScreenHostId}
            isLocalScreenOwner={activeScreenHostId === socketService.socket?.id}
          />

          {/* Draggable FaceTime Webcams */}
          {/* Local Webcam Bubble */}
          {(isCameraOn || localCameraStream) && (
            <CameraBubble
              stream={localCameraStream}
              audioStream={webrtcService.localMicStream}
              username={username}
              isMuted={isMuted}
              isCameraOn={isCameraOn}
              isFocused={focusedBubbleId === 'local'}
              onFocus={() => setFocusedBubbleId('local')}
              isMobile={isMobile}
              isHidden={hiddenBubbles.includes(username)}
              onHide={() => handleToggleHideBubble(username)}
            />
          )}

          {/* Remote Webcam Bubbles */}
          {participants
            .filter((p) => p.socketId !== socketService.socket?.id)
            .map((p, index) => {
              const streamObj = remoteStreams.get(p.socketId);
              const cameraStream = streamObj?.cameraStream || null;
              const isHidden = hiddenBubbles.includes(p.username);
              return (
                <RemoteCameraBubble
                  key={p.socketId}
                  peerSocketId={p.socketId}
                  cameraStream={cameraStream}
                  audioStream={streamObj?.audioStream || null}
                  username={p.username}
                  isMuted={p.isMuted}
                  isCameraOn={p.isCameraOn}
                  index={index}
                  isFocused={focusedBubbleId === p.socketId}
                  onFocus={() => setFocusedBubbleId(p.socketId)}
                  isMobile={isMobile}
                  isHidden={isHidden}
                  onHide={() => handleToggleHideBubble(p.username)}
                />
              );
            })}

          {/* Live Chat Panel (Overlay in both modes) */}
          {chatOpen && (
            <div 
              className={
                isMobile
                  ? "fixed inset-y-0 right-0 w-80 max-w-[85vw] z-50 bg-[#0a0b0d]/95 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                  : (theaterMode 
                      ? "absolute top-5 right-5 w-[380px] h-[70vh] z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
                      : "absolute right-4 top-4 bottom-4 w-80 z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
                    )
              }
            >
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                localSocketId={socketService.socket?.id || null}
                unreadCount={unreadCount}
                onClearUnread={handleClearUnread}
              />
            </div>
          )}

          {/* Floating Participant Overlay (Only in Normal Mode) */}
          {!theaterMode && participantsOpen && (
            <div 
              className={
                isMobile
                  ? "fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 bg-[#0a0b0d]/95 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300"
                  : "absolute left-4 top-4 bottom-4 w-80 z-40 flex flex-col overflow-hidden animate-in slide-in-from-left duration-200"
              }
            >
              <ParticipantList
                participants={participants}
                localSocketId={socketService.socket?.id || null}
              />
            </div>
          )}

          {/* Toast Notifications */}
          <div className="absolute top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="w-72 bg-slate-900/95 backdrop-blur border border-white/10 rounded-xl p-3 shadow-2xl pointer-events-auto animate-in slide-in-from-right duration-200"
              >
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
                  {toast.username}
                </div>
                <div className="text-xs text-gray-200 line-clamp-2">
                  {toast.text}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Control Dock (Sticky bottom toolbar) */}
      {!theaterMode && (
        <ControlDock
          isMuted={isMuted}
          isCameraOn={isCameraOn}
          isSharingScreen={isSharingScreen}
          chatOpen={chatOpen}
          participantsOpen={participantsOpen}
          unreadCount={unreadCount}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleChat={handleToggleChat}
          onToggleParticipants={handleToggleParticipants}
          onToggleFullscreen={handleToggleFullscreen}
          onLeaveRoom={handleLeaveRoom}
          isMobile={isMobile}
          cameraBubblesMenuOpen={cameraBubblesMenuOpen}
          onToggleCameraBubblesMenu={handleToggleCameraBubblesMenu}
        />
      )}

      {/* Camera Bubbles Visibility Checklist Overlay */}
      {cameraBubblesMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-45" 
            onClick={() => setCameraBubblesMenuOpen(false)} 
          />
          <div 
            className="absolute bottom-24 right-4 w-64 bg-slate-900/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Camera Bubbles
              </h4>
              <button 
                onClick={() => setCameraBubblesMenuOpen(false)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {/* Local User */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/45 hover:bg-slate-950/70 cursor-pointer select-none transition-colors">
                <span className="text-xs text-gray-200 truncate max-w-[150px]">
                  {username} (You)
                </span>
                <input 
                  type="checkbox"
                  checked={!hiddenBubbles.includes(username)}
                  onChange={() => handleToggleHideBubble(username)}
                  className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                />
              </label>
              
              {/* Remote Users */}
              {participants
                .filter((p) => p.socketId !== socketService.socket?.id)
                .map((p) => (
                  <label key={p.socketId} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/45 hover:bg-slate-950/70 cursor-pointer select-none transition-colors">
                    <span className="text-xs text-gray-200 truncate max-w-[150px]">
                      {p.username}
                    </span>
                    <input 
                      type="checkbox"
                      checked={!hiddenBubbles.includes(p.username)}
                      onChange={() => handleToggleHideBubble(p.username)}
                      className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                    />
                  </label>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
};
