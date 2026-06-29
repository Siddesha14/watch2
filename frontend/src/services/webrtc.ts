import socketService from './socket';

export type TrackType = 'screen-video' | 'camera-video' | 'microphone-audio';
export type InternalTrackType = TrackType | 'screen-audio';

interface RemoteStreamInfo {
  peerSocketId: string;
  stream: MediaStream;
  track: MediaStreamTrack;
}

interface PeerNegotiationState {
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  isPolite: boolean;
  pendingIceCandidates: any[];
}

class WebRTCService {
  // Map of peerSocketId -> RTCPeerConnection
  public connections = new Map<string, RTCPeerConnection>();

  // Negotiation states per peer
  private peerStates = new Map<string, PeerNegotiationState>();

  // Senders per peer connection and track type
  private senders = new Map<string, Map<InternalTrackType, RTCRtpSender>>();

  private statsIntervalId: any = null;
  private prevStatsMap = new Map<string, { timestamp: number; reports: Map<string, any> }>();
  
  // Local streams
  public localCameraStream: MediaStream | null = null;
  public localMicStream: MediaStream | null = null;
  public localScreenStream: MediaStream | null = null;
  
  // Track metadata: trackId -> type
  private remoteTrackMetadata = new Map<string, TrackType>();
  // Pending streams that arrived before their socket metadata: trackId -> RemoteStreamInfo
  private pendingStreams = new Map<string, RemoteStreamInfo>();

  private getOrCreatePeerState(peerSocketId: string): PeerNegotiationState {
    let state = this.peerStates.get(peerSocketId);
    if (!state) {
      const socket = socketService.socket;
      const myId = socket ? socket.id : '';
      const isPolite = myId && peerSocketId ? (myId < peerSocketId) : false;
      
      state = {
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
        isPolite,
        pendingIceCandidates: []
      };
      this.peerStates.set(peerSocketId, state);
    }
    return state;
  }

  private getOrCreateSenderMap(peerSocketId: string): Map<InternalTrackType, RTCRtpSender> {
    let map = this.senders.get(peerSocketId);
    if (!map) {
      map = new Map<InternalTrackType, RTCRtpSender>();
      this.senders.set(peerSocketId, map);
    }
    return map;
  }

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
    this.startStatsLogging();
  }

  private configureScreenVideoSender(sender: RTCRtpSender, pc: RTCPeerConnection) {
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings) {
        parameters.encodings = [{}];
      }
      parameters.encodings.forEach(encoding => {
        encoding.maxFramerate = 30;
        encoding.maxBitrate = 1500000; // 1.5 Mbps
        encoding.scaleResolutionDownBy = 1.0;
      });
      sender.setParameters(parameters).then(() => {
        console.log("[PERFORMANCE] Configured screen-video RTCRtpSender encoding parameters successfully.");
      }).catch(err => {
        console.error("[PERFORMANCE] Error setting screen-video parameters:", err);
      });

      const transceiver = pc.getTransceivers().find(t => t.sender === sender);
      if (transceiver && 'degradationPreference' in transceiver) {
        (transceiver as any).degradationPreference = 'maintain-resolution';
        console.log("[PERFORMANCE] Set transceiver degradationPreference to 'maintain-resolution'.");
      }
    } catch (err) {
      console.error("[PERFORMANCE] Failed to configure screen video sender:", err);
    }
  }

  private startStatsLogging() {
    if (this.statsIntervalId) return;

    this.statsIntervalId = setInterval(async () => {
      if (this.connections.size === 0) return;

      this.connections.forEach(async (pc, peerSocketId) => {
        try {
          const stats = await pc.getStats();
          
          let captureWidth = 0;
          let captureHeight = 0;
          let captureFPS = 0;
          let outgoingBitrate = 0;
          let rtt = 0;
          let availableBandwidth = 0;
          let droppedFrames = 0;
          let decodedFrames = 0;
          let renderFPS = 0;

          stats.forEach(report => {
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              if (report.frameWidth) captureWidth = report.frameWidth;
              if (report.frameHeight) captureHeight = report.frameHeight;
              if (report.framesPerSecond) captureFPS = report.framesPerSecond;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                rtt = report.currentRoundTripTime * 1000;
              }
              if (report.availableOutgoingBitrate !== undefined) {
                availableBandwidth = report.availableOutgoingBitrate / 1000;
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (report.framesDecoded) decodedFrames = report.framesDecoded;
              if (report.framesPerSecond) renderFPS = report.framesPerSecond;
              if (report.framesDropped) droppedFrames = report.framesDropped;
            }
          });

          const prevStats = this.prevStatsMap.get(peerSocketId);
          const now = Date.now();
          if (prevStats) {
            let bytesSentDelta = 0;
            const timeDelta = (now - prevStats.timestamp) / 1000;
            
            stats.forEach(report => {
              if (report.type === 'outbound-rtp' && report.kind === 'video') {
                const prevReport = prevStats.reports.get(report.id);
                if (prevReport && report.bytesSent !== undefined && prevReport.bytesSent !== undefined) {
                  bytesSentDelta = report.bytesSent - prevReport.bytesSent;
                }
              }
            });

            if (timeDelta > 0) {
              outgoingBitrate = (bytesSentDelta * 8) / timeDelta / 1000;
            }
          }

          const reportsMap = new Map<string, any>();
          stats.forEach(report => {
            if (report.type === 'outbound-rtp') {
              reportsMap.set(report.id, { bytesSent: report.bytesSent });
            }
          });
          this.prevStatsMap.set(peerSocketId, { timestamp: now, reports: reportsMap });

          console.log(
            `[PERFORMANCE] Peer: ${peerSocketId} | ` +
            `Capture: ${captureWidth}x${captureHeight} @ ${captureFPS} FPS | ` +
            `Outgoing Bitrate: ${outgoingBitrate.toFixed(1)} kbps | ` +
            `RTT: ${rtt.toFixed(1)}ms | ` +
            `Available Outgoing Bitrate: ${availableBandwidth.toFixed(1)} kbps | ` +
            `Dropped Frames: ${droppedFrames} | ` +
            `Decoded Frames: ${decodedFrames} | ` +
            `Render FPS: ${renderFPS}`
          );

        } catch (err) {
          console.warn("[PERFORMANCE] Error fetching WebRTC connection stats:", err);
        }
      });
    }, 5000);
  }

  private stopStatsLogging() {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }
    this.prevStatsMap.clear();
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

        const state = this.getOrCreatePeerState(senderSocketId);

        if (signalData.sdp) {
          const description = signalData.sdp;
          const offerCollision = (description.type === 'offer') && 
            (state.makingOffer || pc.signalingState !== 'stable');
          
          state.ignoreOffer = !state.isPolite && offerCollision;
          if (state.ignoreOffer) {
            console.log(`[WEBRTC] Offer collision detected (polite: ${state.isPolite}). Ignoring incoming offer from ${senderSocketId}`);
            return;
          }

          if (offerCollision) {
            console.log(`[WEBRTC] Offer collision detected (polite: ${state.isPolite}). Rolling back local offer to accept remote offer from ${senderSocketId}`);
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(new RTCSessionDescription(description))
            ]);
          } else {
            console.log(`[WEBRTC] Applying remote description (${description.type}) from ${senderSocketId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(description));
          }

          if (description.type === 'offer') {
            this.addActiveTracksToConnection(pc, senderSocketId);
            console.log(`[WEBRTC] Creating answer for ${senderSocketId}`);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketService.sendSignal(senderSocketId, { sdp: pc.localDescription });
          }

          // Drain queued ICE candidates
          console.log(`[WEBRTC] Draining queued ICE candidates for ${senderSocketId}. Count: ${state.pendingIceCandidates.length}`);
          const candidates = [...state.pendingIceCandidates];
          state.pendingIceCandidates = [];
          for (const candidate of candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              console.log(`[WEBRTC] Applied queued ICE candidate from ${senderSocketId}`);
            } catch (err) {
              console.error(`[WEBRTC] Error applying queued ICE candidate for ${senderSocketId}:`, err);
            }
          }
        } else if (signalData.candidate) {
          const candidate = signalData.candidate;
          if (!pc.remoteDescription) {
            console.log(`[WEBRTC] Remote description null. Queueing ICE candidate from ${senderSocketId}`);
            state.pendingIceCandidates.push(candidate);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              console.log(`[WEBRTC] Applied ICE candidate from ${senderSocketId}`);
            } catch (err) {
              if (!state.ignoreOffer) {
                console.error(`[WEBRTC] Error adding ICE candidate from ${senderSocketId}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error('[WEBRTC] Error handling WebRTC signal:', err);
      }
    });

    // Handle track metadata from peers
    socket.off('track-metadata');
    socket.on('track-metadata', ({ senderSocketId, trackId, type }: { senderSocketId: string; trackId: string; type: TrackType }) => {
      console.log(`[WEBRTC] Received track metadata: ${trackId} is ${type} from ${senderSocketId}`);
      this.remoteTrackMetadata.set(trackId, type);

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
    const existingPc = this.connections.get(peerSocketId);
    if (existingPc) {
      console.log(`[WEBRTC] Stale RTCPeerConnection detected for ${peerSocketId}. Re-creating.`);
      this.closeConnection(peerSocketId);
    }

    console.log(`[WEBRTC] Creating RTCPeerConnection for ${peerSocketId}, isInitiator: ${isInitiator}`);
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.connections.set(peerSocketId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WEBRTC] Generated ICE candidate for ${peerSocketId}`);
        socketService.sendSignal(peerSocketId, { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WEBRTC] Connection state with ${peerSocketId}: ${pc.connectionState}`);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(peerSocketId, pc.connectionState);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closeConnection(peerSocketId);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const track = event.track;
      console.log(`[WEBRTC] Track received from ${peerSocketId}: ID=${track.id}, kind=${track.kind}, streamId=${stream?.id}`);

      const type = this.remoteTrackMetadata.get(track.id);
      if (type) {
        if (this.onRemoteTrackCallback) {
          this.onRemoteTrackCallback(peerSocketId, stream, type, track.id);
        }
      } else {
        this.pendingStreams.set(track.id, { peerSocketId, stream, track });
      }

      track.onended = () => {
        console.log(`[WEBRTC] Track ended: ${track.id} from ${peerSocketId}`);
        const resolvedType = type || this.remoteTrackMetadata.get(track.id) || 'camera-video';
        if (this.onRemoteTrackRemovedCallback) {
          this.onRemoteTrackRemovedCallback(peerSocketId, stream.id, resolvedType);
        }
        this.remoteTrackMetadata.delete(track.id);
        this.pendingStreams.delete(track.id);
      };
    };

    pc.onnegotiationneeded = async () => {
      try {
        const state = this.getOrCreatePeerState(peerSocketId);
        if (state.makingOffer || pc.signalingState !== 'stable') {
          console.log(`[WEBRTC] Signaling state not stable (${pc.signalingState}) or already makingOffer. Ignoring negotiationneeded event.`);
          return;
        }

        console.log(`[WEBRTC] Negotiation started. Creating offer for ${peerSocketId}`);
        state.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socketService.sendSignal(peerSocketId, { sdp: pc.localDescription });
        console.log(`[WEBRTC] Sent offer to ${peerSocketId}`);
      } catch (err) {
        console.error(`[WEBRTC] Error in onnegotiationneeded for ${peerSocketId}:`, err);
      } finally {
        const state = this.peerStates.get(peerSocketId);
        if (state) {
          state.makingOffer = false;
        }
      }
    };

    return pc;
  }

  // Connect to a new peer explicitly
  public async connectToPeer(peerSocketId: string) {
    const pc = this.createPeerConnection(peerSocketId, true);
    this.addActiveTracksToConnection(pc, peerSocketId);
  }

  // Add all currently active local tracks to a peer connection
  private addActiveTracksToConnection(pc: RTCPeerConnection, peerSocketId: string) {
    if (this.localCameraStream) {
      this.localCameraStream.getVideoTracks().forEach(track => {
        this.addTrackWithMetadata(pc, peerSocketId, track, this.localCameraStream!, 'camera-video');
      });
    }

    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach(track => {
        this.addTrackWithMetadata(pc, peerSocketId, track, this.localMicStream!, 'microphone-audio');
      });
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(track => {
        const type = track.kind === 'video' ? 'screen-video' : 'screen-audio';
        this.addTrackWithMetadata(pc, peerSocketId, track, this.localScreenStream!, type);
      });
    }
  }

  // Add or replace track to a peer connection
  private addTrackWithMetadata(
    pc: RTCPeerConnection, 
    peerSocketId: string, 
    track: MediaStreamTrack, 
    stream: MediaStream, 
    type: InternalTrackType
  ) {
    const senderMap = this.getOrCreateSenderMap(peerSocketId);
    const existingSender = senderMap.get(type);

    if (existingSender) {
      console.log(`[WEBRTC] Replacing track for ${peerSocketId} (${type})`);
      existingSender.replaceTrack(track).catch(err => {
        console.error(`[WEBRTC] Error replacing track for ${peerSocketId} (${type}):`, err);
      });
      if (type === 'screen-video') {
        this.configureScreenVideoSender(existingSender, pc);
      }
      this.sendMetadataForTrack(track, stream, type);
      return;
    }

    console.log(`[WEBRTC] Adding local track ${track.id} (${type}) to peer ${peerSocketId}`);
    try {
      const sender = pc.addTrack(track, stream);
      senderMap.set(type, sender);
      if (type === 'screen-video') {
        this.configureScreenVideoSender(sender, pc);
      }
      this.sendMetadataForTrack(track, stream, type);
    } catch (err) {
      console.error(`[WEBRTC] Error adding track for ${peerSocketId} (${type}):`, err);
    }
  }

  private sendMetadataForTrack(track: MediaStreamTrack, stream: MediaStream, type: InternalTrackType) {
    const socket = socketService.socket;
    if (socket && socket.connected) {
      const rId = (socket as any).roomId;
      if (rId) {
        const metadataType = (type === 'screen-audio' || type === 'microphone-audio') ? 'microphone-audio' : type;
        console.log(`[WEBRTC] Sending track metadata: room=${rId}, trackId=${track.id}, type=${metadataType}`);
        socketService.sendTrackMetadata(rId, track.id, stream.id, metadataType as TrackType);
      }
    }
  }

  private replaceOrAddTrackOnAllPeers(track: MediaStreamTrack, stream: MediaStream, type: InternalTrackType) {
    this.connections.forEach((pc, peerSocketId) => {
      this.addTrackWithMetadata(pc, peerSocketId, track, stream, type);
    });
  }

  private replaceTrackOnAllPeers(track: MediaStreamTrack | null, type: InternalTrackType) {
    this.connections.forEach((_pc, peerSocketId) => {
      const senderMap = this.getOrCreateSenderMap(peerSocketId);
      const sender = senderMap.get(type);
      if (sender) {
        console.log(`[WEBRTC] Replacing track to ${track ? track.id : 'null'} for peer ${peerSocketId} (${type})`);
        sender.replaceTrack(track).catch(err => {
          console.error(`[WEBRTC] Error replacing track to ${track ? 'track' : 'null'} for peer ${peerSocketId} (${type}):`, err);
        });
      }
    });
  }

  // Start sharing Camera and Microphone
  public async startCameraAndMic(video: boolean, audio: boolean): Promise<MediaStream> {
    console.log(`[WEBRTC] startCameraAndMic called - video: ${video}, audio: ${audio}`);
    
    if (video && !this.localCameraStream) {
      console.log("[WEBRTC] Starting Camera track...");
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 }
      });
      this.localCameraStream = cameraStream;
      const videoTrack = cameraStream.getVideoTracks()[0];
      
      this.replaceOrAddTrackOnAllPeers(videoTrack, cameraStream, 'camera-video');
      this.broadcastTrackMetadata(cameraStream, 'camera-video');
    } else if (!video && this.localCameraStream) {
      this.stopCamera();
    }

    if (audio && !this.localMicStream) {
      console.log("[WEBRTC] Starting Mic track...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      this.localMicStream = micStream;
      const audioTrack = micStream.getAudioTracks()[0];
      
      this.replaceOrAddTrackOnAllPeers(audioTrack, micStream, 'microphone-audio');
      this.broadcastTrackMetadata(micStream, 'microphone-audio');
    } else if (!audio && this.localMicStream) {
      this.stopMic();
    }

    return this.localCameraStream || this.localMicStream || new MediaStream();
  }

  // Stop camera stream
  public stopCamera() {
    if (!this.localCameraStream) return;
    console.log("[WEBRTC] Stopping local camera");
    this.localCameraStream.getVideoTracks().forEach(track => {
      track.stop();
    });
    this.replaceTrackOnAllPeers(null, 'camera-video');
    this.localCameraStream = null;
  }

  // Stop mic stream
  public stopMic() {
    if (!this.localMicStream) return;
    console.log("[WEBRTC] Stopping local mic");
    this.localMicStream.getAudioTracks().forEach(track => {
      track.stop();
    });
    this.replaceTrackOnAllPeers(null, 'microphone-audio');
    this.localMicStream = null;
  }

  // Start Screen Sharing
  public async startScreenShare(roomId: string): Promise<MediaStream> {
    if (this.localScreenStream) return this.localScreenStream;

    console.log("[WEBRTC] Requesting screen capture with optimized constraints: 720p @ 30 FPS");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: true
    });

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 }
        });
      } catch (err) {
        console.warn("[PERFORMANCE] Could not apply track constraints on display track:", err);
      }

      const settings = videoTrack.getSettings();
      console.log(`[PERFORMANCE] Screen capture settings: width=${settings.width}, height=${settings.height}, frameRate=${settings.frameRate}`);
    }

    this.localScreenStream = stream;
    console.log("[WEBRTC] Screen share started");

    socketService.startScreenShare(roomId);

    // Add tracks to all connections
    stream.getTracks().forEach(track => {
      const type = track.kind === 'video' ? 'screen-video' : 'screen-audio';
      this.replaceOrAddTrackOnAllPeers(track, stream, type as InternalTrackType);
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
    console.log("[WEBRTC] Screen share stopped");

    this.localScreenStream.getTracks().forEach(track => {
      track.stop();
    });

    this.replaceTrackOnAllPeers(null, 'screen-video');
    this.replaceTrackOnAllPeers(null, 'screen-audio');

    this.localScreenStream = null;
    socketService.stopScreenShare(roomId);
  }

  // Broadcast track metadata to all rooms
  private broadcastTrackMetadata(stream: MediaStream, defaultType: TrackType, roomId?: string) {
    const socket = socketService.socket;
    if (!socket || !socket.connected) return;

    const rId = roomId || (socket as any).roomId;
    if (!rId) return;

    stream.getTracks().forEach(track => {
      const type = track.kind === 'video' 
        ? defaultType 
        : 'microphone-audio';
        
      console.log(`[WEBRTC] Sent track metadata: ${track.id} as ${type}`);
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
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;

      try {
        pc.getTransceivers().forEach(transceiver => {
          if (transceiver.stop) transceiver.stop();
        });
      } catch (err) {
        console.warn(`[WEBRTC] Error stopping transceivers for ${peerSocketId}:`, err);
      }

      pc.close();
      this.connections.delete(peerSocketId);
      this.peerStates.delete(peerSocketId);
      this.senders.delete(peerSocketId);
      console.log(`[WEBRTC] Closed RTCPeerConnection for ${peerSocketId}`);
    }
  }

  // Clear all connections when leaving a room
  public clearAll() {
    console.log("[WEBRTC] Clearing all peer connections and local streams");
    this.stopStatsLogging();
    this.connections.forEach((_pc, peerSocketId) => this.closeConnection(peerSocketId));
    this.connections.clear();
    this.peerStates.clear();
    this.senders.clear();

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
