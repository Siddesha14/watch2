// Room and Participant manager

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  // Generate random room ID (e.g., abc123)
  generateRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(result)) {
      return this.generateRoomId();
    }
    return result;
  }

  createRoom() {
    const roomId = this.generateRoomId();
    const room = {
      id: roomId,
      participants: new Map(), // socketId -> participant
      screenShareHost: null,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    // Convert maps to plain objects/arrays for transfer over Socket.io
    return {
      id: room.id,
      participants: Array.from(room.participants.values()),
      screenShareHost: room.screenShareHost,
    };
  }

  joinRoom(roomId, socketId, username) {
    let room = this.rooms.get(roomId);
    if (!room) {
      // Room doesn't exist, create it (handles custom room ids if users try to join them)
      room = {
        id: roomId,
        participants: new Map(),
        screenShareHost: null,
      };
      this.rooms.set(roomId, room);
    }

    // First user is the host
    const isHost = room.participants.size === 0;

    const participant = {
      socketId,
      username: username || `User-${socketId.substring(0, 4)}`,
      isHost,
      isMuted: false,
      isCameraOn: false,
      joinedAt: Date.now()
    };

    room.participants.set(socketId, participant);
    return { participant, room: this.getRoom(roomId) };
  }

  leaveRoom(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participant = room.participants.get(socketId);
    if (!participant) return this.getRoom(roomId);

    room.participants.delete(socketId);

    // If screen share host left, clear screen share
    if (room.screenShareHost === socketId) {
      room.screenShareHost = null;
    }

    // If host left, elect new host
    if (participant.isHost && room.participants.size > 0) {
      // Get the oldest participant
      const participants = Array.from(room.participants.values());
      participants.sort((a, b) => a.joinedAt - b.joinedAt);
      
      const newHost = participants[0];
      newHost.isHost = true;
      room.participants.set(newHost.socketId, newHost);
    }

    // If room is empty, clean it up after a brief grace period (or immediately)
    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    return this.getRoom(roomId);
  }

  updateParticipantState(roomId, socketId, updates) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participant = room.participants.get(socketId);
    if (!participant) return null;

    // Apply allowed updates
    if (updates.username !== undefined) participant.username = updates.username;
    if (updates.isMuted !== undefined) participant.isMuted = updates.isMuted;
    if (updates.isCameraOn !== undefined) participant.isCameraOn = updates.isCameraOn;

    room.participants.set(socketId, participant);
    return this.getRoom(roomId);
  }

  /* updateVideoState disabled
  updateVideoState(roomId, isPlaying, currentTime, videoUrl = null) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.videoState.isPlaying = isPlaying;
    room.videoState.currentTime = currentTime;
    if (videoUrl !== null) {
      room.videoState.videoUrl = videoUrl;
    }
    room.videoState.lastUpdated = Date.now();

    return this.getRoom(roomId);
  }
  */

  setScreenShareHost(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.screenShareHost = socketId;
    return this.getRoom(roomId);
  }
}

export default new RoomManager();
