import React, { useState, useEffect } from 'react';
import { Activity, AuthorizedRecipient, CampaignRole, Contact, NotificationLog, WhatsAppSettings, TestLiveWhatsAppResponse, BaileysStatus } from '../types';
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
  Smartphone,
  ShieldCheck,
  Activity as PulseIcon,
  Trash2,
  UserPlus,
  Shield,
  Moon,
  Bell,
  BellOff,
  AlertTriangle,
  QrCode,
  RefreshCw,
  Power
} from 'lucide-react';


const CAMPAIGN_ROLE_LABELS: Record<CampaignRole, string> = {
  admin: 'Administrador General',
  candidato: 'Candidato (#VOY CON EL KZ)',
  coordinador: 'Coordinador General / Logístico',
  prensa: 'Comunicaciones y Prensa',
  lider: 'Líder Comunal / Territorial',
  avanzada: 'Equipo de Avanzada / Seguridad',
};

const CAMPAIGN_ROLE_BADGES: Record<CampaignRole, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  candidato: 'bg-amber-100 text-amber-800 border-amber-200',
  coordinador: 'bg-blue-100 text-blue-800 border-blue-200',
  prensa: 'bg-pink-100 text-pink-800 border-pink-200',
  lider: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  avanzada: 'bg-orange-100 text-orange-800 border-orange-200',
};

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

  // New Authorized Recipient Form States & Feedback
  const [newAuthName, setNewAuthName] = useState<string>('');
  const [newAuthPhone, setNewAuthPhone] = useState<string>('+57');
  const [newAuthRole, setNewAuthRole] = useState<CampaignRole>('coordinador');
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [settingsStatusMsg, setSettingsStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Test Diagnostic States
  const [testPhone, setTestPhone] = useState<string>('+57');
  const [testCustomMsg, setTestCustomMsg] = useState<string>('');
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<TestLiveWhatsAppResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleRunTestLive = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError(null);
    setTestResult(null);
    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!testPhone || !phoneRegex.test(testPhone.trim())) {
      setTestError('Formato de teléfono inválido. Debe usar formato internacional E.164 (Ej. +573001234567).');
      return;
    }
    setTestLoading(true);
    try {
      const res = await api.testLiveWhatsApp(testPhone.trim(), testCustomMsg.trim() || undefined);
      setTestResult(res);
      await loadSettingsAndLogs();
    } catch (err: any) {
      setTestError(err.message || 'Error al ejecutar prueba de WhatsApp.');
    } finally {
      setTestLoading(false);
    }
  };

  // Load preview whenever direct params change
  useEffect(() => {
    fetchPreview();
  }, [messageType, targetActivityId, selectedDate, selectedContactPhone, customPhone]);

  // Native Baileys QR States
  const [baileysStatus, setBaileysStatus] = useState<BaileysStatus | null>(null);
  const [baileysLoading, setBaileysLoading] = useState<boolean>(false);
  const [baileysError, setBaileysError] = useState<string | null>(null);

  const loadBaileysStatus = async () => {
    try {
      const status = await api.getBaileysStatus();
      setBaileysStatus(status);
    } catch (_) {}
  };

  const handleConnectBaileys = async () => {
    setBaileysLoading(true);
    setBaileysError(null);
    try {
      const res = await api.connectBaileys();
      setBaileysStatus(res.data);
    } catch (err: any) {
      setBaileysError(err.message || 'Error al conectar QR');
    } finally {
      setBaileysLoading(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    if (!confirm('¿Seguro que deseas desconectar y cerrar la sesión de WhatsApp en el servidor?')) return;
    setBaileysLoading(true);
    setBaileysError(null);
    try {
      const res = await api.disconnectBaileys();
      setBaileysStatus(res.data);
    } catch (err: any) {
      setBaileysError(err.message || 'Error al desconectar');
    } finally {
      setBaileysLoading(false);
    }
  };

  // Load settings & logs
  useEffect(() => {
    loadSettingsAndLogs();
    if (activeTab === 'settings') {
      loadBaileysStatus();
      const interval = setInterval(() => {
        loadBaileysStatus();
      }, 3500);
      return () => clearInterval(interval);
    }
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

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!settings) return;

    const trimmedName = newAuthName.trim();
    const trimmedPhone = newAuthPhone.trim();
    const phoneRegex = /^\+[1-9]\d{7,14}$/;

    if (trimmedName.length < 2) {
      setAuthError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!phoneRegex.test(trimmedPhone)) {
      setAuthError('El teléfono debe tener formato internacional E.164 (Ej. +573001234567).');
      return;
    }

    const currentList = settings.authorized_phones || [];
    if (currentList.length >= 20) {
      setAuthError('Se ha alcanzado el límite máximo de 20 destinatarios autorizados.');
      return;
    }

    if (currentList.some(r => r.phone === trimmedPhone)) {
      setAuthError(`El número ${trimmedPhone} ya existe en la lista de destinatarios.`);
      return;
    }

    const updatedList: AuthorizedRecipient[] = [
      ...currentList,
      {
        name: trimmedName,
        phone: trimmedPhone,
        role: newAuthRole,
        active: true,
      }
    ];

    setSettings({
      ...settings,
      authorized_phones: updatedList,
    });
    setNewAuthName('');
    setNewAuthPhone('+57');
    setNewAuthRole('coordinador');
  };

  const handleRemoveRecipient = (indexToRemove: number) => {
    if (!settings) return;
    const currentList = settings.authorized_phones || [];
    const updatedList = currentList.filter((_, idx) => idx !== indexToRemove);
    setSettings({
      ...settings,
      authorized_phones: updatedList,
    });
  };

  const handleToggleRecipient = (indexToToggle: number) => {
    if (!settings) return;
    const currentList = settings.authorized_phones || [];
    const updatedList = currentList.map((rec, idx) => {
      if (idx === indexToToggle) {
        return { ...rec, active: !rec.active };
      }
      return rec;
    });
    setSettings({
      ...settings,
      authorized_phones: updatedList,
    });
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    setSettingsStatusMsg(null);
    try {
      const updated = await api.updateWhatsAppSettings(settings);
      setSettings(updated);
      setSettingsStatusMsg({ type: 'success', text: 'Configuración de WhatsApp guardada exitosamente.' });
      setTimeout(() => setSettingsStatusMsg(null), 4000);
    } catch (err: any) {
      setSettingsStatusMsg({ type: 'error', text: err.message || 'Error al guardar la configuración' });
    } finally {
      setSettingsSaving(false);
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'settings' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white bg-slate-700/50'
            }`}
            title="Configuración de Proveedor y Vinculación QR"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configuración & QR</span>
          </button>
        </div>
      </div>

      {/* TAB 1: 1-CLIC DIRECT (WHATSAPP WEB / MOBILE) */}
      {activeTab === 'direct' && (
        <div className="space-y-4">
          {/* Banner de acceso directo a Código QR */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">¿Deseas vincular la línea de WhatsApp de la campaña con Código QR?</span>
                <span className="text-slate-600 text-xs">Conecta el celular oficial para que el sistema despache alertas y reciba necesidades ciudadanas sin costo.</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm whitespace-nowrap self-start sm:self-center flex items-center gap-1.5"
            >
              <span>Vincular por Código QR</span>
              <span>➡️</span>
            </button>
          </div>

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
      </div>
      )}

      {/* TAB 2: AUTOMATED GATEWAY & BROADCAST */}
      {activeTab === 'automated' && (
        <div className="space-y-6">
          {/* Quick QR Setup Notice */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Línea de Salida de WhatsApp Oficial</h4>
                <p className="text-xs text-slate-400">
                  Proveedor: <strong className="text-[#38b6ff] uppercase">{settings?.provider || 'Sin configurar'}</strong>
                  {baileysStatus?.connected ? (
                    <span className="text-emerald-400 ml-2 font-bold">● Conectado ({baileysStatus.phone})</span>
                  ) : (
                    <span className="text-amber-400 ml-2 font-medium">● Sin vincular por QR</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 self-start sm:self-center transition shadow-sm"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{baileysStatus?.connected ? 'Administrar Conexión QR' : 'Vincular por Código QR'}</span>
            </button>
          </div>

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

          {/* Controlled Live Test Diagnostic Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                  <PulseIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    Diagnóstico y Despacho de Prueba en Tiempo Real
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verificación de canal oficial con proveedor activo (Meta Cloud, Twilio o Simulador)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                Rate Limit: 5 envíos / 15 min
              </span>
            </div>

            {testError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{testError}</span>
              </div>
            )}

            {testResult && (
              <div className={`p-4 rounded-xl text-xs space-y-1.5 border ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Resultado del Despacho: {testResult.note || 'Completado'}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Proveedor:</span>
                    <span className="font-bold uppercase text-slate-800">{testResult.provider}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estado:</span>
                    <span className="font-bold text-slate-800">{testResult.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Message ID:</span>
                    <span className="font-bold text-slate-800 truncate block">{testResult.messageId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Intentos Restantes:</span>
                    <span className="font-bold text-slate-800">{testResult.remainingAttempts ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleRunTestLive} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Número de Destino de Prueba (E.164) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+573001234567"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-sm focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Escriba su número con indicativo internacional para recibir el mensaje de verificación.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Texto Personalizado (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Mensaje de prueba oficial..."
                    value={testCustomMsg}
                    onChange={(e) => setTestCustomMsg(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Si se deja vacío, se enviará la plantilla oficial #VOY CON EL KZ.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={testLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {testLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Despachar Mensaje de Prueba en Vivo</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* TAB 3: SETTINGS (PRIMARY PHONE, AUTHORIZED RECIPIENTS, ALERTS, QUIET HOURS & PROVIDER) */}
      {activeTab === 'settings' && settings && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-4xl space-y-8">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-[#38b6ff]/10 text-[#0284c7] rounded-xl flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5 text-[#38b6ff]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-heading">
                    Centro de Configuración de WhatsApp y Notificaciones en Tiempo Real
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina el número principal de campaña, destinatarios autorizados, disparadores automáticos, horas silenciosas y canal de salida.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Zona: America/Bogota (UTC-5)
              </span>
            </div>
          </div>

          {settingsStatusMsg && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 border ${
              settingsStatusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {settingsStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{settingsStatusMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-8 text-xs sm:text-sm">
            
            {/* SECCIÓN 1: NÚMERO PRINCIPAL Y DISPARADORES EN TIEMPO REAL */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#38b6ff]" />
                  <h4 className="font-black text-slate-900 font-heading text-sm uppercase tracking-wide">
                    1. Destinatario Principal y Disparadores Automáticos
                  </h4>
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  Despacho en segundos vía cola de mensajería
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Número Principal de WhatsApp de Campaña (E.164) *
                </label>
                <div className="max-w-md">
                  <input
                    type="text"
                    required
                    placeholder="+573001234567"
                    value={settings.primary_phone || ''}
                    onChange={(e) => setSettings({ ...settings, primary_phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-sm bg-white text-slate-900 focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Número al que se remitirán todas las alertas de alta prioridad (candidato, jefe de campaña o central operativa).
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-2">
                  Eventos que Disparan Mensajes Automáticos Inmediatos:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-[#38b6ff] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_create !== 0}
                      onChange={(e) => setSettings({ ...settings, notify_on_create: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">📢 Creación de Eventos</span>
                      <span className="text-[11px] text-slate-500">
                        Envía alerta instantánea en segundos apenas el evento se guarda en la base de datos.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-[#38b6ff] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_update !== 0}
                      onChange={(e) => setSettings({ ...settings, notify_on_update: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">⚠️ Cambios Relevantes en la Agenda</span>
                      <span className="text-[11px] text-slate-500">
                        Diff inteligente: solo avisa si cambia fecha, hora, lugar o responsable (omite notas internas).
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-[#38b6ff] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_cancel !== 0}
                      onChange={(e) => setSettings({ ...settings, notify_on_cancel: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">🚫 Cancelación Inmediata</span>
                      <span className="text-[11px] text-slate-500">
                        Aviso urgente de cancelación y anulación en cascada de recordatorios programados en cola.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-[#38b6ff] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.notify_on_reminders !== 0}
                      onChange={(e) => setSettings({ ...settings, notify_on_reminders: e.target.checked ? 1 : 0 })}
                      className="mt-0.5 rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">⏰ Recordatorios Escalonados</span>
                      <span className="text-[11px] text-slate-500">
                        Encola automáticamente recordatorios a 7 días, 3 días, 1 día antes y el mismo día al salir.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: DESTINATARIOS AUTORIZADOS DINÁMICOS */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#38b6ff]" />
                  <h4 className="font-black text-slate-900 font-heading text-sm uppercase tracking-wide">
                    2. Destinatarios Autorizados para Alertas
                  </h4>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  (settings.authorized_phones?.length || 0) >= 20
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {settings.authorized_phones?.length || 0} / 20 destinatarios
                </span>
              </div>

              <p className="text-xs text-slate-600">
                Contactos clave que recibirán las notificaciones automáticas según su rol (Candidato, Coordinador, Prensa, Líderes o Avanzada).
              </p>

              {/* Formulario Inline para Agregar Destinatario */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#38b6ff]" />
                  Agregar Nuevo Destinatario Autorizado
                </h5>

                {authError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej. Dra. Claudia Morales"
                      value={newAuthName}
                      onChange={(e) => setNewAuthName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">WhatsApp (E.164)</label>
                    <input
                      type="text"
                      placeholder="+573001234567"
                      value={newAuthPhone}
                      onChange={(e) => setNewAuthPhone(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Rol en Campaña</label>
                    <select
                      value={newAuthRole}
                      onChange={(e) => setNewAuthRole(e.target.value as CampaignRole)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                    >
                      <option value="coordinador">Coordinador</option>
                      <option value="candidato">Candidato</option>
                      <option value="prensa">Prensa</option>
                      <option value="lider">Líder</option>
                      <option value="avanzada">Avanzada</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      className="w-full bg-[#38b6ff] hover:bg-[#20a7f5] text-slate-950 font-bold p-2 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
                      title="Agregar destinatario a la lista"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Destinatarios Actuales */}
              <div className="space-y-2">
                {(!settings.authorized_phones || settings.authorized_phones.length === 0) ? (
                  <div className="p-4 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    No hay destinatarios autorizados adicionales configurados. Las notificaciones se enviarán exclusivamente al número principal.
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {settings.authorized_phones.map((rec, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            rec.active ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs truncate ${rec.active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                                {rec.name}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                CAMPAIGN_ROLE_BADGES[rec.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {CAMPAIGN_ROLE_LABELS[rec.role] || rec.role}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 block">
                              {rec.phone}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRecipient(idx)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                              rec.active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={rec.active ? 'Desactivar notificaciones para este contacto' : 'Activar notificaciones para este contacto'}
                          >
                            {rec.active ? (
                              <>
                                <Bell className="w-3 h-3 text-emerald-600" />
                                <span>Activo</span>
                              </>
                            ) : (
                              <>
                                <BellOff className="w-3 h-3 text-slate-400" />
                                <span>Inactivo</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar de la lista de destinatarios"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 3: HORAS SILENCIOSAS (AMERICA/BOGOTA UTC-5) */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-black text-slate-900 font-heading text-sm uppercase tracking-wide">
                    3. Horas Silenciosas Nocturnas (America/Bogota)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="quiet_hours_enabled"
                    checked={settings.quiet_hours_enabled !== 0}
                    onChange={(e) => setSettings({ ...settings, quiet_hours_enabled: e.target.checked ? 1 : 0 })}
                    className="rounded text-[#38b6ff] focus:ring-[#38b6ff] w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="quiet_hours_enabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Activar Descanso Nocturno
                  </label>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                <Moon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Política de Mensajería Nocturna Protegida:</p>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    Los recordatorios no urgentes programados durante este rango son postergados automáticamente para despacharse a las 06:00 AM del día siguiente.
                    <span className="font-bold underline ml-1">
                      Las cancelaciones de eventos y modificaciones urgentes NUNCA se silencian y se despachan de inmediato.
                    </span>
                  </p>
                </div>
              </div>

              {settings.quiet_hours_enabled !== 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 max-w-md">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Inicio de Horas Silenciosas (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_start || '22:00'}
                      onChange={(e) => setSettings({ ...settings, quiet_hours_start: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-xs bg-white focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Fin de Horas Silenciosas (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_end || '06:00'}
                      onChange={(e) => setSettings({ ...settings, quiet_hours_end: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl p-2.5 font-mono text-xs bg-white focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 4: PROVEEDOR DE MENSAJERÍA Y CREDENCIALES */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#38b6ff]" />
                  <h4 className="font-black text-slate-900 font-heading text-sm uppercase tracking-wide">
                    4. Proveedor de Salida de WhatsApp
                  </h4>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  Proveedor de Envío Activo
                </label>
                <select
                  value={settings.provider}
                  onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                >
                  <option value="baileys_qr">📱 WhatsApp Nativo por Código QR (Serv00 / Local - Sin API de Pago)</option>
                  <option value="simulation">Simulador Activo de Campaña (Recomendado sin costo / Pruebas)</option>
                  <option value="meta_cloud">Meta WhatsApp Cloud API (Oficial para Producción)</option>
                  <option value="twilio">Twilio WhatsApp Business API (Oficial)</option>
                  <option value="evolution_api">Evolution API (Servidor Externo Docker)</option>
                </select>
              </div>

              {/* PANEL DE CONTROL VINCULACIÓN DIRECTA POR CÓDIGO QR (BAILEYS) */}
              {settings.provider === 'baileys_qr' && (
                <div className="p-5 bg-white rounded-2xl border-2 border-emerald-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 font-heading text-sm">
                          Vinculación Nativa por Código QR (Serv00 / Servidor)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Conecta la línea real de WhatsApp de la campaña sin costos de API ni servidores intermedios.
                        </p>
                      </div>
                    </div>

                    {baileysStatus && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        baileysStatus.connected 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : baileysStatus.status === 'qr_ready'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          baileysStatus.connected ? 'bg-emerald-500' : baileysStatus.status === 'qr_ready' ? 'bg-amber-500 animate-ping' : 'bg-slate-400'
                        }`} />
                        {baileysStatus.connected 
                          ? 'Conectado y Operativo' 
                          : baileysStatus.status === 'qr_ready' 
                          ? 'Esperando Escaneo QR' 
                          : baileysStatus.status === 'connecting'
                          ? 'Iniciando...'
                          : 'Desconectado'}
                      </span>
                    )}
                  </div>

                  {/* Alerta de Error si ocurre */}
                  {baileysError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{baileysError}</span>
                    </div>
                  )}

                  {/* Estado 1: CONECTADO */}
                  {baileysStatus?.connected ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-slate-900 text-sm">
                              WhatsApp Vinculado Exitosamente
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            Línea activa: <strong className="text-slate-900 font-mono text-sm">{baileysStatus.phone || 'Desconocido'}</strong> ({baileysStatus.name || 'Campaña'})
                          </p>
                          {baileysStatus.lastConnectedAt && (
                            <p className="text-[11px] text-slate-500">
                              Última conexión: {new Date(baileysStatus.lastConnectedAt).toLocaleString('es-CO')}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleDisconnectBaileys}
                          disabled={baileysLoading}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 self-start sm:self-center"
                        >
                          <Power className="w-4 h-4" />
                          <span>Desvincular y Cerrar Sesión</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-emerald-800 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                        💡 Todas las notificaciones del cronograma (7d / 3d / 1d / salida) y la recepción comunitaria de necesidades por WhatsApp se enviarán y responderán desde este número.
                      </div>
                    </div>
                  ) : baileysStatus?.qrCodeDataUrl ? (
                    /* Estado 2: QR LISTO PARA ESCANEAR */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 items-center">
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner border border-slate-200">
                        <img
                          src={baileysStatus.qrCodeDataUrl}
                          alt="Código QR de WhatsApp"
                          className="w-56 h-56 object-contain rounded-lg"
                        />
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleConnectBaileys}
                            disabled={baileysLoading}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${baileysLoading ? 'animate-spin' : ''}`} />
                            <span>Regenerar Código</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-black text-slate-900 text-xs uppercase tracking-wider font-heading">
                          Instrucciones para Vincular el Celular de la Campaña:
                        </h5>
                        <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                          <li>Abre <strong>WhatsApp</strong> en el teléfono móvil destinado a la campaña.</li>
                          <li>Toca <strong>Menú (⋮)</strong> en Android o <strong>Ajustes (⚙️)</strong> en iPhone.</li>
                          <li>Selecciona <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
                          <li>Apunta la cámara del celular hacia este código QR para sincronizarlo.</li>
                        </ol>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
                          ⚠️ <strong>Recomendación Operativa:</strong> Usa una línea móvil dedicada para la campaña para preservar la privacidad de los líderes y del candidato.
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Estado 3: DESCONECTADO / ESPERANDO INICIO */
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto text-slate-600">
                        <Smartphone className="w-6 h-6 text-[#38b6ff]" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">
                          WhatsApp no está vinculado en este momento
                        </h5>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                          Genera un código QR para escanearlo con el teléfono de campaña. La sesión se guardará persistentemente en el servidor.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectBaileys}
                        disabled={baileysLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md text-xs transition inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {baileysLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <QrCode className="w-4 h-4" />
                        )}
                        <span>{baileysLoading ? 'Generando Código QR...' : 'Generar Código QR de Vinculación'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Advertencia Crítica para Bot Conectado por QR Externo */}
              {settings.provider === 'evolution_api' && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs space-y-2 text-amber-950">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>ADVERTENCIA CRÍTICA DE SEGURIDAD OPERATIVA (BOT QR)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    WhatsApp prohíbe el uso de bots no oficiales en números personales y puede aplicar bloqueos o suspensiones por envíos masivos.
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 text-amber-950 font-medium">
                    <li>Es <strong>OBLIGATORIO</strong> utilizar un chip / número prepago dedicado exclusivo para la campaña política.</li>
                    <li><strong>NUNCA</strong> asocie la línea personal del candidato ni la del jefe de campaña.</li>
                    <li>Mantenga el volumen controlado para evitar bloqueos por parte de Meta.</li>
                  </ul>
                </div>
              )}

              {/* Credenciales Técnicas */}
              {settings.provider !== 'simulation' && settings.provider !== 'baileys_qr' && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      API URL / Endpoint del Proveedor
                    </label>
                    <input
                      type="text"
                      value={settings.api_url || ''}
                      onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                      placeholder="https://graph.facebook.com/v19.0 o https://api.twilio.com"
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-xs">
                      API Token / Bearer Token / Secret
                    </label>
                    <input
                      type="password"
                      value={settings.api_token || ''}
                      onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                      placeholder="Token secreto de autenticación"
                      className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>

                  {settings.provider === 'twilio' && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        Twilio Account SID
                      </label>
                      <input
                        type="text"
                        value={settings.account_sid || ''}
                        onChange={(e) => setSettings({ ...settings, account_sid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>
                  )}

                  {(settings.provider === 'meta_cloud' || settings.provider === 'twilio') && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1 text-xs">
                        Número Remitente / Phone Number ID (E.164)
                      </label>
                      <input
                        type="text"
                        value={settings.sender_phone || ''}
                        onChange={(e) => setSettings({ ...settings, sender_phone: e.target.value })}
                        placeholder="+14155238886 o Phone Number ID de Meta"
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 5: RECORDATORIOS DE FONDO Y FRECUENCIA */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#38b6ff]" />
                  <h4 className="font-black text-slate-900 font-heading text-sm uppercase tracking-wide">
                    5. Parámetros de Fondo y Resumen Diario
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Hora de Resumen de Agenda Diaria (America/Bogota)
                  </label>
                  <input
                    type="time"
                    value={settings.daily_summary_time || '07:00'}
                    onChange={(e) => setSettings({ ...settings, daily_summary_time: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Hora en la que el cron emite la agenda matutina diaria a la comitiva.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Anticipación de Alerta de Salida (Minutos)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={settings.reminder_minutes_before || 60}
                    onChange={(e) => setSettings({ ...settings, reminder_minutes_before: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tiempo previo para el recordatorio de salida del mismo día.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de Guardar */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Los cambios se aplican inmediatamente al motor de notificaciones en Render.
              </span>
              <button
                type="submit"
                disabled={settingsSaving}
                className="bg-[#38b6ff] hover:bg-[#20a7f5] text-slate-950 font-black px-6 py-3 rounded-xl shadow-md transition-transform hover:scale-105 disabled:opacity-50 flex items-center gap-2"
              >
                {settingsSaving ? (
                  <div className="animate-spin w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                <span>Guardar Configuración de WhatsApp</span>
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
