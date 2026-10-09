import React, { useState, useEffect } from 'react';
import { Activity, ActivityCategory, ActivityStatus } from '../types';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './DailyAgendaView';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  UserCheck, 
  Users, 
  Package, 
  FileText, 
  Link as LinkIcon,
  PlusCircle,
  Save
} from 'lucide-react';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activityData: Partial<Activity>) => Promise<void>;
  activityToEdit?: Activity | null;
  defaultDate?: string;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  activityToEdit,
  defaultDate,
}) => {
  const [formData, setFormData] = useState<Partial<Activity>>({
    title: '',
    description: '',
    date: defaultDate || new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '11:00',
    category: 'recorrido',
    status: 'programado',
    location_name: '',
    location_address: '',
    location_url: '',
    zone: 'General',
    responsible_name: '',
    team_assigned: '',
    logistics_needed: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activityToEdit) {
      setFormData(activityToEdit);
    } else {
      setFormData({
        title: '',
        description: '',
        date: defaultDate || new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '11:00',
        category: 'recorrido',
        status: 'programado',
        location_name: '',
        location_address: '',
        location_url: '',
        zone: 'General',
        responsible_name: '',
        team_assigned: '',
        logistics_needed: '',
        notes: '',
      });
    }
  }, [activityToEdit, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.start_time || !formData.location_name || !formData.responsible_name) {
      alert('Por favor complete los campos obligatorios (*) marcados.');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      alert('Error al guardar la actividad: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#38b6ff]/20 text-[#38b6ff] flex items-center justify-center font-bold">
              {activityToEdit ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white">
                {activityToEdit ? 'Editar Actividad de Campaña' : 'Programar Nueva Actividad'}
              </h3>
              <p className="text-xs text-slate-400">
                #VOY CON EL KZ | Gestión de Agenda y Logística
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4 max-h-[80vh] overflow-y-auto text-xs sm:text-sm">
          
          {/* Title */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Título del Evento / Actividad *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Gran Mitin en Barrio Central o Caminata Popular"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Descripción y Objetivos
            </label>
            <textarea
              rows={2}
              placeholder="Detalle del encuentro, temas a tratar con la comunidad..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
            />
          </div>

          {/* Category & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Categoría Política *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ActivityCategory })}
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-[#38b6ff] font-medium"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Estado de la Actividad *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ActivityStatus })}
                className="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-[#38b6ff] font-medium"
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Start Time, End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#38b6ff]" />
                Fecha *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff] font-medium cursor-pointer"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Hora Inicio *
              </label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff] font-mono font-bold cursor-pointer"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Hora Fin (Opcional)
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff] font-mono font-bold cursor-pointer"
              />
            </div>
          </div>

          {/* Location details */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-[#38b6ff]" />
              Ubicación y Punto de Concentración
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Nombre del Lugar *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Polideportivo San Juan o Salón Comunal"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Zona Territorial</label>
                <input
                  type="text"
                  placeholder="Ej. Comuna 2, Zona Norte o General"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dirección Exacta</label>
                <input
                  type="text"
                  placeholder="Ej. Calle 12 # 4-50"
                  value={formData.location_address}
                  onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Enlace Google Maps / Waze</label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={formData.location_url}
                  onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Responsible and Team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Responsable / Avanzada *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Carlos Mendoza (Avanzada)"
                value={formData.responsible_name}
                onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                Equipo / Comitiva Asignada
              </label>
              <input
                type="text"
                placeholder="Ej. Juventudes KZ & Equipo Territorial 1"
                value={formData.team_assigned}
                onChange={(e) => setFormData({ ...formData, team_assigned: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
              />
            </div>
          </div>

          {/* Logistics and Notes */}
          <div>
            <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-500" />
              Requerimientos Logísticos
            </label>
            <input
              type="text"
              placeholder="Ej. Sonido 2000W, 100 refrigerios, 50 camisetas #VOY CON EL KZ, megáfonos"
              value={formData.logistics_needed}
              onChange={(e) => setFormData({ ...formData, logistics_needed: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Observaciones de Seguridad o Ruta
            </label>
            <textarea
              rows={2}
              placeholder="Notas internas para el equipo de seguridad o comitiva..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
            />
          </div>

          {/* Footer Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : activityToEdit ? 'Actualizar Actividad' : 'Guardar en Cronograma'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
