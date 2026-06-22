import React, { useState } from 'react';
import socketService from '../services/socket';
import { Play, Tv, Users, Zap, ShieldCheck } from 'lucide-react';

interface HomeProps {
  onJoinRoom: (roomId: string, username: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onJoinRoom }) => {
  const [username, setUsername] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter a username');
      return;
    }

    setIsCreating(true);
    setErrorMsg('');
    try {
      const socket = socketService.connect();
      
      // Wait for socket to connect
      if (!socket.connected) {
        await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
      }

      const res = await socketService.createRoom();
      if (res.success && res.roomId) {
        // Redirect or trigger state change
        onJoinRoom(res.roomId, username.trim());
      } else {
        setErrorMsg(res.error || 'Failed to create room');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Server connection failed. Make sure the backend is running.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Please enter a username');
      return;
    }
    if (!roomIdInput.trim()) {
      setErrorMsg('Please enter a Room ID');
      return;
    }

    setIsJoining(true);
    setErrorMsg('');
    try {
      socketService.connect();
      onJoinRoom(roomIdInput.trim().toLowerCase(), username.trim());
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to join room');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none select-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px] pointer-events-none select-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col items-center z-10">
        
        {/* Title Brand */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-600/30 mb-4 animate-bounce">
            <Tv className="w-8 h-8 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-slate-950"></span>
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            Watch<span className="text-indigo-400">Together</span>
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-md font-medium">
            Stream anime, movies, and screens with friends in real-time. Zero lag, high fidelity.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full max-w-md mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs text-rose-300 font-semibold text-center animate-in fade-in duration-200">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Action Panel Grid */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl">
          
          {/* Card 1: Create Room */}
          <div className="glass-premium p-8 rounded-3xl flex flex-col justify-between border border-white/10 shadow-2xl hover:border-indigo-500/30 hover:shadow-indigo-500/5 transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-100 mb-2">Host a Watch Party</h2>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Start a private room instantly. You'll be the Host and can stream your screen, tab, or load a synchronized video stream.
              </p>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Luffy"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 border border-white/5 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none text-white transition-colors"
                />
              </div>
              
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCreating ? (
                  <span>Creating Party...</span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Create Room</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card 2: Join Room */}
          <div className="glass-premium p-8 rounded-3xl flex flex-col justify-between border border-white/10 shadow-2xl hover:border-purple-500/30 hover:shadow-purple-500/5 transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-400">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-100 mb-2">Join Existing Party</h2>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Got an invite code? Enter your username and Room ID to connect and sync up with your friends in seconds.
              </p>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zoro"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full text-xs bg-slate-950/80 border border-white/5 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none text-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Room ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. abc123"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    className="w-full text-xs bg-slate-950/80 border border-white/5 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none text-white transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700/50 text-xs font-bold text-white shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isJoining ? (
                  <span>Joining Party...</span>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Join Room</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Pitch features footer */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10 text-gray-400 text-xs text-center border-t border-white/5 pt-6 w-full max-w-2xl select-none">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Secure WebRTC Signaling</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 font-medium">
            <Tv className="w-4 h-4 text-indigo-400" />
            <span>DRM Screen Sharing</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 font-medium">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Low Latency Sync (&lt;150ms)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
