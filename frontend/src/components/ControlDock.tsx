import React from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
  MessageSquare, Users, LogOut, Maximize
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
  onLeaveRoom
}) => {
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
