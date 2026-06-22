export interface SessionData {
  roomId: string;
  username: string;
  timestamp: number;
}

const SESSION_KEY = 'watchTogetherSession';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const sessionService = {
  saveSession(roomId: string, username: string): void {
    const session: SessionData = {
      roomId,
      username,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  getSession(): SessionData | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      const session = JSON.parse(raw) as SessionData;
      
      // Basic validation
      if (!session.roomId || !session.username || !session.timestamp) {
        this.clearSession();
        return null;
      }

      // 24 hours expiry check
      if (Date.now() - session.timestamp > SESSION_EXPIRY_MS) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (e) {
      this.clearSession();
      return null;
    }
  },

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }
};
