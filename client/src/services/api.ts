import { 
  Activity, 
  AuditLog,
  Contact, 
  DashboardStats, 
  NotificationLog, 
  PurgeDemoResult,
  TestLiveWhatsAppResponse,
  User, 
  UserCreatePayload,
  UserUpdatePayload,
  WhatsAppSettings 
} from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('kz_auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    localStorage.setItem('kz_auth_token', data.token);
    localStorage.setItem('kz_user', JSON.stringify(data.user));
    return data;
  },

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('kz_auth_token');
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        this.logout();
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem('kz_auth_token');
    localStorage.removeItem('kz_user');
  },

  // Activities
  async getActivities(params?: { date?: string; month?: string; category?: string; status?: string; search?: string }): Promise<Activity[]> {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.month) query.append('month', params.month);
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/activities?${query.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar actividades');
    return data.activities || [];
  },

  async getActivity(id: number): Promise<Activity> {
    const res = await fetch(`${API_BASE}/activities/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener actividad');
    return data.activity;
  },

  async createActivity(activity: Partial<Activity>): Promise<Activity> {
    const res = await fetch(`${API_BASE}/activities`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(activity),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear actividad');
    return data.activity;
  },

  async updateActivity(id: number, activity: Partial<Activity>): Promise<Activity> {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(activity),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar actividad');
    return data.activity;
  },

  async deleteActivity(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/activities/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar actividad');
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/activities/stats/dashboard`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar estadísticas');
    return data;
  },

  // Contacts
  async getContacts(): Promise<Contact[]> {
    const res = await fetch(`${API_BASE}/contacts`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar contactos');
    return data.contacts || [];
  },

  async createContact(contact: Partial<Contact>): Promise<Contact> {
    const res = await fetch(`${API_BASE}/contacts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(contact),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear contacto');
    return data.contact;
  },

  async updateContact(id: number, contact: Partial<Contact>): Promise<Contact> {
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(contact),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar contacto');
    return data.contact;
  },

  async deleteContact(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar contacto');
  },

  // WhatsApp
  async getWhatsAppPreview(type: 'daily' | 'activity' | 'call_leaders', params: { date?: string; activityId?: number; phone?: string }): Promise<{
    title: string;
    messageText: string;
    directLink: string;
  }> {
    const query = new URLSearchParams({ type });
    if (params.date) query.append('date', params.date);
    if (params.activityId) query.append('activityId', params.activityId.toString());
    if (params.phone) query.append('phone', params.phone);

    const res = await fetch(`${API_BASE}/whatsapp/preview?${query.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al generar vista previa');
    return data;
  },

  async sendAutomatedWhatsApp(body: {
    phone: string;
    recipientName?: string;
    messageText: string;
    activityId?: number;
  }): Promise<{ success: boolean; message: string; result: any }> {
    const res = await fetch(`${API_BASE}/whatsapp/send-notification`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar notificación');
    return data;
  },

  async broadcastDaily(date: string, categoryFilter?: string): Promise<{ totalSent: number; message: string }> {
    const res = await fetch(`${API_BASE}/whatsapp/broadcast-daily`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ date, categoryFilter }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en difusión');
    return data;
  },

  async getWhatsAppSettings(): Promise<WhatsAppSettings> {
    const res = await fetch(`${API_BASE}/whatsapp/settings`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener configuración');
    return data.settings;
  },

  async updateWhatsAppSettings(settings: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> {
    const res = await fetch(`${API_BASE}/whatsapp/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');
    return data.settings;
  },

  async getWhatsAppLogs(): Promise<NotificationLog[]> {
    const res = await fetch(`${API_BASE}/whatsapp/logs`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener historial');
    return data.logs || [];
  },

  // Users & RBAC Management (Admin)
  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener usuarios');
    return data.users || [];
  },

  async createUser(payload: UserCreatePayload): Promise<User> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
    return data.user;
  },

  async updateUser(id: number, payload: UserUpdatePayload): Promise<User> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
    return data.user;
  },

  async deleteUser(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al desactivar usuario');
  },

  // Safe Demo Data Purge (Admin)
  async purgeDemo(confirmationPhrase: string): Promise<PurgeDemoResult> {
    const res = await fetch(`${API_BASE}/activities/purge-demo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ confirmationPhrase }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al depurar actividades de demostración');
    return data;
  },

  // Audit Logs (Admin)
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar bitácora de auditoría');
    return data.logs || [];
  },

  // Controlled Live WhatsApp Test
  async testLiveWhatsApp(phone: string, message?: string): Promise<TestLiveWhatsAppResponse> {
    const res = await fetch(`${API_BASE}/whatsapp/test-live`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al despachar prueba en vivo');
    return data;
  },
};

