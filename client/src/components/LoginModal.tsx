import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { Lock, Mail, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';

interface LoginModalProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@voyconelkz.com');
  const [password, setPassword] = useState('kz2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('kz2026!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950 to-slate-950" />

      <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 text-white">
        
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <img
              src="/logo-kz.jpg"
              alt="Logo #VOY CON EL KZ"
              className="w-20 h-20 rounded-2xl object-cover mx-auto ring-4 ring-[#38b6ff]/60 shadow-xl"
            />
          </div>
          <h1 className="text-2xl font-black font-heading text-white tracking-tight">
            #VOY CON EL KZ
          </h1>
          <p className="text-xs font-bold text-[#38b6ff] uppercase tracking-wider mt-0.5">
            Cronograma Oficial y Notificaciones WhatsApp
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma segura de operaciones y comitivas territoriales
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="font-bold text-slate-300 block mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@voyconelkz.com"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-black py-3 rounded-xl shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Accediendo...' : 'Ingresar a la Plataforma'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Fast Role Login selector */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-[11px] font-bold text-slate-400 mb-2.5 text-center uppercase tracking-wider">
            Accesos Rápidos de Campaña:
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@voyconelkz.com')}
              className="text-left p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs flex items-center justify-between text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#38b6ff]" />
                <span className="font-bold">Administrador General</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">admin@voyconelkz.com</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('candidato@voyconelkz.com')}
              className="text-left p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs flex items-center justify-between text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Candidato KZ</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">candidato@voyconelkz.com</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('avanzada@voyconelkz.com')}
              className="text-left p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-xs flex items-center justify-between text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span className="font-bold">Coordinador de Avanzada</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">avanzada@voyconelkz.com</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
