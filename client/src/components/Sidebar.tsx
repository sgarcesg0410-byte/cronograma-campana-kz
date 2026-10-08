import React from 'react';
import { 
  CalendarDays, 
  CalendarRange, 
  BarChart3, 
  MessageSquare, 
  Users, 
  Printer, 
  CheckCircle2,
  Clock,
  Flame
} from 'lucide-react';
import { DashboardSummary } from '../types';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  summary?: DashboardSummary;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  summary,
}) => {
  const menuItems = [
    {
      id: 'daily',
      label: 'Cronograma Diario',
      description: 'Agenda hoy y hora a hora',
      icon: CalendarDays,
      badge: summary ? `${summary.scheduled + summary.inProgress}` : null,
    },
    {
      id: 'calendar',
      label: 'Calendario de Campaña',
      description: 'Vista mensual y semanal',
      icon: CalendarRange,
    },
    {
      id: 'reports',
      label: 'Panel de Reportes',
      description: 'Métricas, avance y estadísticas',
      icon: BarChart3,
      badge: summary ? `${summary.completionRate}%` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    },
    {
      id: 'whatsapp',
      label: 'Notificaciones WhatsApp',
      description: '1-Clic + Gateway API automático',
      icon: MessageSquare,
      badge: 'Ambas opciones',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    },
    {
      id: 'contacts',
      label: 'Directorio y Comitivas',
      description: 'Líderes, avanzada y prensa',
      icon: Users,
    },
    {
      id: 'print',
      label: 'Ficha de Ruta Oficial',
      description: 'Formato imprimible con logo',
      icon: Printer,
    },
  ];

  return (
    <aside className="w-full lg:w-72 bg-slate-900 border-r border-slate-800 text-slate-300 p-4 flex flex-col justify-between shrink-0">
      <div>
        
        {/* Section title */}
        <div className="px-3 mb-3 text-[11px] font-black uppercase tracking-wider text-slate-400 font-heading flex items-center justify-between">
          <span>Menú de Operaciones</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#38b6ff]" />
        </div>


        {/* Navigation list */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all group ${
                  isActive
                    ? 'bg-[#38b6ff] text-slate-950 font-bold shadow-lg shadow-sky-500/20'
                    : 'hover:bg-slate-800 hover:text-white text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-[#38b6ff]'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold leading-none">{item.label}</div>
                    <div className={`text-[11px] mt-1 ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.badgeColor || (isActive ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-300')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Daily Progress summary widget */}
      {summary && (
        <div className="mt-6 pt-4 border-t border-slate-800 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Meta de Hoy
            </span>
            <span className="text-xs font-mono font-bold text-[#38b6ff]">
              {summary.completed} de {summary.total} cumplidas
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-cyan-400 to-[#38b6ff] h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, summary.completionRate))}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              {summary.scheduled} por realizar
            </span>
            <span className="font-semibold text-slate-300">
              {summary.completionRate}%
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
