import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_FILE = process.env.DB_FILE || path.join(DB_DIR, 'campana_kz.sqlite');

const BACKUPS_DIR = path.join(DB_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let sqlDb = null;

// Helper to save DB to disk
export function saveToDisk() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// Wrapper DB interface with transaction support
export const db = {
  exec(sql) {
    if (!sqlDb) throw new Error('Database not initialized');
    sqlDb.exec(sql);
    saveToDisk();
  },

  query(sql, params = []) {
    if (!sqlDb) throw new Error('Database not initialized');
    const stmt = sqlDb.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  queryOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  run(sql, params = []) {
    if (!sqlDb) throw new Error('Database not initialized');
    sqlDb.run(sql, params);
    
    const res = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as changes;');
    let lastInsertRowid = 0;
    let changes = 0;
    if (res.length > 0 && res[0].values.length > 0) {
      lastInsertRowid = res[0].values[0][0];
      changes = res[0].values[0][1];
    }
    
    saveToDisk();
    return { lastInsertRowid, changes };
  },

  transaction(fn) {
    if (!sqlDb) throw new Error('Database not initialized');
    sqlDb.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      sqlDb.exec('COMMIT;');
      saveToDisk();
      return result;
    } catch (err) {
      sqlDb.exec('ROLLBACK;');
      throw err;
    }
  }
};

// Create a verifiable backup of the current database state
export function createDatabaseBackup(reason = 'manual', userIdentifier = 'system', requestId = '') {
  if (!sqlDb) throw new Error('Database not initialized');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `backup_${timestamp}_req_${requestId || 'none'}_${sanitizedReason}.json`;
  const backupPath = path.join(BACKUPS_DIR, filename);

  const data = {
    metadata: {
      timestamp: new Date().toISOString(),
      reason,
      user: userIdentifier,
      requestId,
      version: '1.0.0'
    },
    tables: {
      users: db.query('SELECT id, name, email, role, zone, phone, active, created_at FROM users'),
      activities: db.query('SELECT * FROM activities'),
      contacts: db.query('SELECT * FROM contacts'),
      community_needs: (function() { try { return db.query('SELECT * FROM community_needs'); } catch(_) { return []; } })(),
      notification_queue: (function() { try { return db.query('SELECT * FROM notification_queue'); } catch(_) { return []; } })(),
      audit_logs: db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500')
    }
  };

  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(backupPath, jsonStr, 'utf-8');

  // Verify file written and size > 0
  const stats = fs.statSync(backupPath);
  if (!stats || stats.size === 0) {
    throw new Error('El archivo de respaldo generado está vacío o no se guardó.');
  }

  return {
    filename,
    filePath: backupPath,
    sizeBytes: stats.size,
    activitiesCount: data.tables.activities.length,
    usersCount: data.tables.users.length
  };
}

// Database initialization and idempotent migrations
export async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // 1. Users table with closed roles and zone support
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'candidato', 'coordinador', 'prensa', 'lider')),
      zone TEXT DEFAULT 'General',
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_login TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Activities table with is_demo flag and zone support
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'programado',
      location_name TEXT NOT NULL,
      location_address TEXT,
      location_url TEXT,
      zone TEXT DEFAULT 'General',
      responsible_id INTEGER,
      responsible_name TEXT NOT NULL,
      team_assigned TEXT,
      logistics_needed TEXT,
      notes TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Contacts / Groups table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_description TEXT NOT NULL,
      phone TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'comitiva',
      zone TEXT DEFAULT 'General',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Notifications Log table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      channel TEXT NOT NULL,
      provider TEXT DEFAULT 'assisted',
      provider_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      message_text TEXT NOT NULL,
      error_message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. WhatsApp Settings table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'assisted',
      api_url TEXT,
      api_token TEXT,
      account_sid TEXT,
      sender_phone TEXT,
      auto_reminders_enabled INTEGER DEFAULT 1,
      reminder_minutes_before INTEGER DEFAULT 60,
      daily_summary_time TEXT DEFAULT '07:00',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Strict Append-Only Audit Logs table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Community Needs table (Gestión Territorial y Solicitudes Ciudadanas)
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS community_needs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER,
      territory_id INTEGER,
      neighborhood TEXT NOT NULL,
      person_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (
        'Salud', 'Ayuda económica', 'Alimentación', 'Vivienda', 
        'Empleo', 'Educación', 'Documentos o trámites', 
        'Infraestructura o servicios públicos', 'Seguridad', 'Otro'
      )),
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Media' CHECK(priority IN ('Urgente', 'Alta', 'Media', 'Baja')),
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN (
        'pendiente', 'en_gestion', 'derivada', 'atendida', 'no_viable', 'cerrada'
      )),
      source TEXT NOT NULL DEFAULT 'whatsapp' CHECK(source IN ('whatsapp', 'manual', 'web')),
      source_message_id TEXT UNIQUE,
      external_ref TEXT,
      consent_contact INTEGER NOT NULL DEFAULT 1,
      assigned_to INTEGER,
      notes TEXT,
      follow_up_date TEXT,
      closed_at TEXT,
      closed_by INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_needs_status ON community_needs(status);
    CREATE INDEX IF NOT EXISTS idx_needs_neighborhood ON community_needs(neighborhood);
    CREATE INDEX IF NOT EXISTS idx_needs_source_msg ON community_needs(source_message_id);
  `);

  // 8. Idempotent Notification Queue table (Cola Resiliente con Dedupe y Backoff)
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS notification_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER,
      recipient_phone TEXT NOT NULL,
      recipient_name TEXT,
      notification_type TEXT NOT NULL,
      dedupe_key TEXT UNIQUE NOT NULL,
      provider TEXT DEFAULT 'assisted',
      provider_message_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'cancelled')),
      message_text TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      next_retry_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      dead_letter INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT,
      error_message TEXT,
      request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_queue_poll ON notification_queue(status, scheduled_for, dead_letter);
    CREATE INDEX IF NOT EXISTS idx_queue_dedupe ON notification_queue(dedupe_key);
  `);

  // Migrations: ensure columns exist if DB was created earlier
  runMigrations();

  // Seed default data if completely empty
  seedData();
  saveToDisk();
}

function runMigrations() {
  // Check if is_demo column exists in activities
  try {
    const actSample = db.query('SELECT * FROM activities LIMIT 1');
    if (actSample.length > 0 && actSample[0].is_demo === undefined) {
      db.exec('ALTER TABLE activities ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;');
      db.exec('ALTER TABLE activities ADD COLUMN zone TEXT DEFAULT "General";');
    }
  } catch (e) {
    // Column might already exist
  }

  // Check if zone/active/last_login exist in users
  try {
    const userSample = db.query('SELECT * FROM users LIMIT 1');
    if (userSample.length > 0) {
      if (userSample[0].zone === undefined) {
        db.exec('ALTER TABLE users ADD COLUMN zone TEXT DEFAULT "General";');
      }
      if (userSample[0].active === undefined) {
        db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;');
      }
      if (userSample[0].last_login === undefined) {
        db.exec('ALTER TABLE users ADD COLUMN last_login TEXT;');
      }
      if (userSample[0].updated_at === undefined) {
        try {
          db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT;');
        } catch (_) {}
      }
    }
  } catch (e) {
    // Column might already exist
  }

  // Ensure notifications_log has provider, provider_message_id, error_message
  try {
    try { db.exec("ALTER TABLE notifications_log ADD COLUMN provider TEXT DEFAULT 'assisted';"); } catch (_) {}
    try { db.exec("ALTER TABLE notifications_log ADD COLUMN provider_message_id TEXT;"); } catch (_) {}
    try { db.exec("ALTER TABLE notifications_log ADD COLUMN error_message TEXT;"); } catch (_) {}
  } catch (e) {}
}

function seedData() {
  const userCount = db.query('SELECT COUNT(*) as count FROM users')[0]?.count || 0;

  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('kz2026!', salt);

    const insertUserSql = `
      INSERT INTO users (name, email, password_hash, role, zone, phone, active) 
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;

    db.run(insertUserSql, ['Administrador General', 'admin@voyconelkz.com', defaultPasswordHash, 'admin', 'General', '+573001234567']);
    db.run(insertUserSql, ['Candidato KZ', 'candidato@voyconelkz.com', defaultPasswordHash, 'candidato', 'General', '+573109876543']);
    db.run(insertUserSql, ['Coordinador de Avanzada', 'avanzada@voyconelkz.com', defaultPasswordHash, 'coordinador', 'Central', '+573205557788']);
    db.run(insertUserSql, ['Jefe de Comunicaciones', 'prensa@voyconelkz.com', defaultPasswordHash, 'prensa', 'General', '+573114443322']);
    db.run(insertUserSql, ['Líder Comunal Zona Norte', 'lider.norte@voyconelkz.com', defaultPasswordHash, 'lider', 'Norte', '+573157778899']);

    // Log seed in audit
    db.run(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details_json, ip_address, user_agent, request_id)
      VALUES (1, 'SYSTEM_INIT', 'users', 'all', '{"message":"Usuarios iniciales creados para producción"}', '127.0.0.1', 'System/Init', 'init-seed')
    `);
  }

  const contactCount = db.query('SELECT COUNT(*) as count FROM contacts')[0]?.count || 0;
  if (contactCount === 0) {
    db.run(`INSERT INTO contacts (name, role_description, phone, category, zone) VALUES (?, ?, ?, ?, ?)`,
      ['Equipo Avanzada y Seguridad', 'Comitiva Principal', '+573009998877', 'comitiva', 'General']);
    db.run(`INSERT INTO contacts (name, role_description, phone, category, zone) VALUES (?, ?, ?, ?, ?)`,
      ['Coordinación de Prensa y Medios', 'Comunicaciones #VOYCONELKZ', '+573114443322', 'prensa', 'General']);
    db.run(`INSERT INTO contacts (name, role_description, phone, category, zone) VALUES (?, ?, ?, ?, ?)`,
      ['Líderes Barriales Zona Norte', 'Liderazgo Territorial', '+573157778899', 'lider_barrial', 'Norte']);
    db.run(`INSERT INTO contacts (name, role_description, phone, category, zone) VALUES (?, ?, ?, ?, ?)`,
      ['Logística y Transporte', 'Caravanas y Sonido', '+573005551234', 'logistica', 'General']);
  }

  const settingsCount = db.query('SELECT COUNT(*) as count FROM whatsapp_settings')[0]?.count || 0;
  if (settingsCount === 0) {
    db.run(`INSERT INTO whatsapp_settings (id, provider, auto_reminders_enabled, reminder_minutes_before, daily_summary_time) VALUES (1, 'assisted', 1, 60, '07:00')`);
  }

  // Ensure demo activities are explicitly marked with is_demo = 1
  const activityCount = db.query('SELECT COUNT(*) as count FROM activities')[0]?.count || 0;
  if (activityCount === 0) {
    const today = new Date().toISOString().split('T')[0];

    const insertDemoActivity = `
      INSERT INTO activities (
        title, description, date, start_time, end_time, category, status,
        location_name, location_address, location_url, zone, responsible_name, team_assigned,
        logistics_needed, notes, is_demo, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `;

    db.run(insertDemoActivity, [
      'Desayuno de Trabajo con Líderes Comunitarios',
      'Presentación del plan de infraestructura y diálogo con presidentes de Juntas de Acción Comunal.',
      today, '07:30', '09:30', 'reunion', 'cumplido',
      'Salón Comunal Barrio Kennedy', 'Carrera 15 # 45-20', 'https://maps.google.com/?q=Kennedy+Central',
      'Central', 'Carlos Mendoza (Avanzada)', 'Equipo Territorial 1 & Juventudes KZ',
      'Microfonía inalámbrica, 60 refrigerios, pendones #VOYCONELKZ', 'Confirmados 48 presidentes de junta.'
    ]);

    db.run(insertDemoActivity, [
      'Rueda de Prensa y Medios Locales',
      'Lanzamiento oficial de las propuestas de seguridad ciudadana y empleo juvenil.',
      today, '10:30', '12:00', 'prensa', 'en_curso',
      'Hotel Plaza Central - Sala Diamante', 'Calle 10 # 5-30', 'https://maps.google.com/?q=Hotel+Plaza+Central',
      'General', 'Laura Gómez (Prensa)', 'Equipo de Comunicaciones y Redes',
      'Atril con logo #VOY CON EL KZ, sistema de audio y kits de prensa', 'Asisten 14 periodistas.'
    ]);

    db.run(insertDemoActivity, [
      'Gran Caminata y Visita Puerta a Puerta',
      'Recorrido calle a calle saludando comerciantes y familias, entrega de volantes con propuestas.',
      today, '15:00', '18:00', 'recorrido', 'programado',
      'Sector Comercial El Progreso', 'Avenida Central con Calle 8', 'https://maps.google.com/?q=Avenida+Central',
      'Norte', 'Andrés Pardo (Coordinador Territorial)', 'Avanzada, Voluntariado Juvenil',
      'Megáfonos, 1500 volantes, 80 gorras, hidratación', 'Punto de encuentro: Parque Central.'
    ]);

    db.run(insertDemoActivity, [
      'Mitin Central y Concentración Ciudadana',
      'Discurso principal del candidato KZ, presentación de compromisos comunales con la comunidad.',
      today, '19:00', '21:30', 'mitin', 'programado',
      'Plaza de Banderas Los Libertadores', 'Plaza Principal', 'https://maps.google.com/?q=Plaza+Principal',
      'Central', 'Comité Político Central', 'Toda la comitiva de campaña & Seguridad',
      'Tarima con luces, sonido 5000W, pantalla LED, banderas', 'Estimado: 800 a 1200 simpatizantes.'
    ]);
  }
}

export default db;
