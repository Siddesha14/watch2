import React, { useState } from 'react';
import { Copy, Check, Users, ShieldAlert, Signal, Activity } from 'lucide-react';

interface TopBarProps {
  roomId: string;
  participantCount: number;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  hostName: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomId,
  participantCount,
  connectionState,
  hostName
}) => {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSignalColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-emerald-400';
      case 'connecting': return 'text-amber-400 animate-pulse';
      case 'reconnecting': return 'text-orange-400 animate-pulse';
      case 'disconnected': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <header className="glass-premium flex items-center justify-between px-6 py-3 rounded-2xl mx-4 mt-4 z-40 relative">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
          <Activity className="w-5 h-5 text-white" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            Watch<span className="text-indigo-400">Together</span>
          </h1>
          <p className="text-[10px] text-gray-400/80 font-medium">BETA • Real-time Watch Parties</p>
        </div>
      </div>

      {/* Room and Invite Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5">
          <span className="text-xs font-semibold text-gray-400">ROOM:</span>
          <span className="text-xs font-bold font-mono tracking-wider text-indigo-300">{roomId}</span>
        </div>
        
        <button
          onClick={copyInviteLink}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-xs font-semibold text-white shadow-lg shadow-indigo-600/25"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied Link!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Invite Friends</span>
            </>
          )}
        </button>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-4">
        {/* Host Info */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span className="text-gray-400">Host:</span>
          <span className="font-semibold text-purple-200">{hostName}</span>
        </div>

        {/* Participant Count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-gray-300">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold">{participantCount}</span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-white/5 text-xs capitalize text-gray-300">
          <Signal className={`w-4 h-4 ${getSignalColor()}`} />
          <span className="font-semibold hidden sm:inline">{connectionState}</span>
        </div>
      </div>
    </header>
  );
};
