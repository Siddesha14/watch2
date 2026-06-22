import React from 'react';
import { Mic, MicOff, Video, VideoOff, Crown, User } from 'lucide-react';

interface Participant {
  socketId: string;
  username: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  localSocketId: string | null;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  localSocketId
}) => {
  return (
    <div className="w-80 h-full flex flex-col glass rounded-2xl p-4 border border-white/5 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
        <h3 className="text-sm font-semibold tracking-wide text-gray-200 uppercase">
          Participants ({participants.length})
        </h3>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {participants.map((participant) => {
          const isLocal = participant.socketId === localSocketId;
          return (
            <div
              key={participant.socketId}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-all border ${
                isLocal 
                  ? 'bg-indigo-500/10 border-indigo-500/20' 
                  : 'bg-slate-950/40 border-transparent hover:border-white/5 hover:bg-slate-900/50'
              }`}
            >
              {/* User Identity info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center relative ${
                  participant.isHost 
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                    : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {participant.isHost ? (
                    <Crown className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  {isLocal && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900" />
                  )}
                </div>
                
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-gray-200 truncate flex items-center gap-1.5">
                    {participant.username}
                    {isLocal && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-bold">
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-400 font-mono truncate">
                    {participant.socketId.substring(0, 8)}
                  </span>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-gray-400">
                {participant.isHost && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/10">
                    Host
                  </span>
                )}
                
                {/* Mic Status */}
                <div className={`p-1 rounded-md ${
                  participant.isMuted 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'bg-slate-800 text-gray-300'
                }`}>
                  {participant.isMuted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Camera Status */}
                <div className={`p-1 rounded-md ${
                  !participant.isCameraOn 
                    ? 'bg-red-500/10 text-red-400' 
                    : 'bg-slate-800 text-gray-300'
                }`}>
                  {!participant.isCameraOn ? (
                    <VideoOff className="w-3.5 h-3.5" />
                  ) : (
                    <Video className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
