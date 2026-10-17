import 'dotenv/config';
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
  dispatchAutomatedNotification,
  validateWebhookSignature,
  parseCommunityNeedMessage,
  formatNeedRegisteredConfirmation,
  formatNeedParseError,
  enqueueActivityNotification,
  processNotificationQueue,
  cancelPendingActivityNotifications,
  ALLOWED_NEED_CATEGORIES,
  calculateActivityRelevantChanges,
  formatEventCreatedMessage,
  formatEventUpdatedMessage,
  formatEventCancelledMessage,
  formatEventReminderMessage,
  getNotificationRecipients,
  scheduleAdvanceReminders,
  getBogotaDateParts,
  baileysManager
} from './whatsappService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Safe JWT_SECRET handling: prioritize env var, fallback to deterministic or secure token
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[SECURITY NOTICE] JWT_SECRET no provista explícitamente. Inicializando clave segura de sesión.');
  JWT_SECRET = process.env.RENDER_SERVICE_ID 
    ? crypto.createHash('sha256').update(process.env.RENDER_SERVICE_ID + '_campana_kz_2026').digest('hex')
    : crypto.randomBytes(32).toString('hex');
}

// ==========================================
// MODO FUERA DE LÍNEA / FUERA DE SERVICIO (LOCKDOWN)
// ==========================================
app.use((req, res) => {
  res.status(503).type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitio Fuera de Línea</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background-color: #0b1120;
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
    }
    .card {
      max-width: 440px;
      margin: 20px;
      padding: 36px;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h1 {
      color: #f1f5f9;
      font-size: 1.35rem;
      margin: 0 0 10px 0;
      font-weight: 700;
    }
    p {
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Plataforma Fuera de Línea</h1>
    <p>El acceso a este sistema se encuentra deshabilitado.</p>
  </div>
</body>
</html>`);
});


// In-memory rate limiting map for login attempts (5 failed attempts per 15 minutes per IP/email)
const loginAttemptsMap = new Map();
function checkLoginRateLimit(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const entry = loginAttemptsMap.get(key) || { count: 0, firstAttempt: now };
  if (now - entry.firstAttempt > windowMs) {
    entry.count = 0;
    entry.firstAttempt = now;
  }
  if (entry.count >= maxAttempts) {
    const waitSeconds = Math.ceil((entry.firstAttempt + windowMs - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true, entry };
}

function recordFailedLogin(key) {
  const rate = checkLoginRateLimit(key);
  if (rate.entry) {
    rate.entry.count++;
    loginAttemptsMap.set(key, rate.entry);
  }
}

function clearFailedLogin(key) {
  loginAttemptsMap.delete(key);
}

app.use(cors());
// OWASP: Limit body size to 64kb and capture rawBody for HMAC-SHA256 signature verification
app.use(express.json({
  limit: '64kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

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
    'needs:read', 'needs:create', 'needs:update', 'needs:delete',
    'whatsapp:preview', 'whatsapp:assisted_share', 'whatsapp:test', 'whatsapp:settings',
    'audit:read'
  ],
  candidato: [
    'activities:read', 'reports:read', 'routesheet:read',
    'contacts:read',
    'needs:read', 'needs:update',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  coordinador: [
    'activities:read', 'activities:create', 'activities:edit:territory',
    'reports:read', 'routesheet:read',
    'contacts:read', 'contacts:manage',
    'needs:read', 'needs:create', 'needs:update',
    'whatsapp:preview', 'whatsapp:assisted_share', 'whatsapp:settings'
  ],
  prensa: [
    'activities:read', 'activities:create:media', 'activities:edit:media',
    'reports:read', 'routesheet:read',
    'contacts:read',
    'needs:read',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  lider: [
    'activities:read', 'activities:read:zone',
    'reports:read:basic',
    'contacts:read',
    'needs:read', 'needs:read:zone', 'needs:create', 'needs:update',
    'whatsapp:preview', 'whatsapp:assisted_share'
  ],
  avanzada: [
    'activities:read', 'activities:create', 'activities:edit:territory',
    'reports:read', 'routesheet:read',
    'contacts:read', 'contacts:manage',
    'needs:read', 'needs:create', 'needs:update',
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

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const cleanEmail = email.toLowerCase().trim();
  const rateLimitKey = `${clientIp}_${cleanEmail}`;
  const rateCheck = checkLoginRateLimit(rateLimitKey);

  if (!rateCheck.allowed) {
    recordAudit(req, 'LOGIN_RATE_LIMITED', 'auth', cleanEmail, { ip: clientIp, email: cleanEmail });
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Por seguridad, intente nuevamente en ${rateCheck.waitSeconds} segundos.`
    });
  }

  const user = db.queryOne('SELECT * FROM users WHERE email = ?', [cleanEmail]);

  if (!user) {
    recordFailedLogin(rateLimitKey);
    recordAudit(req, 'LOGIN_FAILED_UNKNOWN_EMAIL', 'auth', cleanEmail, { email: cleanEmail });
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  if (user.active !== 1) {
    recordAudit(req, 'LOGIN_BLOCKED_INACTIVE_USER', 'auth', user.id, { email: cleanEmail });
    return res.status(403).json({ error: 'Esta cuenta ha sido desactivada por la administración de campaña.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    recordFailedLogin(rateLimitKey);
    recordAudit(req, 'LOGIN_FAILED_WRONG_PASSWORD', 'auth', user.id, { email: cleanEmail });
    return res.status(401).json({ error: 'Credenciales incorrectas. Verifique su correo o contraseña.' });
  }

  // Clear failed login tracking on success
  clearFailedLogin(rateLimitKey);

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

const ALLOWED_ROLES = ['admin', 'candidato', 'coordinador', 'prensa', 'lider', 'avanzada'];

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
app.post('/api/activities', authenticateToken, (req, res) => {
  const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
  const canCreateAll = req.user.role === 'admin' || userPermissions.includes('activities:create');
  const canCreateMedia = userPermissions.includes('activities:create:media');

  if (!canCreateAll && !canCreateMedia) {
    recordAudit(req, 'ACCESS_DENIED', 'permission', 'activities:create', { role: req.user.role });
    return res.status(403).json({ error: `Acceso denegado: Tu rol (${req.user.role}) no tiene autorización para programar actividades.` });
  }

  const {
    title,
    description,
    date,
    start_time,
    end_time,
    category = 'recorrido',
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

  if (!canCreateAll && canCreateMedia && category !== 'prensa') {
    return res.status(403).json({ error: 'El rol Prensa únicamente está autorizado a programar actividades de categoría Prensa / Medios.' });
  }

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

    // Automatic real-time notification workflow (post-commit)
    try {
      const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
      const shouldNotifyCreate = !settings || settings.notify_on_create !== 0;
      const shouldNotifyReminders = !settings || settings.notify_on_reminders !== 0;

      const recipients = getNotificationRecipients(newActivity);

      if (shouldNotifyCreate && recipients.length > 0) {
        const createdMsg = formatEventCreatedMessage(newActivity);
        const nowIso = new Date().toISOString();

        for (const rec of recipients) {
          const dedupeKey = `event-created-${newActivity.id}-${rec.phone}`;
          enqueueActivityNotification({
            activityId: newActivity.id,
            recipientPhone: rec.phone,
            recipientName: rec.name,
            notificationType: 'event_created',
            dedupeKey,
            scheduledFor: nowIso,
            messageText: createdMsg,
            requestId: req.requestId
          });
        }

        // Fast immediate dispatch in seconds (Render background worker will also ensure safety net)
        setImmediate(() => {
          processNotificationQueue().catch(err => console.error('[FAST DISPATCH CREATE ERROR]', err.message));
        });
      }

      if (shouldNotifyReminders && recipients.length > 0) {
        scheduleAdvanceReminders(newActivity, recipients, req.requestId);
      }
    } catch (queueErr) {
      console.error('[ACTIVITY QUEUE ERROR]', queueErr.message);
    }

    res.status(201).json({ message: 'Actividad programada exitosamente', activity: newActivity });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
app.put('/api/activities/:id', authenticateToken, (req, res) => {
  const current = db.queryOne('SELECT * FROM activities WHERE id = ?', [req.params.id]);
  if (!current) {
    return res.status(404).json({ error: 'Actividad no encontrada.' });
  }

  const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
  const canEditAll = req.user.role === 'admin' || userPermissions.includes('activities:edit:all');
  const canEditTerritory = userPermissions.includes('activities:edit:territory');
  const canEditMedia = userPermissions.includes('activities:edit:media');

  if (!canEditAll) {
    if (canEditMedia && current.category === 'prensa') {
      // Authorized for media activity
    } else if (canEditTerritory && current.category !== 'prensa') {
      // Authorized for territorial activity
    } else {
      recordAudit(req, 'ACCESS_DENIED', 'permission', 'activities:edit', { role: req.user.role, activityCategory: current.category });
      return res.status(403).json({
        error: `Acceso denegado: Tu rol (${req.user.role}) no tiene autorización para modificar esta actividad.`
      });
    }
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

    // Real-Time Notification evaluation on updated activity
    try {
      const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
      const recipients = getNotificationRecipients(updated);

      // 1. Cancellation flow: if status changed to 'cancelado'
      if (status === 'cancelado' && current.status !== 'cancelado') {
        // Cancel all pending reminders in cascade
        cancelPendingActivityNotifications(req.params.id);

        if ((!settings || settings.notify_on_cancel !== 0) && recipients.length > 0) {
          const cancelMsg = formatEventCancelledMessage(updated, notes || 'Cancelación de agenda por el equipo');
          const nowIso = new Date().toISOString();

          for (const rec of recipients) {
            const dedupeKey = `event-cancelled-${updated.id}-${rec.phone}`;
            enqueueActivityNotification({
              activityId: updated.id,
              recipientPhone: rec.phone,
              recipientName: rec.name,
              notificationType: 'event_cancelled',
              dedupeKey,
              scheduledFor: nowIso,
              messageText: cancelMsg,
              requestId: req.requestId
            });
          }

          setImmediate(() => {
            processNotificationQueue().catch(err => console.error('[FAST DISPATCH CANCEL ERROR]', err.message));
          });
        }
      }
      // 2. Active updates flow: calculate diff of relevant fields (ignoring internal notes/minor edits)
      else if (status !== 'cancelado') {
        const diff = calculateActivityRelevantChanges(current, updated);

        if (diff.hasRelevantChanges) {
          // If date or time changed, cancel old reminders and reschedule with new dates
          const dateOrTimeChanged = current.date !== updated.date || current.start_time !== updated.start_time;
          if (dateOrTimeChanged) {
            cancelPendingActivityNotifications(req.params.id);
            if (!settings || settings.notify_on_reminders !== 0) {
              scheduleAdvanceReminders(updated, recipients, req.requestId);
            }
          }

          if ((!settings || settings.notify_on_update !== 0) && recipients.length > 0) {
            const updateMsg = formatEventUpdatedMessage(updated, diff.changesSummary);
            const nowIso = new Date().toISOString();

            for (const rec of recipients) {
              const dedupeKey = `event-updated-${updated.id}-${diff.contentHash}-${rec.phone}`;
              enqueueActivityNotification({
                activityId: updated.id,
                recipientPhone: rec.phone,
                recipientName: rec.name,
                notificationType: 'event_updated',
                dedupeKey,
                scheduledFor: nowIso,
                messageText: updateMsg,
                requestId: req.requestId
              });
            }

            setImmediate(() => {
              processNotificationQueue().catch(err => console.error('[FAST DISPATCH UPDATE ERROR]', err.message));
            });
          }
        }
      }
    } catch (queueErr) {
      console.error('[UPDATE QUEUE ERROR]', queueErr.message);
    }

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
    cancelPendingActivityNotifications(req.params.id);
    db.transaction(() => {
      db.run('DELETE FROM activities WHERE id = ?', [req.params.id]);
      recordAudit(req, 'ACTIVITY_DELETED', 'activities', req.params.id, { title: current.title });
    });

    // Send cancellation alert if enabled
    try {
      const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
      if ((!settings || settings.notify_on_cancel !== 0)) {
        const recipients = getNotificationRecipients(current);
        if (recipients.length > 0) {
          const cancelMsg = formatEventCancelledMessage(current, 'Actividad eliminada de la agenda oficial');
          const nowIso = new Date().toISOString();

          for (const rec of recipients) {
            const dedupeKey = `event-deleted-${current.id}-${rec.phone}`;
            enqueueActivityNotification({
              activityId: current.id,
              recipientPhone: rec.phone,
              recipientName: rec.name,
              notificationType: 'event_cancelled',
              dedupeKey,
              scheduledFor: nowIso,
              messageText: cancelMsg,
              requestId: req.requestId
            });
          }

          setImmediate(() => {
            processNotificationQueue().catch(err => console.error('[FAST DISPATCH DELETE ERROR]', err.message));
          });
        }
      }
    } catch (_) {}

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
      const deleteNeeds = db.run('DELETE FROM community_needs WHERE is_demo = 1');

      recordAudit(req, 'PURGE_DEMO_COMPLETED', 'activities', 'purge_demo', {
        deletedActivities: deleteResult.changes,
        deletedNeeds: deleteNeeds.changes,
        backupFile: backupInfo.filename,
        backupSizeBytes: backupInfo.sizeBytes
      });

      return deleteResult.changes + deleteNeeds.changes;
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
  const today = getBogotaDateParts().dateStr;

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
    const targetDate = date || getBogotaDateParts().dateStr;
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

// Send single automated WhatsApp notification
app.post('/api/whatsapp/send-notification', authenticateToken, requirePermission('whatsapp:assisted_share'), async (req, res) => {
  const { phone, recipientName, messageText, activityId } = req.body;

  if (!phone || !messageText) {
    return res.status(400).json({ error: 'Teléfono y texto del mensaje son requeridos.' });
  }

  const cleanPhone = phone.trim();
  if (!validateE164Phone(cleanPhone)) {
    return res.status(400).json({ error: 'El teléfono debe tener formato internacional E.164 (Ej. +573001234567).' });
  }

  try {
    const result = await dispatchAutomatedNotification({
      phone: cleanPhone,
      recipientName: recipientName || 'Destinatario de Campaña',
      messageText,
      activityId: activityId || null
    });

    recordAudit(req, 'WHATSAPP_SINGLE_NOTIFICATION_SENT', 'whatsapp', cleanPhone, {
      activityId,
      provider: result.provider,
      status: result.status,
      success: result.success
    });

    res.json({
      success: result.success,
      message: result.success ? 'Notificación despachada exitosamente.' : (result.error || 'No se pudo entregar el mensaje'),
      result
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar notificación: ' + err.message });
  }
});

// Broadcast daily agenda to active contacts and authorized recipients
app.post('/api/whatsapp/broadcast-daily', authenticateToken, requirePermission('whatsapp:settings'), async (req, res) => {
  const { date, categoryFilter } = req.body;
  const targetDate = date || getBogotaDateParts().dateStr;

  try {
    let actQuery = "SELECT * FROM activities WHERE date = ? AND status != 'cancelado'";
    const actParams = [targetDate];
    if (categoryFilter && categoryFilter !== 'all') {
      actQuery += ' AND category = ?';
      actParams.push(categoryFilter);
    }
    actQuery += ' ORDER BY start_time ASC';

    const activities = db.query(actQuery, actParams);
    const message = formatDailyAgendaMessage(targetDate, activities);

    // Collect active contacts from directory
    const contacts = db.query('SELECT name, phone FROM contacts WHERE active = 1');

    // Also collect authorized recipients from settings
    const settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
    let authorized = [];
    try {
      authorized = JSON.parse(settings?.authorized_phones || '[]');
    } catch (_) {}

    const allRecipients = [];
    const seenPhones = new Set();

    // Primary phone
    if (settings?.primary_phone && validateE164Phone(settings.primary_phone)) {
      seenPhones.add(settings.primary_phone);
      allRecipients.push({ name: 'Central de Campaña', phone: settings.primary_phone });
    }

    // Authorized recipients
    for (const r of authorized) {
      if (r.active !== false && r.phone && validateE164Phone(r.phone) && !seenPhones.has(r.phone)) {
        seenPhones.add(r.phone);
        allRecipients.push({ name: r.name, phone: r.phone });
      }
    }

    // Active directory contacts
    for (const c of contacts) {
      if (c.phone && validateE164Phone(c.phone) && !seenPhones.has(c.phone)) {
        seenPhones.add(c.phone);
        allRecipients.push({ name: c.name, phone: c.phone });
      }
    }

    let totalSent = 0;
    const nowIso = new Date().toISOString();

    for (const r of allRecipients) {
      enqueueActivityNotification({
        activityId: null,
        recipientPhone: r.phone,
        recipientName: r.name,
        notificationType: 'daily_broadcast',
        dedupeKey: `broadcast_${targetDate}_${r.phone}`,
        scheduledFor: nowIso,
        messageText: message,
        requestId: req.requestId
      });
      totalSent++;
    }

    // Fast dispatch via background queue
    setImmediate(() => {
      processNotificationQueue().catch(err => console.error('[FAST BROADCAST DISPATCH ERROR]', err.message));
    });

    recordAudit(req, 'WHATSAPP_BROADCAST_TRIGGERED', 'whatsapp', targetDate, {
      totalRecipients: totalSent,
      categoryFilter
    });

    res.json({
      totalSent,
      message: `Difusión de agenda programada exitosamente para ${totalSent} destinatarios.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en la difusión de agenda: ' + err.message });
  }
});

// WhatsApp Settings (Admin & Coordinador)
app.get('/api/whatsapp/settings', authenticateToken, requirePermission('whatsapp:settings'), (req, res) => {
  let settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
  if (!settings) {
    db.run(`
      INSERT INTO whatsapp_settings (id, provider, primary_phone, authorized_phones, notify_on_create, notify_on_update, notify_on_cancel, notify_on_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
      VALUES (1, 'assisted', '+573001234567', '[]', 1, 1, 1, 1, 1, '22:00', '06:00')
    `);
    settings = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
  }

  // Parse authorized_phones JSON for the client
  let parsedAuth = [];
  try {
    parsedAuth = JSON.parse(settings.authorized_phones || '[]');
  } catch (_) {
    parsedAuth = [];
  }

  const hasToken = Boolean(settings.api_token && settings.api_token.trim().length > 0);
  const safeSettings = {
    ...settings,
    api_token_configured: hasToken,
    api_token: hasToken ? '••••••••' : '',
    authorized_phones: parsedAuth
  };

  res.json({ settings: safeSettings });
});

app.put('/api/whatsapp/settings', authenticateToken, requirePermission('whatsapp:settings'), (req, res) => {
  const {
    provider,
    api_url,
    api_token,
    account_sid,
    sender_phone,
    primary_phone,
    authorized_phones,
    notify_on_create = 1,
    notify_on_update = 1,
    notify_on_cancel = 1,
    notify_on_reminders = 1,
    quiet_hours_enabled = 1,
    quiet_hours_start = '22:00',
    quiet_hours_end = '06:00',
    auto_reminders_enabled = 1,
    reminder_minutes_before = 60,
    daily_summary_time = '07:00'
  } = req.body;

  // 1. Validate primary phone if provided
  if (primary_phone && !validateE164Phone(primary_phone)) {
    return res.status(400).json({ error: 'El número de WhatsApp principal debe tener formato E.164 (Ej. +573001234567).' });
  }

  // 2. Validate authorized phones list
  let cleanAuthList = [];
  if (authorized_phones !== undefined) {
    if (!Array.isArray(authorized_phones)) {
      return res.status(400).json({ error: 'authorized_phones debe ser una lista de destinatarios.' });
    }
    if (authorized_phones.length > 20) {
      return res.status(400).json({ error: 'Se permite un máximo de 20 destinatarios autorizados.' });
    }

    const seenPhones = new Set();
    const allowedRoles = ['admin', 'candidato', 'coordinador', 'prensa', 'lider', 'avanzada'];

    for (const item of authorized_phones) {
      if (!item || typeof item !== 'object') continue;
      const phone = (item.phone || '').trim();
      const name = (item.name || '').trim();
      const role = (item.role || 'coordinador').trim().toLowerCase();
      const active = item.active !== false;

      if (!name || name.length < 2) {
        return res.status(400).json({ error: `Cada destinatario debe tener un nombre válido (mínimo 2 caracteres). Error en: "${name}"` });
      }

      if (!validateE164Phone(phone)) {
        return res.status(400).json({ error: `Teléfono inválido para "${name}": ${phone}. Debe tener formato internacional (Ej. +573001234567).` });
      }

      if (seenPhones.has(phone)) {
        return res.status(400).json({ error: `El número ${phone} está duplicado en la lista de destinatarios.` });
      }
      seenPhones.add(phone);

      cleanAuthList.push({
        name,
        phone,
        role: allowedRoles.includes(role) ? role : 'coordinador',
        active
      });
    }
  }

  // 3. Validate quiet hours format (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (quiet_hours_start && !timeRegex.test(quiet_hours_start)) {
    return res.status(400).json({ error: 'quiet_hours_start debe tener formato HH:MM (Ej. 22:00).' });
  }
  if (quiet_hours_end && !timeRegex.test(quiet_hours_end)) {
    return res.status(400).json({ error: 'quiet_hours_end debe tener formato HH:MM (Ej. 06:00).' });
  }

  const current = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1') || {};

  // Preserve existing api_token if masked placeholder was submitted or left blank
  let resolvedApiToken = current.api_token;
  if (api_token !== undefined && api_token !== '••••••••' && api_token.trim() !== '') {
    resolvedApiToken = api_token.trim();
  }

  try {
    db.run(`
      INSERT OR REPLACE INTO whatsapp_settings (
        id, provider, api_url, api_token, account_sid, sender_phone,
        primary_phone, authorized_phones, notify_on_create, notify_on_update,
        notify_on_cancel, notify_on_reminders, quiet_hours_enabled, quiet_hours_start,
        quiet_hours_end, auto_reminders_enabled, reminder_minutes_before, daily_summary_time,
        updated_at
      ) VALUES (
        1, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        CURRENT_TIMESTAMP
      )
    `, [
      provider || current.provider || 'assisted',
      api_url !== undefined ? api_url : current.api_url,
      resolvedApiToken,
      account_sid !== undefined ? account_sid : current.account_sid,
      sender_phone !== undefined ? sender_phone : current.sender_phone,
      primary_phone !== undefined ? primary_phone : current.primary_phone,
      authorized_phones !== undefined ? JSON.stringify(cleanAuthList) : (current.authorized_phones || '[]'),
      notify_on_create !== undefined ? (notify_on_create ? 1 : 0) : 1,
      notify_on_update !== undefined ? (notify_on_update ? 1 : 0) : 1,
      notify_on_cancel !== undefined ? (notify_on_cancel ? 1 : 0) : 1,
      notify_on_reminders !== undefined ? (notify_on_reminders ? 1 : 0) : 1,
      quiet_hours_enabled !== undefined ? (quiet_hours_enabled ? 1 : 0) : 1,
      quiet_hours_start || '22:00',
      quiet_hours_end || '06:00',
      auto_reminders_enabled !== undefined ? (auto_reminders_enabled ? 1 : 0) : 1,
      reminder_minutes_before || 60,
      daily_summary_time || '07:00'
    ]);

    recordAudit(req, 'WHATSAPP_SETTINGS_UPDATED', 'whatsapp_settings', '1', {
      provider: provider || current.provider,
      recipientsCount: cleanAuthList.length,
      quietHours: `${quiet_hours_start || '22:00'}-${quiet_hours_end || '06:00'}`
    });

    const updated = db.queryOne('SELECT * FROM whatsapp_settings WHERE id = 1');
    const safeUpdated = {
      ...updated,
      authorized_phones: JSON.parse(updated.authorized_phones || '[]')
    };

    res.json({ message: 'Configuración de WhatsApp guardada exitosamente', settings: safeUpdated });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar configuración: ' + err.message });
  }
});

// ==========================================
// Baileys WhatsApp QR Endpoints (Serv00 / Local / Direct)
// ==========================================
app.get('/api/whatsapp/baileys/status', authenticateToken, requirePermission('whatsapp:settings'), (req, res) => {
  res.json({
    success: true,
    data: baileysManager.getStatus()
  });
});

app.post('/api/whatsapp/baileys/connect', authenticateToken, requirePermission('whatsapp:settings'), async (req, res) => {
  try {
    const status = await baileysManager.connect();
    res.json({
      success: true,
      message: 'Proceso de conexión iniciado. Si no está conectado, escanee el código QR.',
      data: status
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al conectar WhatsApp QR: ' + err.message });
  }
});

app.post('/api/whatsapp/baileys/disconnect', authenticateToken, requirePermission('whatsapp:settings'), async (req, res) => {
  try {
    const status = await baileysManager.clearSession();
    recordAudit(req, 'WHATSAPP_QR_DISCONNECTED', 'whatsapp_session', '1', {});
    res.json({
      success: true,
      message: 'Sesión de WhatsApp desconectada exitosamente.',
      data: status
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al desconectar WhatsApp QR: ' + err.message });
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

// Resilient Notification Queue endpoints (Admin & Coordinador)
app.get('/api/whatsapp/queue', authenticateToken, requirePermission('whatsapp:settings'), (req, res) => {
  const items = db.query(`
    SELECT * FROM notification_queue
    ORDER BY created_at DESC
    LIMIT 100
  `);
  const stats = {
    pending: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'pending'")?.count || 0,
    processing: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'processing'")?.count || 0,
    sent: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'sent'")?.count || 0,
    failed: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'failed'")?.count || 0,
    dead_letter: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'dead_letter'")?.count || 0,
    cancelled: db.queryOne("SELECT COUNT(*) as count FROM notification_queue WHERE status = 'cancelled'")?.count || 0,
    total: db.queryOne("SELECT COUNT(*) as count FROM notification_queue")?.count || 0
  };
  res.json({ items, stats });
});

app.post('/api/whatsapp/queue/process', authenticateToken, requirePermission('whatsapp:settings'), async (req, res) => {
  try {
    const processed = await processNotificationQueue();
    recordAudit(req, 'NOTIFICATION_QUEUE_MANUAL_PROCESS', 'notification_queue', 'manual', { processed });
    res.json({ message: `Cola procesada exitosamente. Se despacharon ${processed} mensajes.`, processed });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar la cola de WhatsApp: ' + err.message });
  }
});

app.post('/api/whatsapp/queue/retry-failed', authenticateToken, requirePermission('whatsapp:settings'), (req, res) => {
  try {
    const updated = db.run(`
      UPDATE notification_queue
      SET status = 'pending', attempts = 0, dead_letter = 0, next_retry_at = NULL
      WHERE status IN ('failed', 'dead_letter')
    `);
    recordAudit(req, 'NOTIFICATION_QUEUE_RETRY_FAILED', 'notification_queue', 'retry', { affected: updated.changes });
    res.json({ message: `Se reiniciaron ${updated.changes} notificaciones fallidas para reintento.`, count: updated.changes });
  } catch (err) {
    res.status(500).json({ error: 'Error al reiniciar notificaciones: ' + err.message });
  }
});

// ==========================================
// 8. WHATSAPP WEBHOOK: HANDSHAKE & INCOMING MESSAGE PROCESSOR
// ==========================================

// Webhook Handshake (Meta Hub Verification)
app.get('/api/whatsapp/incoming', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedSecret = process.env.WHATSAPP_VERIFY_TOKEN || 'campana_kz_verify_token_2026';

  if (mode && token) {
    const tokenBuf = Buffer.from(String(token));
    const expBuf = Buffer.from(String(expectedSecret));
    const isMatch = tokenBuf.length === expBuf.length && crypto.timingSafeEqual(tokenBuf, expBuf);

    if (mode === 'subscribe' && isMatch) {
      console.log('[WEBHOOK HANDSHAKE SUCCESS] Meta webhook verificado con éxito.');
      return res.status(200).send(challenge);
    }
  }

  recordAudit(req, 'WEBHOOK_HANDSHAKE_DENIED', 'whatsapp_webhook', 'meta', { ip: req.ip });
  return res.status(403).json({ error: 'Token de verificación de webhook inválido.' });
});

// Webhook Message Receiver with HMAC-SHA256 signature verification & Deduplication
app.post('/api/whatsapp/incoming', async (req, res) => {
  const signatureHeader = req.headers['x-hub-signature-256'] || req.headers['x-webhook-secret'] || '';
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.WEBHOOK_SECRET || 'campana_kz_webhook_secret_2026';

  const isSignatureValid = validateWebhookSignature(req.rawBody || Buffer.from(JSON.stringify(req.body)), signatureHeader, appSecret);

  if (!isSignatureValid) {
    recordAudit(req, 'WEBHOOK_SIGNATURE_REJECTED', 'whatsapp_webhook', 'incoming', { ip: req.ip });
    return res.status(401).json({ error: 'Firma de webhook inválida o ausente (X-Hub-Signature-256).' });
  }

  // Fast response to webhook caller (Meta requires <3s)
  res.status(200).json({ status: 'received' });

  // Asynchronous processing of incoming message
  try {
    const body = req.body;
    let senderPhone = '';
    let messageText = '';
    let providerMessageId = '';

    // 1. Meta Cloud API format
    if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const msgObj = body.entry[0].changes[0].value.messages[0];
      senderPhone = msgObj.from ? `+${msgObj.from}` : '';
      messageText = msgObj.text?.body || '';
      providerMessageId = msgObj.id || '';
    }
    // 2. Evolution API / WAHA format
    else if (body?.data?.message || body?.message) {
      const msgData = body.data || body;
      messageText = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || msgData.body || '';
      const jid = msgData.key?.remoteJid || msgData.sender || '';
      senderPhone = jid ? '+' + jid.split('@')[0] : '';
      providerMessageId = msgData.key?.id || '';
    }
    // 3. Direct simple payload
    else if (body?.messageText) {
      senderPhone = body.senderPhone || '';
      messageText = body.messageText || '';
      providerMessageId = body.messageId || 'sim-' + Date.now();
    }

    if (!messageText || !messageText.trim()) return;

    // Deduplication by source_message_id (wamid)
    if (providerMessageId) {
      const existing = db.queryOne('SELECT id FROM community_needs WHERE source_message_id = ?', [providerMessageId]);
      if (existing) {
        console.log(`[WEBHOOK DEDUPE] Mensaje ya procesado anteriormente (ID: ${providerMessageId})`);
        return;
      }
    }

    // Parse community need command
    const parseResult = parseCommunityNeedMessage(messageText, senderPhone);

    if (parseResult.isNeedCommand) {
      if (parseResult.isValid) {
        const { neighborhood, person_name, phone, category, description, priority, consent_contact } = parseResult.data;

        const insRes = db.run(`
          INSERT INTO community_needs (
            neighborhood, person_name, phone, category, description,
            priority, status, source, source_message_id, consent_contact
          ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'whatsapp', ?, ?)
        `, [
          neighborhood, person_name, phone, category, description,
          priority, providerMessageId || null, consent_contact
        ]);

        const newId = insRes.lastInsertRowid;
        recordAudit(req, 'COMMUNITY_NEED_CREATED_VIA_WHATSAPP', 'community_needs', newId, {
          neighborhood, category, priority
        });

        // Send sanitized confirmation back to sender
        if (senderPhone) {
          const confirmText = formatNeedRegisteredConfirmation({
            id: newId,
            neighborhood,
            category,
            priority,
            status: 'pendiente'
          });
          await dispatchAutomatedNotification({
            phone: senderPhone,
            recipientName: person_name,
            messageText: confirmText
          });
        }
      } else {
        // Return format error with instructions
        if (senderPhone && parseResult.errorReply) {
          await dispatchAutomatedNotification({
            phone: senderPhone,
            recipientName: 'Ciudadano',
            messageText: parseResult.errorReply
          });
        }
      }
    }
  } catch (err) {
    console.error('[WEBHOOK ASYNC PROCESSING ERROR]', err.message);
  }
});

// Interactive Webhook Simulator for Testing from Web UI
app.post('/api/whatsapp/simulate-incoming', authenticateToken, requirePermission('needs:create'), async (req, res) => {
  const { senderPhone, messageText } = req.body;
  if (!messageText) return res.status(400).json({ error: 'Texto del mensaje es requerido.' });

  const parseResult = parseCommunityNeedMessage(messageText, senderPhone);

  if (!parseResult.isNeedCommand) {
    return res.json({
      isNeedCommand: false,
      replyText: 'El mensaje no contiene el comando NECESIDAD. No se realizó ninguna acción.',
      registered: false
    });
  }

  if (!parseResult.isValid) {
    return res.json({
      isNeedCommand: true,
      registered: false,
      missingFields: parseResult.missingFields,
      replyText: parseResult.errorReply
    });
  }

  const { neighborhood, person_name, phone, category, description, priority, consent_contact } = parseResult.data;
  const insRes = db.run(`
    INSERT INTO community_needs (
      neighborhood, person_name, phone, category, description,
      priority, status, source, consent_contact, reporter_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'whatsapp_sim', ?, ?)
  `, [
    neighborhood, person_name, phone, category, description,
    priority, consent_contact, req.user.id
  ]);

  const newId = insRes.lastInsertRowid;
  recordAudit(req, 'COMMUNITY_NEED_SIMULATED', 'community_needs', newId, { neighborhood, category });

  const confirmText = formatNeedRegisteredConfirmation({
    id: newId,
    neighborhood,
    category,
    priority,
    status: 'pendiente'
  });

  res.json({
    isNeedCommand: true,
    registered: true,
    needId: newId,
    replyText: confirmText,
    data: parseResult.data
  });
});

// ==========================================
// 9. COMMUNITY NEEDS CRUD & ANALYTICS
// ==========================================

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  const prefix = phone.slice(0, phone.length - 7);
  const suffix = phone.slice(-4);
  return `${prefix} *** ${suffix}`;
}

// List needs with territorial boundary and search
app.get('/api/needs', authenticateToken, requirePermission('needs:read'), (req, res) => {
  const { status, category, priority, neighborhood, search, limit = 100 } = req.query;

  let query = 'SELECT * FROM community_needs WHERE 1=1';
  const params = [];

  if (req.user.role === 'lider' && req.user.zone && req.user.zone !== 'General') {
    query += ' AND (neighborhood LIKE ? OR neighborhood = ?)';
    params.push(`%${req.user.zone}%`, req.user.zone);
  }

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (priority && priority !== 'all') {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (neighborhood && neighborhood !== 'all') {
    query += ' AND neighborhood LIKE ?';
    params.push(`%${neighborhood}%`);
  }
  if (search) {
    query += ' AND (person_name LIKE ? OR description LIKE ? OR phone LIKE ? OR neighborhood LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(200, parseInt(limit)));

  const needs = db.query(query, params);

  const canSeeFullPII = ['admin', 'coordinador'].includes(req.user.role);
  const sanitizedNeeds = needs.map(n => ({
    ...n,
    phone_masked: maskPhone(n.phone),
    phone: canSeeFullPII ? n.phone : maskPhone(n.phone)
  }));

  res.json({ needs: sanitizedNeeds, total: sanitizedNeeds.length });
});

// Get single need details
app.get('/api/needs/:id', authenticateToken, requirePermission('needs:read'), (req, res) => {
  const need = db.queryOne('SELECT * FROM community_needs WHERE id = ?', [req.params.id]);
  if (!need) return res.status(404).json({ error: 'Necesidad no encontrada.' });

  const canSeeFullPII = ['admin', 'coordinador'].includes(req.user.role);
  const sanitizedNeed = {
    ...need,
    phone_masked: maskPhone(need.phone),
    phone: canSeeFullPII ? need.phone : maskPhone(need.phone)
  };

  recordAudit(req, 'COMMUNITY_NEED_VIEWED', 'community_needs', need.id, { category: need.category });
  res.json({ need: sanitizedNeed });
});

// Create manual need
app.post('/api/needs', authenticateToken, requirePermission('needs:create'), (req, res) => {
  const {
    neighborhood,
    person_name,
    phone,
    category,
    description,
    priority = 'Media',
    notes,
    consent_contact = 1
  } = req.body;

  if (!neighborhood || !person_name || !phone || !category || !description) {
    return res.status(400).json({ error: 'Barrio, Persona, Teléfono, Categoría y Descripción son obligatorios.' });
  }

  if (!validateE164Phone(phone)) {
    return res.status(400).json({ error: 'El teléfono debe tener formato internacional E.164 (Ej. +573001234567).' });
  }

  if (!ALLOWED_NEED_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Categoría inválida. Permitidas: ${ALLOWED_NEED_CATEGORIES.join(', ')}` });
  }

  try {
    const result = db.run(`
      INSERT INTO community_needs (
        neighborhood, person_name, phone, category, description,
        priority, status, source, notes, consent_contact, reporter_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'manual', ?, ?, ?)
    `, [
      neighborhood.trim(), person_name.trim(), phone.trim(), category, description.trim(),
      priority, notes ? notes.trim() : null, consent_contact ? 1 : 0, req.user.id
    ]);

    const newId = result.lastInsertRowid;
    recordAudit(req, 'COMMUNITY_NEED_CREATED_MANUAL', 'community_needs', newId, {
      neighborhood, category, priority
    });

    const created = db.queryOne('SELECT * FROM community_needs WHERE id = ?', [newId]);
    res.status(201).json({ message: 'Necesidad comunitaria registrada con éxito.', need: created });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar necesidad: ' + err.message });
  }
});

// Update need status / follow-up
app.put('/api/needs/:id', authenticateToken, requirePermission('needs:update'), (req, res) => {
  const targetId = parseInt(req.params.id);
  const current = db.queryOne('SELECT * FROM community_needs WHERE id = ?', [targetId]);
  if (!current) return res.status(404).json({ error: 'Necesidad no encontrada.' });

  const { status, notes, priority, assigned_to, follow_up_date, category } = req.body;

  let closedAt = current.closed_at;
  let closedBy = current.closed_by;
  if (status && ['atendida', 'cerrada', 'no_viable'].includes(status) && !current.closed_at) {
    closedAt = new Date().toISOString();
    closedBy = req.user.id;
  }

  try {
    db.run(`
      UPDATE community_needs SET
        status = ?,
        notes = ?,
        priority = ?,
        assigned_to = ?,
        follow_up_date = ?,
        category = ?,
        closed_at = ?,
        closed_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      status || current.status,
      notes !== undefined ? notes : current.notes,
      priority || current.priority,
      assigned_to !== undefined ? assigned_to : current.assigned_to,
      follow_up_date !== undefined ? follow_up_date : current.follow_up_date,
      category || current.category,
      closedAt,
      closedBy,
      targetId
    ]);

    recordAudit(req, 'COMMUNITY_NEED_UPDATED', 'community_needs', targetId, {
      oldStatus: current.status,
      newStatus: status || current.status
    });

    const updated = db.queryOne('SELECT * FROM community_needs WHERE id = ?', [targetId]);
    res.json({ message: 'Necesidad actualizada exitosamente.', need: updated });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar necesidad: ' + err.message });
  }
});

// Delete need (Admin only)
app.delete('/api/needs/:id', authenticateToken, requirePermission('needs:delete'), (req, res) => {
  const targetId = parseInt(req.params.id);
  const current = db.queryOne('SELECT * FROM community_needs WHERE id = ?', [targetId]);
  if (!current) return res.status(404).json({ error: 'Necesidad no encontrada.' });

  db.run('DELETE FROM community_needs WHERE id = ?', [targetId]);
  recordAudit(req, 'COMMUNITY_NEED_DELETED', 'community_needs', targetId, { neighborhood: current.neighborhood });
  res.json({ message: 'Registro de necesidad eliminado con éxito.' });
});

// Needs KPI statistics
app.get('/api/needs/stats/summary', authenticateToken, requirePermission('needs:read'), (req, res) => {
  const total = db.queryOne('SELECT COUNT(*) as count FROM community_needs')?.count || 0;
  const pending = db.queryOne("SELECT COUNT(*) as count FROM community_needs WHERE status = 'pendiente'")?.count || 0;
  const inProgress = db.queryOne("SELECT COUNT(*) as count FROM community_needs WHERE status = 'en_gestion'")?.count || 0;
  const attended = db.queryOne("SELECT COUNT(*) as count FROM community_needs WHERE status = 'atendida'")?.count || 0;
  const urgent = db.queryOne("SELECT COUNT(*) as count FROM community_needs WHERE priority IN ('Urgente', 'Alta') AND status NOT IN ('atendida', 'cerrada')")?.count || 0;

  const byCategory = db.query('SELECT category, COUNT(*) as count FROM community_needs GROUP BY category ORDER BY count DESC');
  const byNeighborhood = db.query('SELECT neighborhood, COUNT(*) as count FROM community_needs GROUP BY neighborhood ORDER BY count DESC LIMIT 8');

  res.json({
    total,
    pending,
    inProgress,
    attended,
    urgent,
    byCategory,
    byNeighborhood
  });
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

  // Background cron worker: Process resilient notification queue and broadcast daily agenda
  cron.schedule('* * * * *', async () => {
    try {
      const processed = await processNotificationQueue();
      if (processed > 0) {
        console.log(`[CRON WORKER] Despachadas ${processed} notificaciones de WhatsApp pendientes`);
      }
    } catch (err) {
      console.error('[CRON WORKER ERROR]', err.message);
    }

    // Daily agenda broadcast based on whatsapp_settings.daily_summary_time in America/Bogota
    try {
      const { hours, minutes, dateStr: todayBogota } = getBogotaDateParts();
      const currentHHMM = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const settings = db.queryOne('SELECT daily_summary_time FROM whatsapp_settings WHERE id = 1');
      const targetTime = settings?.daily_summary_time || '07:00';

      if (currentHHMM === targetTime) {
        const todayActivities = db.query("SELECT * FROM activities WHERE date = ? AND status != 'cancelado' ORDER BY start_time ASC", [todayBogota]);
        if (todayActivities.length > 0) {
          const message = formatDailyAgendaMessage(todayBogota, todayActivities);
          const recipients = getNotificationRecipients(null);

          let enqueuedCount = 0;
          for (const r of recipients) {
            if (validateE164Phone(r.phone)) {
              const ok = enqueueActivityNotification({
                activityId: null,
                recipientPhone: r.phone,
                recipientName: r.name,
                notificationType: 'daily_agenda',
                dedupeKey: `cron_agenda_${todayBogota}_${r.phone}`,
                scheduledFor: new Date().toISOString(),
                messageText: message
              });
              if (ok) enqueuedCount++;
            }
          }
          if (enqueuedCount > 0) {
            await processNotificationQueue();
          }
        }
      }
    } catch (cronErr) {
      console.error('[DAILY AGENDA CRON ERROR]', cronErr.message);
    }
  });

  // Set incoming citizen need callback for native Baileys WhatsApp bot
  baileysManager.setIncomingNeedCallback(async ({ senderPhone, messageText, messageId }) => {
    const parseResult = parseCommunityNeedMessage(messageText);
    if (!parseResult.valid) {
      return formatNeedParseError(parseResult.missingFields);
    }

    const { data } = parseResult;
    try {
      const res = db.run(`
        INSERT INTO community_needs (
          reporter_user_id, neighborhood, person_name, phone, category,
          description, priority, status, source, is_demo, raw_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', 'whatsapp', 0, ?)
      `, [
        null,
        data.neighborhood,
        data.person_name,
        data.phone,
        data.category,
        data.description,
        data.priority,
        JSON.stringify({ raw_text: messageText, sender: senderPhone, messageId, provider: 'baileys_qr' })
      ]);

      const needRecord = { id: res.lastInsertRowid, ...data };
      return formatNeedRegisteredConfirmation(needRecord);
    } catch (err) {
      console.error('[BAILEYS NEED INSERT ERROR]', err.message);
      return '⚠️ Hubo un error al registrar la solicitud en el sistema. Por favor reintente más tarde.';
    }
  });

  // Auto-reconnect native WhatsApp QR session if existing credentials are found
  baileysManager.init(true).catch(e => console.warn('[BAILEYS AUTOINIT NOTICE]', e.message));

  app.listen(PORT, () => {

    console.log(`\n======================================================`);
    console.log(`  🚀 SERVIDOR DE PRODUCCIÓN #VOY CON EL KZ ACTIVO`);
    console.log(`  📍 App Web + Backend URL: http://localhost:${PORT}`);
    console.log(`  🔑 Base de datos SQLite inicializada y persistente`);
    console.log(`  ⏰ Cola de notificaciones y cron workers activos`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
