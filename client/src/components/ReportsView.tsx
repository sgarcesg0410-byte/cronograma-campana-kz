import React from 'react';
import { Activity, DashboardStats } from '../types';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './DailyAgendaView';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Printer, 
  Target, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

interface ReportsViewProps {
  stats: DashboardStats | null;
  activities: Activity[];
  onSelectView: (view: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  stats,
  activities,
  onSelectView,
}) => {
  if (!stats) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#38b6ff] border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-slate-600 font-semibold text-sm">Cargando métricas y reportes de campaña...</p>
      </div>
    );
  }

  const { summary, byCategory, upcoming } = stats;

  // Calculate responsible leaders stats
  const responsibleStats = activities.reduce((acc, act) => {
    const name = act.responsible_name || 'Sin asignar';
    if (!acc[name]) {
      acc[name] = { total: 0, completed: 0, inProgress: 0, scheduled: 0 };
    }
    acc[name].total += 1;
    if (act.status === 'cumplido') acc[name].completed += 1;
    if (act.status === 'en_curso') acc[name].inProgress += 1;
    if (act.status === 'programado') acc[name].scheduled += 1;
    return acc;
  }, {} as Record<string, { total: number; completed: number; inProgress: number; scheduled: number }>);

  const responsibleList = Object.entries(responsibleStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#38b6ff]/20 text-[#38b6ff] text-xs font-bold px-2.5 py-1 rounded-full border border-[#38b6ff]/30">
              PANEL EJECUTIVO DE CAMPAÑA
            </span>
            <span className="text-xs text-slate-400 font-mono">#VOY CON EL KZ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-heading text-white tracking-tight">
            Reporte de Desempeño y Cumplimiento
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mt-1">
            Supervisión en tiempo real de actividades en territorio, movilización ciudadana y agenda del candidato.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectView('print')}
            className="bg-[#38b6ff] hover:bg-[#20a7f5] text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-transform hover:scale-105"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Ficha Oficial</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Events */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-[#38b6ff] flex items-center justify-center shrink-0 border border-sky-100">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Actividades</p>
            <p className="text-2xl font-black text-slate-900 font-heading">{summary.total}</p>
            <p className="text-[11px] text-slate-400">Registradas en agenda</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cumplimiento</p>
            <p className="text-2xl font-black text-emerald-600 font-heading">{summary.completionRate}%</p>
            <p className="text-[11px] text-slate-400">{summary.completed} eventos realizados</p>
          </div>
        </div>

        {/* In Progress / Active */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">En Territorio Ahora</p>
            <p className="text-2xl font-black text-amber-600 font-heading">{summary.inProgress}</p>
            <p className="text-[11px] text-slate-400">Actividades en curso</p>
          </div>
        </div>

        {/* Scheduled Pending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Por Realizar</p>
            <p className="text-2xl font-black text-blue-600 font-heading">{summary.scheduled}</p>
            <p className="text-[11px] text-slate-400">Próximos días</p>
          </div>
        </div>

      </div>

      {/* Two columns: Status Breakdown & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 font-heading mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#38b6ff]" />
            Estado General de la Agenda de Campaña
          </h3>

          <div className="space-y-3.5">
            {[
              { key: 'cumplido', label: 'Cumplidas', count: summary.completed, color: 'bg-emerald-500', bar: 'bg-emerald-100' },
              { key: 'en_curso', label: 'En Curso', count: summary.inProgress, color: 'bg-amber-500', bar: 'bg-amber-100' },
              { key: 'programado', label: 'Programadas', count: summary.scheduled, color: 'bg-blue-500', bar: 'bg-blue-100' },
              { key: 'reprogramado', label: 'Reprogramadas', count: summary.rescheduled, color: 'bg-purple-500', bar: 'bg-purple-100' },
              { key: 'cancelado', label: 'Canceladas', count: summary.cancelled, color: 'bg-rose-500', bar: 'bg-rose-100' },
            ].map((st) => {
              const pct = summary.total > 0 ? Math.round((st.count / summary.total) * 100) : 0;
              return (
                <div key={st.key}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
                      {st.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {st.count} ({pct}%)
                    </span>
                  </div>
                  <div className={`w-full ${st.bar} rounded-full h-2.5 overflow-hidden`}>
                    <div
                      className={`${st.color} h-2.5 rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 font-heading mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#38b6ff]" />
            Distribución por Tipo de Actividad Política
          </h3>

          <div className="space-y-3">
            {byCategory.map((catItem) => {
              const catConf = CATEGORY_CONFIG[catItem.category] || CATEGORY_CONFIG.otro;
              const CatIcon = catConf.icon;
              const pct = summary.total > 0 ? Math.round((catItem.count / summary.total) * 100) : 0;

              return (
                <div key={catItem.category}>
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                    <span className="flex items-center gap-2">
                      <CatIcon className="w-3.5 h-3.5 text-[#38b6ff]" />
                      {catConf.label}
                    </span>
                    <span className="font-mono text-slate-500">
                      {catItem.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#38b6ff] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Leader / Responsible performance table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 font-heading mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#38b6ff]" />
          Seguimiento por Coordinador y Responsable de Avanzada
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-heading font-black text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Responsable / Avanzada</th>
                <th className="py-3 px-4 text-center">Total Asignadas</th>
                <th className="py-3 px-4 text-center">Cumplidas</th>
                <th className="py-3 px-4 text-center">En Curso</th>
                <th className="py-3 px-4 text-center">Pendientes</th>
                <th className="py-3 px-4 text-right">Efectividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {responsibleList.map(([name, data]) => {
                const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <tr key={name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {data.total}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                      {data.completed}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                      {data.inProgress}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-600">
                      {data.scheduled}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded-full text-xs ${
                        rate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                        rate >= 50 ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
