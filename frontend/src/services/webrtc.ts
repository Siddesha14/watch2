import socketService from './socket';

export type TrackType = 'screen-video' | 'camera-video' | 'microphone-audio';

interface RemoteStreamInfo {
  peerSocketId: string;
  stream: MediaStream;
  track: MediaStreamTrack;
}

class WebRTCService {
  // Map of peerSocketId -> RTCPeerConnection
  public connections = new Map<string, RTCPeerConnection>();
  
  // Local streams
  public localCameraStream: MediaStream | null = null;
  public localMicStream: MediaStream | null = null;
  public localScreenStream: MediaStream | null = null;
  
  // Track metadata: trackId -> type
  private remoteTrackMetadata = new Map<string, TrackType>();
  // Pending streams that arrived before their socket metadata: trackId -> RemoteStreamInfo
  private pendingStreams = new Map<string, RemoteStreamInfo>();

  // ICE Servers config
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  // Callbacks registered by the UI
  private onRemoteTrackCallback: ((peerSocketId: string, stream: MediaStream, type: TrackType, trackId: string) => void) | null = null;
  private onRemoteTrackRemovedCallback: ((peerSocketId: string, streamId: string, type: TrackType) => void) | null = null;
  private onConnectionStateChangeCallback: ((peerSocketId: string, state: RTCPeerConnectionState) => void) | null = null;

  init(
    onRemoteTrack: (peerSocketId: string, stream: MediaStream, type: TrackType, trackId: string) => void,
    onRemoteTrackRemoved: (peerSocketId: string, streamId: string, type: TrackType) => void,
    onConnectionStateChange: (peerSocketId: string, state: RTCPeerConnectionState) => void
  ) {
    this.onRemoteTrackCallback = onRemoteTrack;
    this.onRemoteTrackRemovedCallback = onRemoteTrackRemoved;
    this.onConnectionStateChangeCallback = onConnectionStateChange;
    
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    const socket = socketService.socket;
    if (!socket) return;

    // Handle incoming signals from peers (offer, answer, ice-candidate)
    socket.off('signal');
    socket.on('signal', async ({ senderSocketId, signalData }: { senderSocketId: string; signalData: any }) => {
      try {
        let pc = this.connections.get(senderSocketId);
        
        if (!pc) {
          pc = this.createPeerConnection(senderSocketId, false);
        }

        if (signalData.sdp) {
          if (signalData.sdp.type === 'offer') {
            console.log("RECEIVED OFFER FROM:", senderSocketId);
          } else if (signalData.sdp.type === 'answer') {
            console.log("RECEIVED ANSWER FROM:", senderSocketId);
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          
          if (signalData.sdp.type === 'offer') {
            // Add all our active tracks to this new connection
            this.addActiveTracksToConnection(pc);
            
            console.log("SENDING ANSWER TO:", senderSocketId);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.sendSignal(senderSocketId, { sdp: pc.localDescription });
          }
        } else if (signalData.candidate) {
          console.log("ADDING RECEIVED ICE CANDIDATE FROM:", senderSocketId);
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    });

    // Handle track metadata from peers
    socket.off('track-metadata');
    socket.on('track-metadata', ({ senderSocketId, trackId, type }: { senderSocketId: string; trackId: string; type: TrackType }) => {
      console.log(`Received track metadata: ${trackId} is ${type} from ${senderSocketId}`);
      this.remoteTrackMetadata.set(trackId, type);

      // Check if we have a pending stream for this track ID
      const pending = this.pendingStreams.get(trackId);
      if (pending) {
        this.pendingStreams.delete(trackId);
        if (this.onRemoteTrackCallback) {
          this.onRemoteTrackCallback(pending.peerSocketId, pending.stream, type, trackId);
        }
      }
    });
  }

  // Create a peer connection for a user
  public createPeerConnection(peerSocketId: string, isInitiator: boolean): RTCPeerConnection {
    console.log(`Creating RTCPeerConnection for ${peerSocketId}, isInitiator: ${isInitiator}`);
    
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.connections.set(peerSocketId, pc);

    // ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("GENERATING ICE CANDIDATE FOR:", peerSocketId);
        socketService.sendSignal(peerSocketId, { candidate: event.candidate });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerSocketId}: ${pc.connectionState}`);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(peerSocketId, pc.connectionState);
      }
      
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closeConnection(peerSocketId);
      }
    };

    // Track received
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const track = event.track;
      console.log(
        "ONTRACK",
        peerSocketId,
        track.kind,
        track.id,
        event.streams[0]?.id
      );
      console.log("TRACK RECEIVED", { peerId: peerSocketId, kind: track.kind, trackId: track.id });
      console.log(`Received remote track: ${track.id} (${track.kind}) from ${peerSocketId}`);

      const type = this.remoteTrackMetadata.get(track.id);
      if (type) {
        // We already have the metadata, route it directly
        if (this.onRemoteTrackCallback) {
          this.onRemoteTrackCallback(peerSocketId, stream, type, track.id);
        }
      } else {
        // Store as pending until socket metadata event arrives
        this.pendingStreams.set(track.id, { peerSocketId, stream, track });
      }

      // Track removal handling
      track.onended = () => {
        console.log("TRACK REMOVED", { peerId: peerSocketId, trackId: track.id });
        console.log(`Track ended: ${track.id} from ${peerSocketId}`);
        const resolvedType = type || this.remoteTrackMetadata.get(track.id) || 'camera-video';
        if (this.onRemoteTrackRemovedCallback) {
          this.onRemoteTrackRemovedCallback(peerSocketId, stream.id, resolvedType);
        }
        this.remoteTrackMetadata.delete(track.id);
        this.pendingStreams.delete(track.id);
      };
    };

    // Negotiation needed (allows any peer to renegotiate when signalingState is stable)
    pc.onnegotiationneeded = async () => {
      try {
        const socketId = socketService.socket?.id || 'unknown';
        console.log("ONNEGOTIATIONNEEDED FIRED, SIGNALLING STATE:", pc.signalingState);
        if (pc.signalingState !== 'stable') {
          console.log("SIGNALING STATE NOT STABLE, QUEUING/IGNORING FOR NOW");
          return;
        }
        console.log("INITIATOR:", socketId);
        console.log("CREATING OFFER TO:", peerSocketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendSignal(peerSocketId, { sdp: pc.localDescription });
      } catch (err) {
        console.error('Error in onnegotiationneeded:', err);
      }
    };

    return pc;
  }

  // Connect to a new peer explicitly
  public async connectToPeer(peerSocketId: string) {
    const pc = this.createPeerConnection(peerSocketId, true);
    this.addActiveTracksToConnection(pc);
  }

  // Add all currently active local tracks to a peer connection
  private addActiveTracksToConnection(pc: RTCPeerConnection) {
    // 1. Add camera video track if active
    if (this.localCameraStream) {
      this.localCameraStream.getVideoTracks().forEach(track => {
        this.addTrackWithMetadata(pc, track, this.localCameraStream!, 'camera-video');
      });
    }

    // 2. Add mic audio track if active
    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach(track => {
        this.addTrackWithMetadata(pc, track, this.localMicStream!, 'microphone-audio');
      });
    }

    // 3. Add screen tracks if active
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(track => {
        const type = track.kind === 'video' ? 'screen-video' : 'microphone-audio';
        this.addTrackWithMetadata(pc, track, this.localScreenStream!, type);
      });
    }
  }

  // Add a single track and emit its metadata to the other side
  private addTrackWithMetadata(pc: RTCPeerConnection, track: MediaStreamTrack, stream: MediaStream, type: TrackType) {
    // Check if already added
    const senders = pc.getSenders();
    const alreadyAdded = senders.some(s => s.track === track);
    if (alreadyAdded) return;

    console.log(`Adding local track ${track.id} (${type}) to peer`);
    pc.addTrack(track, stream);

    // Send metadata to the peer so they can map the track ID to its type
    // Send via socket. since we don't have roomId here directly, we'll emit via socket service
    // socket.ts has roomId stored or we can just send it with current room
  }

  // Start sharing Camera and Microphone
  public async startCameraAndMic(video: boolean, audio: boolean): Promise<MediaStream> {
    console.log(`startCameraAndMic called - video: ${video}, audio: ${audio}`);
    
    // 1. Handle Camera Video Track
    if (video && !this.localCameraStream) {
      console.log("Starting Camera track...");
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 }
      });
      this.localCameraStream = cameraStream;
      const videoTrack = cameraStream.getVideoTracks()[0];
      
      this.connections.forEach((pc) => {
        this.addTrackWithMetadata(pc, videoTrack, cameraStream, 'camera-video');
      });
      this.broadcastTrackMetadata(cameraStream, 'camera-video');
    } else if (!video && this.localCameraStream) {
      this.stopCamera();
    }

    // 2. Handle Microphone Audio Track
    if (audio && !this.localMicStream) {
      console.log("Starting Mic track...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      this.localMicStream = micStream;
      const audioTrack = micStream.getAudioTracks()[0];
      
      this.connections.forEach((pc) => {
        this.addTrackWithMetadata(pc, audioTrack, micStream, 'microphone-audio');
      });
      this.broadcastTrackMetadata(micStream, 'microphone-audio');
    } else if (!audio && this.localMicStream) {
      this.stopMic();
    }

    return this.localCameraStream || this.localMicStream || new MediaStream();
  }

  // Stop camera stream
  public stopCamera() {
    if (!this.localCameraStream) return;
    console.log("CAMERA REMOVED", { peerId: "local" });
    this.localCameraStream.getVideoTracks().forEach(track => {
      track.stop();
      this.removeTrackFromAllPeers(track);
    });
    this.localCameraStream = null;
  }

  // Stop mic stream
  public stopMic() {
    if (!this.localMicStream) return;
    console.log("AUDIO REMOVED", { peerId: "local" });
    this.localMicStream.getAudioTracks().forEach(track => {
      track.stop();
      this.removeTrackFromAllPeers(track);
    });
    this.localMicStream = null;
  }

  // Start Screen Sharing
  public async startScreenShare(roomId: string): Promise<MediaStream> {
    if (this.localScreenStream) return this.localScreenStream;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 60 }
      },
      audio: true // Share tab audio if selected
    });

    this.localScreenStream = stream;
    console.log("SCREEN SHARE STARTED", { peerId: "local" });

    // Log active tracks created
    stream.getVideoTracks().forEach(track => {
      console.log("SCREEN TRACK CREATED", track.id);
    });

    // Alert server we are sharing screen
    socketService.startScreenShare(roomId);

    // Add tracks to all connections
    this.connections.forEach((pc) => {
      stream.getTracks().forEach(track => {
        const type = track.kind === 'video' ? 'screen-video' : 'microphone-audio'; // screen audio is mixed or sent as microphone-audio/screen-audio
        this.addTrackWithMetadata(pc, track, stream, type);
      });
    });

    // Send metadata for these tracks
    this.broadcastTrackMetadata(stream, 'screen-video', roomId);

    // Set listener for when the user clicks 'Stop Sharing' from the browser bar
    stream.getVideoTracks()[0].onended = () => {
      this.stopScreenShare(roomId);
    };

    return stream;
  }

  // Stop Screen Sharing
  public stopScreenShare(roomId: string) {
    if (!this.localScreenStream) return;
    console.log("SCREEN SHARE STOPPED", { peerId: "local" });

    this.localScreenStream.getTracks().forEach(track => {
      track.stop();
      this.removeTrackFromAllPeers(track);
    });

    this.localScreenStream = null;
    socketService.stopScreenShare(roomId);
  }

  // Remove track from all peer connections and trigger renegotiation
  private removeTrackFromAllPeers(track: MediaStreamTrack) {
    this.connections.forEach((pc) => {
      const senders = pc.getSenders();
      const sender = senders.find(s => s.track === track);
      if (sender) {
        pc.removeTrack(sender);
      }
    });
  }

  // Broadcast track metadata to all rooms
  private broadcastTrackMetadata(stream: MediaStream, defaultType: TrackType, roomId?: string) {
    const socket = socketService.socket;
    if (!socket || !socket.connected) return;

    // Retrieve the roomId from socket object properties or argument
    const rId = roomId || (socket as any).roomId;
    if (!rId) return;

    stream.getTracks().forEach(track => {
      const type = track.kind === 'video' 
        ? defaultType 
        : (defaultType === 'screen-video' ? 'microphone-audio' : 'microphone-audio'); // map audio tracks
        
      const metadata = { roomId: rId, trackId: track.id, streamId: stream.id, type };
      console.log("TRACK METADATA SENT", metadata);

      socketService.sendTrackMetadata(rId, track.id, stream.id, type as TrackType);
    });
  }

  // Broadcast track metadata to a specific peer (used upon connecting)
  public sendAllTrackMetadataToPeer(_peerSocketId: string, roomId: string) {
    if (this.localCameraStream) {
      this.localCameraStream.getVideoTracks().forEach(track => {
        socketService.sendTrackMetadata(roomId, track.id, this.localCameraStream!.id, 'camera-video');
      });
    }
    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach(track => {
        socketService.sendTrackMetadata(roomId, track.id, this.localMicStream!.id, 'microphone-audio');
      });
    }
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(track => {
        const type = track.kind === 'video' ? 'screen-video' : 'microphone-audio';
        socketService.sendTrackMetadata(roomId, track.id, this.localScreenStream!.id, type);
      });
    }
  }

  // Close connection to a peer
  public closeConnection(peerSocketId: string) {
    const pc = this.connections.get(peerSocketId);
    if (pc) {
      pc.close();
      this.connections.delete(peerSocketId);
      console.log(`Closed RTCPeerConnection for ${peerSocketId}`);
    }
  }

  // Clear all connections when leaving a room
  public clearAll() {
    this.connections.forEach((pc) => pc.close());
    this.connections.clear();

    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach(t => t.stop());
      this.localCameraStream = null;
    }

    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach(t => t.stop());
      this.localMicStream = null;
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(t => t.stop());
      this.localScreenStream = null;
    }

    this.remoteTrackMetadata.clear();
    this.pendingStreams.clear();
  }
}

export default new WebRTCService();
