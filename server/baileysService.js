import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session storage folder (persists in Serv00 or local storage)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SESSION_DIR = path.join(DATA_DIR, 'whatsapp_session');

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

class BaileysManager {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrCodeDataUrl = null;
    this.connectedPhone = null;
    this.connectedName = null;
    this.lastConnectedAt = null;
    this.onIncomingNeedCallback = null;
    this.reconnectTimer = null;
    this.isManualDisconnect = false;
  }

  hasExistingSession() {
    return fs.existsSync(path.join(SESSION_DIR, 'creds.json'));
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'connected',
      qrCodeDataUrl: this.qrCodeDataUrl,
      connectedPhone: this.connectedPhone,
      phone: this.connectedPhone,
      connectedName: this.connectedName,
      name: this.connectedName,
      lastConnectedAt: this.lastConnectedAt,
      hasExistingSession: this.hasExistingSession(),
    };
  }

  setIncomingNeedCallback(callback) {
    this.onIncomingNeedCallback = callback;
  }

  async init(autoConnect = true) {
    if (autoConnect && this.hasExistingSession()) {
      console.log('[WHATSAPP QR] Sesión previa detectada. Reconectando automáticamente...');
      await this.connect();
    }
  }

  async connect() {
    if (this.status === 'connected' && this.sock) {
      return this.getStatus();
    }

    this.isManualDisconnect = false;
    this.status = 'connecting';
    this.qrCodeDataUrl = null;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      // Silent logger to prevent console clutter
      const logger = pino({ level: 'silent' });

      this.sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Campana KZ', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      // Save credentials update
      this.sock.ev.on('creds.update', saveCreds);

      // Connection state updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: '#0b1728', light: '#ffffff' }
            });
            this.status = 'qr_ready';
            console.log('[WHATSAPP QR] Código QR generado y listo para escanear en la plataforma.');
          } catch (qrErr) {
            console.error('[WHATSAPP QR ERROR]', qrErr.message);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeDataUrl = null;
          this.lastConnectedAt = new Date().toISOString();

          // Extract phone number from JID
          const rawId = this.sock.user?.id || '';
          const phoneOnly = rawId.split(':')[0].replace(/[^0-9]/g, '');
          this.connectedPhone = phoneOnly ? `+${phoneOnly}` : null;
          this.connectedName = this.sock.user?.name || 'Línea de Campaña';

          console.log(`\n======================================================`);
          console.log(`  🟢 WHATSAPP QR VINCULADO CON ÉXITO`);
          console.log(`  📱 Número conectado: ${this.connectedPhone} (${this.connectedName})`);
          console.log(`  💾 Sesión guardada en: ${SESSION_DIR}`);
          console.log(`======================================================\n`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isManualDisconnect;

          console.log(`[WHATSAPP QR] Conexión cerrada. Código: ${statusCode}. Reintentar: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut || this.isManualDisconnect) {
            await this.clearSession();
            this.status = 'disconnected';
            this.connectedPhone = null;
            this.connectedName = null;
            this.qrCodeDataUrl = null;
          } else if (shouldReconnect) {
            this.status = 'connecting';
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch((e) => console.error('[WHATSAPP RECONNECT ERROR]', e.message));
            }, 5000);
          } else {
            this.status = 'disconnected';
          }
        }
      });

      // Handle incoming messages (e.g., citizen needs starting with "NECESIDAD")
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue; // Ignore messages sent by the bot itself
          
          const fromJid = msg.key.remoteJid || '';
          if (fromJid.endsWith('@g.us') || fromJid === 'status@broadcast') continue; // Ignore groups and status

          const messageText = msg.message?.conversation || 
                              msg.message?.extendedTextMessage?.text || '';

          if (!messageText.trim()) continue;

          const senderPhone = '+' + fromJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');

          // If it starts with NECESIDAD, route to callback
          if (messageText.trim().toUpperCase().startsWith('NECESIDAD')) {
            console.log(`[WHATSAPP BOT] Mensaje de necesidad recibido de ${senderPhone}`);
            if (this.onIncomingNeedCallback) {
              try {
                const replyText = await this.onIncomingNeedCallback({
                  senderPhone,
                  messageText,
                  messageId: msg.key.id || `baileys-${Date.now()}`
                });

                if (replyText) {
                  await this.sock.sendMessage(fromJid, { text: replyText });
                }
              } catch (cbErr) {
                console.error('[WHATSAPP INCOMING NEED ERROR]', cbErr.message);
              }
            }
          }
        }
      });

    } catch (err) {
      console.error('[WHATSAPP INIT ERROR]', err.message);
      this.status = 'disconnected';
    }

    return this.getStatus();
  }

  async sendMessage({ to, text }) {
    if (this.status !== 'connected' || !this.sock) {
      return {
        success: false,
        status: 'not_connected',
        error: 'WhatsApp no está vinculado. Escanee el código QR en la pestaña Notificaciones WhatsApp primero.'
      };
    }

    try {
      let cleanPhone = to.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
        cleanPhone = '57' + cleanPhone;
      }
      const jid = `${cleanPhone}@s.whatsapp.net`;

      const result = await this.sock.sendMessage(jid, { text });

      return {
        success: true,
        status: 'sent',
        provider: 'baileys_qr',
        messageId: result.key?.id || `baileys-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('[WHATSAPP SEND ERROR]', err.message);
      return {
        success: false,
        status: 'failed',
        error: `Error al despachar mensaje por WhatsApp QR: ${err.message}`
      };
    }
  }

  async clearSession() {
    this.isManualDisconnect = true;
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (_) {}

    try {
      if (fs.existsSync(SESSION_DIR)) {
        const files = fs.readdirSync(SESSION_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(SESSION_DIR, file));
        }
      }
    } catch (err) {
      console.error('[WHATSAPP CLEAR SESSION ERROR]', err.message);
    }

    this.status = 'disconnected';
    this.qrCodeDataUrl = null;
    this.connectedPhone = null;
    this.connectedName = null;
    return this.getStatus();
  }
}

export const baileysManager = new BaileysManager();
