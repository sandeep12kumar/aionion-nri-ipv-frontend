import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, Camera, Check, CheckCircle2, CircleDot, FileText, Mic, MicOff, Video, VideoOff, Wifi } from 'lucide-react';
import { api, apiUrl, clearCustomerToken, errorMessage, getCustomerToken, setCustomerToken } from '../../shared/api';
import { Logo, ProductTitle } from '../../shared/Brand';
import type { Consent, RequiredDocument, Session } from '../../shared/types';
import { Button, ErrorBanner, formatDateTime, Loading, SuccessBanner } from '../../shared/ui';
import { useMicLevel, VideoTile } from '../../shared/video/media';
import { useLocalMedia } from '../../shared/video/useLocalMedia';
import { STATUS_LABEL, useVideoCall } from '../../shared/video/useVideoCall';

interface InviteInfo {
  referenceNo: string;
  scheduledAt: string;
  clientName: string;
}

interface CustomerState {
  session: Session;
  application: { reference_no: string; client_name: string };
  agentName: string | null;
  consent: Consent | null;
  // Recording is left out when the server has recording turned off.
  consentText: Partial<Record<'dataProcessing' | 'video' | 'recording' | 'location', string>>;
  requiredDocuments: RequiredDocument[];
}

const STEPS = ['Welcome', 'Consent', 'Device check', 'Video call'];

function Shell({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-5">
        <Logo className="h-10 sm:h-12" />
        <ProductTitle title="NRI IPV" subtitle="Verification" />
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pb-10">
        {step !== undefined && (
          <ol className="mb-5 flex items-center gap-1 sm:gap-1.5" aria-label="Progress">
            {STEPS.map((name, index) => (
              <li key={name} className="flex items-center gap-1 sm:gap-1.5">
                {index > 0 && <span className="hidden h-px w-3 bg-slate-300 sm:block" aria-hidden />}
                <span
                  aria-current={index === step ? 'step' : undefined}
                  className={`pill !px-2.5 text-[11px] sm:!px-3.5 sm:text-xs ${index === step ? 'pill-active' : index < step ? 'pill-done' : 'pill-idle'}`}
                >
                  {index < step && <Check className="h-3 w-3" />}
                  {index + 1}. {name}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card sm:p-8">{children}</div>
      </main>
    </div>
  );
}

function WelcomeStep({ token, invite, onStarted }: { token: string; invite: InviteInfo; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ token: string }>(`/customer/invite/${token}/start`, { method: 'POST', token: null });
      setCustomerToken(result.token);
      onStarted();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Welcome, {invite.clientName}</h1>
        <p className="mt-1 text-sm text-slate-600">You have been invited to complete a video verification for application {invite.referenceNo}.</p>
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" /> {formatDateTime(invite.scheduledAt)}
        </p>
        <p className="mt-0.5 pl-6 text-xs text-slate-500">Shown in your own time zone</p>
      </div>
      <ErrorBanner message={error} />
      <Button className="w-full" busy={busy} onClick={start}>Start verification</Button>
    </div>
  );
}

function ConsentStep({ state, onDone }: { state: CustomerState; onDone: () => void }) {
  const [checks, setChecks] = useState({ dataProcessing: false, video: false, recording: false, location: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location is required for the verification, so a refusal or failure stops here with a clear next step.
  const getLocation = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share your location. Please use an up-to-date Chrome, Safari or Edge.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (failure) => reject(new Error(failure.code === failure.PERMISSION_DENIED
      ? 'Location access is blocked. Allow location for this site in your browser settings (the icon in the address bar), then try again.'
      : 'We could not find your location. Turn on location services on your device, then try again.')), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const position = await getLocation();
      await api('/customer/consent', {
        token: getCustomerToken(),
        body: {
          dataProcessing: checks.dataProcessing,
          video: checks.video,
          recording: checks.recording,
          location: true,
          coords: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy },
        },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const allRows: { key: keyof typeof checks; required: boolean }[] = [
    { key: 'dataProcessing', required: true }, { key: 'video', required: true }, { key: 'recording', required: false }, { key: 'location', required: true },
  ];
  const rows = allRows.filter(({ key }) => state.consentText[key]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Before we begin</h1>
        <p className="mt-1 text-sm text-slate-600">Please have these originals with you. The agent will ask you to show each one to the camera.</p>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {state.requiredDocuments.map((doc) => (
          <li key={doc.type} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
            <FileText className="h-3.5 w-3.5 shrink-0 text-brand-600" /> {doc.label}
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <h2 className="text-sm font-semibold">Your consent</h2>
        {rows.map(({ key, required }) => (
          <label key={key} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} />
            <span>{state.consentText[key]} <span className="text-xs text-slate-500">{required ? '(required)' : '(optional)'}</span></span>
          </label>
        ))}
      </div>
      <ErrorBanner message={error} />
      {checks.location && !busy && !error && <p className="text-xs text-slate-500">Your browser will ask to share your location. Please choose Allow.</p>}
      <Button type="submit" className="w-full" busy={busy} disabled={!checks.dataProcessing || !checks.video || !checks.location}>Agree and continue</Button>
    </form>
  );
}

function DeviceStep({ onDone }: { onDone: () => void }) {
  const media = useLocalMedia();
  const level = useMicLevel(media.stream);
  const [latency, setLatency] = useState<number | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStalled, setCameraStalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const samples: number[] = [];
        for (let i = 0; i < 3; i += 1) {
          const started = performance.now();
          const response = await fetch(apiUrl('/health'), { cache: 'no-store' });
          if (!response.ok) throw new Error('health check failed');
          samples.push(performance.now() - started);
        }
        if (!cancelled) setLatency(Math.round(samples.reduce((a, b) => a + b, 0) / samples.length));
      } catch {
        if (!cancelled) setNetworkFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A camera track can exist without producing a picture, so only decoded frames count as working.
  useEffect(() => {
    setCameraReady(false);
    setCameraStalled(false);
    if (!media.stream) return undefined;
    let lastCount = 0;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const video = preview.current;
      const count = video?.videoWidth ? video.getVideoPlaybackQuality().totalVideoFrames : 0;
      const flowing = count > lastCount && lastCount > 0;
      lastCount = count;
      setCameraReady(flowing);
      setCameraStalled(!flowing && Date.now() - started > 6000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [media.stream]);

  const micReady = Boolean(media.stream?.getAudioTracks().length);

  async function proceed() {
    setBusy(true);
    setError(null);
    try {
      await api('/customer/device-check', {
        token: getCustomerToken(),
        body: { camera: cameraReady, microphone: micReady, latencyMs: latency, userAgent: navigator.userAgent.slice(0, 500) },
      });
      media.stop();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const check = (ok: boolean, icon: ReactNode, label: string, detail: string) => (
    <li className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-brand-600">{icon}</span>
      <span className="flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span>
      {ok && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Ready" />}
    </li>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Check your camera and microphone</h1>
      <div className="relative overflow-hidden rounded-xl bg-slate-900">
        <VideoTile ref={preview} stream={media.stream} muted mirrored label="Your camera preview" className="aspect-[4/3] w-full" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-3/4 w-2/5 rounded-[50%] border-2 border-dashed border-white/80" />
        </div>
        <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white drop-shadow">Center your face in the outline</p>
      </div>
      {(media.error || cameraStalled) && (
        <div className="space-y-2">
          <ErrorBanner message={media.error ?? 'Your camera is connected, but no picture is coming through. Close other apps using it and try again.'} />
          <Button small variant="secondary" onClick={media.retry}>Try again</Button>
        </div>
      )}
      <ul className="space-y-2">
        {check(cameraReady, <Camera className="h-4 w-4" />, 'Camera', cameraReady ? 'Working' : media.stream ? 'Waiting for a picture' : 'Waiting for access')}
        <li className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-3">
            <span className="text-brand-600"><Mic className="h-4 w-4" /></span>
            <span className="flex-1"><span className="block text-sm font-medium">Microphone</span><span className="block text-xs text-slate-500">{micReady ? 'Say something, the bar should move' : 'Waiting for access'}</span></span>
            {micReady && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Ready" />}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${level}%` }} /></div>
        </li>
        {check(latency !== null, <Wifi className="h-4 w-4" />, 'Network', networkFailed ? 'Could not measure the connection. You can still continue.' : latency !== null ? `${latency} ms to the server${latency > 500 ? ', this may be slow' : ''}` : 'Testing…')}
      </ul>
      <ErrorBanner message={error} />
      <Button className="w-full" busy={busy} disabled={!cameraReady || !micReady || (latency === null && !networkFailed)} onClick={proceed}>Continue to video call</Button>
    </div>
  );
}

function VideoStep({ state, onEnded }: { state: CustomerState; onEnded: (status: string) => void }) {
  const media = useLocalMedia();
  const [request, setRequest] = useState<{ label: string; instruction: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const call = useVideoCall({
    sessionId: state.session.id,
    token: getCustomerToken(),
    localStream: media.stream,
    onSessionEnded: onEnded,
    onDocRequest: setRequest,
    onRecordingState: setRecording,
  });
  const connected = call.status === 'connected';

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-white">
      <div className="relative min-h-0 flex-1">
        <VideoTile stream={call.remoteStream} label="Agent video" className="h-full w-full" />
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="text-base font-medium">{call.status === 'waiting' ? `Waiting for ${state.agentName ?? 'your agent'} to join` : STATUS_LABEL[call.status]}</p>
            <p className="text-sm text-slate-300">Please keep this page open and your documents ready.</p>
          </div>
        )}
        <div className="absolute right-3 top-3 w-24 overflow-hidden rounded-xl border border-white/30 shadow-lg sm:w-44">
          <VideoTile stream={media.stream} muted mirrored label="Your video" className="aspect-[3/4] w-full sm:aspect-video" />
        </div>
        {recording && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-medium"><CircleDot className="h-3 w-3" /> Recording</span>
        )}
        {request && connected && (
          <div className="absolute inset-x-3 bottom-3 mx-auto max-w-lg rounded-xl bg-white p-3 text-slate-900 shadow-lg" role="status">
            <p className="text-sm font-semibold">Please show: {request.label}</p>
            <p className="mt-0.5 text-xs text-slate-600">{request.instruction} Hold it still until the agent confirms.</p>
          </div>
        )}
      </div>
      {(media.error || call.error) && (
        <div className="space-y-2 p-3">
          <ErrorBanner message={media.error ?? call.error} />
          {media.error && <Button small variant="secondary" onClick={media.retry}>Try again</Button>}
        </div>
      )}
      <div className="flex items-center justify-center gap-3 p-3">
        <button
          type="button" aria-label={media.micOn ? 'Mute microphone' : 'Unmute microphone'}
          onClick={() => call.logEvent(media.toggleMic() ? 'MIC_UNMUTED' : 'MIC_MUTED')}
          className={`rounded-full p-3 ${media.micOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600'}`}
        >
          {media.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          type="button" aria-label={media.cameraOn ? 'Turn camera off' : 'Turn camera on'}
          onClick={() => call.logEvent(media.toggleCamera() ? 'CAMERA_ON' : 'CAMERA_OFF')}
          className={`rounded-full p-3 ${media.cameraOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600'}`}
        >
          {media.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </button>
        <span className="flex items-center gap-1 text-xs text-slate-300"><Wifi className="h-3.5 w-3.5" /> {STATUS_LABEL[call.status]}</span>
      </div>
    </div>
  );
}

export default function CustomerFlow() {
  const { token = '' } = useParams();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [state, setState] = useState<CustomerState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceDone, setDeviceDone] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const customerToken = getCustomerToken();
    if (!customerToken) {
      setState(null);
      return;
    }
    try {
      const data = await api<CustomerState>('/customer/session', { token: customerToken });
      setState(data);
      if (['COMPLETED', 'DROPPED'].includes(data.session.status)) setEnded(data.session.status);
    } catch {
      // A sign-in from an older link or an expired one: ask for a new code.
      clearCustomerToken();
      setState(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        if (!getCustomerToken()) setInvite(await api<InviteInfo>(`/customer/invite/${token}`, { token: null }));
      } catch (err) {
        setFatal(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refresh]);

  if (loading) return <Shell><Loading /></Shell>;

  if (ended) {
    return (
      <Shell>
        <div className="py-4 text-center">
          <CheckCircle2 className={`mx-auto h-12 w-12 ${ended === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <h1 className="mt-3 text-lg font-semibold">{ended === 'COMPLETED' ? 'Verification submitted' : 'Your session has ended'}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {ended === 'COMPLETED'
              ? 'Thank you. Your verification has been submitted for review, and you will be told the outcome. You can close this page.'
              : 'This session was closed before it was completed. We will contact you to arrange a new appointment.'}
          </p>
          {state && <p className="mt-3 text-xs text-slate-500">Reference {state.application.reference_no}</p>}
        </div>
      </Shell>
    );
  }

  if (fatal) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">This link cannot be used</h1>
        <div className="mt-3"><ErrorBanner message={fatal} /></div>
      </Shell>
    );
  }

  if (!state) {
    if (!invite) return <Shell><Loading /></Shell>;
    return <Shell step={0}><WelcomeStep token={token} invite={invite} onStarted={refresh} /></Shell>;
  }

  if (!state.consent) return <Shell step={1}><ConsentStep state={state} onDone={refresh} /></Shell>;

  if (!deviceDone && !state.session.device_checked_at) {
    return (
      <Shell step={2}>
        <DeviceStep onDone={() => { setDeviceDone(true); void refresh(); }} />
        <div className="mt-3"><SuccessBanner message={state.consent.location ? 'Your location was recorded with your consent.' : null} /></div>
      </Shell>
    );
  }

  return <VideoStep state={state} onEnded={(status) => setEnded(status)} />;
}
