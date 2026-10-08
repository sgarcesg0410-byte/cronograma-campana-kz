import React, { useState } from 'react';
import { Activity, ActivityCategory, ActivityStatus } from '../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  UserCheck, 
  Users, 
  Package, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Share2, 
  ExternalLink, 
  CheckCircle, 
  Clock3, 
  AlertCircle, 
  XCircle, 
  RefreshCw,
  Megaphone,
  Radio,
  Footprints,
  Car,
  Handshake,
  Utensils,
  Search,
  Filter,
  FileEdit,
  Trash2
} from 'lucide-react';

interface DailyAgendaViewProps {
  activities: Activity[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onOpenCreateModal: (defaultDate?: string) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (id: number) => void;
  onUpdateStatus: (id: number, status: ActivityStatus) => void;
  onOpenWhatsAppActivity: (activity: Activity, type: 'activity' | 'call_leaders') => void;
}

export const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; color: string; icon: any }> = {
  recorrido: { label: 'Recorrido / Caminata', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Footprints },
  mitin: { label: 'Mitin / Tarima', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Megaphone },
  reunion: { label: 'Reunión con Líderes', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Handshake },
  prensa: { label: 'Medios / Prensa', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Radio },
  volanteo: { label: 'Volanteo / Calle', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Users },
  caravana: { label: 'Caravana Vehicular', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Car },
  almuerzo: { label: 'Almuerzo Político', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: Utensils },
  otro: { label: 'Otras Actividades', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: Calendar },
};

export const STATUS_CONFIG: Record<ActivityStatus, { label: string; badge: string; icon: any }> = {
  programado: { label: 'Programado', badge: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock3 },
  en_curso: { label: 'En Curso', badge: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse', icon: AlertCircle },
  cumplido: { label: 'Cumplido', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle },
  reprogramado: { label: 'Reprogramado', badge: 'bg-purple-100 text-purple-800 border-purple-300', icon: RefreshCw },
  cancelado: { label: 'Cancelado', badge: 'bg-rose-100 text-rose-800 border-rose-300', icon: XCircle },
};

export const DailyAgendaView: React.FC<DailyAgendaViewProps> = ({
  activities,
  selectedDate,
  onDateChange,
  onOpenCreateModal,
  onEditActivity,
  onDeleteActivity,
  onUpdateStatus,
  onOpenWhatsAppActivity,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Date navigation helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    onDateChange(new Date().toISOString().split('T')[0]);
  };

  const formatTitleDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  };

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (act.date !== selectedDate) return false;
    if (filterCategory !== 'all' && act.category !== filterCategory) return false;
    if (filterStatus !== 'all' && act.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        act.title.toLowerCase().includes(q) ||
        (act.description && act.description.toLowerCase().includes(q)) ||
        act.location_name.toLowerCase().includes(q) ||
        act.responsible_name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const completedCount = filteredActivities.filter((a) => a.status === 'cumplido').length;
  const inProgressCount = filteredActivities.filter((a) => a.status === 'en_curso').length;

  return (
    <div className="space-y-6">
      
      {/* Date Header & Action Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Date navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-white text-slate-700 hover:text-slate-950 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading capitalize">
                {formatTitleDate(selectedDate)}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {filteredActivities.length} actividades programadas | {completedCount} cumplidas
            </p>
          </div>
        </div>

        {/* Right: Date picker & create button */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff] focus:border-transparent bg-slate-50 font-medium cursor-pointer"
          />

          <button
            onClick={() => onOpenCreateModal(selectedDate)}
            className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-transform hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Actividad</span>
          </button>
        </div>

      </div>

      {/* Filters & Search Row */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por actividad, lugar, líder o comitiva..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38b6ff] bg-slate-50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Categoría:</span>
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
          >
            <option value="all">Todas las categorías</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-2">
            <span>Estado:</span>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Activities Timeline List */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-sky-50 text-[#38b6ff] rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-100">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 font-heading">
            No hay actividades programadas para este día
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Aún no se han registrado eventos oficiales en el cronograma de la campaña para esta fecha.
          </p>
          <button
            onClick={() => onOpenCreateModal(selectedDate)}
            className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Programar Actividad Ahora</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((act) => {
            const cat = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.otro;
            const CatIcon = cat.icon;
            const status = STATUS_CONFIG[act.status] || STATUS_CONFIG.programado;
            const StatusIcon = status.icon;

            return (
              <div
                key={act.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-md ${
                  act.status === 'en_curso'
                    ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-amber-100'
                    : act.status === 'cumplido'
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-slate-200/90 shadow-sm'
                }`}
              >
                <div className="p-5 sm:p-6">
                  
                  {/* Top Bar: Time, Category & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    
                    <div className="flex items-center gap-2.5">
                      {/* Time Badge */}
                      <div className="flex items-center gap-1.5 bg-slate-900 text-white font-mono font-bold text-xs sm:text-sm px-3 py-1 rounded-lg shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-[#38b6ff]" />
                        <span>{act.start_time}</span>
                        {act.end_time && <span>- {act.end_time}</span>}
                      </div>

                      {/* Category Badge */}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${cat.color}`}>
                        <CatIcon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </span>
                    </div>

                    {/* Status Dropdown Selector */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <StatusIcon className={`w-4 h-4 ${
                          act.status === 'cumplido' ? 'text-emerald-600' :
                          act.status === 'en_curso' ? 'text-amber-500' :
                          act.status === 'cancelado' ? 'text-rose-500' : 'text-blue-500'
                        }`} />
                        <select
                          value={act.status}
                          onChange={(e) => onUpdateStatus(act.id, e.target.value as ActivityStatus)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer transition-colors ${status.badge}`}
                        >
                          {Object.entries(STATUS_CONFIG).map(([stKey, stConf]) => (
                            <option key={stKey} value={stKey}>
                              {stConf.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* Title and Description */}
                  <div className="mb-4">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 font-heading mb-1.5">
                      {act.title}
                    </h3>
                    {act.description && (
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {act.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Details: Location, Responsible, Logistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                    
                    {/* Location */}
                    <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-[#38b6ff] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">
                          {act.location_name}
                        </span>
                        {act.location_address && (
                          <span className="text-[11px] text-slate-500 block truncate">
                            {act.location_address}
                          </span>
                        )}
                        {act.location_url && (
                          <a
                            href={act.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#1a8bd0] hover:underline font-semibold mt-0.5"
                          >
                            <span>Abrir en Google Maps</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Responsible & Team */}
                    <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block truncate">
                          Resp: {act.responsible_name}
                        </span>
                        {act.team_assigned && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <Users className="w-3 h-3 text-slate-400" />
                            {act.team_assigned}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Logistics */}
                    {act.logistics_needed && (
                      <div className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 md:col-span-2 lg:col-span-1">
                        <Package className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block">
                            Logística de Campaña:
                          </span>
                          <span className="text-[11px] text-slate-600 line-clamp-2">
                            {act.logistics_needed}
                          </span>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Notes if present */}
                  {act.notes && (
                    <div className="mt-2.5 p-2 rounded-lg bg-amber-50/70 border border-amber-200/50 text-xs text-amber-900">
                      <span className="font-bold">Nota de avanzada:</span> {act.notes}
                    </div>
                  )}

                  {/* Bottom Action Buttons: WhatsApp & Edit/Delete */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    
                    {/* WhatsApp Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onOpenWhatsAppActivity(act, 'activity')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        title="Enviar recordatorio formal por WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Recordatorio WhatsApp</span>
                      </button>

                      <button
                        onClick={() => onOpenWhatsAppActivity(act, 'call_leaders')}
                        className="bg-slate-800 hover:bg-slate-700 text-[#38b6ff] font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
                        title="Generar invitación para líderes y comitiva"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>Convocatoria Líderes</span>
                      </button>
                    </div>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEditActivity(act)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar actividad"
                      >
                        <FileEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteActivity(act.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar del cronograma"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
