import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../shared/api';
import type { Application, ApplicationBundle, ClientFields } from '../../shared/types';
import { Button, Card, ErrorBanner, Field, Loading, PageHeader } from '../../shared/ui';

const EMPTY: ClientFields = {
  client_name: '', email: '', phone: '', dob: '', nationality: 'Indian', country_of_residence: '',
  passport_no: '', pan_no: '', foreign_id_type: '', foreign_id_no: '', overseas_address: '', india_address: '',
};

export default function ApplicationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientFields | null>(id ? null : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<ApplicationBundle>(`/applications/${id}`)
      .then(({ application }) => {
        const values = Object.fromEntries(Object.keys(EMPTY).map((key) => [key, application[key as keyof ClientFields] ?? '']));
        setForm(values as unknown as ClientFields);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (!form) return error ? <ErrorBanner message={error} /> : <Loading />;

  const text = (key: keyof ClientFields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <input className="input" required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </Field>
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { application } = id
        ? await api<{ application: Application }>(`/applications/${id}`, { method: 'PATCH', body: form })
        : await api<{ application: Application }>('/applications', { body: form });
      navigate(`/admin/applications/${application.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={id ? 'Edit client details' : 'New IPV request'} subtitle="Use dummy client information only while testing" />
      <form onSubmit={submit} className="space-y-5">
        <ErrorBanner message={error} />
        <Card title="Client">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('client_name', 'Full name as on passport')}
            {text('dob', 'Date of birth', { type: 'date' })}
            {text('email', 'Email', { type: 'email' })}
            {text('phone', 'Mobile number with country code', { placeholder: '+971500000000' })}
            {text('nationality', 'Nationality')}
            {text('country_of_residence', 'Country of residence')}
          </div>
        </Card>
        <Card title="Identity documents">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('passport_no', 'Passport number')}
            {text('pan_no', 'PAN', { placeholder: 'ABCDE1234F' })}
            {text('foreign_id_type', 'Foreign ID type', { placeholder: 'Residence permit, driving licence…' })}
            {text('foreign_id_no', 'Foreign ID number')}
          </div>
        </Card>
        <Card title="Addresses">
          <div className="grid gap-4">
            {text('overseas_address', 'Overseas address')}
            {text('india_address', 'India address (optional)', { required: false })}
          </div>
        </Card>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" busy={busy}>{id ? 'Save changes' : 'Create request'}</Button>
        </div>
      </form>
    </div>
  );
}
