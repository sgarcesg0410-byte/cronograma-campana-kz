export type ActivityCategory = 
  | 'recorrido'
  | 'mitin'
  | 'reunion'
  | 'prensa'
  | 'volanteo'
  | 'caravana'
  | 'almuerzo'
  | 'otro';

export type ActivityStatus = 
  | 'programado'
  | 'en_curso'
  | 'cumplido'
  | 'reprogramado'
  | 'cancelado';

export interface Activity {
  id: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time?: string; // HH:MM
  category: ActivityCategory;
  status: ActivityStatus;
  location_name: string;
  location_address?: string;
  location_url?: string;
  responsible_id?: number;
  responsible_name: string;
  team_assigned?: string;
  logistics_needed?: string;
  is_demo?: number;
  zone?: string;
  notes?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export type CampaignRole = 'admin' | 'candidato' | 'coordinador' | 'prensa' | 'lider' | 'avanzada';

export interface User {
  id: number;
  name: string;
  email: string;
  role: CampaignRole;
  zone?: string;
  phone?: string;
  active?: number;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  permissions?: string[];
}

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  role: CampaignRole;
  zone?: string;
  phone?: string;
}

export interface UserUpdatePayload {
  name?: string;
  role?: CampaignRole;
  zone?: string;
  phone?: string;
  active?: number;
  newPassword?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  created_at: string;
}

export interface PurgeDemoResult {
  success: boolean;
  message: string;
  deletedCount: number;
  backupFile?: string;
  remainingActivitiesCount?: number;
}

export interface TestLiveWhatsAppResponse {
  success: boolean;
  provider: string;
  messageId?: string;
  status: string;
  note?: string;
  remainingAttempts?: number;
  error?: string;
}

export interface Contact {
  id: number;
  name: string;
  role_description: string;
  phone: string;
  category: 'comitiva' | 'prensa' | 'lider_barrial' | 'logistica' | 'seguridad';
  active: number;
  created_at?: string;
}

export interface NotificationLog {
  id: number;
  activity_id?: number;
  activity_title?: string;
  recipient_phone: string;
  recipient_name: string;
  channel: string;
  provider?: string;
  status: 'sent' | 'pending' | 'failed';
  message_text: string;
  sent_at: string;
}

export interface WhatsAppSettings {
  id: number;
  provider: 'simulation' | 'twilio' | 'evolution_api' | 'meta_cloud';
  api_url?: string;
  api_token?: string;
  account_sid?: string;
  sender_phone?: string;
  auto_reminders_enabled: number;
  reminder_minutes_before: number;
  daily_summary_time: string;
}

export interface DashboardSummary {
  total: number;
  completed: number;
  inProgress: number;
  scheduled: number;
  cancelled: number;
  rescheduled: number;
  completionRate: number;
  demoCount?: number;
}

export interface DashboardStats {
  today: string;
  summary: DashboardSummary;
  todayActivities: Activity[];
  byCategory: { category: ActivityCategory; count: number }[];
  upcoming: Activity[];
}

export type NeedCategory =
  | 'Salud'
  | 'Ayuda económica'
  | 'Alimentación'
  | 'Vivienda'
  | 'Empleo'
  | 'Educación'
  | 'Documentos o trámites'
  | 'Infraestructura o servicios públicos'
  | 'Seguridad'
  | 'Otro';

export type NeedPriority = 'Urgente' | 'Alta' | 'Media' | 'Baja';

export type NeedStatus =
  | 'pendiente'
  | 'en_gestion'
  | 'derivada'
  | 'atendida'
  | 'no_viable'
  | 'cerrada';

export interface CommunityNeed {
  id: number;
  reporter_user_id?: number | null;
  territory_id?: number | null;
  neighborhood: string;
  person_name: string;
  phone: string;
  phone_masked?: string;
  category: NeedCategory;
  description: string;
  priority: NeedPriority;
  status: NeedStatus;
  source: 'whatsapp' | 'manual' | 'web';
  source_message_id?: string | null;
  external_ref?: string | null;
  consent_contact: number;
  assigned_to?: number | null;
  notes?: string | null;
  follow_up_date?: string | null;
  closed_at?: string | null;
  closed_by?: number | null;
  is_demo?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CommunityNeedCreatePayload {
  neighborhood: string;
  person_name: string;
  phone: string;
  category: NeedCategory;
  description: string;
  priority?: NeedPriority;
  notes?: string;
  consent_contact?: number;
}

export interface CommunityNeedUpdatePayload {
  status?: NeedStatus;
  category?: NeedCategory;
  priority?: NeedPriority;
  assigned_to?: number | null;
  notes?: string;
  follow_up_date?: string;
}

export interface CommunityNeedsStats {
  total: number;
  pending: number;
  inProgress: number;
  attended: number;
  urgent: number;
  byCategory: { category: string; count: number }[];
  byNeighborhood: { neighborhood: string; count: number }[];
}

export interface SimulateIncomingResponse {
  isNeedCommand: boolean;
  registered?: boolean;
  needId?: number;
  replyText: string;
  data?: Partial<CommunityNeed>;
}

export interface NotificationQueueItem {
  id: number;
  activity_id?: number | null;
  recipient_phone: string;
  recipient_name: string;
  notification_type: string;
  dedupe_key: string;
  provider?: string;
  provider_message_id?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead_letter' | 'cancelled';
  message_text: string;
  scheduled_for: string;
  next_retry_at?: string;
  attempts: number;
  dead_letter: number;
  sent_at?: string;
  error_message?: string;
  request_id?: string;
  created_at: string;
}

export interface NotificationQueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  dead_letter: number;
  cancelled: number;
  total: number;
}

