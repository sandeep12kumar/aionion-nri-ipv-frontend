export type Role = 'ADMIN' | 'AGENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  active_cases?: number;
}

export interface ClientFields {
  client_name: string;
  email: string;
  phone: string;
  dob: string;
  nationality: string;
  country_of_residence: string;
  passport_no: string;
  pan_no: string;
  foreign_id_type: string;
  foreign_id_no: string;
  overseas_address: string;
  india_address: string;
}

export interface Session {
  id: string;
  application_id: string;
  attempt_no: number;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  agent_remarks: string | null;
  invite_expires_at: string | null;
  invite_version: number;
  link_opened_at: string | null;
  consented_at: string | null;
  device_checked_at: string | null;
}

export interface Application extends ClientFields {
  id: string;
  reference_no: string;
  status: string;
  assigned_agent_id: string | null;
  current_session_id: string | null;
  created_at: string;
  updated_at: string;
  agent_name?: string | null;
  session?: Session | null;
  documents_captured?: number;
  documents_required?: number;
}

export interface DocumentRecord {
  id: string;
  session_id: string;
  doc_type: string;
  source: string;
  status: string;
  status_note: string | null;
  version: number;
  is_current: boolean;
  size_bytes: number;
  created_at: string;
}

export interface OcrResult {
  id: string;
  document_id: string;
  session_id: string;
  doc_type: string;
  status: string;
  confidence: number;
  raw_text: string;
  checks: Record<string, boolean> | null;
  original_fields: Record<string, string>;
  corrected_fields: Record<string, string>;
  corrections: { at: string; by: string; changes: { field: string; from: string; to: string }[] }[];
  created_at: string;
}

export interface FrameRecord {
  id: string;
  session_id: string;
  note: string | null;
  include_in_report: boolean;
  created_at: string;
}

export interface Consent {
  id: string;
  session_id: string;
  consent_version: string;
  data_processing: boolean;
  video: boolean;
  recording: boolean;
  location: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  ip_address: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'yes_no' | 'text';
  required: boolean;
}

export interface QuestionnaireTemplate {
  version: string;
  sections: { title: string; questions: Question[] }[];
}

export type Answers = Record<string, boolean | string>;

export interface QuestionnaireLog {
  id: string;
  session_id: string;
  template: QuestionnaireTemplate;
  answers: Answers;
  created_at: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  actor_role: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface Review {
  id: string;
  session_id: string;
  decision: string;
  remarks: string;
  reviewer_name: string;
  created_at: string;
}

export interface Report {
  id: string;
  version: number;
  reason: string;
  size_bytes: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error?: string;
  created_at: string;
}

export interface RequiredDocument {
  type: string;
  label: string;
  instruction: string;
  ocr?: boolean;
}

export interface ApplicationBundle {
  application: Application;
  agent: User | null;
  assignments: { id: string; agent_name: string; active: boolean; created_at: string }[];
  sessions: Session[];
  documents: DocumentRecord[];
  ocrResults: OcrResult[];
  frames: FrameRecord[];
  questionnaireLogs: QuestionnaireLog[];
  consents: Consent[];
  reviews: Review[];
  reports: Report[];
  notifications: Notification[];
  events: SessionEvent[];
  auditLogs: AuditLog[];
  requiredDocuments: RequiredDocument[];
}

export interface SessionBundle {
  session: Session;
  application: Application;
  agent: User | null;
  consent: Consent | null;
  documents: DocumentRecord[];
  ocrResults: OcrResult[];
  frames: FrameRecord[];
  questionnaire: { template: QuestionnaireTemplate; latest: QuestionnaireLog | null };
  events: SessionEvent[];
  requiredDocuments: RequiredDocument[];
  features?: { recording: boolean };
}
