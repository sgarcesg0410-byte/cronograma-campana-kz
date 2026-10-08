import React, { useState, useEffect } from 'react';
import { Activity, Contact, NotificationLog, WhatsAppSettings } from '../types';
import { api } from '../services/api';
import { 
  MessageSquare, 
  Send, 
  Share2, 
  Copy, 
  Check, 
  Settings, 
  History, 
  Radio, 
  Users, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  Bot,
  Zap,
  Clock,
  Smartphone
} from 'lucide-react';

interface WhatsAppCenterViewProps {
  activities: Activity[];
  contacts: Contact[];
  selectedDate: string;
}

export const WhatsAppCenterView: React.FC<WhatsAppCenterViewProps> = ({
  activities,
  contacts,
  selectedDate,
}) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'automated' | 'settings' | 'logs'>('direct');
  
  // Direct Option 1 States
  const [messageType, setMessageType] = useState<'daily' | 'activity' | 'call_leaders'>('daily');
  const [targetActivityId, setTargetActivityId] = useState<number>(activities[0]?.id || 0);
  const [selectedContactPhone, setSelectedContactPhone] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [previewData, setPreviewData] = useState<{ title: string; messageText: string; directLink: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Automated Option 2 States
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [sendingSingle, setSendingSingle] = useState(false);

  // Load preview whenever direct params change
  useEffect(() => {
    fetchPreview();
  }, [messageType, targetActivityId, selectedDate, selectedContactPhone, customPhone]);

  // Load settings & logs
  useEffect(() => {
    loadSettingsAndLogs();
  }, [activeTab]);

  const loadSettingsAndLogs = async () => {
    try {
      const [s, l] = await Promise.all([api.getWhatsAppSettings(), api.getWhatsAppLogs()]);
      setSettings(s);
      setLogs(l);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const phone = customPhone || selectedContactPhone;
      const data = await api.getWhatsAppPreview(messageType, {
        date: selectedDate,
        activityId: targetActivityId || undefined,
        phone: phone || undefined,
      });
      setPreviewData(data);
    } catch (err) {
      console.error('Error fetching preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCopy = () => {
    if (!previewData) return;
    navigator.clipboard.writeText(previewData.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Automated direct API send
  const handleSendViaApi = async () => {
    if (!previewData) return;
    const phone = customPhone || selectedContactPhone || 'Comitiva General';
    setSendingSingle(true);
    try {
      const res = await api.sendAutomatedWhatsApp({
        phone,
        recipientName: 'Contacto / Grupo Seleccionado',
        messageText: previewData.messageText,
        activityId: messageType !== 'daily' ? targetActivityId : undefined,
      });
      alert(res.message);
      loadSettingsAndLogs();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSendingSingle(false);
    }
  };

  // Broadcast Daily to all active contacts
  const handleBroadcastDaily = async () => {
    if (!confirm(`¿Confirma el envío de la agenda del día a todos los ${contacts.filter(c => c.active).length} contactos activos?`)) return;
    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await api.broadcastDaily(selectedDate);
      setBroadcastResult(res.message);
      loadSettingsAndLogs();
    } catch (err: any) {
      alert('Error en difusión: ' + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await api.updateWhatsAppSettings(settings);
      alert('Configuración guardada exitosamente');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-sm border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              SISTEMA DUAL DE WHATSAPP
            </span>
            <span className="text-xs text-slate-400 font-mono">#VOY CON EL KZ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            Notificaciones y Difusión de Agenda por WhatsApp
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Comparte la hoja de ruta con 1-clic a WhatsApp Web/Móvil o despacha notificaciones automáticas y masivas vía API a toda la comitiva.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 self-start md:self-center">
          <button
            onClick={() => setActiveTab('direct')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'direct' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Opción 1: 1-Clic Web</span>
          </button>
          <button
            onClick={() => setActiveTab('automated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'automated' ? 'bg-[#38b6ff] text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Opción 2: Gateway API</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({logs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
            title="Configuración de Proveedor"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TAB 1: 1-CLIC DIRECT (WHATSAPP WEB / MOBILE) */}
      {activeTab === 'direct' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Message Generator Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 font-heading flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                Configurar Mensaje para WhatsApp
              </h3>

              {/* Message Type */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Tipo de Contenido a Difundir
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'daily', label: 'Agenda Hoy' },
                    { id: 'activity', label: 'Actividad' },
                    { id: 'call_leaders', label: 'Convocatoria' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMessageType(t.id as any)}
                      className={`text-xs font-bold py-2 px-2 rounded-xl border text-center transition-all ${
                        messageType === t.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Activity (if not daily) */}
              {messageType !== 'daily' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Seleccionar Actividad Específica
                  </label>
                  <select
                    value={targetActivityId}
                    onChange={(e) => setTargetActivityId(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.start_time} - {act.title} ({act.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient from Contacts */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>Destinatario de Campaña (Opcional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Para enviar a un chat directo</span>
                </label>
                <select
                  value={selectedContactPhone}
                  onChange={(e) => {
                    setSelectedContactPhone(e.target.value);
                    if (e.target.value) setCustomPhone('');
                  }}
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none mb-2"
                >
                  <option value="">-- Sin contacto específico (Abrir selector de WhatsApp) --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.phone}>
                      {c.name} ({c.role_description} - {c.phone})
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="O escribir número celular (ej. 3001234567)"
                    value={customPhone}
                    onChange={(e) => {
                      setCustomPhone(e.target.value);
                      if (e.target.value) setSelectedContactPhone('');
                    }}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2 pl-3 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {previewData && (
                  <a
                    href={previewData.directLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/30 transition-all text-center"
                  >
                    <Send className="w-4 h-4" />
                    <span>Abrir en WhatsApp (1-Clic)</span>
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCopy}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>

                  <button
                    onClick={handleSendViaApi}
                    disabled={sendingSingle}
                    className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>{sendingSingle ? 'Enviando...' : 'Despachar API'}</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Quick helper tip */}
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                <strong>Ideal para coordinadores de campaña:</strong> El botón "Abrir en WhatsApp" funciona directamente en navegadores y en la app móvil oficial sin necesidad de configurar servidores de mensajería pagos.
              </p>
            </div>
          </div>

          {/* Right: WhatsApp Chat Bubble Live Preview */}
          <div className="lg:col-span-7">
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
              
              {/* WhatsApp App Mock Header */}
              <div className="bg-[#075e54] text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo-kz.jpg"
                    alt="Logo KZ"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40"
                  />
                  <div>
                    <h4 className="font-bold text-sm leading-tight">
                      Campaña #VOY CON EL KZ 🔵⚪
                    </h4>
                    <p className="text-[11px] text-emerald-200">
                      Vista previa del formato en WhatsApp
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded font-mono text-emerald-100">
                  Formato Oficial
                </span>
              </div>

              {/* Chat Canvas (WhatsApp wallpaper look) */}
              <div className="p-4 sm:p-6 bg-[#efeae2] min-h-[440px] flex flex-col justify-end">
                {loadingPreview ? (
                  <div className="text-center py-12 text-slate-500 font-medium text-xs">
                    Generando plantilla...
                  </div>
                ) : previewData ? (
                  <div className="max-w-[92%] sm:max-w-[85%] self-end bg-[#dcf8c6] p-3.5 sm:p-4 rounded-2xl rounded-tr-none shadow-md border border-emerald-200/60 text-slate-800 text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {previewData.messageText}
                    <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-500">
                      <span>12:00 PM</span>
                      <Check className="w-3 h-3 text-[#34b7f1]" />
                      <Check className="w-3 h-3 text-[#34b7f1] -ml-2" />
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* TAB 2: AUTOMATED GATEWAY & BROADCAST */}
      {activeTab === 'automated' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Broadcast Daily to All Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-sky-50 text-[#38b6ff] rounded-2xl flex items-center justify-center border border-sky-100">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Difusión Masiva de Agenda del Día
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Despacha la agenda completa de hoy por API a todos los contactos y grupos activos registrados ({contacts.filter(c => c.active).length} destinatarios).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between text-slate-600">
                  <span>Fecha seleccionada:</span>
                  <span className="font-bold text-slate-900">{selectedDate}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Proveedor actual:</span>
                  <span className="font-bold text-emerald-700 uppercase">{settings?.provider || 'SIMULACIÓN'}</span>
                </div>
              </div>

              <button
                onClick={handleBroadcastDaily}
                disabled={isBroadcasting}
                className="w-full bg-[#38b6ff] hover:bg-[#1ea1f0] text-slate-950 font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isBroadcasting ? 'Despachando difusión...' : 'Disparar Difusión Masiva Ahora'}</span>
              </button>

              {broadcastResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
                  {broadcastResult}
                </div>
              )}
            </div>

            {/* Cron & Auto-Reminders Status Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Planificador de Recordatorios Automáticos (Cron)
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  El servidor de campaña supervisa en segundo plano las actividades programadas y despacha alertas automáticas antes de cada evento.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-medium">Estado del Cron:</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Activo y Supervisando
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-medium">Anticipación de Alerta:</span>
                  <span className="font-bold text-slate-900">
                    {settings?.reminder_minutes_before || 60} minutos antes
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 font-medium">Frecuencia de escaneo:</span>
                  <span className="font-bold text-slate-900">Cada 10 minutos</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('settings')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition-colors"
              >
                Ajustar tiempos en Configuración
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS (API PROVIDERS & CRON) */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
          <h3 className="text-lg font-black text-slate-900 font-heading mb-1 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#38b6ff]" />
            Configuración del Conector de WhatsApp
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Selecciona si deseas operar en modo de simulación o conectar tu proveedor de mensajería empresarial.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs sm:text-sm">
            
            {/* Provider selection */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Proveedor de Envío
              </label>
              <select
                value={settings.provider}
                onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-[#38b6ff]"
              >
                <option value="simulation">Simulador Activo de Campaña (Recomendado sin costo / Pruebas)</option>
                <option value="twilio">Twilio WhatsApp Business API</option>
                <option value="evolution_api">Evolution API / Baileys (WhatsApp conectado por QR)</option>
                <option value="meta_cloud">Meta WhatsApp Cloud API (Oficial)</option>
              </select>
            </div>

            {settings.provider !== 'simulation' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    API URL / Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.api_url || ''}
                    onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                    placeholder="https://api.twilio.com o http://localhost:8080"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    API Token / Auth Secret
                  </label>
                  <input
                    type="password"
                    value={settings.api_token || ''}
                    onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                    placeholder="Token secreto"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  />
                </div>

                {settings.provider === 'twilio' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={settings.account_sid || ''}
                      onChange={(e) => setSettings({ ...settings, account_sid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Automation parameters */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_reminders"
                  checked={Boolean(settings.auto_reminders_enabled)}
                  onChange={(e) => setSettings({ ...settings, auto_reminders_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="auto_reminders" className="font-bold text-slate-800 cursor-pointer">
                  Activar recordatorios automáticos de eventos próximos (Background Cron)
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Anticipación de recordatorio (Minutos antes del evento)
                </label>
                <input
                  type="number"
                  min="15"
                  max="180"
                  value={settings.reminder_minutes_before}
                  onChange={(e) => setSettings({ ...settings, reminder_minutes_before: Number(e.target.value) })}
                  className="w-32 border border-slate-300 rounded-lg p-2 bg-slate-50"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-[#38b6ff] hover:bg-[#20a7f5] text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-sm transition-transform hover:scale-105"
              >
                Guardar Configuración
              </button>
            </div>

          </form>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-black text-slate-900 font-heading text-base flex items-center gap-2">
              <History className="w-5 h-5 text-[#38b6ff]" />
              Registro Histórico de Notificaciones WhatsApp Despachadas
            </h3>
            <button
              onClick={loadSettingsAndLogs}
              className="text-xs text-[#38b6ff] hover:underline font-bold"
            >
              Actualizar Lista
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-heading font-black uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Destinatario</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Actividad Vinculada</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No hay registros de envíos aún.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {log.sent_at}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {log.recipient_name}
                        <span className="block font-normal text-slate-500 font-mono text-[10px]">
                          {log.recipient_phone}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {log.activity_title || 'Agenda Completa'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <Check className="w-2.5 h-2.5" />
                          {log.status === 'sent' ? 'Despachado' : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
