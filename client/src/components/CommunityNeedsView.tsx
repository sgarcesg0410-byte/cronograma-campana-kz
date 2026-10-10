import React, { useState, useEffect } from 'react';
import {
  CommunityNeed,
  CommunityNeedCreatePayload,
  CommunityNeedsStats,
  NeedCategory,
  NeedPriority,
  NeedStatus,
  NotificationQueueItem,
  NotificationQueueStats,
  User
} from '../types';
import { api } from '../services/api';
import {
  HeartHandshake,
  Plus,
  Search,
  Filter,
  Phone,
  MapPin,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bot,
  Send,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  MessageSquare,
  Layers,
  Shield,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

interface CommunityNeedsViewProps {
  currentUser?: User | null;
}

const CATEGORIES: NeedCategory[] = [
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

const PRIORITIES: NeedPriority[] = ['Urgente', 'Alta', 'Media', 'Baja'];

const STATUSES: { value: NeedStatus; label: string; color: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'en_gestion', label: 'En Gestión', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'derivada', label: 'Derivada', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'atendida', label: 'Atendida', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'no_viable', label: 'No Viable', color: 'bg-slate-700 text-slate-400 border-slate-600' },
  { value: 'cerrada', label: 'Cerrada', color: 'bg-slate-800 text-slate-500 border-slate-700' }
];

export const CommunityNeedsView: React.FC<CommunityNeedsViewProps> = ({ currentUser }) => {
  const [needs, setNeeds] = useState<CommunityNeed[]>([]);
  const [stats, setStats] = useState<CommunityNeedsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [unmaskAll, setUnmaskAll] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [editingNeed, setEditingNeed] = useState<CommunityNeed | null>(null);

  // Form State for Manual Need
  const [newNeedForm, setNewNeedForm] = useState<CommunityNeedCreatePayload>({
    neighborhood: '',
    person_name: '',
    phone: '+57',
    category: 'Salud',
    priority: 'Media',
    description: '',
    notes: '',
    consent_contact: 1
  });

  // Simulator State
  const [simText, setSimText] = useState(
`NECESIDAD
Barrio: La Esperanza
Persona: Juan Camilo Gómez
Teléfono: +573009876543
Tipo: Salud
Prioridad: Alta
Descripción: Adulto mayor requiere apoyo de silla de ruedas y traslado a cita médica.`
  );
  const [simPhone, setSimPhone] = useState('+573001234567');
  const [simResponse, setSimResponse] = useState<string | null>(null);
  const [simSuccess, setSimSuccess] = useState<boolean | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Queue State
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<NotificationQueueStats | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Clipboard copy state
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const canManageAll = currentUser?.role === 'admin' || currentUser?.role === 'coordinador';
  const canDelete = currentUser?.role === 'admin';

  useEffect(() => {
    loadNeedsData();
  }, [statusFilter, categoryFilter, priorityFilter]);

  const loadNeedsData = async () => {
    setLoading(true);
    try {
      const [needsRes, statsRes] = await Promise.all([
        api.getCommunityNeeds({
          status: statusFilter,
          category: categoryFilter,
          priority: priorityFilter,
          search: searchTerm
        }),
        api.getCommunityNeedsStats()
      ]);
      setNeeds(needsRes.needs);
      setStats(statsRes);
    } catch (err) {
      console.error('Error al cargar necesidades:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNeedsData();
  };

  const handleCreateNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createCommunityNeed(newNeedForm);
      setIsCreateModalOpen(false);
      setNewNeedForm({
        neighborhood: '',
        person_name: '',
        phone: '+57',
        category: 'Salud',
        priority: 'Media',
        description: '',
        notes: '',
        consent_contact: 1
      });
      await loadNeedsData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar necesidad');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, nextStatus: NeedStatus) => {
    try {
      await api.updateCommunityNeed(id, { status: nextStatus });
      setNeeds(prev => prev.map(n => n.id === id ? { ...n, status: nextStatus } : n));
      // Refresh stats
      const updatedStats = await api.getCommunityNeedsStats();
      setStats(updatedStats);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNeed) return;
    setActionLoading(true);
    try {
      await api.updateCommunityNeed(editingNeed.id, {
        status: editingNeed.status,
        category: editingNeed.category,
        priority: editingNeed.priority,
        notes: editingNeed.notes || ''
      });
      setEditingNeed(null);
      await loadNeedsData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar cambios');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number, neighborhood: string) => {
    if (!confirm(`¿Confirmas eliminar permanentemente esta necesidad registrada en el barrio ${neighborhood}?`)) {
      return;
    }
    try {
      await api.deleteCommunityNeed(id);
      setNeeds(prev => prev.filter(n => n.id !== id));
      const updatedStats = await api.getCommunityNeedsStats();
      setStats(updatedStats);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleRunSimulator = async () => {
    setSimLoading(true);
    setSimResponse(null);
    setSimSuccess(null);
    try {
      const res = await api.simulateIncomingWhatsApp({
        messageText: simText,
        senderPhone: simPhone,
        messageId: 'sim-' + Date.now()
      });
      setSimResponse(res.replyText);
      setSimSuccess(res.registered || false);
      if (res.registered) {
        await loadNeedsData();
      }
    } catch (err: any) {
      setSimResponse('Error: ' + err.message);
      setSimSuccess(false);
    } finally {
      setSimLoading(false);
    }
  };

  const loadQueueData = async () => {
    setQueueLoading(true);
    try {
      const res = await api.getNotificationQueue();
      setQueueItems(res.items);
      setQueueStats(res.stats);
    } catch (err) {
      console.error('Error al cargar cola:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleOpenQueue = async () => {
    setIsQueueModalOpen(true);
    await loadQueueData();
  };

  const handleProcessQueueManual = async () => {
    setActionLoading(true);
    try {
      const res = await api.processNotificationQueueManual();
      alert(res.message);
      await loadQueueData();
    } catch (err: any) {
      alert(err.message || 'Error al procesar cola');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading(true);
    try {
      const res = await api.retryFailedNotifications();
      alert(res.message);
      await loadQueueData();
    } catch (err: any) {
      alert(err.message || 'Error al reintentar fallos');
    } finally {
      setActionLoading(false);
    }
  };

  const copyTemplateToClipboard = () => {
    const templateText = 
`NECESIDAD
Barrio: [Nombre del Barrio / Comuna]
Persona: [Nombre completo del ciudadano]
Teléfono: +57[3001234567]
Tipo: [Salud / Vivienda / Empleo / Ayuda económica / Otro]
Prioridad: [Urgente / Alta / Media / Baja]
Descripción: [Detalle claro de la solicitud o requerimiento]`;
    navigator.clipboard.writeText(templateText);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Top Banner / Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Gestión Territorial y Solicitudes Ciudadanas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black font-heading text-white flex items-center gap-3">
              Necesidades de la Comunidad
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#38b6ff]/20 text-[#38b6ff] border border-[#38b6ff]/30">
                #VOY CON EL KZ
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Captura inmediata desde el Bot de WhatsApp en barrios y veredas, seguimiento de comitiva y gestión ética bajo Ley 1581 (Habeas Data).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#38b6ff] hover:bg-[#25a0e8] text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-[#38b6ff]/20 text-xs sm:text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Caso</span>
            </button>

            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Formato WhatsApp</span>
            </button>

            <button
              onClick={() => setIsSimulatorModalOpen(true)}
              className="inline-flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all"
            >
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Simular Bot</span>
            </button>

            {canManageAll && (
              <button
                onClick={handleOpenQueue}
                className="inline-flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Cola WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Total Solicitudes</span>
              <Layers className="w-4 h-4 text-[#38b6ff]" />
            </div>
            <div className="text-2xl font-black text-white mt-2 font-heading">{stats.total}</div>
            <div className="text-[11px] text-slate-500 mt-1">Registradas en campaña</div>
          </div>

          <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
              <span>Pendientes</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-amber-300 mt-2 font-heading">{stats.pending}</div>
            <div className="text-[11px] text-slate-500 mt-1">Requieren evaluación</div>
          </div>

          <div className="bg-slate-900 border border-blue-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-400 text-xs font-semibold">
              <span>En Gestión</span>
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-blue-300 mt-2 font-heading">{stats.inProgress}</div>
            <div className="text-[11px] text-slate-500 mt-1">Comitiva asignada</div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold">
              <span>Atendidas</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-emerald-300 mt-2 font-heading">{stats.attended}</div>
            <div className="text-[11px] text-slate-500 mt-1">Compromiso cumplido</div>
          </div>

          <div className="bg-slate-900 border border-rose-500/20 rounded-xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-rose-400 text-xs font-semibold">
              <span>Casos Urgentes</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-rose-300 mt-2 font-heading">{stats.urgent}</div>
            <div className="text-[11px] text-slate-500 mt-1">Alta prioridad ciudadana</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por persona, barrio, descripción o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#38b6ff]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#38b6ff]"
            >
              <option value="all">Todos los estados</option>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#38b6ff]"
            >
              <option value="all">Todas las categorías</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#38b6ff]"
            >
              <option value="all">Todas las prioridades</option>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg text-xs transition-all"
            >
              Filtrar
            </button>

            {canManageAll && (
              <button
                type="button"
                onClick={() => setUnmaskAll(!unmaskAll)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  unmaskAll 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Alternar visibilidad de teléfonos de ciudadanos para contacto directo"
              >
                {unmaskAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{unmaskAll ? 'Ocultar PII' : 'Ver Teléfonos'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Needs Cards List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="animate-spin w-8 h-8 border-4 border-[#38b6ff] border-t-transparent rounded-full" />
        </div>
      ) : needs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <HeartHandshake className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">No se encontraron necesidades registradas</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Usa el botón "Registrar Caso", comparte el formato de WhatsApp con los líderes o prueba el simulador del bot.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 bg-[#38b6ff] text-slate-950 font-bold px-4 py-2 rounded-xl text-sm shadow-md"
          >
            <Plus className="w-4 h-4" />
            Registrar Primera Necesidad
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {needs.map((item) => {
            const statusConfig = STATUSES.find(s => s.value === item.status) || STATUSES[0];
            const isUrgent = item.priority === 'Urgente' || item.priority === 'Alta';
            const displayPhone = unmaskAll && item.phone ? item.phone : (item.phone_masked || item.phone);
            
            // Clean phone for wa.me direct button
            const cleanPhoneDigits = (item.phone || '').replace(/[^0-9]/g, '');
            const waFollowUpText = encodeURIComponent(
              `Hola ${item.person_name}, cordial saludo del equipo de campaña #VOY CON EL KZ. Le escribimos en seguimiento a su solicitud comunitaria en el barrio ${item.neighborhood} sobre: ${item.category}. ¿Cómo podemos coordinar?`
            );
            const waLink = cleanPhoneDigits ? `https://wa.me/${cleanPhoneDigits}?text=${waFollowUpText}` : '#';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md group relative"
              >
                {/* Priority ribbon / Top row */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono text-slate-500">#{item.id}</span>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        item.priority === 'Urgente'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                          : item.priority === 'Alta'
                          ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                          : item.priority === 'Media'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {item.priority}
                      </span>

                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Citizen and Location */}
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-white group-hover:text-[#38b6ff] transition-colors flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{item.person_name}</span>
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-slate-300 truncate">{item.neighborhood}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400 truncate">{item.category}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 mb-3.5 leading-relaxed line-clamp-3">
                    {item.description}
                  </div>

                  {/* Notes / Follow-up if present */}
                  {item.notes && (
                    <div className="text-[11px] text-slate-400 bg-slate-800/50 rounded-lg p-2 mb-3 border border-slate-700/50">
                      <strong className="text-slate-300">Seguimiento:</strong> {item.notes}
                    </div>
                  )}

                  {/* Contact Info and Consent */}
                  <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-3 mb-4">
                    <div className="flex items-center gap-1.5 font-mono text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-[#38b6ff]" />
                      <span>{displayPhone}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400" title="Consentimiento de contacto informado registrado">
                      <Shield className="w-3 h-3" />
                      <span>Habeas Data OK</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5">
                    {cleanPhoneDigits && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        title="Contactar al ciudadano vía WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Contactar</span>
                      </a>
                    )}

                    <button
                      onClick={() => setEditingNeed(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                      title="Editar seguimiento / cambiar estado"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id, item.neighborhood)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick Status Select */}
                  <select
                    value={item.status}
                    onChange={(e) => handleUpdateStatus(item.id, e.target.value as NeedStatus)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-[#38b6ff]"
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: REGISTRAR NECESIDAD MANUAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <h2 className="text-xl font-black text-white font-heading mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#38b6ff]" />
              Registrar Nueva Necesidad Comunitaria
            </h2>
            <p className="text-slate-400 text-xs mb-5">
              Ingresa los datos recogidos en terreno por los líderes o la comitiva de campaña.
            </p>

            <form onSubmit={handleCreateNeed} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Barrio o Comuna *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. La Esperanza"
                    value={newNeedForm.neighborhood}
                    onChange={(e) => setNewNeedForm({ ...newNeedForm, neighborhood: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Ciudadano *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Pérez"
                    value={newNeedForm.person_name}
                    onChange={(e) => setNewNeedForm({ ...newNeedForm, person_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono (E.164) *</label>
                  <input
                    type="text"
                    required
                    placeholder="+573001234567"
                    value={newNeedForm.phone}
                    onChange={(e) => setNewNeedForm({ ...newNeedForm, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría *</label>
                  <select
                    value={newNeedForm.category}
                    onChange={(e) => setNewNeedForm({ ...newNeedForm, category: e.target.value as NeedCategory })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prioridad *</label>
                  <select
                    value={newNeedForm.priority}
                    onChange={(e) => setNewNeedForm({ ...newNeedForm, priority: e.target.value as NeedPriority })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción de la Solicitud *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detalla la situación planteada por la persona o comunidad..."
                  value={newNeedForm.description}
                  onChange={(e) => setNewNeedForm({ ...newNeedForm, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observaciones Internas / Comitiva</label>
                <input
                  type="text"
                  placeholder="Líder asignado, compromiso o siguiente paso..."
                  value={newNeedForm.notes || ''}
                  onChange={(e) => setNewNeedForm({ ...newNeedForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-300">
                <input
                  type="checkbox"
                  id="consent_checkbox"
                  checked={newNeedForm.consent_contact === 1}
                  onChange={(e) => setNewNeedForm({ ...newNeedForm, consent_contact: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded text-[#38b6ff] focus:ring-0"
                />
                <label htmlFor="consent_checkbox">
                  El ciudadano autorizó explícitamente el contacto por parte del equipo de campaña (Ley 1581 de 2012).
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#38b6ff] hover:bg-[#25a0e8] text-slate-950 font-bold px-5 py-2 rounded-lg text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Registro</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PLANTILLA WHATSAPP BOT */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <h2 className="text-xl font-black text-white font-heading mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              Formato de Mensaje para Bot de WhatsApp
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Copia este formato y compártelo en los grupos de WhatsApp de líderes y coordinadores barriales.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400 mb-4 whitespace-pre-line leading-relaxed select-all">
{`NECESIDAD
Barrio: La Esperanza
Persona: María Pérez
Teléfono: +573001234567
Tipo: Salud
Prioridad: Alta
Descripción: Requiere ayuda con medicamentos`}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 mb-5 flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Tip de Campaña:</strong> El bot responde automáticamente confirmando el número de caso asignado, sin repetir datos sensibles de salud por protección legal.
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={copyTemplateToClipboard}
                className="bg-[#38b6ff] hover:bg-[#25a0e8] text-slate-950 font-bold px-4 py-2 rounded-lg text-sm shadow-md transition-all flex items-center gap-2"
              >
                {copiedTemplate ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedTemplate ? '¡Copiado!' : 'Copiar Formato'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SIMULADOR DE BOT EN VIVO */}
      {isSimulatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <h2 className="text-xl font-black text-white font-heading mb-1 flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              Simulador del Bot WhatsApp en Tiempo Real
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Prueba cómo el sistema procesa los comandos que envían los líderes por WhatsApp y verifica su registro instantáneo.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono del Remitente (Líder)</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Mensaje de WhatsApp Recibido</label>
                <textarea
                  rows={6}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full bg-slate-950 font-mono text-xs text-slate-200 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-[#38b6ff] leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunSimulator}
                  disabled={simLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Enviar al Bot</span>
                </button>
              </div>

              {simResponse && (
                <div className={`p-4 rounded-xl border text-xs whitespace-pre-line leading-relaxed font-mono ${
                  simSuccess
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="font-bold font-sans text-xs mb-2 flex items-center gap-1.5">
                    {simSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    <span>Respuesta generada por el Bot:</span>
                  </div>
                  {simResponse}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSimulatorModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: COLA DE NOTIFICACIONES RESILIENTE */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h2 className="text-xl font-black text-white font-heading flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Cola Idempotente de Notificaciones WhatsApp
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Despachos programados, control de duplicados (dedupe_key) y reintentos automáticos con backoff.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleProcessQueueManual}
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow"
                  title="Ejecutar el procesador de cola ahora mismo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>Procesar Ahora</span>
                </button>

                <button
                  onClick={handleRetryFailed}
                  disabled={actionLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  title="Reiniciar mensajes fallidos para nuevo intento"
                >
                  Reintentar Fallos
                </button>
              </div>
            </div>

            {/* Queue Stats Bar */}
            {queueStats && (
              <div className="grid grid-cols-5 gap-2 mb-4 text-center">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">Pendientes</div>
                  <div className="text-lg font-bold text-amber-400">{queueStats.pending}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">En Proceso</div>
                  <div className="text-lg font-bold text-blue-400">{queueStats.processing}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">Enviadas</div>
                  <div className="text-lg font-bold text-emerald-400">{queueStats.sent}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">Fallidas</div>
                  <div className="text-lg font-bold text-rose-400">{queueStats.failed}</div>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">Dead Letter</div>
                  <div className="text-lg font-bold text-slate-500">{queueStats.dead_letter}</div>
                </div>
              </div>
            )}

            {/* Queue Items Table */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {queueLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
                </div>
              ) : queueItems.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  La cola de notificaciones está completamente al día.
                </div>
              ) : (
                queueItems.map(q => (
                  <div key={q.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{q.recipient_name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{q.recipient_phone}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          q.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : q.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : q.status === 'processing'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {q.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-lg">
                        Clave: {q.dedupe_key}
                      </div>
                      {q.error_message && (
                        <div className="text-[11px] text-rose-400">
                          Error: {q.error_message} (Intentos: {q.attempts})
                        </div>
                      )}
                    </div>

                    <div className="text-right text-[11px] text-slate-500 shrink-0">
                      <div>Programado: {new Date(q.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>Intentos: {q.attempts}/3</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 mt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: EDITAR CASO / SEGUIMIENTO */}
      {editingNeed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <h2 className="text-xl font-black text-white font-heading mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[#38b6ff]" />
              Seguimiento del Caso #{editingNeed.id}
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              {editingNeed.person_name} • {editingNeed.neighborhood}
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Estado de Gestión</label>
                <select
                  value={editingNeed.status}
                  onChange={(e) => setEditingNeed({ ...editingNeed, status: e.target.value as NeedStatus })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={editingNeed.category}
                    onChange={(e) => setEditingNeed({ ...editingNeed, category: e.target.value as NeedCategory })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prioridad</label>
                  <select
                    value={editingNeed.priority}
                    onChange={(e) => setEditingNeed({ ...editingNeed, priority: e.target.value as NeedPriority })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notas de Seguimiento / Comitiva</label>
                <textarea
                  rows={3}
                  value={editingNeed.notes || ''}
                  onChange={(e) => setEditingNeed({ ...editingNeed, notes: e.target.value })}
                  placeholder="Compromisos asumidos, fecha de visita o solución brindada..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#38b6ff]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingNeed(null)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#38b6ff] hover:bg-[#25a0e8] text-slate-950 font-bold px-5 py-2 rounded-lg text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
