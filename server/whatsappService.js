import { db } from './db.js';

// Format date helper in Spanish
export function formatSpanishDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  
  return `${dayName}, ${parseInt(day)} de ${monthName} de ${year}`;
}

const CATEGORY_EMOJIS = {
  recorrido: '🚶‍♂️',
  mitin: '📢',
  reunion: '🤝',
  prensa: '🎙️',
  volanteo: '📄',
  caravana: '🚗',
  almuerzo: '🍽️',
  otro: '📌'
};

const STATUS_ICONS = {
  programado: '⏳ Programado',
  en_curso: '🔴 En Curso',
  cumplido: '✅ Cumplido',
  reprogramado: '🔄 Reprogramado',
  cancelado: '❌ Cancelado'
};

// Validate E.164 international format (+57...)
export function validateE164Phone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.trim().replace(/\s+/g, '');
  // General E.164: + followed by 8 to 15 digits
  return /^\+[1-9]\d{8,14}$/.test(cleaned);
}

// 1. Format complete daily schedule message
export function formatDailyAgendaMessage(dateStr, activities) {
  const formattedDate = formatSpanishDate(dateStr);
  
  let msg = `🔵⚪ *CRONOGRAMA OFICIAL | #VOY CON EL KZ* ⚪🔵\n`;
  msg += `📅 *${formattedDate}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (!activities || activities.length === 0) {
    msg += `No hay actividades oficiales programadas para este día.\n`;
  } else {
    activities.forEach((act, idx) => {
      const catEmoji = CATEGORY_EMOJIS[act.category] || '📌';
      const statusText = STATUS_ICONS[act.status] || act.status;
      
      msg += `${idx + 1}. ${catEmoji} *${act.start_time}${act.end_time ? ' - ' + act.end_time : ''}*\n`;
      msg += `📌 *${act.title}*\n`;
      msg += `📍 *Lugar:* ${act.location_name}${act.location_address ? ` (${act.location_address})` : ''}\n`;
      if (act.location_url) {
        msg += `🗺️ *Mapa:* ${act.location_url}\n`;
      }
      msg += `👤 *Responsable:* ${act.responsible_name}\n`;
      if (act.team_assigned) {
        msg += `👥 *Comitiva:* ${act.team_assigned}\n`;
      }
      if (act.logistics_needed) {
        msg += `📦 *Logística:* ${act.logistics_needed}\n`;
      }
      msg += `⚡ *Estado:* ${statusText}\n\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `¡Con fuerza, disciplina y cercanía con la comunidad!\n`;
  msg += `🚀 *#VOYCONELKZ* | *#Campana2026*`;

  return msg;
}

// 2. Format individual activity reminder
export function formatActivityReminderMessage(activity) {
  const formattedDate = formatSpanishDate(activity.date);
  const catEmoji = CATEGORY_EMOJIS[activity.category] || '📌';
  const statusText = STATUS_ICONS[activity.status] || activity.status;

  let msg = `🔔 *RECORDATORIO DE ACTIVIDAD | #VOY CON EL KZ*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${catEmoji} *${activity.title}*\n\n`;
  msg += `📅 *Fecha:* ${formattedDate}\n`;
  msg += `⏰ *Hora:* ${activity.start_time}${activity.end_time ? ' a ' + activity.end_time : ''}\n`;
  msg += `📍 *Ubicación:* ${activity.location_name}\n`;
  if (activity.location_address) {
    msg += `🏠 *Dirección:* ${activity.location_address}\n`;
  }
  if (activity.location_url) {
    msg += `🗺️ *Ubicación GPS:* ${activity.location_url}\n`;
  }
  msg += `👤 *Responsable:* ${activity.responsible_name}\n`;
  if (activity.team_assigned) {
    msg += `👥 *Equipo / Comitiva:* ${activity.team_assigned}\n`;
  }
  if (activity.logistics_needed) {
    msg += `📦 *Requerimientos Logísticos:* ${activity.logistics_needed}\n`;
  }
  if (activity.notes) {
    msg += `📝 *Observaciones:* ${activity.notes}\n`;
  }
  msg += `⚡ *Estado:* ${statusText}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `¡Puntualidad y compromiso de equipo! 💪 #VOYCONELKZ`;

  return msg;
}

// 3. Format Call-to-action message for leaders and volunteers
export function formatCallToLeadersMessage(activity) {
  let msg = `📢 *CONVOCATORIA DE LÍDERES | #VOY CON EL KZ*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Estimados líderes y coordinadores:\n\n`;
  msg += `Los invitamos cordialmente a acompañar a nuestro candidato en:\n`;
  msg += `👉 *${activity.title}*\n`;
  msg += `📅 *Fecha:* ${formatSpanishDate(activity.date)}\n`;
  msg += `⏰ *Hora de encuentro:* ${activity.start_time}\n`;
  msg += `📍 *Punto de concentración:* ${activity.location_name} (${activity.location_address || ''})\n`;
  if (activity.location_url) {
    msg += `🗺️ *Ubicación:* ${activity.location_url}\n`;
  }
  msg += `\nLleva tu camiseta, gorra y tu mejor energía para seguir transformando nuestra región.\n`;
  msg += `¡Tu presencia es fundamental! 🔵⚪\n`;
  msg += `🚀 *#VOYCONELKZ*`;
  return msg;
}

// 4. Assisted Human Flow (wa.me direct link generator)
export function generateAssistedWhatsAppLink(phone, messageText) {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(messageText);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

// 5. Rate limiting store for test-live endpoint (In-memory)
const testLiveRateLimits = new Map(); // key: userId/ip -> array of timestamps

export function checkTestLiveRateLimit(key, maxAttempts = 5, windowMinutes = 15) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const attempts = (testLiveRateLimits.get(key) || []).filter(ts => now - ts < windowMs);

  if (attempts.length >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((attempts[0] + windowMs - now) / 1000)
    };
  }

  attempts.push(now);
  testLiveRateLimits.set(key, attempts);
  return { allowed: true, remaining: maxAttempts - attempts.length };
}

// =========================================================================
// 6. OFFICIAL PRODUCTION WHATSAPP PROVIDERS (Meta Cloud API, Twilio, Assisted)
// =========================================================================

// Meta WhatsApp Cloud API Provider (Official Meta Business)
class MetaCloudProvider {
  async sendTextMessage({ to, text }) {
    const token = process.env.META_WA_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return {
        success: false,
        status: 'not_configured',
        error: 'Credenciales de Meta Cloud API no configuradas en variables de entorno (META_WA_TOKEN / META_PHONE_NUMBER_ID).'
      };
    }

    const cleanNumber = to.replace(/[^0-9]/g, '');
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanNumber,
          type: 'text',
          text: { body: text }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || 'Error en Meta Cloud API';
        return { success: false, status: 'failed', error: errorMsg };
      }

      const messageId = data?.messages?.[0]?.id || 'meta-' + Date.now();
      return {
        success: true,
        status: 'queued',
        provider: 'meta_cloud',
        messageId
      };
    } catch (err) {
      return {
        success: false,
        status: 'network_error',
        error: 'No se pudo conectar con el servicio de Meta: ' + err.message
      };
    }
  }
}

// Twilio WhatsApp Provider
class TwilioProvider {
  async sendTextMessage({ to, text }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_PHONE;

    if (!sid || !authToken || !fromNumber) {
      return {
        success: false,
        status: 'not_configured',
        error: 'Credenciales de Twilio no configuradas en variables de entorno.'
      };
    }

    try {
      const auth = Buffer.from(`${sid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
      params.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
      params.append('Body', text);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, status: 'failed', error: data.message || 'Error Twilio' };
      }

      return {
        success: true,
        status: data.status || 'queued',
        provider: 'twilio',
        messageId: data.sid
      };
    } catch (err) {
      return {
        success: false,
        status: 'network_error',
        error: 'No se pudo conectar con Twilio: ' + err.message
      };
    }
  }
}

// Assisted / Simulation Provider
class AssistedProvider {
  async sendTextMessage({ to, text }) {
    return {
      success: true,
      status: 'assisted_flow',
      provider: 'assisted',
      messageId: 'assisted-' + Date.now(),
      note: 'Mensaje generado para canal asistido wa.me'
    };
  }
}

// Provider factory
export function getWhatsAppProvider(providerName) {
  const selected = providerName || process.env.WA_PROVIDER || 'assisted';
  if (selected === 'meta_cloud') return new MetaCloudProvider();
  if (selected === 'twilio') return new TwilioProvider();
  return new AssistedProvider();
}

// Dispatch automated notification safely
export async function dispatchAutomatedNotification({ phone, recipientName, messageText, activityId = null, providerOverride = null }) {
  const provider = getWhatsAppProvider(providerOverride);
  const result = await provider.sendTextMessage({ to: phone, text: messageText });

  // Record in notifications log (excluding tokens/secrets)
  try {
    db.run(`
      INSERT INTO notifications_log (
        activity_id, recipient_phone, recipient_name, channel, provider,
        provider_message_id, status, message_text, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      activityId,
      phone,
      recipientName || 'Destinatario de Campaña',
      result.provider === 'assisted' ? 'whatsapp_assisted' : 'whatsapp_automated',
      result.provider || 'unknown',
      result.messageId || null,
      result.success ? 'sent' : 'failed',
      messageText,
      result.error || null
    ]);
  } catch (logErr) {
    console.error('Error registrando notification_log:', logErr.message);
  }

  return result;
}
