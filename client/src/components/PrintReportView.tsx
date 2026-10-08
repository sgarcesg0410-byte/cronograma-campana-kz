import React from 'react';
import { Activity } from '../types';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './DailyAgendaView';
import { Printer, Calendar, Clock, MapPin, Users, Package } from 'lucide-react';

interface PrintReportViewProps {
  activities: Activity[];
  selectedDate: string;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  activities,
  selectedDate,
}) => {
  const dayActivities = activities.filter((a) => a.date === selectedDate);

  const formatTitleDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  };

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
            Documento de control diario para equipo de seguridad, avanzada, transporte y candidato.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-105"
        >
          <Printer className="w-4 h-4 text-[#38b6ff]" />
          <span>Imprimir / Guardar en PDF</span>
        </button>
      </div>

      {/* Printable Sheet Container */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 max-w-5xl mx-auto">
        
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
              <span className="text-[10px] font-bold text-slate-500 block uppercase">FECHA OFICIAL</span>
              <span className="text-sm font-black text-slate-900 capitalize font-heading">
                {formatTitleDate(selectedDate)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              Impreso: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-heading font-black border-b border-slate-300">
                <th className="p-2.5 border-r border-slate-300 w-24 text-center">HORA</th>
                <th className="p-2.5 border-r border-slate-300">ACTIVIDAD / PROPÓSITO</th>
                <th className="p-2.5 border-r border-slate-300 w-32">TIPO</th>
                <th className="p-2.5 border-r border-slate-300">LUGAR Y DIRECCIÓN</th>
                <th className="p-2.5 border-r border-slate-300">RESPONSABLE & EQUIPO</th>
                <th className="p-2.5 w-24 text-center">ESTADO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dayActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 font-medium">
                    No hay actividades registradas en el cronograma para esta fecha.
                  </td>
                </tr>
              ) : (
                dayActivities.map((act) => {
                  const cat = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.otro;
                  const status = STATUS_CONFIG[act.status] || STATUS_CONFIG.programado;

                  return (
                    <tr key={act.id} className="hover:bg-slate-50">
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
