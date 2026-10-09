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

