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


let sqlDb = null;

// Helper to save DB to disk
function saveToDisk() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

// Wrapper DB interface
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
    
    // Get last insert row id
    const res = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as changes;');
    let lastInsertRowid = 0;
    let changes = 0;
    if (res.length > 0 && res[0].values.length > 0) {
      lastInsertRowid = res[0].values[0][0];
      changes = res[0].values[0][1];
    }
    
    saveToDisk();
    return { lastInsertRowid, changes };
  }
};

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  // 1. Users table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'coordinador',
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Activities table
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
      responsible_id INTEGER,
      responsible_name TEXT NOT NULL,
      team_assigned TEXT,
      logistics_needed TEXT,
      notes TEXT,
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
      status TEXT NOT NULL DEFAULT 'sent',
      message_text TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. WhatsApp Settings table
  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'simulation',
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

  seedData();
  saveToDisk();
}

function seedData() {
  // Check users count
  const userRows = db.query('SELECT COUNT(*) as count FROM users');
  const userCount = userRows[0]?.count || 0;

  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('kz2026!', salt);

    db.run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ['Administrador de Campaña', 'admin@voyconelkz.com', defaultPasswordHash, 'admin', '+573001234567']
    );
    db.run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ['Candidato KZ', 'candidato@voyconelkz.com', defaultPasswordHash, 'candidato', '+573109876543']
    );
    db.run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ['Coordinador de Avanzada', 'avanzada@voyconelkz.com', defaultPasswordHash, 'coordinador', '+573205557788']
    );
  }

  // Check contacts count
  const contactRows = db.query('SELECT COUNT(*) as count FROM contacts');
  const contactCount = contactRows[0]?.count || 0;

  if (contactCount === 0) {
    db.run(
      `INSERT INTO contacts (name, role_description, phone, category) VALUES (?, ?, ?, ?)`,
      ['Equipo Avanzada y Seguridad', 'Comitiva Principal', '+573009998877', 'comitiva']
    );
    db.run(
      `INSERT INTO contacts (name, role_description, phone, category) VALUES (?, ?, ?, ?)`,
      ['Coordinación de Prensa y Medios', 'Comunicaciones #VOYCONELKZ', '+573114443322', 'prensa']
    );
    db.run(
      `INSERT INTO contacts (name, role_description, phone, category) VALUES (?, ?, ?, ?)`,
      ['Líderes Barriales Zona Norte', 'Liderazgo Territorial', '+573157778899', 'lider_barrial']
    );
    db.run(
      `INSERT INTO contacts (name, role_description, phone, category) VALUES (?, ?, ?, ?)`,
      ['Líderes Sector Comercio y Jóvenes', 'Juventudes KZ', '+573182221100', 'lider_barrial']
    );
    db.run(
      `INSERT INTO contacts (name, role_description, phone, category) VALUES (?, ?, ?, ?)`,
      ['Logística y Transporte', 'Caravanas y Sonido', '+573005551234', 'logistica']
    );
  }

  // Check settings
  const settingsRows = db.query('SELECT COUNT(*) as count FROM whatsapp_settings');
  const settingsCount = settingsRows[0]?.count || 0;

  if (settingsCount === 0) {
    db.run(
      `INSERT INTO whatsapp_settings (id, provider, auto_reminders_enabled, reminder_minutes_before, daily_summary_time) VALUES (1, 'simulation', 1, 60, '07:00')`
    );
  }

  // Check activities
  const activityRows = db.query('SELECT COUNT(*) as count FROM activities');
  const activityCount = activityRows[0]?.count || 0;

  if (activityCount === 0) {
    const today = new Date().toISOString().split('T')[0];
    
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    const dayAfterDate = new Date();
    dayAfterDate.setDate(dayAfterDate.getDate() + 2);
    const dayAfter = dayAfterDate.toISOString().split('T')[0];

    const insertActivitySql = `
      INSERT INTO activities (
        title, description, date, start_time, end_time, category, status,
        location_name, location_address, location_url, responsible_name, team_assigned,
        logistics_needed, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    // Today's activities
    db.run(insertActivitySql, [
      'Desayuno de Trabajo con Líderes Comunitarios',
      'Presentación del plan de infraestructura y diálogo con presidentes de Juntas de Acción Comunal.',
      today,
      '07:30',
      '09:30',
      'reunion',
      'cumplido',
      'Salón Comunal Barrio Kennedy',
      'Carrera 15 # 45-20',
      'https://maps.google.com/?q=Kennedy+Central',
      'Carlos Mendoza (Avanzada)',
      'Equipo Territorial 1 & Juventudes KZ',
      'Microfonía inalámbrica, 60 refrigerios, pendones #VOYCONELKZ',
      'Confirmados 48 presidentes de junta.'
    ]);

    db.run(insertActivitySql, [
      'Rueda de Prensa y Medios Locales',
      'Lanzamiento oficial de las propuestas de seguridad ciudadana y empleo juvenil.',
      today,
      '10:30',
      '12:00',
      'prensa',
      'en_curso',
      'Hotel Plaza Central - Sala Diamante',
      'Calle 10 # 5-30',
      'https://maps.google.com/?q=Hotel+Plaza+Central',
      'Laura Gómez (Prensa)',
      'Equipo de Comunicaciones y Redes',
      'Atril con logo #VOY CON EL KZ, sistema de audio y kits de prensa',
      'Asisten 14 periodistas de radio, televisión y medios digitales.'
    ]);

    db.run(insertActivitySql, [
      'Gran Caminata y Visita Puerta a Puerta',
      'Recorrido calle a calle saludando comerciantes y familias, entrega de volantes con propuestas.',
      today,
      '15:00',
      '18:00',
      'recorrido',
      'programado',
      'Sector Comercial El Progreso',
      'Avenida Central con Calle 8',
      'https://maps.google.com/?q=Avenida+Central',
      'Andrés Pardo (Coordinador Territorial)',
      'Avanzada, Voluntariado Juvenil (35 personas)',
      'Megáfonos, 1500 volantes, 80 gorras y camisetas #VOY CON EL KZ, hidratación',
      'Punto de encuentro: Parque Central frente a la iglesia.'
    ]);

    db.run(insertActivitySql, [
      'Mitin Central y Concentración Ciudadana',
      'Discurso principal del candidato KZ, presentación de compromisos comunales con la comunidad.',
      today,
      '19:00',
      '21:30',
      'mitin',
      'programado',
      'Plaza de Banderas Los Libertadores',
      'Plaza Principal',
      'https://maps.google.com/?q=Plaza+Principal',
      'Comité Político Central',
      'Toda la comitiva de campaña & Seguridad',
      'Tarima con luces, sonido profesional 5000W, 400 sillas, pantalla LED con logo KZ, banderas',
      'Estimado de asistencia: 800 a 1200 simpatizantes.'
    ]);

    // Tomorrow
    db.run(insertActivitySql, [
      'Entrevista en Emisora Radial La Voz del Pueblo',
      'Entrevista en vivo en el noticiero matutino sobre propuestas para madres cabeza de hogar.',
      tomorrow,
      '08:00',
      '09:00',
      'prensa',
      'programado',
      'Estudios Radial La Voz del Pueblo',
      'Carrera 7 # 12-40',
      'https://maps.google.com/?q=Estudios+Radial',
      'Laura Gómez (Prensa)',
      'Comunicaciones',
      'Grabación de clips para TikTok e Instagram en vivo',
      'Llegar 20 minutos antes para prueba de micrófonos.'
    ]);

    db.run(insertActivitySql, [
      'Gran Caravana de la Victoria #VOY CON EL KZ',
      'Caravana vehicular con motos y carros decorados recorriendo los principales sectores del municipio.',
      tomorrow,
      '16:30',
      '19:30',
      'caravana',
      'programado',
      'Punto de Salida: Glorieta Norte',
      'Glorieta Norte Km 2',
      'https://maps.google.com/?q=Glorieta+Norte',
      'Equipo Logístico y Transportadores',
      'Comitiva de avanzada & 120 vehículos inscritos',
      'Camión tarima con sonido móvil, banderas gigantes #VOY CON EL KZ, pitos y stickers vehiculares',
      'Coordinar con tránsito municipal la escolta vial.'
    ]);

    // Day after
    db.run(insertActivitySql, [
      'Encuentro con Jóvenes Universitarios',
      'Foro abierto sobre becas, emprendimiento y tecnología.',
      dayAfter,
      '14:00',
      '16:30',
      'reunion',
      'programado',
      'Auditorio Centro Cultural',
      'Calle 14 # 9-18',
      'https://maps.google.com/?q=Centro+Cultural',
      'Juventudes KZ',
      'Comité de Juventudes',
      'Sonido, proyector HDMI, banners fotográficos con el logo KZ',
      'Se rifarán 10 cupos para talleres de liderazgo.'
    ]);
  }
}

export default db;
