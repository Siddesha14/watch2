import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Tv } from 'lucide-react';
import { sessionService } from './services/sessionService';

function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  
  // To handle direct links (e.g. localhost:5173/room/abc123)
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);
  const [inviteUsernameInput, setInviteUsernameInput] = useState('');

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([a-zA-Z0-9]+)$/);
    let targetRoomId: string | null = null;
    
    if (match && match[1]) {
      targetRoomId = match[1];
      setInviteRoomId(targetRoomId);
    }

    const session = sessionService.getSession();
    if (session) {
      // Auto-rejoin if we're on the root path or if the URL roomId matches the session roomId
      if (!targetRoomId || targetRoomId === session.roomId) {
        setUsername(session.username);
        setRoomId(session.roomId);
        if (!targetRoomId) {
          window.history.replaceState(null, '', `/room/${session.roomId}`);
        }
      }
    }

    // Handle back button / browser navigation changes
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      const currentMatch = currentPath.match(/^\/room\/([a-zA-Z0-9]+)$/);
      if (currentMatch && currentMatch[1]) {
        setInviteRoomId(currentMatch[1]);
        setRoomId(currentMatch[1]);
      } else {
        setRoomId(null);
        setInviteRoomId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleJoin = (targetRoomId: string, name: string) => {
    setUsername(name);
    setRoomId(targetRoomId);
    
    // Update URL without reloading page
    window.history.pushState(null, '', `/room/${targetRoomId}`);
  };

  const handleLeave = () => {
    setRoomId(null);
    setInviteRoomId(null);
    setUsername('');
    
    // Clear URL
    window.history.pushState(null, '', '/');
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsernameInput.trim() || !inviteRoomId) return;
    handleJoin(inviteRoomId, inviteUsernameInput.trim());
  };

  // If invited directly via link, prompt for username first
  if (inviteRoomId && !roomId) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0b0f19]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none select-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px] pointer-events-none select-none"></div>

        <div className="w-full max-w-md z-10">
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-3">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Join Watch Party</h1>
            <p className="text-xs text-gray-400 mt-1">You've been invited to join room: <span className="font-mono text-indigo-300 font-bold">{inviteRoomId}</span></p>
          </div>

          <div className="glass-premium p-6 rounded-3xl border border-white/10 shadow-2xl">
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Choose Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nami"
                  value={inviteUsernameInput}
                  onChange={(e) => setInviteUsernameInput(e.target.value)}
                  className="w-full text-xs bg-slate-950/80 border border-white/5 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none text-white transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Join Party
              </button>
            </form>
          </div>
          
          <button
            onClick={handleLeave}
            className="w-full text-center mt-6 text-xs text-gray-500 hover:text-gray-400 underline cursor-pointer"
          >
            Go to Landing Page
          </button>
        </div>
      </div>
    );
  }

  // Active room view
  if (roomId && username) {
    return (
      <Room 
        roomId={roomId} 
        username={username} 
        onLeave={handleLeave} 
      />
    );
  }

  // Default landing view
  return <Home onJoinRoom={handleJoin} />;
}

export default App;
