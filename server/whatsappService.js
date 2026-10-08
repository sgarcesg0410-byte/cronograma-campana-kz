import { db } from './db.js';

// Helper to format Spanish dates
export function formatSpanishDate(dateStr) {
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

// 4. Generate 1-Click WhatsApp Link
export function generateWhatsAppLink(phone, messageText) {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(messageText);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

// 5. Automated Dispatcher (Opción 2: Gateway / API / Simulated)
export async function sendAutomatedWhatsApp({ phone, recipientName, messageText, activityId = null }) {
  const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1') || { provider: 'simulation' };
  
  let deliveryStatus = 'sent';
  let providerResponse = null;

  try {
    if (settings.provider === 'simulation') {
      // High-fidelity simulation: saves to log, available immediately in UI
      deliveryStatus = 'sent';
      providerResponse = { simulation: true, note: 'Mensaje despachado y registrado con éxito en simulador de campaña.' };
    } else if (settings.provider === 'twilio') {
      if (settings.account_sid && settings.api_token && settings.sender_phone) {
        const auth = Buffer.from(`${settings.account_sid}:${settings.api_token}`).toString('base64');
        const params = new URLSearchParams();
        params.append('From', `whatsapp:${settings.sender_phone}`);
        params.append('To', `whatsapp:${phone}`);
        params.append('Body', messageText);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error Twilio');
        providerResponse = data;
      }
    } else if (settings.provider === 'evolution_api') {
      if (settings.api_url && settings.api_token) {
        const cleanNumber = phone.replace(/[^0-9]/g, '');
        const res = await fetch(`${settings.api_url}/message/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.api_token
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: messageText
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error Evolution API');
        providerResponse = data;
      }
    } else if (settings.provider === 'meta_cloud') {
      if (settings.api_url && settings.api_token) {
        const cleanNumber = phone.replace(/[^0-9]/g, '');
        const res = await fetch(settings.api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.api_token}`
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanNumber,
            type: 'text',
            text: { body: messageText }
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error Meta API');
        providerResponse = data;
      }
    }
  } catch (error) {
    console.error('Error enviando WhatsApp automático:', error.message);
    deliveryStatus = 'failed';
    providerResponse = { error: error.message };
  }

  // Register in notifications log
  const result = db.run(`
    INSERT INTO notifications_log (activity_id, recipient_phone, recipient_name, channel, status, message_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    activityId,
    phone || 'Todos / Difusión',
    recipientName || 'Comitiva de Campaña',
    settings.provider === 'simulation' ? 'whatsapp_simulation' : 'whatsapp_api',
    deliveryStatus,
    messageText
  ]);

  return {
    success: deliveryStatus === 'sent',
    logId: result.lastInsertRowid,
    status: deliveryStatus,
    response: providerResponse
  };
}
