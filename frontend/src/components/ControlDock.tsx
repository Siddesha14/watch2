import React, { useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
  MessageSquare, Users, LogOut, Maximize, MoreHorizontal
} from 'lucide-react';

interface ControlDockProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isSharingScreen: boolean;
  chatOpen: boolean;
  participantsOpen: boolean;
  unreadCount?: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleFullscreen: () => void;
  onLeaveRoom: () => void;
  isMobile?: boolean;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  isMuted,
  isCameraOn,
  isSharingScreen,
  chatOpen,
  participantsOpen,
  unreadCount = 0,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleFullscreen,
  onLeaveRoom,
  isMobile = false
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="relative mx-4 mb-4 z-40">
        {/* Click away backdrop for More menu */}
        {moreOpen && (
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setMoreOpen(false)}
          />
        )}

        {/* Floating More menu popup */}
        {moreOpen && (
          <div className="absolute bottom-16 right-0 left-0 glass-premium rounded-2xl p-4 border border-white/10 shadow-2xl flex flex-col gap-3 z-40 animate-in slide-in-from-bottom-5 duration-200">
            <div className="grid grid-cols-2 gap-2">
              {/* Toggle Participants List */}
              <button
                onClick={() => {
                  onToggleParticipants();
                  setMoreOpen(false);
                }}
                className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-95 border flex items-center justify-center gap-2 cursor-pointer text-xs font-medium ${
                  participantsOpen
                    ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 shadow'
                    : 'bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Participants</span>
              </button>

              {/* Toggle Chat Panel */}
              <button
                onClick={() => {
                  onToggleChat();
                  setMoreOpen(false);
                }}
                className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-95 border flex items-center justify-center gap-2 cursor-pointer text-xs font-medium ${
                  chatOpen
                    ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 shadow'
                    : 'bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <div className="relative flex items-center">
                  <MessageSquare className="w-4 h-4" />
                  {!chatOpen && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                  )}
                </div>
                <span>Chat {!chatOpen && unreadCount > 0 ? `(${unreadCount})` : ''}</span>
              </button>

              {/* Leave Room Button */}
              <button
                onClick={() => {
                  onLeaveRoom();
                  setMoreOpen(false);
                }}
                className="col-span-2 flex items-center justify-center gap-2 p-3 min-w-[44px] min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        )}

        {/* Dock single row layout */}
        <div className="glass-premium flex flex-row flex-nowrap items-center justify-around gap-2 px-4 py-3 rounded-2xl shadow-2xl relative z-40">
          {/* Microphone Toggle */}
          <button
            onClick={onToggleMic}
            className={`p-3.5 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
              isMuted 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 glow-danger' 
                : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={onToggleCamera}
            className={`p-3.5 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
              !isCameraOn
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 glow-danger'
                : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
            }`}
          >
            {!isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={onToggleScreenShare}
            className={`p-3.5 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
              isSharingScreen
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 glow-primary'
                : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
            }`}
          >
            {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={onToggleFullscreen}
            className="p-3.5 min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700 active:scale-90 transition-all flex items-center justify-center cursor-pointer shadow-md"
          >
            <Maximize className="w-5 h-5" />
          </button>

          {/* More Toggle */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`p-3.5 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer relative ${
              moreOpen
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 glow-primary'
                : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            {!chatOpen && unreadCount > 0 && !moreOpen && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-[#0d0e12]" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-premium flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 rounded-2xl mx-4 mb-4 z-40 shadow-2xl transition-all">
      
      {/* Empty space for alignment matching styling */}
      <div className="w-32 hidden sm:block"></div>

      {/* Main A/V Controls */}
      <div className="flex items-center gap-3">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3.5 rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
            isMuted 
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 glow-danger' 
              : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3.5 rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
            !isCameraOn
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 glow-danger'
              : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
          }`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {!isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-xl transition-all active:scale-90 shadow-md flex items-center justify-center cursor-pointer ${
            isSharingScreen
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 glow-primary'
              : 'bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700'
          }`}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Fullscreen Trigger */}
        <button
          onClick={onToggleFullscreen}
          className="p-3.5 rounded-xl bg-slate-800 text-gray-100 border border-white/5 hover:bg-slate-700 active:scale-90 transition-all cursor-pointer"
          title="Fullscreen Stage"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Controls & Disconnect */}
      <div className="flex items-center gap-3">
        {/* Toggle Participants List */}
        <button
          onClick={onToggleParticipants}
          className={`p-3 rounded-xl transition-all active:scale-90 border cursor-pointer ${
            participantsOpen
              ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 shadow'
              : 'bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700'
          }`}
          title="Toggle Participants"
        >
          <Users className="w-4 h-4" />
        </button>

        {/* Toggle Chat Panel (Part 9) */}
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-xl transition-all active:scale-90 border flex items-center gap-1.5 cursor-pointer ${
            chatOpen
              ? 'bg-slate-900 border-indigo-500/30 text-indigo-400 shadow'
              : 'bg-slate-800 border-white/5 text-gray-300 hover:bg-slate-700'
          }`}
          title="Toggle Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {!chatOpen && unreadCount > 0 && (
            <span className="text-xs font-semibold">
              ({unreadCount})
            </span>
          )}
        </button>

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs active:scale-95 transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Leave Room</span>
        </button>
      </div>

    </div>
  );
};

