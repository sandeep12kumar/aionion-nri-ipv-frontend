// Two-way WebRTC call, using the "perfect negotiation" pattern. The call is set up through
// openSignaling (Socket.IO locally, API Gateway WebSockets live). The video goes directly between browsers.
import { useCallback, useEffect, useRef, useState } from 'react';
import { openSignaling, type SignalingChannel } from './signaling';

export type CallStatus = 'joining' | 'waiting' | 'connecting' | 'connected' | 'peer-away' | 'reconnecting' | 'failed';

interface Options {
  sessionId: string | undefined;
  token: string | null;
  localStream: MediaStream | null;
  onSessionEnded?: (status: string) => void;
  onDocRequest?: (request: { type: string; label: string; instruction: string }) => void;
  onRecordingState?: (recording: boolean) => void;
  onLive?: () => void;
}

export function useVideoCall({ sessionId, token, localStream, onSessionEnded, onDocRequest, onRecordingState, onLive }: Options) {
  const [status, setStatus] = useState<CallStatus>('joining');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const socketRef = useRef<SignalingChannel | null>(null);
  const handlers = useRef({ onSessionEnded, onDocRequest, onRecordingState, onLive });
  handlers.current = { onSessionEnded, onDocRequest, onRecordingState, onLive };

  useEffect(() => {
    if (!sessionId || !token || !localStream) return undefined;
    const stream = localStream;

    const socket = openSignaling(token, sessionId);
    socketRef.current = socket;

    let pc: RTCPeerConnection | null = null;
    let polite = false;
    let iceServers: RTCIceServer[] = [];
    let makingOffer = false;
    let ignoreOffer = false;
    let signalQueue: Promise<void> = Promise.resolve();
    // Live, messages can overtake each other, so candidates that arrive before the offer wait for it.
    let earlyCandidates: RTCIceCandidateInit[] = [];

    const log = (type: string, data?: unknown) => socket.emit('event:log', { type, data });

    function createPeer() {
      pc?.close();
      makingOffer = false;
      ignoreOffer = false;
      earlyCandidates = [];
      setRemoteStream(null);
      const conn = new RTCPeerConnection({ iceServers });
      pc = conn;

      conn.ontrack = ({ track, streams }) => {
        setRemoteStream(streams[0] ?? new MediaStream([track]));
      };
      conn.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('signal', { candidate });
      };
      conn.onnegotiationneeded = async () => {
        try {
          makingOffer = true;
          await conn.setLocalDescription();
          socket.emit('signal', { description: conn.localDescription });
        } catch (err) {
          console.error('Could not create offer', err);
        } finally {
          makingOffer = false;
        }
      };
      conn.onconnectionstatechange = () => {
        if (pc !== conn) return;
        if (conn.connectionState === 'connected') {
          setStatus('connected');
          log('ICE_CONNECTED');
        } else if (conn.connectionState === 'disconnected') {
          setStatus('reconnecting');
          log('ICE_DISCONNECTED');
        } else if (conn.connectionState === 'failed') {
          setStatus('reconnecting');
          log('ICE_FAILED');
          log('ICE_RESTART');
          conn.restartIce();
        }
      };
      stream.getTracks().forEach((track) => {
        // Documents must stay readable, so prefer keeping the resolution when bandwidth is short.
        if (track.kind === 'video') track.contentHint = 'detail';
        conn.addTrack(track, stream);
      });
      setStatus('connecting');
    }

    async function handleSignal({ description, candidate }: { description?: RTCSessionDescription; candidate?: RTCIceCandidateInit }) {
      if (!pc) createPeer();
      const conn = pc!;
      try {
        if (description) {
          const collision = description.type === 'offer' && (makingOffer || conn.signalingState !== 'stable');
          ignoreOffer = !polite && collision;
          if (ignoreOffer) return;
          await conn.setRemoteDescription(description);
          const waiting = earlyCandidates;
          earlyCandidates = [];
          for (const early of waiting) await conn.addIceCandidate(early).catch(() => undefined);
          if (description.type === 'offer') {
            await conn.setLocalDescription();
            socket.emit('signal', { description: conn.localDescription });
          }
        } else if (candidate && !conn.remoteDescription) {
          earlyCandidates.push(candidate);
        } else if (candidate) {
          try {
            await conn.addIceCandidate(candidate);
          } catch (err) {
            if (!ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error('Signaling error', err);
      }
    }

    function join() {
      socket.emit('room:join', { sessionId }, (reply: { error?: string; polite?: boolean; peerPresent?: boolean; iceServers?: RTCIceServer[]; startedAt?: string | null }) => {
        if (reply.error) {
          setError(reply.error);
          setStatus('failed');
          return;
        }
        setError(null);
        polite = Boolean(reply.polite);
        iceServers = reply.iceServers ?? [];
        if (reply.startedAt) setStartedAt(reply.startedAt);
        if (reply.peerPresent) createPeer();
        else setStatus('waiting');
      });
    }

    socket.on('connect', join);
    socket.on('connect_error', () => setStatus('reconnecting'));
    socket.on('disconnect', (reason: string) => {
      if (reason !== 'io client disconnect') setStatus('reconnecting');
    });
    socket.on('peer:joined', () => createPeer());
    socket.on('peer:left', () => setStatus('peer-away'));
    socket.on('signal', (payload) => {
      signalQueue = signalQueue.then(() => handleSignal(payload));
    });
    socket.on('session:live', ({ startedAt: at }) => {
      setStartedAt(at);
      handlers.current.onLive?.();
    });
    socket.on('session:ended', ({ status: ended }) => handlers.current.onSessionEnded?.(ended));
    socket.on('doc:request', (request) => handlers.current.onDocRequest?.(request));
    socket.on('recording:state', ({ recording }) => handlers.current.onRecordingState?.(recording));
    socket.on('room:replaced', () => {
      setError('This session was opened in another window.');
      setStatus('failed');
      socket.close();
    });

    const stats = window.setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') {
        setRoundTripMs(null);
        return;
      }
      const report = await pc.getStats();
      report.forEach((entry) => {
        if (entry.type === 'candidate-pair' && entry.nominated && entry.currentRoundTripTime !== undefined) {
          setRoundTripMs(Math.round(entry.currentRoundTripTime * 1000));
        }
      });
    }, 3000);

    return () => {
      window.clearInterval(stats);
      pc?.close();
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId, token, localStream]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const logEvent = useCallback((type: string, data?: unknown) => {
    socketRef.current?.emit('event:log', { type, data });
  }, []);

  return { status, remoteStream, error, startedAt, roundTripMs, emit, logEvent };
}

export const STATUS_LABEL: Record<CallStatus, string> = {
  joining: 'Joining…',
  waiting: 'Waiting for the other person',
  connecting: 'Connecting video…',
  connected: 'Connected',
  'peer-away': 'The other person lost connection',
  reconnecting: 'Reconnecting…',
  failed: 'Not connected',
};
