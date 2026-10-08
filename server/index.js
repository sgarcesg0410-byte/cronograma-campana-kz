import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase } from './db.js';
import {
  formatDailyAgendaMessage,
  formatActivityReminderMessage,
  formatCallToLeadersMessage,
  generateWhatsAppLink,
  sendAutomatedWhatsApp
} from './whatsappService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'campana_kz_secret_key_2026';

app.use(cors());
app.use(express.json());

// Serve static images (logo, etc.)
app.use('/static', express.static(path.join(__dirname, '../client/public')));

// Middleware: Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Se requiere inicio de sesión.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Sesión inválida o expirada.' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos.' });
  }

  const user = db.queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.queryOne('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }
  res.json({ user });
});

// ==========================================
// 2. ACTIVITIES (CRONOGRAMA) ROUTES
// ==========================================

// Get activities with filters (date, month, category, status, search)
app.get('/api/activities', (req, res) => {
  const { date, month, category, status, search } = req.query;

  let query = 'SELECT * FROM activities WHERE 1=1';
  const params = [];

  if (date) {
    query += ' AND date = ?';
    params.push(date);
  } else if (month) {
    query += ' AND date LIKE ?';
    params.push(`${month}%`);
  }

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR location_name LIKE ? OR responsible_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY date ASC, start_time ASC';

  try {
    const activities = db.query(query, params);
    res.json({ activities });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single activity
app.get('/api/activities/:id', (req, res) => {
  const activity = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!activity) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }
  res.json({ activity });
});

// Create activity
app.post('/api/activities', authenticateToken, (req, res) => {
  const {
    title,
    description,
    date,
    start_time,
    end_time,
    category,
    status = 'programado',
    location_name,
    location_address,
    location_url,
    responsible_name,
    team_assigned,
    logistics_needed,
    notes
  } = req.body;

  if (!title || !date || !start_time || !location_name || !responsible_name) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (Título, Fecha, Hora, Lugar, Responsable).' });
  }

  try {
    const sql = `
      INSERT INTO activities (
        title, description, date, start_time, end_time, category, status,
        location_name, location_address, location_url, responsible_name, team_assigned,
        logistics_needed, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = db.run(sql, [
      title,
      description || '',
      date,
      start_time,
      end_time || '',
      category || 'recorrido',
      status,
      location_name,
      location_address || '',
      location_url || '',
      responsible_name,
      team_assigned || '',
      logistics_needed || '',
      notes || '',
      req.user.id
    ]);

    const newActivity = db.queryOne('SELECT * FROM activities WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Actividad programada exitosamente', activity: newActivity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
app.put('/api/activities/:id', authenticateToken, (req, res) => {
  const {
    title,
    description,
    date,
    start_time,
    end_time,
    category,
    status,
    location_name,
    location_address,
    location_url,
    responsible_name,
    team_assigned,
    logistics_needed,
    notes
  } = req.body;

  const current = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  try {
    const sql = `
      UPDATE activities SET
        title = ?,
        description = ?,
        date = ?,
        start_time = ?,
        end_time = ?,
        category = ?,
        status = ?,
        location_name = ?,
        location_address = ?,
        location_url = ?,
        responsible_name = ?,
        team_assigned = ?,
        logistics_needed = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(sql, [
      title || current.title,
      description !== undefined ? description : current.description,
      date || current.date,
      start_time || current.start_time,
      end_time !== undefined ? end_time : current.end_time,
      category || current.category,
      status || current.status,
      location_name || current.location_name,
      location_address !== undefined ? location_address : current.location_address,
      location_url !== undefined ? location_url : current.location_url,
      responsible_name || current.responsible_name,
      team_assigned !== undefined ? team_assigned : current.team_assigned,
      logistics_needed !== undefined ? logistics_needed : current.logistics_needed,
      notes !== undefined ? notes : current.notes,
      req.params.id
    ]);

    const updated = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
    res.json({ message: 'Actividad actualizada exitosamente', activity: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
app.delete('/api/activities/:id', authenticateToken, (req, res) => {
  const current = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  db.run('DELETE FROM activities WHERE id = ?', [req.params.id]);
  res.json({ message: 'Actividad eliminada con éxito.' });
});

// Dashboard metrics & reporting
app.get('/api/activities/stats/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const total = db.queryOne('SELECT COUNT(*) as count FROM activities')?.count || 0;
  const completed = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'cumplido'")?.count || 0;
  const inProgress = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'en_curso'")?.count || 0;
  const scheduled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'programado'")?.count || 0;
  const cancelled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'cancelado'")?.count || 0;
  const rescheduled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'reprogramado'")?.count || 0;

  // Activities today
  const todayActivities = db.query('SELECT * FROM activities WHERE date = ? ORDER BY start_time ASC', [today]);

  // By category
  const byCategory = db.query(`
    SELECT category, COUNT(*) as count 
    FROM activities 
    GROUP BY category 
    ORDER BY count DESC
  `);

  // Upcoming 5 activities
  const upcoming = db.query(`
    SELECT * FROM activities 
    WHERE date >= ? 
    ORDER BY date ASC, start_time ASC 
    LIMIT 6
  `, [today]);

  // Percentage of completion
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    today,
    summary: {
      total,
      completed,
      inProgress,
      scheduled,
      cancelled,
      rescheduled,
      completionRate
    },
    todayActivities,
    byCategory,
    upcoming
  });
});

// ==========================================
// 3. CONTACTS / CAMPAIGN GROUPS ROUTES
// ==========================================

app.get('/api/contacts', (req, res) => {
  const contacts = db.query('SELECT * FROM contacts ORDER BY name ASC');
  res.json({ contacts });
});

app.post('/api/contacts', authenticateToken, (req, res) => {
  const { name, role_description, phone, category = 'comitiva' } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos.' });
  }

  const result = db.run(`
    INSERT INTO contacts (name, role_description, phone, category)
    VALUES (?, ?, ?, ?)
  `, [name, role_description || 'Comisión de Campaña', phone, category]);

  const newContact = db.queryOne('SELECT * FROM contacts WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ message: 'Contacto registrado exitosamente', contact: newContact });
});

app.put('/api/contacts/:id', authenticateToken, (req, res) => {
  const { name, role_description, phone, category, active } = req.body;
  const current = db.queryOne('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Contacto no encontrado' });

  db.run(`
    UPDATE contacts SET
      name = ?,
      role_description = ?,
      phone = ?,
      category = ?,
      active = ?
    WHERE id = ?
  `, [
    name || current.name,
    role_description || current.role_description,
    phone || current.phone,
    category || current.category,
    active !== undefined ? active : current.active,
    req.params.id
  ]);

  const updated = db.queryOne('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  res.json({ message: 'Contacto actualizado', contact: updated });
});

app.delete('/api/contacts/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id]);
  res.json({ message: 'Contacto eliminado' });
});

// ==========================================
// 4. WHATSAPP NOTIFICATION ENGINE (AMBAS OPCIONES)
// ==========================================

// OPTION 1: Get Pre-formatted WhatsApp Message & 1-Click Link
app.get('/api/whatsapp/preview', (req, res) => {
  const { type, date, activityId, phone } = req.query;

  let messageText = '';
  let title = '';

  if (type === 'daily') {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const activities = db.query('SELECT * FROM activities WHERE date = ? ORDER BY start_time ASC', [targetDate]);
    messageText = formatDailyAgendaMessage(targetDate, activities);
    title = `Agenda Oficial del Día (${targetDate})`;
  } else if (type === 'activity' && activityId) {
    const act = db.queryOne('SELECT * FROM activities WHERE id = ?', [activityId]);
    if (!act) return res.status(404).json({ error: 'Actividad no encontrada' });
    messageText = formatActivityReminderMessage(act);
    title = `Recordatorio: ${act.title}`;
  } else if (type === 'call_leaders' && activityId) {
    const act = db.queryOne('SELECT * FROM activities WHERE id = ?', [activityId]);
    if (!act) return res.status(404).json({ error: 'Actividad no encontrada' });
    messageText = formatCallToLeadersMessage(act);
    title = `Convocatoria: ${act.title}`;
  } else {
    return res.status(400).json({ error: 'Tipo de previsualización no válido' });
  }

  const directLink = generateWhatsAppLink(phone, messageText);

  res.json({
    title,
    messageText,
    directLink,
    phone: phone || null
  });
});

// OPTION 2: Send Automated / API Notification
app.post('/api/whatsapp/send-notification', authenticateToken, async (req, res) => {
  const { phone, recipientName, messageText, activityId } = req.body;

  if (!messageText) {
    return res.status(400).json({ error: 'El contenido del mensaje es requerido.' });
  }

  const result = await sendAutomatedWhatsApp({
    phone: phone || 'Difusión General',
    recipientName: recipientName || 'Equipo #VOY CON EL KZ',
    messageText,
    activityId
  });

  res.json({
    message: result.success ? 'Notificación despachada correctamente' : 'Error en el despacho',
    result
  });
});

// Broadcast Daily Schedule to all active contacts via API
app.post('/api/whatsapp/broadcast-daily', authenticateToken, async (req, res) => {
  const { date, categoryFilter } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const activities = db.query('SELECT * FROM activities WHERE date = ? ORDER BY start_time ASC', [targetDate]);
  const messageText = formatDailyAgendaMessage(targetDate, activities);

  let contactsQuery = 'SELECT * FROM contacts WHERE active = 1';
  const params = [];
  if (categoryFilter && categoryFilter !== 'all') {
    contactsQuery += ' AND category = ?';
    params.push(categoryFilter);
  }

  const contacts = db.query(contactsQuery, params);

  const results = [];
  for (const c of contacts) {
    const resSend = await sendAutomatedWhatsApp({
      phone: c.phone,
      recipientName: c.name,
      messageText,
      activityId: null
    });
    results.push({ contact: c.name, phone: c.phone, success: resSend.success });
  }

  res.json({
    message: `Difusión procesada para ${contacts.length} contactos/grupos`,
    totalSent: results.length,
    results
  });
});

// WhatsApp Settings
app.get('/api/whatsapp/settings', (req, res) => {
  const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
  res.json({ settings });
});

app.put('/api/whatsapp/settings', authenticateToken, (req, res) => {
  const {
    provider,
    api_url,
    api_token,
    account_sid,
    sender_phone,
    auto_reminders_enabled,
    reminder_minutes_before,
    daily_summary_time
  } = req.body;

  db.run(`
    UPDATE whatsapp_settings SET
      provider = ?,
      api_url = ?,
      api_token = ?,
      account_sid = ?,
      sender_phone = ?,
      auto_reminders_enabled = ?,
      reminder_minutes_before = ?,
      daily_summary_time = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [
    provider || 'simulation',
    api_url || '',
    api_token || '',
    account_sid || '',
    sender_phone || '',
    auto_reminders_enabled !== undefined ? (auto_reminders_enabled ? 1 : 0) : 1,
    reminder_minutes_before || 60,
    daily_summary_time || '07:00'
  ]);

  const updated = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
  res.json({ message: 'Configuración de WhatsApp guardada exitosamente', settings: updated });
});

// Notifications History Log
app.get('/api/whatsapp/logs', (req, res) => {
  const logs = db.query(`
    SELECT n.*, a.title as activity_title 
    FROM notifications_log n 
    LEFT JOIN activities a ON n.activity_id = a.id 
    ORDER BY n.sent_at DESC 
    LIMIT 100
  `);
  res.json({ logs });
});

// ==========================================
// 5. BACKGROUND CRON JOB FOR AUTO-REMINDERS
// ==========================================
cron.schedule('*/10 * * * *', async () => {
  try {
    const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
    if (!settings || !settings.auto_reminders_enabled) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const upcomingActivities = db.query(`
      SELECT * FROM activities 
      WHERE date = ? AND status = 'programado'
    `, [today]);

    for (const act of upcomingActivities) {
      if (!act.start_time) continue;
      const [actH, actM] = act.start_time.split(':').map(Number);
      const actDate = new Date();
      actDate.setHours(actH, actM, 0, 0);

      const diffMinutes = Math.round((actDate.getTime() - now.getTime()) / (1000 * 60));

      if (diffMinutes > 0 && diffMinutes <= (settings.reminder_minutes_before || 60)) {
        const alreadyNotified = db.queryOne(`
          SELECT COUNT(*) as count FROM notifications_log 
          WHERE activity_id = ? AND sent_at > datetime('now', '-2 hours')
        `, [act.id])?.count || 0;

        if (alreadyNotified === 0) {
          const msg = formatActivityReminderMessage(act);
          await sendAutomatedWhatsApp({
            phone: 'Equipo Asignado',
            recipientName: act.responsible_name,
            messageText: msg,
            activityId: act.id
          });
          console.log(`[CRON] Recordatorio despachado para: ${act.title}`);
        }
      }
    }
  } catch (err) {
    console.error('[CRON ERROR]', err.message);
  }
});

// Serve client dist in production
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// Fallback for SPA routing
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});


// Initialize DB and start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 SERVIDOR DE CAMPAÑA #VOY CON EL KZ ACTIVO`);
    console.log(`  📍 App Web + Backend URL: http://localhost:${PORT}`);
    console.log(`  🔑 Base de datos SQLite inicializada y persistente`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});

