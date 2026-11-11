import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle2, ChevronDown, Circle, CircleDot, ClipboardList, Mic, MicOff, PhoneOff, Video, VideoOff, Wifi,
} from 'lucide-react';
import { api, errorMessage, getStaffToken, useLoad } from '../../shared/api';
import { Logo } from '../../shared/Brand';
import type { SessionBundle } from '../../shared/types';
import { Button, ErrorBanner, Field, formatDateTime, humanize, KeyValues, Loading, ProtectedImage, StatusBadge, SuccessBanner } from '../../shared/ui';
import { captureFrame, useElapsed, useRecorder, VideoTile } from '../../shared/video/media';
import { useLocalMedia } from '../../shared/video/useLocalMedia';
import { STATUS_LABEL, useVideoCall } from '../../shared/video/useVideoCall';
import DocumentStep from './DocumentStep';
import QuestionnaireStep from './QuestionnaireStep';

const QUESTIONNAIRE_STEP = 'QUESTIONNAIRE';

export default function SessionRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { data, error, reload } = useLoad(() => api<SessionBundle>(`/sessions/${sessionId}`), [sessionId]);
  const media = useLocalMedia();
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [finished, setFinished] = useState<string | null>(null);
  const frameInput = useRef<HTMLVideoElement | null>(null);

  const ended = finished ?? (data && ['COMPLETED', 'DROPPED'].includes(data.session.status) ? data.session.status : null);

  const call = useVideoCall({
    sessionId: ended ? undefined : sessionId,
    token: getStaffToken(),
    localStream: media.stream,
    onLive: () => void reload(),
  });

  const uploadSegment = useCallback(async (blob: Blob) => {
    try {
      const form = new FormData();
      form.append('file', blob, 'recording.webm');
      await api(`/sessions/${sessionId}/recordings`, { form });
      setNotice('The recording segment was saved.');
      await reload();
    } catch (err) {
      setActionError(`The recording could not be saved: ${errorMessage(err)}`);
    }
  }, [sessionId, reload]);

  const recorder = useRecorder(call.remoteStream, media.stream, uploadSegment);
  const elapsed = useElapsed(call.startedAt ?? data?.session.started_at ?? null, data?.session.ended_at);

  // Tell the customer which document is wanted whenever the agent moves to another step.
  const stepInfo = data?.requiredDocuments.find((d) => d.type === activeStep);
  useEffect(() => {
    if (stepInfo && call.status === 'connected') call.emit('doc:request', stepInfo);
  }, [stepInfo, call.status, call.emit]);

  useEffect(() => {
    if (data && activeStep === null) {
      const current = data.documents.filter((d) => d.is_current);
      const next = data.requiredDocuments.find((info) => current.find((d) => d.doc_type === info.type)?.status !== 'VERIFIED');
      setActiveStep(next?.type ?? QUESTIONNAIRE_STEP);
    }
  }, [data, activeStep]);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    frameInput.current = element;
    setVideoElement(element);
  }, []);

  if (error && !data) {
    return <div className="mx-auto max-w-lg p-8"><ErrorBanner message={error} /><Link to="/agent" className="mt-4 inline-block text-sm text-brand-700 hover:underline">Back to my cases</Link></div>;
  }
  if (!data) return <Loading />;

  const { application: app, session, consent, requiredDocuments, questionnaire } = data;
  const recordingOn = data.features?.recording ?? true;
  const documents = data.documents.filter((d) => d.is_current);
  const docFor = (type: string) => documents.find((d) => d.doc_type === type) ?? null;
  const verifiedCount = requiredDocuments.filter((info) => docFor(info.type)?.status === 'VERIFIED').length;
  const connected = call.status === 'connected';

  const blockers = [
    ...(session.started_at || call.startedAt ? [] : ['The customer has not joined yet']),
    ...requiredDocuments.filter((info) => docFor(info.type)?.status !== 'VERIFIED').map((info) => `${info.label} is not verified`),
  ];

  async function submit(remarks: string) {
    await api(`/sessions/${sessionId}/submit`, { body: { remarks } });
    recorder.stop();
    media.stop();
    setFinished('COMPLETED');
    await reload();
  }

  async function endSession() {
    setActionError(null);
    try {
      await api(`/sessions/${sessionId}/end`, { body: { reason: endReason } });
      recorder.stop();
      media.stop();
      setFinished('DROPPED');
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function saveFrame() {
    setActionError(null);
    try {
      if (!frameInput.current) throw new Error('There is no live video to capture yet');
      const form = new FormData();
      form.append('file', await captureFrame(frameInput.current), 'frame.jpg');
      form.append('note', stepInfo ? `During ${stepInfo.label}` : 'Session frame');
      await api(`/sessions/${sessionId}/frames`, { form });
      setNotice('The frame was saved.');
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function toggleFrame(id: string, includeInReport: boolean) {
    setActionError(null);
    try {
      await api(`/frames/${id}`, { method: 'PATCH', body: { includeInReport } });
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function toggleRecording() {
    setActionError(null);
    try {
      if (recorder.recording) {
        recorder.stop();
        call.emit('recording:state', { recording: false });
      } else {
        recorder.start();
        call.emit('recording:state', { recording: true });
      }
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (ended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <CheckCircle2 className={`mx-auto h-10 w-10 ${ended === 'COMPLETED' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <h1 className="mt-3 text-lg font-semibold">{ended === 'COMPLETED' ? 'Verification submitted' : 'Session ended'}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {ended === 'COMPLETED' ? `${app.reference_no} is now with the KYC review team, and the report has been generated.` : `${app.reference_no} was closed without submission. An admin can schedule a new attempt.`}
          </p>
          <Button className="mt-5" onClick={() => navigate('/agent')}>Back to my cases</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/agent" aria-label="Back to my cases" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <Logo className="hidden h-9 sm:block" />
          <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden />
          <div>
            <h1 className="text-sm font-bold">Live verification: {app.client_name}</h1>
            <p className="text-xs text-slate-500">{app.reference_no} · Attempt {session.attempt_no}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums" aria-label="Session timer">{elapsed}</span>
          <StatusBadge status={connected ? 'VERIFIED' : call.status === 'failed' ? 'DROPPED' : 'INVITED'} label={STATUS_LABEL[call.status]} />
          <Button small variant="danger" onClick={() => setEnding(true)}><PhoneOff className="h-3.5 w-3.5" /> End session</Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto bg-page p-4 lg:grid-cols-[minmax(320px,1fr)_minmax(400px,1.2fr)_280px] lg:overflow-hidden">
        {/* Column 1: customer and agent video */}
        <section aria-label="Video" className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <div className="relative overflow-hidden rounded-xl bg-slate-900">
            <VideoTile ref={setVideoRef} stream={call.remoteStream} label="Customer video" className="aspect-video w-full !object-contain" />
            {!connected && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-200">{STATUS_LABEL[call.status]}</div>
            )}
            <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Customer</span>
            {recorder.recording && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white"><CircleDot className="h-3 w-3" /> REC</span>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3">
            <div className="relative overflow-hidden rounded-xl bg-slate-900">
              <VideoTile stream={media.stream} muted mirrored label="Your video" className="aspect-video w-full" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] text-white">You</span>
            </div>
            <div className="flex flex-wrap content-start gap-2">
              <Button small variant="secondary" aria-pressed={!media.micOn} onClick={() => call.logEvent(media.toggleMic() ? 'MIC_UNMUTED' : 'MIC_MUTED')}>
                {media.micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5 text-red-600" />} {media.micOn ? 'Mute' : 'Unmute'}
              </Button>
              <Button small variant="secondary" aria-pressed={!media.cameraOn} onClick={() => call.logEvent(media.toggleCamera() ? 'CAMERA_ON' : 'CAMERA_OFF')}>
                {media.cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5 text-red-600" />} {media.cameraOn ? 'Camera off' : 'Camera on'}
              </Button>
              <Button small variant="secondary" disabled={!connected} onClick={saveFrame}><Camera className="h-3.5 w-3.5" /> Save frame</Button>
              {recordingOn && (
                <Button
                  small variant="secondary" disabled={!connected || !consent?.recording}
                  title={consent?.recording ? undefined : 'The customer did not consent to recording'}
                  onClick={toggleRecording}
                >
                  <CircleDot className={`h-3.5 w-3.5 ${recorder.recording ? 'text-red-600' : ''}`} /> {recorder.recording ? 'Stop recording' : 'Start recording'}
                </Button>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-500"><Wifi className="h-3.5 w-3.5" /> {call.roundTripMs !== null ? `${call.roundTripMs} ms` : 'No reading'}</span>
            </div>
          </div>

          {media.error && (
            <div className="space-y-2"><ErrorBanner message={media.error} /><Button small variant="secondary" onClick={media.retry}>Try again</Button></div>
          )}
          <ErrorBanner message={call.error} />
          <ErrorBanner message={actionError} />
          <SuccessBanner message={notice} />
          {recordingOn && consent && !consent.recording && <p className="text-xs text-slate-500">Recording is off because the customer did not consent to it.</p>}

          {ending && (
            <div className="rounded-xl border border-red-200 bg-white p-3">
              <Field label="Why are you ending without submitting?">
                <input className="input" value={endReason} onChange={(e) => setEndReason(e.target.value)} />
              </Field>
              <div className="mt-2 flex gap-2">
                <Button small variant="danger" disabled={endReason.trim().length < 3} onClick={endSession}>End session</Button>
                <Button small variant="ghost" onClick={() => setEnding(false)}>Keep going</Button>
              </div>
            </div>
          )}

          {data.frames.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h2 className="mb-2 text-xs font-semibold">Saved frames ({data.frames.length})</h2>
              <div className="grid grid-cols-3 gap-2">
                {data.frames.map((frame) => (
                  <label key={frame.id} className="block cursor-pointer text-[11px] text-slate-600">
                    <ProtectedImage path={`/frames/${frame.id}/file`} alt="Saved frame" className="aspect-video w-full rounded object-cover" />
                    <span className="mt-1 flex items-center gap-1">
                      <input type="checkbox" checked={frame.include_in_report} onChange={(e) => toggleFrame(frame.id, e.target.checked)} /> In report
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Column 2: document verification steps */}
        <section aria-label="Verification steps" className="min-h-0 rounded-xl border border-slate-200 bg-white lg:overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Verification checklist</h2>
              <span className="text-xs tabular-nums text-slate-500">{verifiedCount}/{requiredDocuments.length} verified</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(verifiedCount / requiredDocuments.length) * 100}%` }} />
            </div>
          </div>
          <ol className="divide-y divide-slate-100">
            {requiredDocuments.map((info, index) => {
              const doc = docFor(info.type);
              const open = activeStep === info.type;
              return (
                <li key={info.type}>
                  <button type="button" aria-expanded={open} onClick={() => setActiveStep(open ? '' : info.type)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    {doc?.status === 'VERIFIED' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
                    <span className="flex-1 text-sm font-medium">{index + 1}. {info.label}</span>
                    {doc && <StatusBadge status={doc.status} />}
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <DocumentStep
                        info={info}
                        sessionId={session.id}
                        document={doc}
                        earlierCount={data.documents.filter((d) => d.doc_type === info.type && !d.is_current).length}
                        ocr={doc ? data.ocrResults.filter((o) => o.document_id === doc.id).at(-1) ?? null : null}
                        video={videoElement}
                        onChange={reload}
                      />
                    </div>
                  )}
                </li>
              );
            })}
            <li>
              <button type="button" aria-expanded={activeStep === QUESTIONNAIRE_STEP} onClick={() => setActiveStep(activeStep === QUESTIONNAIRE_STEP ? '' : QUESTIONNAIRE_STEP)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <ClipboardList className={`h-4 w-4 shrink-0 ${questionnaire.latest ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span className="flex-1 text-sm font-medium">{requiredDocuments.length + 1}. Questionnaire</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition ${activeStep === QUESTIONNAIRE_STEP ? 'rotate-180' : ''}`} />
              </button>
              {activeStep === QUESTIONNAIRE_STEP && (
                <div className="px-4 pb-4">
                  <QuestionnaireStep sessionId={session.id} template={questionnaire.template} latest={questionnaire.latest} onSaved={reload} onSubmit={submit} blockers={blockers} />
                </div>
              )}
            </li>
          </ol>
        </section>

        {/* Column 3: customer details and session information */}
        <aside aria-label="Customer and session details" className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">Customer details</h2>
            <KeyValues rows={[
              ['Name', app.client_name], ['Date of birth', app.dob], ['Passport', app.passport_no], ['PAN', app.pan_no],
              ['Foreign ID', `${app.foreign_id_type} ${app.foreign_id_no}`], ['Residence', app.country_of_residence],
              ['Overseas address', app.overseas_address], ['Phone', app.phone],
            ]} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">Session</h2>
            <KeyValues rows={[
              ['Scheduled', formatDateTime(session.scheduled_at)],
              ['Status', <StatusBadge key="s" status={session.status} />],
              ['Link opened', formatDateTime(session.link_opened_at)],
              ...(recordingOn ? [['Recording consent', consent ? (consent.recording ? 'Agreed' : 'Declined') : 'Not given yet'] as [string, string]] : []),
              ['Location', consent?.location && consent.latitude != null ? `${consent.latitude.toFixed(4)}, ${consent.longitude?.toFixed(4)}` : 'Not shared'],
              ['Agent', data.agent?.name],
            ]} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold">Session log</h2>
            <ul className="space-y-1.5">
              {data.events.slice(0, 12).map((event) => (
                <li key={event.id} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-slate-700">{humanize(event.event_type)}</span>
                  <span className="shrink-0 text-slate-400">{new Date(event.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}</span>
                </li>
              ))}
              {data.events.length === 0 && <li className="text-xs text-slate-500">Nothing yet.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
