import roomManager from './roomManager.js';

export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Track which room this socket belongs to
    let currentRoomId = null;

    // Create a new room
    socket.on('create-room', (callback) => {
      try {
        const room = roomManager.createRoom();
        console.log(`Room created: ${room.id} by ${socket.id}`);
        callback({ success: true, roomId: room.id });
      } catch (err) {
        console.error('Error creating room:', err);
        callback({ success: false, error: err.message });
      }
    });

    // Join room
    socket.on('join-room', ({ roomId, username }, callback) => {
      try {
        roomId = roomId.trim().toLowerCase();
        socket.join(roomId);
        currentRoomId = roomId;

        const { participant, room } = roomManager.joinRoom(roomId, socket.id, username);
        console.log(`User ${username} (${socket.id}) joined room ${roomId}`);

        // Notify other participants in the room
        socket.to(roomId).emit('user-joined', { participant, room });

        // Acknowledge back to joining user with full room state
        callback({ success: true, room, localParticipant: participant });
      } catch (err) {
        console.error('Error joining room:', err);
        callback({ success: false, error: err.message });
      }
    });

    // WebRTC Signaling Relay
    // Target is the socket ID of the specific peer we are offering/answering/ICEing to
    socket.on('signal', ({ targetSocketId, signalData }) => {
      io.to(targetSocketId).emit('signal', {
        senderSocketId: socket.id,
        signalData
      });
    });

    // Track metadata sharing
    socket.on('track-metadata', ({ roomId, trackId, streamId, type }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      socket.to(cleanRoomId).emit('track-metadata', {
        senderSocketId: socket.id,
        trackId,
        streamId,
        type
      });
    });

    // Chat Message
    socket.on('send-message', ({ roomId, text }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      
      const room = roomManager.getRoom(cleanRoomId);
      if (!room) return;

      const participant = room.participants.find(p => p.socketId === socket.id);
      const username = participant ? participant.username : 'Anonymous';

      const message = {
        id: Math.random().toString(36).substring(2, 9),
        senderSocketId: socket.id,
        username,
        text,
        timestamp: Date.now()
      };

      io.to(cleanRoomId).emit('message', message);
    });

    // Participant State Updates (mute, camera toggling)
    socket.on('update-state', ({ roomId, updates }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();

      const room = roomManager.updateParticipantState(cleanRoomId, socket.id, updates);
      if (room) {
        io.to(cleanRoomId).emit('room-updated', room);
      }
    });

    // Screen sharing signaling
    socket.on('start-screen-share', ({ roomId }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.setScreenShareHost(cleanRoomId, socket.id);
      if (room) {
        io.to(cleanRoomId).emit('room-updated', room);
        socket.to(cleanRoomId).emit('screen-share-started', { hostSocketId: socket.id });
      }
    });

    socket.on('stop-screen-share', ({ roomId }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.setScreenShareHost(cleanRoomId, null);
      if (room) {
        io.to(cleanRoomId).emit('room-updated', room);
        socket.to(cleanRoomId).emit('screen-share-stopped');
      }
    });

    /* Synchronized Video Player Control - Disabled in pure Discord-style voice/screen-share mode
    socket.on('video-play', ({ roomId, currentTime }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.updateVideoState(cleanRoomId, true, currentTime);
      if (room) {
        socket.to(cleanRoomId).emit('video-play', { currentTime, senderId: socket.id });
      }
    });

    socket.on('video-pause', ({ roomId, currentTime }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.updateVideoState(cleanRoomId, false, currentTime);
      if (room) {
        socket.to(cleanRoomId).emit('video-pause', { currentTime, senderId: socket.id });
      }
    });

    socket.on('video-seek', ({ roomId, currentTime }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.updateVideoState(cleanRoomId, null, currentTime);
      if (room) {
        socket.to(cleanRoomId).emit('video-seek', { currentTime, senderId: socket.id });
      }
    });

    socket.on('video-change-url', ({ roomId, videoUrl }) => {
      if (!roomId) return;
      const cleanRoomId = roomId.trim().toLowerCase();
      const room = roomManager.updateVideoState(cleanRoomId, false, 0, videoUrl);
      if (room) {
        io.to(cleanRoomId).emit('video-change-url', { videoUrl, senderId: socket.id });
        io.to(cleanRoomId).emit('room-updated', room);
      }
    });
    */

    // Disconnect and Leave
    const handleLeave = () => {
      if (currentRoomId) {
        const roomId = currentRoomId;
        currentRoomId = null;

        const room = roomManager.leaveRoom(roomId, socket.id);
        
        // Notify others
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          room
        });
        
        if (room) {
          io.to(roomId).emit('room-updated', room);
        }
        
        console.log(`User ${socket.id} left room ${roomId}`);
      }
    };

    socket.on('leave-room', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
