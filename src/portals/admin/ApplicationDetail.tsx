import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, FileDown, Pencil } from 'lucide-react';
import { api, errorMessage, openProtectedFile, useLoad } from '../../shared/api';
import type { ApplicationBundle, Session, User } from '../../shared/types';
import {
  Button, Card, EmptyState, ErrorBanner, Field, formatDateTime, humanize, KeyValues, Loading, PageHeader, ProtectedImage, StatCard, StatusBadge, SuccessBanner,
} from '../../shared/ui';

const TABS = ['Documents', 'OCR', 'Questionnaire', 'Sessions', 'Reports', 'Audit'] as const;
type Tab = (typeof TABS)[number];

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function QuickActions({ bundle, reload }: { bundle: ApplicationBundle; reload: () => Promise<void> }) {
  const { application: app } = bundle;
  const [agents, setAgents] = useState<User[]>([]);
  const [agentId, setAgentId] = useState(app.assigned_agent_id ?? '');
  const [when, setWhen] = useState(app.session?.scheduled_at ? toLocalInput(app.session.scheduled_at) : '');
  const [invite, setInvite] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ users: User[] }>('/users?role=AGENT').then(({ users }) => setAgents(users.filter((u) => u.active))).catch((err) => setError(errorMessage(err)));
  }, []);

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const canSchedule = ['ASSIGNED', 'SCHEDULED', 'INVITED', 'SESSION_DROPPED', 'REVERIFICATION'].includes(app.status);
  const canInvite = ['SCHEDULED', 'INVITED'].includes(app.status);
  const needsNewAttempt = ['SESSION_DROPPED', 'REVERIFICATION'].includes(app.status);

  return (
    <Card title="Next steps">
      <div className="space-y-5">
        <ErrorBanner message={error} />
        <div>
          <Field label="1. Assign agent">
            <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Choose an agent</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} ({agent.active_cases} open)</option>)}
            </select>
          </Field>
          <Button
            small variant="secondary" className="mt-2" busy={busy === 'assign'}
            disabled={!agentId || agentId === app.assigned_agent_id}
            onClick={() => run('assign', () => api(`/applications/${app.id}/assign`, { body: { agentId } }).then(() => undefined))}
          >
            Assign agent
          </Button>
        </div>

        <div>
          <Field label={needsNewAttempt ? '2. Schedule a new attempt' : '2. Schedule meeting'}>
            <input className="input" type="datetime-local" value={when} disabled={!canSchedule} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Button
            small variant="secondary" className="mt-2" busy={busy === 'schedule'} disabled={!canSchedule || !when}
            onClick={() => run('schedule', () => api(`/applications/${app.id}/schedule`, { body: { scheduledAt: new Date(when).toISOString() } }).then(() => { setInvite(null); }))}
          >
            {needsNewAttempt ? 'Schedule new attempt' : 'Save meeting time'}
          </Button>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">3. Invite customer</span>
          <Button
            small variant="secondary" busy={busy === 'invite'} disabled={!canInvite}
            onClick={() => run('invite', async () => {
              const result = await api<{ link: string; expiresAt: string }>(`/applications/${app.id}/invite`, { method: 'POST' });
              setInvite(result);
            })}
          >
            {app.status === 'INVITED' ? 'Send a new invitation link' : 'Send invitation'}
          </Button>
          {app.status === 'INVITED' && !invite && (
            <p className="mt-2 text-xs text-slate-500">Sent. Link valid until {formatDateTime(app.session?.invite_expires_at)}. A new link cancels the old one.</p>
          )}
          {invite && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
              <p className="text-xs font-medium text-brand-900">Copy this link now. It is shown only once.</p>
              <p className="mt-1 text-xs text-brand-900">No email or SMS gateway is connected, so send it to the customer yourself.</p>
              <input aria-label="Invitation link" readOnly value={invite.link} onFocus={(e) => e.target.select()} className="input mt-2 text-xs" />
              <Button
                small variant="secondary" className="mt-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite.link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ReviewPanel({ bundle, reload }: { bundle: ApplicationBundle; reload: () => Promise<void> }) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: string) {
    setBusy(decision);
    setError(null);
    try {
      await api(`/applications/${bundle.application.id}/review`, { body: { decision, remarks } });
      setRemarks('');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="KYC review">
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Field label="Reviewer remarks">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button busy={busy === 'APPROVED'} disabled={!!busy} onClick={() => decide('APPROVED')}>Approve</Button>
          <Button variant="secondary" busy={busy === 'REVERIFICATION'} disabled={!!busy} onClick={() => decide('REVERIFICATION')}>Request re-verification</Button>
          <Button variant="danger" busy={busy === 'REJECTED'} disabled={!!busy} onClick={() => decide('REJECTED')}>Reject</Button>
        </div>
      </div>
    </Card>
  );
}

function AttemptPicker({ sessions, value, onChange }: { sessions: Session[]; value: string; onChange: (id: string) => void }) {
  if (sessions.length < 2) return null;
  return (
    <select className="input mb-4 w-auto" aria-label="Choose attempt" value={value} onChange={(e) => onChange(e.target.value)}>
      {sessions.map((s) => <option key={s.id} value={s.id}>Attempt {s.attempt_no} ({humanize(s.status)})</option>)}
    </select>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(() => api<ApplicationBundle>(`/applications/${id}`), [id]);
  const [tab, setTab] = useState<Tab>('Documents');
  const [attempt, setAttempt] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error && !data) return <ErrorBanner message={error} />;
  if (!data) return <Loading />;

  const { application: app } = data;
  const sessionId = attempt || app.current_session_id || '';
  const documents = data.documents.filter((d) => d.session_id === sessionId && d.doc_type !== 'RECORDING');
  const current = documents.filter((d) => d.is_current);
  const recordings = data.documents.filter((d) => d.session_id === sessionId && d.doc_type === 'RECORDING');
  const frames = data.frames.filter((f) => f.session_id === sessionId);
  const questionnaire = data.questionnaireLogs.filter((q) => q.session_id === sessionId).at(-1);
  const consent = data.consents.filter((c) => c.session_id === sessionId).at(-1);
  const session = data.sessions.find((s) => s.id === sessionId);
  const verified = current.filter((d) => d.status === 'VERIFIED').length;
  const lastReview = data.reviews.at(-1);

  async function generateReport() {
    setReportBusy(true);
    setActionError(null);
    try {
      await api(`/applications/${app.id}/reports`, { method: 'POST' });
      setNotice('A new report version was generated.');
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{app.client_name} <StatusBadge status={app.status} /></span>}
        subtitle={`${app.reference_no} · Created ${formatDateTime(app.created_at)}`}
        action={!['IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(app.status) && (
          <Link to={`/admin/applications/${app.id}/edit`}><Button variant="secondary"><Pencil className="h-4 w-4" /> Edit details</Button></Link>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Documents verified" value={verified} of={data.requiredDocuments.length} />
        <StatCard label="Verification attempts" value={data.sessions.length} />
        <StatCard label="Session frames" value={frames.length} />
        <StatCard label="Report versions" value={data.reports.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {app.status === 'PENDING_REVIEW' && <ReviewPanel bundle={data} reload={reload} />}
          {lastReview && app.status !== 'PENDING_REVIEW' && (
            <Card title="Latest KYC decision">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge status={lastReview.decision} />
                <span className="text-slate-600">{lastReview.reviewer_name}, {formatDateTime(lastReview.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{lastReview.remarks}</p>
            </Card>
          )}

          <section className="rounded-xl border border-slate-200 bg-white shadow-card">
            <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
              {TABS.map((name) => (
                <button
                  key={name} role="tab" type="button" aria-selected={tab === name} onClick={() => setTab(name)}
                  className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm ${tab === name ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="p-5">
              {['Documents', 'OCR', 'Questionnaire'].includes(tab) && <AttemptPicker sessions={data.sessions} value={sessionId} onChange={setAttempt} />}

              {tab === 'Documents' && (
                <div className="space-y-6">
                  <ErrorBanner message={actionError} />
                  {data.requiredDocuments.every((info) => !current.find((d) => d.doc_type === info.type)) && (
                    <EmptyState title="No documents captured yet">The agent captures these during the live session.</EmptyState>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.requiredDocuments.map((info) => {
                      const doc = current.find((d) => d.doc_type === info.type);
                      if (!doc) return null;
                      const older = documents.filter((d) => d.doc_type === info.type && !d.is_current).length;
                      return (
                        <div key={info.type} className="overflow-hidden rounded-lg border border-slate-200">
                          <button
                            type="button" className="block w-full" aria-label={`Open ${info.label} full size`}
                            onClick={() => openProtectedFile(`/documents/${doc.id}/file`).catch((err) => setActionError(errorMessage(err)))}
                          >
                            <ProtectedImage path={`/documents/${doc.id}/file`} alt={info.label} className="h-40 w-full bg-slate-100 object-contain" />
                          </button>
                          <div className="space-y-1 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{info.label}</span>
                              <StatusBadge status={doc.status} />
                            </div>
                            <p className="text-xs text-slate-500">
                              {humanize(doc.source)}, version {doc.version}{older ? ` (${older} earlier kept)` : ''}
                            </p>
                            {doc.status_note && <p className="text-xs text-red-700">{doc.status_note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {frames.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Session frames</h3>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {frames.map((frame) => (
                          <ProtectedImage key={frame.id} path={`/frames/${frame.id}/file`} alt="Session frame" className="aspect-video w-full rounded-lg object-cover" />
                        ))}
                      </div>
                    </div>
                  )}
                  {recordings.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Recordings</h3>
                      <ul className="space-y-1.5 text-sm">
                        {recordings.map((rec) => (
                          <li key={rec.id} className="flex items-center justify-between gap-2">
                            <span>Segment {rec.version}, {(rec.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                            <Button small variant="secondary" onClick={() => openProtectedFile(`/documents/${rec.id}/file`).catch((err) => setActionError(errorMessage(err)))}>Play</Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === 'OCR' && (
                <div className="space-y-5">
                  {data.ocrResults.filter((o) => o.session_id === sessionId).length === 0 && <EmptyState title="No OCR results yet" />}
                  {data.ocrResults.filter((o) => o.session_id === sessionId).map((ocr) => (
                    <div key={ocr.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{humanize(ocr.doc_type)}</span>
                        <StatusBadge status={ocr.status} />
                        <span className="text-xs text-slate-500">Confidence {Math.round(ocr.confidence)}%</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead><tr className="border-b border-slate-100"><th className="th !px-2">Field</th><th className="th !px-2">OCR read</th><th className="th !px-2">Final value</th></tr></thead>
                          <tbody>
                            {Object.keys(ocr.corrected_fields).map((key) => {
                              const changed = ocr.corrected_fields[key] !== ocr.original_fields[key];
                              return (
                                <tr key={key} className="border-b border-slate-50">
                                  <td className="td !px-2 !py-1.5 text-slate-500">{humanize(key)}</td>
                                  <td className="td !px-2 !py-1.5">{ocr.original_fields[key] || '—'}</td>
                                  <td className={`td !px-2 !py-1.5 ${changed ? 'font-medium text-amber-800' : ''}`}>{ocr.corrected_fields[key] || '—'}{changed && ' (corrected)'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {ocr.corrections.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">{ocr.corrections.length} correction{ocr.corrections.length > 1 ? 's' : ''}, last by {ocr.corrections.at(-1)!.by}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'Questionnaire' && (
                questionnaire ? (
                  <div className="space-y-5">
                    {questionnaire.template.sections.map((section) => (
                      <div key={section.title}>
                        <h3 className="mb-2 text-sm font-semibold">{section.title}</h3>
                        <ul className="space-y-1.5">
                          {section.questions.map((q) => {
                            const answer = questionnaire.answers[q.id];
                            return (
                              <li key={q.id} className="flex items-start justify-between gap-4 text-sm">
                                <span className="text-slate-600">{q.text}</span>
                                <span className="shrink-0 font-medium">{answer === true ? 'Yes' : answer === false ? 'No' : answer || '—'}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 pt-3">
                      <h3 className="text-sm font-semibold">Agent remarks</h3>
                      <p className="mt-1 text-sm text-slate-700">{session?.agent_remarks ?? '—'}</p>
                    </div>
                  </div>
                ) : <EmptyState title="Questionnaire not completed yet" />
              )}

              {tab === 'Sessions' && (
                data.sessions.length === 0 ? <EmptyState title="No sessions yet">Schedule a meeting to create the first one.</EmptyState> : (
                  <div className="space-y-4">
                    {[...data.sessions].reverse().map((s) => {
                      const events = data.events.filter((e) => e.session_id === s.id);
                      return (
                        <details key={s.id} className="rounded-lg border border-slate-200" open={s.id === app.current_session_id}>
                          <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3 text-sm">
                            <span className="font-medium">Attempt {s.attempt_no}</span>
                            <StatusBadge status={s.status} />
                            <span className="text-xs text-slate-500">Scheduled {formatDateTime(s.scheduled_at)}</span>
                          </summary>
                          <ul className="max-h-72 divide-y divide-slate-50 overflow-y-auto border-t border-slate-100 px-3">
                            {events.length === 0 && <li className="py-3 text-sm text-slate-500">No events yet.</li>}
                            {events.map((e) => (
                              <li key={e.id} className="flex justify-between gap-3 py-1.5 text-xs">
                                <span>{humanize(e.event_type)} <span className="text-slate-400">({e.actor_role})</span></span>
                                <span className="shrink-0 text-slate-500">{formatDateTime(e.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                )
              )}

              {tab === 'Reports' && (
                <div className="space-y-3">
                  <ErrorBanner message={actionError} />
                  <SuccessBanner message={notice} />
                  <Button variant="secondary" small busy={reportBusy} disabled={!app.current_session_id} onClick={generateReport}>Generate new version</Button>
                  {data.reports.length === 0 && <EmptyState title="No reports yet">A report is generated when the agent submits.</EmptyState>}
                  <ul className="divide-y divide-slate-100">
                    {[...data.reports].reverse().map((report) => (
                      <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <div>
                          <div className="text-sm font-medium">Version {report.version}</div>
                          <div className="text-xs text-slate-500">{report.reason}, {formatDateTime(report.created_at)}, {(report.size_bytes / 1024).toFixed(0)} KB</div>
                        </div>
                        <Button small variant="secondary" onClick={() => openProtectedFile(`/reports/${report.id}/file`).catch((err) => setActionError(errorMessage(err)))}>
                          <FileDown className="h-3.5 w-3.5" /> Open PDF
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'Audit' && (
                data.auditLogs.length === 0 ? <EmptyState title="No audit entries yet" /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.auditLogs.map((log) => (
                      <li key={log.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                        <span><span className="font-medium">{log.actor_name}</span> <span className="text-slate-600">{humanize(log.action)}</span></span>
                        <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {!['IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(app.status) && <QuickActions key={app.id} bundle={data} reload={reload} />}
          <Card title="Client details">
            <KeyValues rows={[
              ['Date of birth', app.dob], ['Email', app.email], ['Phone', app.phone], ['Residence', app.country_of_residence],
              ['Passport', app.passport_no], ['PAN', app.pan_no], ['Foreign ID', `${app.foreign_id_type} ${app.foreign_id_no}`],
              ['Overseas address', app.overseas_address], ['India address', app.india_address],
              ['Agent', data.agent?.name],
            ]} />
          </Card>
          <Card title="Consent">
            {consent ? (
              <KeyValues rows={[
                ['Given', formatDateTime(consent.created_at)],
                ['Recording', consent.recording ? 'Agreed' : 'Declined'],
                ['Location', consent.location && consent.latitude != null ? `${consent.latitude.toFixed(4)}, ${consent.longitude?.toFixed(4)}` : 'Not shared'],
                ['IP address', consent.ip_address],
              ]} />
            ) : <p className="text-sm text-slate-500">Not given yet for this attempt.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
