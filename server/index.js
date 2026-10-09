import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cron from 'node-cron';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db, { initDatabase, createDatabaseBackup } from './db.js';
import {
  formatDailyAgendaMessage,
  formatActivityReminderMessage,
  formatCallToLeadersMessage,
  generateAssistedWhatsAppLink,
  validateE164Phone,
  checkTestLiveRateLimit,
  dispatchAutomatedNotification
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

// Request ID middleware for end-to-end traceability
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID().slice(0, 8);
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ==========================================
// 1. RBAC PERMISSION MATRIX & MIDDLEWARES
// ==========================================

const ROLE_PERMISSIONS = {
  admin: [
    'users:read', 'users:create', 'users:update', 'users:delete',
    'agenda:purge_demo',
    'activities:read', 'activities:create', 'activities:edit:all', 'activities:delete',
    'reports:read', 'routesheet:read',
    'contacts:read', 'contacts:manage',
    'whatsapp:preview', 'whatsapp:assisted_share', 'whatsapp:test', 'whatsapp:settings',
    'audit:read'
  ],
  candidato: [
    'activities:read', 'reports:read', 'routesheet:read',
    'contacts:read',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  coordinador: [
    'activities:read', 'activities:create', 'activities:edit:territory',
    'reports:read', 'routesheet:read',
    'contacts:read', 'contacts:manage',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  prensa: [
    'activities:read', 'activities:create:media', 'activities:edit:media',
    'reports:read', 'routesheet:read',
    'contacts:read',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  lider: [
    'activities:read:zone',
    'reports:read:basic',
    'contacts:read',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ]
};

// Audit logging helper
function recordAudit(req, action, resourceType, resourceId, detailsObj) {
  try {
    const userId = req.user?.id || null;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const reqId = req.requestId || 'sys';

    // Sanitize details: strip any password, secret or raw token
    const sanitizedDetails = { ...detailsObj };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.api_token;
    delete sanitizedDetails.account_sid;

    db.run(`
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, details_json, ip_address, user_agent, request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      resourceType,
      String(resourceId || 'n/a'),
      JSON.stringify(sanitizedDetails),
      ip,
      userAgent,
      reqId
    ]);
  } catch (err) {
    console.error('[AUDIT ERROR]', err.message);
  }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado. Se requiere inicio de sesión.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    // Check live user status from database to enforce immediate session revocation upon deactivation
    const dbUser = db.queryOne('SELECT id, name, email, role, zone, active FROM users WHERE id = ?', [user.id]);
    if (!dbUser || dbUser.active !== 1) {
      return res.status(401).json({ error: 'Usuario desactivado o no disponible. Sesión revocada.' });
    }

    req.user = dbUser;
    next();
  });
};

// Granular Permission Middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Se requiere inicio de sesión.' });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole] || [];

    // Admins have all permissions or check explicit inclusion
    if (userRole === 'admin' || permissions.includes(permission)) {
      return next();
    }

    // Forbidden
    recordAudit(req, 'ACCESS_DENIED', 'permission', permission, {
      role: userRole,
      requiredPermission: permission,
      path: req.originalUrl
    });

    return res.status(403).json({
      error: `Acceso denegado: Tu rol (${userRole}) no cuenta con el permiso requerido (${permission}).`,
      requiredPermission: permission
    });
  };
};

// ==========================================
// 2. AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const user = db.queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

  if (!user) {
    recordAudit(req, 'LOGIN_FAILED_UNKNOWN_EMAIL', 'auth', cleanEmail, { email: cleanEmail });
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  if (user.active !== 1) {
    recordAudit(req, 'LOGIN_BLOCKED_INACTIVE_USER', 'auth', user.id, { email: cleanEmail });
    return res.status(403).json({ error: 'Esta cuenta ha sido desactivada por la administración de campaña.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    recordAudit(req, 'LOGIN_FAILED_WRONG_PASSWORD', 'auth', user.id, { email: cleanEmail });
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  // Record successful login timestamp
  db.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, zone: user.zone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  recordAudit(req, 'LOGIN_SUCCESS', 'auth', user.id, { email: cleanEmail, role: user.role });

  res.json({
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      zone: user.zone,
      phone: user.phone,
      permissions: ROLE_PERMISSIONS[user.role] || []
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      zone: req.user.zone,
      permissions: ROLE_PERMISSIONS[req.user.role] || []
    }
  });
});

// ==========================================
// 3. USER & ROLE MANAGEMENT (ADMIN ONLY)
// ==========================================

const ALLOWED_ROLES = ['admin', 'candidato', 'coordinador', 'prensa', 'lider'];

// List all campaign team users
app.get('/api/users', authenticateToken, requirePermission('users:read'), (req, res) => {
  const users = db.query(`
    SELECT id, name, email, role, zone, phone, active, last_login, created_at, updated_at 
    FROM users 
    ORDER BY active DESC, name ASC
  `);
  res.json({ users });
});

// Create new campaign user
app.post('/api/users', authenticateToken, requirePermission('users:create'), (req, res) => {
  const { name, email, password, role, zone = 'General', phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Nombre, correo, contraseña y rol son obligatorios.' });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `Rol inválido. Los roles permitidos son: ${ALLOWED_ROLES.join(', ')}` });
  }

  if (phone && !validateE164Phone(phone)) {
    return res.status(400).json({ error: 'El teléfono debe tener formato internacional E.164 (Ej. +573001234567).' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (existing) {
    return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo electrónico.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  try {
    const result = db.transaction(() => {
      const resInsert = db.run(`
        INSERT INTO users (name, email, password_hash, role, zone, phone, active) 
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [name.trim(), cleanEmail, passwordHash, role, zone.trim(), phone ? phone.trim() : null]);

      recordAudit(req, 'USER_CREATED', 'users', resInsert.lastInsertRowid, {
        name, email: cleanEmail, role, zone, phone
      });

      return resInsert;
    });

    const newUser = db.queryOne(`
      SELECT id, name, email, role, zone, phone, active, created_at 
      FROM users WHERE id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear usuario: ' + err.message });
  }
});

// Update campaign user
app.put('/api/users/:id', authenticateToken, requirePermission('users:update'), (req, res) => {
  const targetId = parseInt(req.params.id);
  const { name, role, zone, phone, active, newPassword } = req.body;

  const current = db.queryOne('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!current) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Protection: Last active admin check
  if (current.role === 'admin') {
    const changingRole = role && role !== 'admin';
    const deactivating = active !== undefined && active === 0;

    if (changingRole || deactivating) {
      const adminCount = db.queryOne('SELECT COUNT(*) as count FROM users WHERE role = "admin" AND active = 1')?.count || 0;
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Operación denegada: No es posible desactivar o cambiar el rol del único Administrador activo del sistema.'
        });
      }
    }
  }

  if (role && !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: `Rol no permitido. Roles válidos: ${ALLOWED_ROLES.join(', ')}` });
  }

  if (phone && !validateE164Phone(phone)) {
    return res.status(400).json({ error: 'El teléfono debe tener formato internacional E.164 (Ej. +573001234567).' });
  }

  try {
    db.transaction(() => {
      let passwordHash = current.password_hash;
      let passwordChanged = false;
      if (newPassword && newPassword.trim().length >= 6) {
        const salt = bcrypt.genSaltSync(10);
        passwordHash = bcrypt.hashSync(newPassword.trim(), salt);
        passwordChanged = true;
      }

      db.run(`
        UPDATE users SET
          name = ?,
          role = ?,
          zone = ?,
          phone = ?,
          active = ?,
          password_hash = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        name ? name.trim() : current.name,
        role || current.role,
        zone ? zone.trim() : current.zone,
        phone !== undefined ? (phone ? phone.trim() : null) : current.phone,
        active !== undefined ? active : current.active,
        passwordHash,
        targetId
      ]);

      recordAudit(req, 'USER_UPDATED', 'users', targetId, {
        changedFields: {
          name: name !== current.name,
          role: role !== current.role,
          active: active !== current.active,
          passwordChanged
        },
        oldRole: current.role,
        newRole: role || current.role
      });
    });

    const updated = db.queryOne(`
      SELECT id, name, email, role, zone, phone, active, last_login, created_at, updated_at 
      FROM users WHERE id = ?
    `, [targetId]);

    res.json({ message: 'Usuario actualizado exitosamente', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario: ' + err.message });
  }
});

// Soft-Delete (Deactivate) User
app.delete('/api/users/:id', authenticateToken, requirePermission('users:delete'), (req, res) => {
  const targetId = parseInt(req.params.id);
  const current = db.queryOne('SELECT * FROM users WHERE id = ?', [targetId]);

  if (!current) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Prevent last admin deactivation
  if (current.role === 'admin') {
    const adminCount = db.queryOne('SELECT COUNT(*) as count FROM users WHERE role = "admin" AND active = 1')?.count || 0;
    if (adminCount <= 1) {
      return res.status(400).json({
        error: 'Operación denegada: No es posible desactivar al único Administrador activo del sistema.'
      });
    }
  }

  try {
    db.transaction(() => {
      // Soft-delete
      db.run('UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetId]);
      recordAudit(req, 'USER_DEACTIVATED', 'users', targetId, { email: current.email, role: current.role });
    });

    res.json({ message: 'Usuario desactivado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Logs Viewer (Admin only)
app.get('/api/audit-logs', authenticateToken, requirePermission('audit:read'), (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const logs = db.query(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `, [limit]);

  res.json({ logs });
});

// ==========================================
// 4. ACTIVITIES (CRONOGRAMA) ROUTES
// ==========================================

// Get activities (filtered by zone if user is lider)
app.get('/api/activities', authenticateToken, requirePermission('activities:read'), (req, res) => {
  const { date, month, category, status, search, zone } = req.query;

  let query = 'SELECT * FROM activities WHERE 1=1';
  const params = [];

  // Zone boundary for 'lider' role
  if (req.user.role === 'lider' && req.user.zone && req.user.zone !== 'General') {
    query += ' AND (zone = ? OR zone = "General" OR zone IS NULL)';
    params.push(req.user.zone);
  } else if (zone && zone !== 'all') {
    query += ' AND zone = ?';
    params.push(zone);
  }

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

// Create activity
app.post('/api/activities', authenticateToken, requirePermission('activities:create'), (req, res) => {
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
    zone = 'General',
    responsible_name,
    team_assigned,
    logistics_needed,
    notes,
    is_demo = 0
  } = req.body;

  if (!title || !date || !start_time || !location_name || !responsible_name) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (Título, Fecha, Hora, Lugar, Responsable).' });
  }

  try {
    const result = db.transaction(() => {
      const resIns = db.run(`
        INSERT INTO activities (
          title, description, date, start_time, end_time, category, status,
          location_name, location_address, location_url, zone, responsible_name, team_assigned,
          logistics_needed, notes, is_demo, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
        zone || 'General',
        responsible_name,
        team_assigned || '',
        logistics_needed || '',
        notes || '',
        is_demo ? 1 : 0,
        req.user.id
      ]);

      recordAudit(req, 'ACTIVITY_CREATED', 'activities', resIns.lastInsertRowid, { title, date, start_time, is_demo });
      return resIns;
    });

    const newActivity = db.queryOne('SELECT * FROM activities WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Actividad programada exitosamente', activity: newActivity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
app.put('/api/activities/:id', authenticateToken, requirePermission('activities:create'), (req, res) => {
  const {
    title, description, date, start_time, end_time, category, status,
    location_name, location_address, location_url, zone, responsible_name,
    team_assigned, logistics_needed, notes
  } = req.body;

  const current = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  try {
    db.transaction(() => {
      db.run(`
        UPDATE activities SET
          title = ?, description = ?, date = ?, start_time = ?, end_time = ?,
          category = ?, status = ?, location_name = ?, location_address = ?,
          location_url = ?, zone = ?, responsible_name = ?, team_assigned = ?,
          logistics_needed = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
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
        zone !== undefined ? zone : current.zone,
        responsible_name || current.responsible_name,
        team_assigned !== undefined ? team_assigned : current.team_assigned,
        logistics_needed !== undefined ? logistics_needed : current.logistics_needed,
        notes !== undefined ? notes : current.notes,
        req.params.id
      ]);

      recordAudit(req, 'ACTIVITY_UPDATED', 'activities', req.params.id, {
        title: title || current.title,
        statusChanged: status !== current.status
      });
    });

    const updated = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
    res.json({ message: 'Actividad actualizada exitosamente', activity: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
app.delete('/api/activities/:id', authenticateToken, requirePermission('activities:delete'), (req, res) => {
  const current = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  try {
    db.transaction(() => {
      db.run('DELETE FROM activities WHERE id = ?', [req.params.id]);
      recordAudit(req, 'ACTIVITY_DELETED', 'activities', req.params.id, { title: current.title });
    });
    res.json({ message: 'Actividad eliminada con éxito.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SAFE DEMO DATA PURGE WITH VERIFIABLE BACKUP
// ==========================================

app.post('/api/activities/purge-demo', authenticateToken, requirePermission('agenda:purge_demo'), (req, res) => {
  const { confirmationPhrase } = req.body;

  // Exact confirmation phrase requirement
  if (!confirmationPhrase || confirmationPhrase.trim() !== 'INICIAR AGENDA REAL') {
    recordAudit(req, 'PURGE_DEMO_REJECTED_PHRASE', 'activities', 'purge_demo', { inputPhrase: confirmationPhrase });
    return res.status(400).json({
      error: 'Frase de confirmación incorrecta. Debe escribir exactamente: INICIAR AGENDA REAL'
    });
  }

  try {
    // 1. Count demo records dynamically
    const demoCount = db.queryOne('SELECT COUNT(*) as count FROM activities WHERE is_demo = 1')?.count || 0;

    if (demoCount === 0) {
      return res.json({
        message: 'No hay actividades demo para limpiar en la base de datos.',
        deletedCount: 0
      });
    }

    // 2. Create verifiable backup before proceeding
    const backupInfo = createDatabaseBackup('purge_demo', req.user.email, req.requestId);

    // 3. Execute purge in a strict database transaction
    const purgeResult = db.transaction(() => {
      const deleteResult = db.run('DELETE FROM activities WHERE is_demo = 1');

      recordAudit(req, 'PURGE_DEMO_COMPLETED', 'activities', 'purge_demo', {
        deletedCount: deleteResult.changes,
        backupFile: backupInfo.filename,
        backupSizeBytes: backupInfo.sizeBytes
      });

      return deleteResult.changes;
    });

    const remainingCount = db.queryOne('SELECT COUNT(*) as count FROM activities')?.count || 0;

    res.json({
      success: true,
      message: `Agenda real iniciada exitosamente. Se eliminaron ${purgeResult} eventos de prueba.`,
      deletedCount: purgeResult,
      backupFile: backupInfo.filename,
      remainingActivitiesCount: remainingCount
    });
  } catch (err) {
    console.error('Error durante la limpieza de datos demo:', err);
    res.status(500).json({ error: 'Error durante la limpieza de datos: ' + err.message });
  }
});

// Dashboard metrics
app.get('/api/activities/stats/dashboard', authenticateToken, requirePermission('reports:read'), (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const total = db.queryOne('SELECT COUNT(*) as count FROM activities')?.count || 0;
  const completed = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'cumplido'")?.count || 0;
  const inProgress = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'en_curso'")?.count || 0;
  const scheduled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'programado'")?.count || 0;
  const cancelled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'cancelado'")?.count || 0;
  const rescheduled = db.queryOne("SELECT COUNT(*) as count FROM activities WHERE status = 'reprogramado'")?.count || 0;
  const demoCount = db.queryOne('SELECT COUNT(*) as count FROM activities WHERE is_demo = 1')?.count || 0;

  const todayActivities = db.query('SELECT * FROM activities WHERE date = ? ORDER BY start_time ASC', [today]);
  const byCategory = db.query('SELECT category, COUNT(*) as count FROM activities GROUP BY category ORDER BY count DESC');
  const upcoming = db.query('SELECT * FROM activities WHERE date >= ? ORDER BY date ASC, start_time ASC LIMIT 6', [today]);

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
      completionRate,
      demoCount
    },
    todayActivities,
    byCategory,
    upcoming
  });
});

// ==========================================
// 6. CONTACTS DIRECTORY
// ==========================================

app.get('/api/contacts', authenticateToken, requirePermission('contacts:read'), (req, res) => {
  const contacts = db.query('SELECT * FROM contacts ORDER BY name ASC');
  res.json({ contacts });
});

app.post('/api/contacts', authenticateToken, requirePermission('contacts:manage'), (req, res) => {
  const { name, role_description, phone, category = 'comitiva', zone = 'General' } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos.' });
  }

  if (!validateE164Phone(phone)) {
    return res.status(400).json({ error: 'El teléfono debe tener formato internacional E.164 (+57...).' });
  }

  const result = db.run(`
    INSERT INTO contacts (name, role_description, phone, category, zone)
    VALUES (?, ?, ?, ?, ?)
  `, [name.trim(), role_description || 'Comisión de Campaña', phone.trim(), category, zone.trim()]);

  recordAudit(req, 'CONTACT_CREATED', 'contacts', result.lastInsertRowid, { name, phone });

  const newContact = db.queryOne('SELECT * FROM contacts WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ message: 'Contacto registrado exitosamente', contact: newContact });
});

app.delete('/api/contacts/:id', authenticateToken, requirePermission('contacts:manage'), (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id]);
  recordAudit(req, 'CONTACT_DELETED', 'contacts', req.params.id, {});
  res.json({ message: 'Contacto eliminado' });
});

// ==========================================
// 7. WHATSAPP ENGINE: ASSISTED & CONTROLLED LIVE TEST
// ==========================================

// Assisted wa.me link generation
app.get('/api/whatsapp/preview', authenticateToken, requirePermission('whatsapp:preview'), (req, res) => {
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

  const directLink = generateAssistedWhatsAppLink(phone, messageText);

  res.json({
    title,
    messageText,
    directLink,
    phone: phone || null
  });
});

// Controlled Live WhatsApp Test Endpoint (Single authorized recipient + Rate limited)
app.post('/api/whatsapp/test-live', authenticateToken, requirePermission('whatsapp:test'), async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !validateE164Phone(phone)) {
    return res.status(400).json({
      error: 'Formato de teléfono inválido. Debe incluir indicativo internacional (Ej. +573001234567).'
    });
  }

  // Rate limiting check
  const rateLimitKey = `test_live_${req.user.id}`;
  const rateLimitStatus = checkTestLiveRateLimit(rateLimitKey, 5, 15);
  if (!rateLimitStatus.allowed) {
    recordAudit(req, 'WHATSAPP_TEST_RATE_LIMITED', 'whatsapp', phone, { userId: req.user.id });
    return res.status(429).json({
      error: `Límite de pruebas alcanzado. Podrás realizar una nueva prueba en ${rateLimitStatus.retryAfterSeconds} segundos.`
    });
  }

  const testMessage = message || `🔵⚪ *PRUEBA DE NOTIFICACIÓN | #VOY CON EL KZ*\n━━━━━━━━━━━━━━━━━━━━━━━\nEste es un mensaje de verificación en tiempo real del sistema de campaña.\nConexión exitosa a las ${new Date().toLocaleTimeString('es-CO')}.\n🚀 #VOYCONELKZ`;

  try {
    const result = await dispatchAutomatedNotification({
      phone,
      recipientName: 'Prueba de Diagnóstico',
      messageText: testMessage,
      activityId: null
    });

    recordAudit(req, 'WHATSAPP_TEST_SENT', 'whatsapp', phone, {
      provider: result.provider,
      status: result.status,
      success: result.success
    });

    // Sanitized response (excluding secrets/tokens)
    res.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId || 'msg-' + Date.now(),
      status: result.status,
      note: result.note || (result.success ? 'Mensaje despachado correctamente.' : result.error),
      remainingAttempts: rateLimitStatus.remaining
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en la prueba de WhatsApp: ' + err.message });
  }
});

// Notifications history log
app.get('/api/whatsapp/logs', authenticateToken, requirePermission('reports:read'), (req, res) => {
  const logs = db.query(`
    SELECT n.id, n.recipient_phone, n.recipient_name, n.channel, n.provider, n.status, n.message_text, n.sent_at, a.title as activity_title 
    FROM notifications_log n 
    LEFT JOIN activities a ON n.activity_id = a.id 
    ORDER BY n.sent_at DESC 
    LIMIT 100
  `);
  res.json({ logs });
});

// SPA static serving and fallback
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Initialize database and start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 SERVIDOR DE PRODUCCIÓN #VOY CON EL KZ ACTIVO`);
    console.log(`  📍 App Web + Backend URL: http://localhost:${PORT}`);
    console.log(`  🔑 Base de datos SQLite inicializada y persistente`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
