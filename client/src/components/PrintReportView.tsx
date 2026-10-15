import React, { useState } from 'react';
import { Activity } from '../types';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './DailyAgendaView';
import { Printer, Calendar, Clock, MapPin, Users, Package, CalendarRange } from 'lucide-react';
import { formatTitleDate, formatBogotaTimestamp } from '../utils/date';

interface PrintReportViewProps {
  activities: Activity[];
  selectedDate: string;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  activities,
  selectedDate,
}) => {
  const [printMode, setPrintMode] = useState<'day' | 'week'>('day');

  // Compute week range based on selectedDate (Monday to Sunday)
  const getWeekRange = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(year, month - 1, day + distanceToMonday);
    const sunday = new Date(year, month - 1, day + distanceToMonday + 6);
    
    const toStr = (date: Date) => 
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const monthNameMonday = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(monday);
    const monthNameSunday = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(sunday);

    return {
      startStr: toStr(monday),
      endStr: toStr(sunday),
      label: `${monday.getDate()} de ${monthNameMonday} al ${sunday.getDate()} de ${monthNameSunday}`
    };
  };

  const weekRange = getWeekRange(selectedDate);

  const displayedActivities = activities
    .filter((a) => {
      if (printMode === 'day') {
        return a.date === selectedDate;
      } else {
        return a.date >= weekRange.startStr && a.date <= weekRange.endStr;
      }
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Control bar (hidden during print) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 font-heading">
            Ficha de Ruta Oficial e Imprimible (PDF)
          </h2>
          <p className="text-xs text-slate-500">
            Documento de control para equipo de seguridad, avanzada, transporte y candidato.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setPrintMode('day')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                printMode === 'day'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Día Actual
            </button>
            <button
              onClick={() => setPrintMode('week')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                printMode === 'week'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5 text-[#148ad6]" />
              <span>Semana Completa</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4 text-[#38b6ff]" />
            <span>Imprimir / Guardar en PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Container - Isolated by #print-sheet in print mode */}
      <div id="print-sheet" className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm max-w-5xl mx-auto">
        
        {/* Header with Official Logo & Campaign details */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-kz.jpg"
              alt="Logo #VOY CON EL KZ"
              className="w-12 h-12 object-cover rounded-lg border border-slate-300 shadow-2xs"
            />
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#1c4b82] uppercase block">
                DOCUMENTO OFICIAL DE AVANZADA Y SEGURIDAD
              </span>
              <h1 className="text-lg sm:text-xl font-black font-heading text-slate-900 leading-tight">
                Hoja de Ruta Territorial | Campaña 2026
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                Coordinación Operativa y Desplazamiento
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-right">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                {printMode === 'day' ? 'FECHA OFICIAL' : 'SEMANA OFICIAL'}
              </span>
              <span className="text-sm font-black text-slate-900 capitalize font-heading">
                {printMode === 'day' ? formatTitleDate(selectedDate) : weekRange.label}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Impreso: {formatBogotaTimestamp()}
            </p>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-heading font-black border-b border-slate-300">
                {printMode === 'week' && (
                  <th className="p-2.5 border-r border-slate-300 w-24 text-center">FECHA</th>
                )}
                <th className="p-2.5 border-r border-slate-300 w-24 text-center">HORA</th>
                <th className="p-2.5 border-r border-slate-300">ACTIVIDAD / PROPÓSITO</th>
                <th className="p-2.5 border-r border-slate-300 w-32">TIPO</th>
                <th className="p-2.5 border-r border-slate-300">LUGAR Y DIRECCIÓN</th>
                <th className="p-2.5 border-r border-slate-300">RESPONSABLE & EQUIPO</th>
                <th className="p-2.5 w-24 text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedActivities.length === 0 ? (
                <tr>
                  <td colSpan={printMode === 'week' ? 7 : 6} className="p-6 text-center text-slate-500 font-medium">
                    No hay actividades registradas en el cronograma para {printMode === 'day' ? 'esta fecha' : 'esta semana'}.
                  </td>
                </tr>
              ) : (
                displayedActivities.map((act) => {
                  const cat = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.otro;
                  const status = STATUS_CONFIG[act.status] || STATUS_CONFIG.programado;

                  return (
                    <tr key={act.id} className="hover:bg-slate-50">
                      {printMode === 'week' && (
                        <td className="p-2 border-r border-slate-300 text-center font-bold text-slate-800 whitespace-nowrap bg-slate-50/50">
                          {act.date.substring(5)}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(new Date(act.date + 'T12:00:00'))}
                          </span>
                        </td>
                      )}

                      <td className="p-2.5 border-r border-slate-300 text-center font-mono font-bold whitespace-nowrap bg-slate-50/50">
                        {act.start_time}
                        {act.end_time && <span className="block text-[10px] text-slate-500">{act.end_time}</span>}
                      </td>

                      <td className="p-2.5 border-r border-slate-300">
                        <span className="font-bold text-slate-900 block">{act.title}</span>
                        {act.description && (
                          <span className="text-[11px] text-slate-600 block mt-0.5">{act.description}</span>
                        )}
                        {act.logistics_needed && (
                          <span className="text-[10px] text-amber-900 bg-amber-50 px-1 py-0.5 rounded mt-1 inline-block border border-amber-200">
                            <strong>Logística:</strong> {act.logistics_needed}
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-slate-300 font-medium text-slate-700">
                        {cat.label}
                      </td>

                      <td className="p-2.5 border-r border-slate-300">
                        <span className="font-semibold text-slate-900 block">{act.location_name}</span>
                        {act.location_address && (
                          <span className="text-[11px] text-slate-500 block">{act.location_address}</span>
                        )}
                      </td>

                      <td className="p-2.5 border-r border-slate-300">
                        <span className="font-bold text-slate-800 block">{act.responsible_name}</span>
                        {act.team_assigned && (
                          <span className="text-[10px] text-slate-500 block">Comitiva: {act.team_assigned}</span>
                        )}
                      </td>

                      <td className="p-2.5 text-center font-bold font-mono text-[11px]">
                        {status.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Security & Logistics Protocol Footer */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-8 text-[11px] text-slate-600">
          <div>
            <span className="font-bold text-slate-900 block mb-0.5">Protocolo de Seguridad y Avanzada:</span>
            El equipo de avanzada debe verificar el punto de encuentro 30 minutos antes de la llegada del candidato. Cualquier novedad debe ser reportada inmediatamente a la central.
          </div>
          <div>
            <span className="font-bold text-slate-900 block mb-0.5">Comunicaciones y Medios:</span>
            Toda transmisión en vivo y material fotográfico debe incorporar el hashtag oficial <strong>#VOYCONELKZ</strong> y los distintivos oficiales de la campaña.
          </div>
        </div>

        {/* Signatures line */}
        <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-300 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-1.5" />
            <p className="font-bold text-slate-800">Candidato / Jefe de Debate</p>
            <p className="text-[10px] text-slate-500">Comité Político Central</p>
          </div>
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-1.5" />
            <p className="font-bold text-slate-800">Coordinador General de Avanzada</p>
            <p className="text-[10px] text-slate-500">Logística y Operaciones Territoriales</p>
          </div>
        </div>

      </div>

    </div>
  );
};
