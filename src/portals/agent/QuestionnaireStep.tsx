import { useState } from 'react';
import { api, errorMessage } from '../../shared/api';
import type { Answers, QuestionnaireLog, QuestionnaireTemplate, Question } from '../../shared/types';
import { Button, ErrorBanner, Field } from '../../shared/ui';

interface Props {
  sessionId: string;
  template: QuestionnaireTemplate;
  latest: QuestionnaireLog | null;
  onSaved: () => Promise<void>;
  onSubmit: (remarks: string) => Promise<void>;
  blockers: string[];
}

function YesNo({ question, value, onChange }: { question: Question; value: boolean | string | undefined; onChange: (next: boolean) => void }) {
  return (
    <fieldset className="flex items-start justify-between gap-3 py-1.5">
      <legend className="sr-only">{question.text}</legend>
      <span className="text-xs text-slate-700" aria-hidden>{question.text}{question.required && <span className="text-red-600"> *</span>}</span>
      <span className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
        {([['Yes', true], ['No', false]] as const).map(([label, option]) => (
          <label key={label} className={`cursor-pointer px-2.5 py-1 text-xs font-medium ${value === option ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <input type="radio" name={question.id} className="sr-only" aria-label={`${question.text}: ${label}`} checked={value === option} onChange={() => onChange(option)} />
            {label}
          </label>
        ))}
      </span>
    </fieldset>
  );
}

export default function QuestionnaireStep({ sessionId, template, latest, onSaved, onSubmit, blockers }: Props) {
  const [answers, setAnswers] = useState<Answers>(latest?.answers ?? {});
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const questions = template.sections.flatMap((s) => s.questions);
  const missing = questions.filter((q) => q.required && (answers[q.id] === undefined || answers[q.id] === '')).length;
  // Compared answer by answer: answers read back from the database can come in a different key order.
  const savedAnswers = latest?.answers ?? {};
  const dirty = [...new Set([...Object.keys(answers), ...Object.keys(savedAnswers)])].some((id) => answers[id] !== savedAnswers[id]);

  const set = (id: string, value: boolean | string) => {
    setAnswers({ ...answers, [id]: value });
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/questionnaire`, { method: 'PUT', body: { answers } });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(remarks);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  const allBlockers = [
    ...blockers,
    ...(missing ? [`${missing} required question${missing === 1 ? '' : 's'} unanswered`] : []),
    ...(dirty ? ['Questionnaire changes are not saved'] : []),
    ...(latest || dirty ? [] : ['Questionnaire not saved']),
    ...(remarks.trim().length < 3 ? ['Agent remarks are empty'] : []),
  ];

  return (
    <div className="space-y-4">
      {template.sections.map((section) => (
        <div key={section.title}>
          <h4 className="mb-1 text-xs font-semibold text-slate-900">{section.title}</h4>
          <div className="divide-y divide-slate-100">
            {section.questions.map((question) =>
              question.type === 'yes_no' ? (
                <YesNo key={question.id} question={question} value={answers[question.id]} onChange={(next) => set(question.id, next)} />
              ) : (
                <div key={question.id} className="py-1.5">
                  <Field label={question.text}>
                    <textarea className="input" rows={2} value={String(answers[question.id] ?? '')} onChange={(e) => set(question.id, e.target.value)} />
                  </Field>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button small variant="secondary" busy={saving} disabled={!dirty} onClick={save}>Save questionnaire</Button>
        {saved && !dirty && <span className="text-xs text-emerald-700">Saved</span>}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <Field label="Agent remarks">
          <textarea className="input" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Summary of the verification and anything the reviewer should know" />
        </Field>
      </div>

      <ErrorBanner message={error} />
      {allBlockers.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">Before you can submit:</p>
          <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
            {allBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      )}
      <Button className="w-full" busy={submitting} disabled={allBlockers.length > 0} onClick={submit}>Submit verification</Button>
    </div>
  );
}
