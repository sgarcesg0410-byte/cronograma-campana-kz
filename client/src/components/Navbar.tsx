import React from 'react';
import { User } from '../types';
import { 
  Calendar, 
  Share2, 
  Printer, 
  PlusCircle, 
  LogOut, 
  UserCheck, 
  Clock,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenCreateModal: () => void;
  onOpenWhatsAppModal: () => void;
  onSelectView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onOpenCreateModal,
  onOpenWhatsAppModal,
  onSelectView,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Campaign Title */}
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => onSelectView('daily')}>
              <img 
                src="/logo-kz.jpg" 
                alt="Logo #VOY CON EL KZ" 
                className="w-12 h-12 rounded-xl object-cover shadow-lg ring-2 ring-[#38b6ff] ring-offset-2 ring-offset-slate-900 transition-transform group-hover:scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black tracking-wider text-xl text-white">
                  CRONOGRAMA <span className="text-[#38b6ff]">#VOYCONELKZ</span>
                </span>
                <span className="bg-[#38b6ff]/20 text-[#38b6ff] text-xs font-bold px-2 py-0.5 rounded-full border border-[#38b6ff]/30 hidden sm:inline-block">
                  CAMPAÑA OFICIAL
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 capitalize">
                <Clock className="w-3.5 h-3.5 text-[#38b6ff]" />
                {capitalizeFirst(todayFormatted)}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* WhatsApp Quick Share */}
            <button
              onClick={onOpenWhatsAppModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:shadow-emerald-600/30"
              title="Compartir Agenda del Día por WhatsApp"
            >
              <Share2 className="w-4 h-4 text-emerald-100" />
              <span className="hidden md:inline">WhatsApp</span> Agenda
            </button>

            {/* Print Official Sheet */}
            <button
              onClick={() => onSelectView('print')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-slate-700 flex items-center gap-2 transition-all"
              title="Ficha Oficial Imprimible"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">Ficha</span> Imprimir
            </button>

            {/* Create Activity Button */}
            <button
              onClick={onOpenCreateModal}
              className="bg-[#38b6ff] hover:bg-[#20a7f5] text-slate-950 font-bold text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg flex items-center gap-2 shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Actividad</span>
            </button>

            {/* User Profile & Logout */}
            <div className="flex items-center border-l border-slate-800 pl-3 ml-1 sm:ml-2">
              <div className="flex items-center gap-2 mr-3 hidden lg:flex">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[#38b6ff]">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="text-left text-xs">
                  <p className="font-semibold text-slate-200 leading-tight">
                    {currentUser?.name || 'Administrador'}
                  </p>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {currentUser?.role || 'Comité Político'}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
