import crypto from 'crypto';
import { db } from './db.js';

// Constant-time signature verification for Meta and QR Webhooks (OWASP compliance)
export function validateWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  
  try {
    // 1. Meta X-Hub-Signature-256 header format: sha256=<hex>
    if (signatureHeader.startsWith('sha256=')) {
      const signatureHash = signatureHeader.slice(7).trim();
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (signatureHash.length !== expectedHash.length) return false;
      return crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(expectedHash, 'hex'));
    }

    // 2. Direct Webhook Secret header (for Evolution API / internal test)
    const sigBuf = Buffer.from(signatureHeader.trim());
    const secBuf = Buffer.from(secret.trim());
    if (sigBuf.length !== secBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, secBuf);
  } catch (err) {
    console.error('[WEBHOOK SIG VERIFY ERROR]', err.message);
    return false;
  }
}

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

// Evolution API / Baileys QR Gateway Provider
class EvolutionApiProvider {
  async sendTextMessage({ to, text }) {
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE || 'campana_kz';

    if (!apiUrl || !apiKey) {
      return {
        success: false,
        status: 'not_configured',
        error: 'Credenciales de Evolution API no configuradas en variables de entorno.'
      };
    }

    try {
      const cleanPhone = to.replace(/\+/g, '').trim();
      const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: text,
          options: { delay: 1200, presence: 'composing' }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, status: 'failed', error: data.message || 'Error en Evolution API' };
      }

      return {
        success: true,
        status: 'sent',
        provider: 'evolution_api',
        messageId: data.key?.id || 'evo-' + Date.now()
      };
    } catch (err) {
      return {
        success: false,
        status: 'network_error',
        error: 'Error de conexión con Evolution API: ' + err.message
      };
    }
  }
}

// Provider factory
export function getWhatsAppProvider(providerName) {
  const selected = providerName || process.env.WA_PROVIDER || 'assisted';
  if (selected === 'meta_cloud') return new MetaCloudProvider();
  if (selected === 'twilio') return new TwilioProvider();
  if (selected === 'evolution_api') return new EvolutionApiProvider();
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

// ==========================================
// 8. COMMUNITY NEEDS PARSER & FORMATTERS
// ==========================================

export const ALLOWED_NEED_CATEGORIES = [
  'Salud',
  'Ayuda económica',
  'Alimentación',
  'Vivienda',
  'Empleo',
  'Educación',
  'Documentos o trámites',
  'Infraestructura o servicios públicos',
  'Seguridad',
  'Otro'
];

export function normalizeNeedCategory(rawCategory) {
  if (!rawCategory) return null;
  const clean = rawCategory.trim().toLowerCase();
  if (clean.includes('salud') || clean.includes('medic') || clean.includes('enfer') || clean.includes('hospital') || clean.includes('cita')) return 'Salud';
  if (clean.includes('econom') || clean.includes('plata') || clean.includes('dinero') || clean.includes('subsidio') || clean.includes('deuda')) return 'Ayuda económica';
  if (clean.includes('aliment') || clean.includes('comida') || clean.includes('mercado') || clean.includes('nutri') || clean.includes('hambre')) return 'Alimentación';
  if (clean.includes('vivien') || clean.includes('casa') || clean.includes('techo') || clean.includes('arriendo') || clean.includes('reubic')) return 'Vivienda';
  if (clean.includes('emple') || clean.includes('trabaj') || clean.includes('vacante') || clean.includes('cv') || clean.includes('hoja de vida')) return 'Empleo';
  if (clean.includes('educa') || clean.includes('colegio') || clean.includes('universidad') || clean.includes('beca') || clean.includes('utiles')) return 'Educación';
  if (clean.includes('docum') || clean.includes('tramit') || clean.includes('cedula') || clean.includes('sisben') || clean.includes('pasaporte')) return 'Documentos o trámites';
  if (clean.includes('infra') || clean.includes('via') || clean.includes('calle') || clean.includes('paviment') || clean.includes('alcant') || clean.includes('agua') || clean.includes('luz') || clean.includes('alumbr')) return 'Infraestructura o servicios públicos';
  if (clean.includes('segur') || clean.includes('polic') || clean.includes('robo') || clean.includes('patrulla') || clean.includes('camara')) return 'Seguridad';
  const exact = ALLOWED_NEED_CATEGORIES.find(c => c.toLowerCase() === clean);
  if (exact) return exact;
  return 'Otro';
}

export function parseCommunityNeedMessage(rawText, fallbackSenderPhone = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { isNeedCommand: false, isValid: false, missingFields: ['Texto del mensaje'], errorReply: 'Mensaje vacío.' };
  }

  const trimmed = rawText.trim();
  // Check command keyword
  const isNeedCommand = /^\s*(NECESIDAD|REGISTRAR\s+NECESIDAD)/i.test(trimmed);
  if (!isNeedCommand) {
    return { isNeedCommand: false, isValid: false, missingFields: [], errorReply: null };
  }

  // Helper extractor by regex
  const extractField = (patterns) => {
    for (const pat of patterns) {
      const match = trimmed.match(pat);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  const neighborhood = extractField([
    /(?:Barrio|Comuna|Sector|Ubicación|Ubicacion)\s*:\s*([^\n\r]+)/i,
    /(?:Barrio|Comuna)\s*([^\n\r]+)/i
  ]);

  const personName = extractField([
    /(?:Persona|Nombre|Ciudadano|Contacto|Solicitante)\s*:\s*([^\n\r]+)/i,
    /(?:Persona|Nombre)\s*([^\n\r]+)/i
  ]);

  let phone = extractField([
    /(?:Teléfono|Telefono|Tel|Celular|Cel|WhatsApp|Movil)\s*:\s*([^\n\r]+)/i,
    /(?:Teléfono|Telefono|Celular)\s*([+0-9\s-]+)/i
  ]);

  if (!phone && fallbackSenderPhone) {
    phone = fallbackSenderPhone;
  }

  const rawCategory = extractField([
    /(?:Tipo|Categoría|Categoria|Tema|Área|Area)\s*:\s*([^\n\r]+)/i
  ]);

  const rawPriority = extractField([
    /(?:Prioridad|Urgencia)\s*:\s*([^\n\r]+)/i
  ]);

  const description = extractField([
    /(?:Descripción|Descripcion|Detalle|Solicitud|Problema|Caso|Necesidad)\s*:\s*([\s\S]+)$/i,
    /(?:Descripción|Descripcion)\s*:\s*([^\n\r]+)/i
  ]);

  const category = normalizeNeedCategory(rawCategory);

  // Normalize priority
  let priority = 'Media';
  const cleanPri = rawPriority.toLowerCase();
  if (cleanPri.includes('urgente')) priority = 'Urgente';
  else if (cleanPri.includes('alta') || cleanPri.includes('alto')) priority = 'Alta';
  else if (cleanPri.includes('baja') || cleanPri.includes('bajo')) priority = 'Baja';

  // Normalize and validate phone
  let cleanPhone = phone ? phone.trim().replace(/\s+/g, '') : '';
  if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
    cleanPhone = '+57' + cleanPhone;
  }
  const isPhoneValid = validateE164Phone(cleanPhone);

  const missingFields = [];
  if (!neighborhood) missingFields.push('Barrio');
  if (!personName) missingFields.push('Persona');
  if (!phone || !isPhoneValid) missingFields.push('Teléfono (con indicativo E.164, ej: +573001234567)');
  if (!rawCategory || !category) missingFields.push('Tipo / Categoría válida (Salud, Vivienda, Empleo, etc.)');
  if (!description || description.length < 4) missingFields.push('Descripción detallada del caso');

  const isValid = missingFields.length === 0;

  return {
    isNeedCommand: true,
    isValid,
    missingFields,
    data: {
      neighborhood: neighborhood.slice(0, 100),
      person_name: personName.slice(0, 120),
      phone: cleanPhone,
      category: category || 'Otro',
      description: description.slice(0, 800),
      priority,
      consent_contact: 1
    },
    errorReply: isValid ? null : formatNeedParseError(missingFields)
  };
}

// Sanitized confirmation without repeating medical/economic PII
export function formatNeedRegisteredConfirmation({ id, neighborhood, category, priority, status }) {
  return `✅ *Necesidad registrada #${id}*
━━━━━━━━━━━━━━━━━━━━━━━
📍 *Barrio:* ${neighborhood}
🏷️ *Categoría:* ${category}
⚡ *Prioridad:* ${priority}
📊 *Estado:* ${status === 'pendiente' ? 'Pendiente' : status}

El equipo de campaña dará seguimiento formal a este caso.
🚀 *#VOYCONELKZ*`;
}

export function formatNeedParseError(missingFields) {
  const fieldsList = missingFields.map(f => `• ${f}`).join('\n');
  return `⚠️ *Faltan datos para registrar la necesidad:*
${fieldsList}

Por favor reenvía el mensaje en este formato exacto:
━━━━━━━━━━━━━━━━━━━━━━━
NECESIDAD
Barrio: La Esperanza
Persona: Nombre del solicitante
Teléfono: +573001234567
Tipo: Salud (o Vivienda, Empleo, etc.)
Prioridad: Alta
Descripción: Detalle breve de la solicitud
━━━━━━━━━━━━━━━━━━━━━━━
🚀 *#VOYCONELKZ*`;
}

// ==========================================
// 9. IDEMPOTENT NOTIFICATION QUEUE ENGINE
// ==========================================

export function enqueueActivityNotification({
  activityId,
  recipientPhone,
  recipientName,
  notificationType,
  dedupeKey,
  scheduledFor,
  messageText,
  requestId = 'sys'
}) {
  if (!recipientPhone || !dedupeKey || !messageText) return false;

  try {
    const res = db.run(`
      INSERT INTO notification_queue (
        activity_id, recipient_phone, recipient_name, notification_type,
        dedupe_key, status, message_text, scheduled_for, request_id
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      ON CONFLICT(dedupe_key) DO NOTHING;
    `, [
      activityId,
      recipientPhone,
      recipientName || 'Responsable',
      notificationType,
      dedupeKey,
      messageText,
      scheduledFor || new Date().toISOString(),
      requestId
    ]);

    return res.changes > 0;
  } catch (err) {
    console.error('[QUEUE ENQUEUE ERROR]', err.message);
    return false;
  }
}

export async function processNotificationQueue() {
  try {
    const nowIso = new Date().toISOString();
    const pendingItems = db.query(`
      SELECT * FROM notification_queue
      WHERE status = 'pending'
        AND dead_letter = 0
        AND scheduled_for <= ?
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY scheduled_for ASC
      LIMIT 20
    `, [nowIso, nowIso]);

    if (!pendingItems || pendingItems.length === 0) return 0;

    let processedCount = 0;

    for (const item of pendingItems) {
      db.run("UPDATE notification_queue SET status = 'processing' WHERE id = ?", [item.id]);

      try {
        const result = await dispatchAutomatedNotification({
          phone: item.recipient_phone,
          recipientName: item.recipient_name,
          messageText: item.message_text,
          activityId: item.activity_id
        });

        if (result.success) {
          db.run(`
            UPDATE notification_queue SET
              status = 'sent',
              provider = ?,
              provider_message_id = ?,
              sent_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [result.provider || 'assisted', result.messageId || null, item.id]);
          processedCount++;
        } else {
          const nextAttempts = (item.attempts || 0) + 1;
          const isDeadLetter = nextAttempts >= 3;
          const backoffMinutes = 15 * Math.pow(2, nextAttempts - 1);
          const nextRetryDate = new Date(Date.now() + backoffMinutes * 60000).toISOString();

          db.run(`
            UPDATE notification_queue SET
              status = ?,
              attempts = ?,
              dead_letter = ?,
              next_retry_at = ?,
              error_message = ?
            WHERE id = ?
          `, [
            isDeadLetter ? 'dead_letter' : 'pending',
            nextAttempts,
            isDeadLetter ? 1 : 0,
            nextRetryDate,
            result.error || 'Fallo de entrega',
            item.id
          ]);
        }
      } catch (itemErr) {
        db.run(`
          UPDATE notification_queue SET
            status = 'failed',
            attempts = attempts + 1,
            error_message = ?
          WHERE id = ?
        `, [itemErr.message, item.id]);
      }
    }

    return processedCount;
  } catch (err) {
    console.error('[PROCESS QUEUE ERROR]', err.message);
    return 0;
  }
}

export function cancelPendingActivityNotifications(activityId) {
  try {
    const res = db.run(`
      UPDATE notification_queue
      SET status = 'cancelled', error_message = 'Actividad cancelada por el equipo de campaña'
      WHERE activity_id = ? AND status IN ('pending', 'processing');
    `, [activityId]);
    return res.changes;
  } catch (err) {
    console.error('[CANCEL QUEUE ERROR]', err.message);
    return 0;
  }
}

