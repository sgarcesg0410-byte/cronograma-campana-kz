import React, { useState } from 'react';
import { Activity } from '../types';
import { CATEGORY_CONFIG } from './DailyAgendaView';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  Calendar as CalendarIcon,
  Eye
} from 'lucide-react';

interface CalendarViewProps {
  activities: Activity[];
  onSelectDate: (date: string) => void;
  onOpenCreateModal: (defaultDate?: string) => void;
  onSelectActivity: (activity: Activity) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  activities,
  onSelectDate,
  onOpenCreateModal,
  onSelectActivity,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentMonthDate(new Date());
  };

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert to Monday = 0:
  const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Create grid cells
  const calendarCells = [];

  // Prev month padding
  for (let i = startDayOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    calendarCells.push({
      day: dayNum,
      isCurrentMonth: false,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
    });
  }

  // Current month days
  const todayStr = new Date().toISOString().split('T')[0];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      dateString,
      isToday: dateString === todayStr,
    });
  }

  // Next month padding to fill 35 or 42 cells
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let n = 1; n <= remaining; n++) {
    calendarCells.push({
      day: n,
      isCurrentMonth: false,
      dateString: `${year}-${String(month + 2).padStart(2, '0')}-${String(n).padStart(2, '0')}`,
    });
  }

  // Group activities by date
  const activitiesByDate = activities.reduce((acc, act) => {
    if (!acc[act.date]) acc[act.date] = [];
    acc[act.date].push(act);
    return acc;
  }, {} as Record<string, Activity[]>);

  const weekDayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-6">
      
      {/* Calendar Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-white text-slate-700 hover:text-slate-950 transition-colors"
            >
              Mes Actual
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Calendario General de Campaña #VOY CON EL KZ
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenCreateModal()}
          className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Programar Evento</span>
        </button>

      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-600 py-3 font-heading uppercase tracking-wider">
          {weekDayLabels.map((wd, i) => (
            <div key={i}>{wd}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          {calendarCells.map((cell, idx) => {
            const dayActs = activitiesByDate[cell.dateString] || [];
            
            return (
              <div
                key={idx}
                className={`min-h-[110px] sm:min-h-[135px] p-2 flex flex-col justify-between transition-colors group ${
                  cell.isCurrentMonth ? 'bg-white hover:bg-sky-50/30' : 'bg-slate-50/60 text-slate-400'
                } ${cell.isToday ? 'bg-sky-50/50 ring-2 ring-inset ring-[#38b6ff]' : ''}`}
              >
                
                {/* Day Number Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      cell.isToday
                        ? 'bg-[#38b6ff] text-slate-950 font-black shadow-sm'
                        : cell.isCurrentMonth
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {cell.isCurrentMonth && (
                    <button
                      onClick={() => onSelectDate(cell.dateString)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-[#1a8bd0] hover:underline flex items-center gap-0.5 transition-opacity"
                      title="Ver agenda detallada del día"
                    >
                      <span>Ver día</span>
                      <Eye className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Activities chips in this day */}
                <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                  {dayActs.map((act) => {
                    const cat = CATEGORY_CONFIG[act.category] || CATEGORY_CONFIG.otro;
                    return (
                      <div
                        key={act.id}
                        onClick={() => onSelectActivity(act)}
                        className={`text-[10px] font-bold p-1 rounded-md border truncate cursor-pointer transition-transform hover:scale-[1.02] ${cat.color} ${
                          act.status === 'cumplido' ? 'opacity-70 line-through' : ''
                        }`}
                        title={`${act.start_time} - ${act.title} (${cat.label})`}
                      >
                        <span className="font-mono mr-1">{act.start_time}</span>
                        <span>{act.title}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Add button on hover */}
                {cell.isCurrentMonth && dayActs.length === 0 && (
                  <button
                    onClick={() => onOpenCreateModal(cell.dateString)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-slate-700 font-medium py-1 text-center w-full rounded hover:bg-slate-100 transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar</span>
                  </button>
                )}

              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
