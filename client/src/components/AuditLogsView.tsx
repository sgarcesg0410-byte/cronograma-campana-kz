import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  RefreshCw, 
  Search, 
  Filter, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Globe, 
  Clock, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(limit);
      setLogs(data);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      (log.user_name && log.user_name.toLowerCase().includes(q)) ||
      (log.user_email && log.user_email.toLowerCase().includes(q)) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(q)) ||
      (log.request_id && log.request_id.toLowerCase().includes(q))
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes('PURGE_DEMO')) {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (action.includes('USER_CREATED') || action.includes('USER_DEACTIVATED')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    if (action.includes('LOGIN_SUCCESS')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (action.includes('LOGIN_FAILED') || action.includes('DENIED') || action.includes('BLOCKED')) {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    if (action.includes('WHATSAPP')) {
      return 'bg-sky-100 text-sky-800 border-sky-300';
    }
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-rose-500/20 text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1.5 font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              REGISTRO AUDITABLE INMUTABLE
            </span>
            <span className="text-xs text-slate-400 font-mono">#VOY CON EL KZ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            Bitácora de Auditoría y Seguridad de Campaña
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Trazabilidad de eventos críticos: inicio de sesiones, cambios de privilegios, despachos de WhatsApp y depuraciones con Request ID.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Bitácora</span>
        </button>
      </div>

      {/* Filter and Limit Row */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por acción, usuario, recurso o Request ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38b6ff] bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Mostrar últimos:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
          >
            <option value="25">25 registros</option>
            <option value="50">50 registros</option>
            <option value="100">100 registros</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-heading font-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Acción Registrada</th>
                <th className="py-3 px-4">Usuario Responsable</th>
                <th className="py-3 px-4">Recurso</th>
                <th className="py-3 px-4">IP / Req-ID</th>
                <th className="py-3 px-4 text-right">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    <div className="animate-spin w-6 h-6 border-2 border-[#38b6ff] border-t-transparent rounded-full mx-auto mb-2" />
                    Consultando bitácora de auditoría...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                    No hay registros de auditoría disponibles.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  let parsedDetails = null;
                  try {
                    parsedDetails = log.details_json ? JSON.parse(log.details_json) : null;
                  } catch {
                    parsedDetails = log.details_json;
                  }

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {log.created_at.replace('T', ' ').slice(0, 19)}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-sans">
                          {log.user_name ? (
                            <div>
                              <span className="font-bold text-slate-900 block">{log.user_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{log.user_email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sistema / Público</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-700">
                          <span className="font-bold text-slate-800">{log.resource_type}</span>
                          {log.resource_id && log.resource_id !== 'n/a' && (
                            <span className="text-slate-500 text-[11px] block">#{log.resource_id}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          <div>{log.ip_address}</div>
                          {log.request_id && (
                            <div className="text-[10px] text-sky-600 font-bold">req:{log.request_id}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Ver detalles JSON"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-950 text-emerald-400">
                          <td colSpan={6} className="p-4 text-[11px] font-mono border-y border-slate-800">
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-[#38b6ff]" />
                                PayLoad de Evento Auditable [ID #{log.id}]
                              </span>
                              <span>User-Agent: {log.user_agent}</span>
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {JSON.stringify(parsedDetails, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
