import { useCallback, useEffect, useRef, useState } from 'react';

function describe(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return 'Camera or microphone access was blocked. Allow access in your browser settings and try again.';
  if (name === 'NotFoundError') return 'No camera or microphone was found on this device.';
  if (name === 'NotReadableError') return 'Your camera or microphone is being used by another app. Close it and try again.';
  return 'Could not start your camera and microphone.';
}

export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const current = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const autoRestarts = useRef(0);

  const stop = useCallback(() => {
    generation.current += 1;
    current.current?.getTracks().forEach((track) => track.stop());
    current.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    const run = ++generation.current;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera here. Open the app on localhost or HTTPS in a current browser.');
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      // The page may have closed while the permission prompt was open. Don't leave the camera on.
      if (run !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      current.current?.getTracks().forEach((track) => track.stop());
      current.current = media;
      // Fires only when a device fails on its own (unplugged, taken by another app), not on stop().
      // One automatic restart, which also rebuilds any call using this stream, then ask the user.
      media.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (current.current !== media) return;
          if (autoRestarts.current < 1) {
            autoRestarts.current += 1;
            void start();
          } else {
            setError('Your camera or microphone stopped working. Check that it is connected, then try again.');
          }
        });
      });
      setStream(media);
      setMicOn(true);
      setCameraOn(true);
    } catch (err) {
      if (run === generation.current) setError(describe(err));
    }
  }, []);

  useEffect(() => {
    // Deferred so a mount that is immediately undone never opens the camera at all.
    // Overlapping capture requests can leave the surviving stream without any frames.
    const timer = window.setTimeout(() => void start(), 0);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [start, stop]);

  const retry = useCallback(() => {
    autoRestarts.current = 0;
    return start();
  }, [start]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    current.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicOn(next);
    return next;
  }, [micOn]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    current.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraOn(next);
    return next;
  }, [cameraOn]);

  return { stream, error, micOn, cameraOn, retry, stop, toggleMic, toggleCamera };
}
