import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface VideoTileProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
  label?: string;
}

export const VideoTile = forwardRef<HTMLVideoElement, VideoTileProps>(function VideoTile({ stream, muted, mirrored, className = '', label }, ref) {
  const inner = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => inner.current!, []);

  useEffect(() => {
    const element = inner.current;
    if (element && element.srcObject !== stream) {
      element.srcObject = stream;
      // Some browsers block autoplay with sound. The controls still work if this is refused.
      if (stream) element.play().catch(() => undefined);
    }
  }, [stream]);

  return (
    <video
      ref={inner}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className={`bg-slate-900 object-cover ${mirrored ? '-scale-x-100' : ''} ${className}`}
    />
  );
});

export function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth) return Promise.reject(new Error('There is no live video to capture yet'));
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not capture the frame'))), 'image/jpeg', 0.92);
  });
}

// Records the customer's video with both sides' audio mixed together.
export function useRecorder(remote: MediaStream | null, local: MediaStream | null, onSegment: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const stop = () => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };

  const start = () => {
    if (!remote) throw new Error('There is no live video to record yet');
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    [remote, local].forEach((stream) => {
      if (stream?.getAudioTracks().length) context.createMediaStreamSource(stream).connect(destination);
    });
    audio.current = context;

    const tracks = [...remote.getVideoTracks(), ...destination.stream.getAudioTracks()];
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('This browser cannot record WebM video');
    const instance = new MediaRecorder(new MediaStream(tracks), { mimeType });
    const chunks: Blob[] = [];
    instance.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    instance.onstop = () => {
      setRecording(false);
      void audio.current?.close();
      audio.current = null;
      recorder.current = null;
      if (chunks.length) onSegmentRef.current(new Blob(chunks, { type: 'video/webm' }));
    };
    instance.start(1000);
    recorder.current = instance;
    setRecording(true);
  };

  // When a reconnect replaces the remote stream, the running segment is closed and saved.
  useEffect(() => {
    if (!remote) stop();
  }, [remote]);

  useEffect(() => stop, []);

  return { recording, start, stop };
}

export function useMicLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream?.getAudioTracks().length) return undefined;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const timer = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      setLevel(Math.min(100, Math.round((data.reduce((sum, v) => sum + v, 0) / data.length) * 1.6)));
    }, 150);
    return () => {
      window.clearInterval(timer);
      void context.close();
    };
  }, [stream]);
  return level;
}

export function useElapsed(startedAt: string | null, stoppedAt?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt || stoppedAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, stoppedAt]);
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor(((stoppedAt ? new Date(stoppedAt).getTime() : now) - new Date(startedAt).getTime()) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
