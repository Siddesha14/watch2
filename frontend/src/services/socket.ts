import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

class SocketService {
  public socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to socket signaling server:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Promise-wrapped emitters for easier async flow
  createRoom(): Promise<{ success: boolean; roomId?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }
      this.socket.emit('create-room', (response: any) => {
        resolve(response);
      });
    });
  }

  joinRoom(roomId: string, username: string): Promise<{ success: boolean; room?: any; localParticipant?: any; error?: string }> {
    const cleanRoomId = roomId.trim().toLowerCase();
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }
      this.socket.emit('join-room', { roomId: cleanRoomId, username }, (response: any) => {
        resolve(response);
      });
    });
  }

  leaveRoom() {
    if (this.socket) {
      this.socket.emit('leave-room');
    }
  }

  sendSignal(targetSocketId: string, signalData: any) {
    if (this.socket) {
      this.socket.emit('signal', { targetSocketId, signalData });
    }
  }

  sendTrackMetadata(roomId: string, trackId: string, streamId: string, type: 'screen-video' | 'camera-video' | 'microphone-audio') {
    if (this.socket) {
      this.socket.emit('track-metadata', { roomId: roomId.trim().toLowerCase(), trackId, streamId, type });
    }
  }

  sendMessage(roomId: string, text: string) {
    if (this.socket) {
      this.socket.emit('send-message', { roomId: roomId.trim().toLowerCase(), text });
    }
  }

  updateState(roomId: string, updates: { username?: string; isMuted?: boolean; isCameraOn?: boolean }) {
    if (this.socket) {
      this.socket.emit('update-state', { roomId: roomId.trim().toLowerCase(), updates });
    }
  }

  startScreenShare(roomId: string) {
    if (this.socket) {
      this.socket.emit('start-screen-share', { roomId: roomId.trim().toLowerCase() });
    }
  }

  stopScreenShare(roomId: string) {
    if (this.socket) {
      this.socket.emit('stop-screen-share', { roomId: roomId.trim().toLowerCase() });
    }
  }

  videoPlay(roomId: string, currentTime: number) {
    if (this.socket) {
      this.socket.emit('video-play', { roomId: roomId.trim().toLowerCase(), currentTime });
    }
  }

  videoPause(roomId: string, currentTime: number) {
    if (this.socket) {
      this.socket.emit('video-pause', { roomId: roomId.trim().toLowerCase(), currentTime });
    }
  }

  videoSeek(roomId: string, currentTime: number) {
    if (this.socket) {
      this.socket.emit('video-seek', { roomId: roomId.trim().toLowerCase(), currentTime });
    }
  }

  videoChangeUrl(roomId: string, videoUrl: string) {
    if (this.socket) {
      this.socket.emit('video-change-url', { roomId: roomId.trim().toLowerCase(), videoUrl });
    }
  }
}

export default new SocketService();
