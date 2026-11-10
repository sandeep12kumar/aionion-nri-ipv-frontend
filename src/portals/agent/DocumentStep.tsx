import { useEffect, useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { api, errorMessage } from '../../shared/api';
import type { DocumentRecord, OcrResult, RequiredDocument } from '../../shared/types';
import { Button, ErrorBanner, Field, humanize, ProtectedImage, StatusBadge, SuccessBanner } from '../../shared/ui';
import { captureFrame } from '../../shared/video/media';

interface Props {
  info: RequiredDocument;
  sessionId: string;
  document: DocumentRecord | null;
  earlierCount: number;
  ocr: OcrResult | null;
  video: HTMLVideoElement | null;
  onChange: () => Promise<void>;
}

function OcrEditor({ ocr, onSaved }: { ocr: OcrResult; onSaved: () => Promise<void> }) {
  const [fields, setFields] = useState(ocr.corrected_fields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = Object.keys(fields).some((key) => fields[key] !== ocr.corrected_fields[key]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/ocr/${ocr.id}`, { method: 'PATCH', body: { fields } });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const failedChecks = ocr.checks ? Object.entries(ocr.checks).filter(([, ok]) => !ok).map(([key]) => humanize(key)) : [];

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">OCR results</span>
        <StatusBadge status={ocr.status} />
        <span className="text-xs text-slate-500">Confidence {Math.round(ocr.confidence)}%</span>
      </div>
      {ocr.status === 'NO_FIELDS_FOUND' && (
        <p className="mb-3 text-xs text-amber-800">No details could be read from this image. Capture it again with the document closer to the camera, or type the details from the document.</p>
      )}
      {failedChecks.length > 0 && (
        <p className="mb-3 text-xs text-amber-800">Passport check digits did not match for: {failedChecks.join(', ')}. Compare these with the document.</p>
      )}
      {'surname' in fields && ocr.status !== 'NO_FIELDS_FOUND' && (
        <p className="mb-3 text-xs text-slate-500">Passports have no check digit for names, so compare the surname and given names with the document.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.keys(fields).map((key) => (
          <Field key={key} label={humanize(key)} hint={fields[key] !== ocr.original_fields[key] ? `OCR read: ${ocr.original_fields[key] || 'blank'}` : undefined}>
            <input className="input !py-1.5" value={fields[key]} onChange={(e) => { setFields({ ...fields, [key]: e.target.value }); setSaved(false); }} />
          </Field>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button small variant="secondary" busy={busy} disabled={!dirty} onClick={save}>Save corrections</Button>
        {saved && <span className="text-xs text-emerald-700">Saved</span>}
      </div>
      <ErrorBanner message={error} />
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500">Show recognised text</summary>
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] text-slate-600">{ocr.raw_text || 'No text recognised.'}</pre>
      </details>
    </div>
  );
}

export default function DocumentStep({ info, sessionId, document, earlierCount, ocr, video, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
    setRejecting(false);
    setRejectNote('');
  }, [info.type]);

  async function store(blob: Blob, source: 'VIDEO_CAPTURE' | 'FILE_UPLOAD', filename: string) {
    setError(null);
    const form = new FormData();
    form.append('docType', info.type);
    form.append('source', source);
    form.append('file', blob, filename);
    setBusy('capture');
    try {
      const { document: saved } = await api<{ document: DocumentRecord }>(`/sessions/${sessionId}/documents`, { form });
      await onChange();
      if (info.ocr) {
        setBusy('ocr');
        await api(`/documents/${saved.id}/ocr`, { method: 'POST' });
        await onChange();
      }
    } catch (err) {
      setError(errorMessage(err));
      await onChange().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  async function capture() {
    if (!video) return setError('There is no live video to capture yet');
    try {
      await store(await captureFrame(video), 'VIDEO_CAPTURE', `${info.type}.jpg`);
    } catch (err) {
      setError(errorMessage(err));
    }
    return undefined;
  }

  async function runOcr() {
    if (!document) return;
    setBusy('ocr');
    setError(null);
    try {
      await api(`/documents/${document.id}/ocr`, { method: 'POST' });
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: 'VERIFIED' | 'REJECTED') {
    if (!document) return;
    setBusy(status);
    setError(null);
    try {
      await api(`/documents/${document.id}/status`, { method: 'PATCH', body: { status, note: status === 'REJECTED' ? rejectNote : undefined } });
      setRejecting(false);
      setRejectNote('');
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Asked of the customer: “{info.instruction}”</p>
      <div className="flex flex-wrap gap-2">
        <Button small busy={busy === 'capture'} disabled={!!busy} onClick={capture}><Camera className="h-3.5 w-3.5" /> Capture from video</Button>
        <Button small variant="secondary" disabled={!!busy} onClick={() => fileInput.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload image</Button>
        <input
          ref={fileInput} type="file" accept="image/jpeg,image/png" className="hidden" aria-label={`Upload ${info.label}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void store(file, 'FILE_UPLOAD', file.name);
          }}
        />
      </div>
      <ErrorBanner message={error} />
      {busy === 'ocr' && <SuccessBanner message="Reading the document with OCR. The first read can take up to a minute." />}

      {document && (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <ProtectedImage key={document.id} path={`/documents/${document.id}/file`} alt={`Captured ${info.label}`} className="max-h-56 w-full bg-slate-100 object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
              <span className="text-xs text-slate-500">
                Version {document.version}{earlierCount ? `, ${earlierCount} earlier kept` : ''}
              </span>
              <StatusBadge status={document.status} />
            </div>
          </div>
          {document.status_note && <p className="text-xs text-red-700">Rejected: {document.status_note}</p>}
          {ocr && busy !== 'ocr' && <OcrEditor key={ocr.id} ocr={ocr} onSaved={onChange} />}
          {info.ocr && !ocr && busy !== 'ocr' && (
            <Button small variant="secondary" onClick={runOcr}>Run OCR</Button>
          )}
          {rejecting ? (
            <div className="space-y-2">
              <Field label="Why is this document being rejected?">
                <input className="input" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button small variant="danger" busy={busy === 'REJECTED'} disabled={!rejectNote.trim()} onClick={() => setStatus('REJECTED')}>Confirm rejection</Button>
                <Button small variant="ghost" onClick={() => setRejecting(false)}>Keep document</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button small busy={busy === 'VERIFIED'} disabled={!!busy || document.status === 'VERIFIED'} onClick={() => setStatus('VERIFIED')}>Mark as verified</Button>
              <Button small variant="danger" disabled={!!busy || document.status === 'REJECTED'} onClick={() => setRejecting(true)}>Reject</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
