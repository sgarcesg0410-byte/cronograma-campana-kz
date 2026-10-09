import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Edit3, 
  UserX, 
  UserCheck, 
  Lock, 
  Mail, 
  Phone, 
  MapPin, 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  X, 
  Clock 
} from 'lucide-react';
import { User, CampaignRole, UserCreatePayload, UserUpdatePayload } from '../types';
import { api } from '../services/api';

interface UsersManagementViewProps {
  currentUser: User;
}

const ROLE_INFO: Record<CampaignRole, { label: string; badge: string; desc: string }> = {
  admin: {
    label: 'Administrador',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    desc: 'Acceso total: gestión de usuarios, roles, auditoría, configuración y depuración de agenda.'
  },
  candidato: {
    label: 'Candidato Oficial',
    badge: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
    desc: 'Supervisión estratégica: consulta de agenda general, reportes ejecutivos y fichas de ruta.'
  },
  coordinador: {
    label: 'Coordinador Territorial',
    badge: 'bg-blue-100 text-blue-800 border-blue-300 font-bold',
    desc: 'Operación territorial: programación y edición de actividades, logística y comitivas.'
  },
  prensa: {
    label: 'Equipo de Prensa',
    badge: 'bg-purple-100 text-purple-800 border-purple-300 font-bold',
    desc: 'Comunicaciones y medios: creación de entrevistas, ruedas de prensa y difusión oficial.'
  },
  lider: {
    label: 'Líder Barrial / Comunal',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    desc: 'Convocatoria y movilización en su zona comunal asignada.'
  },
  avanzada: {
    label: 'Equipo de Avanzada',
    badge: 'bg-slate-100 text-slate-800 border-slate-300 font-bold',
    desc: 'Inspección de puntos de concentración y avanzada previa.'
  }
};

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<UserCreatePayload>({
    name: '',
    email: '',
    password: '',
    role: 'coordinador',
    zone: 'General',
    phone: '+57'
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<UserUpdatePayload & { newPasswordConfirm?: string }>({
    name: '',
    role: 'coordinador',
    zone: 'General',
    phone: '',
    active: 1,
    newPassword: '',
    newPasswordConfirm: ''
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterActive !== 'all') {
      const isActive = filterActive === '1';
      if (Boolean(u.active) !== isActive) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.zone && u.zone.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const activeAdminsCount = users.filter((u) => u.role === 'admin' && u.active === 1).length;

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createFormData.name.trim() || !createFormData.email.trim() || !createFormData.password.trim()) {
      setCreateError('Nombre, correo y contraseña son obligatorios.');
      return;
    }

    if (createFormData.password.length < 6) {
      setCreateError('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    if (createFormData.phone && createFormData.phone !== '+57') {
      const phoneRegex = /^\+[1-9]\d{7,14}$/;
      if (!phoneRegex.test(createFormData.phone.trim())) {
        setCreateError('El formato de teléfono debe ser internacional E.164 (Ej. +573001234567).');
        return;
      }
    }

    setCreateLoading(true);
    try {
      await api.createUser({
        ...createFormData,
        phone: createFormData.phone === '+57' ? undefined : createFormData.phone
      });
      setIsCreateOpen(false);
      setCreateFormData({
        name: '',
        email: '',
        password: '',
        role: 'coordinador',
        zone: 'General',
        phone: '+57'
      });
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear usuario.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditFormData({
      name: u.name,
      role: u.role,
      zone: u.zone || 'General',
      phone: u.phone || '',
      active: u.active ?? 1,
      newPassword: '',
      newPasswordConfirm: ''
    });
    setEditError(null);
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (editFormData.newPassword) {
      if (editFormData.newPassword.length < 6) {
        setEditError('La nueva contraseña debe tener mínimo 6 caracteres.');
        return;
      }
      if (editFormData.newPassword !== editFormData.newPasswordConfirm) {
        setEditError('Las nuevas contraseñas no coinciden.');
        return;
      }
    }

    if (editFormData.phone) {
      const phoneRegex = /^\+[1-9]\d{7,14}$/;
      if (!phoneRegex.test(editFormData.phone.trim())) {
        setEditError('El teléfono debe tener formato internacional E.164 (Ej. +573001234567).');
        return;
      }
    }

    // Protection check
    if (editingUser.role === 'admin' && activeAdminsCount <= 1) {
      if (editFormData.role !== 'admin' || editFormData.active === 0) {
        setEditError('No es posible degradar o desactivar al único Administrador activo de la campaña.');
        return;
      }
    }

    setEditLoading(true);
    try {
      await api.updateUser(editingUser.id, {
        name: editFormData.name,
        role: editFormData.role,
        zone: editFormData.zone,
        phone: editFormData.phone,
        active: editFormData.active,
        newPassword: editFormData.newPassword ? editFormData.newPassword : undefined
      });
      setIsEditOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar usuario.');
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle user quick deactivation
  const handleToggleActive = async (u: User) => {
    if (u.role === 'admin' && u.active === 1 && activeAdminsCount <= 1) {
      alert('Operación protegida: No es posible desactivar al único Administrador activo del sistema.');
      return;
    }

    const actionText = u.active === 1 ? 'desactivar' : 'activar';
    if (!confirm(`¿Confirma que desea ${actionText} la cuenta de ${u.name}?`)) return;

    try {
      if (u.active === 1) {
        await api.deleteUser(u.id);
      } else {
        await api.updateUser(u.id, { active: 1 });
      }
      await fetchUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              GESTIÓN DE ACCESOS Y ROLES RBAC
            </span>
            <span className="text-xs text-slate-400 font-mono">#VOY CON EL KZ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-slate-900">
            Equipo Oficial de Campaña y Asignación de Roles
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Control de cuentas autorizadas, roles con permisos cerrados, zonas territoriales y revocación inmediata de sesiones activas.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          className="bg-[#38b6ff] hover:bg-[#1ea2f3] text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-transform hover:scale-[1.02] flex items-center gap-2 self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Usuario</span>
        </button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(['admin', 'candidato', 'coordinador', 'prensa', 'lider'] as CampaignRole[]).map((r) => {
          const info = ROLE_INFO[r];
          const count = users.filter((u) => u.role === r && u.active === 1).length;
          return (
            <div key={r} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${info.badge}`}>
                    {info.label}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700">{count} act.</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {info.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, teléfono o zona..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38b6ff] bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Rol:</span>
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="candidato">Candidato Oficial</option>
            <option value="coordinador">Coordinador Territorial</option>
            <option value="prensa">Equipo de Prensa</option>
            <option value="lider">Líder Barrial</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-2">
            <span>Estado:</span>
          </div>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38b6ff]"
          >
            <option value="all">Todos los estados</option>
            <option value="1">Activos</option>
            <option value="0">Desactivados</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-heading font-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4">Zona Territorial</th>
                <th className="py-3 px-4">Teléfono (WhatsApp)</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Último Acceso</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="animate-spin w-6 h-6 border-2 border-[#38b6ff] border-t-transparent rounded-full mx-auto mb-2" />
                    Cargando equipo de campaña...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No se encontraron usuarios con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleConfig = ROLE_INFO[u.role] || { label: u.role, badge: 'bg-slate-100 text-slate-800' };
                  const isCurrent = u.id === currentUser.id;
                  const isLastAdmin = u.role === 'admin' && u.active === 1 && activeAdminsCount <= 1;

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.active === 0 ? 'bg-slate-50/60 opacity-70' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {u.name}
                          {isCurrent && (
                            <span className="text-[10px] bg-sky-100 text-[#0c7ab8] px-1.5 py-0.2 rounded font-mono font-normal">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {u.email}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${roleConfig.badge}`}>
                          {roleConfig.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{u.zone || 'General'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {u.phone ? (
                          <div className="flex items-center gap-1 text-slate-700 font-mono">
                            <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{u.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No registrado</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {u.active === 1 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <X className="w-3 h-3 text-rose-600" />
                            Desactivado
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {u.last_login ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{u.last_login.replace('T', ' ').slice(0, 16)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Nunca</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                            title="Editar usuario"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isLastAdmin}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isLastAdmin
                                ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                                : u.active === 1
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={
                              isLastAdmin
                                ? 'Último administrador activo (Protegido)'
                                : u.active === 1
                                ? 'Desactivar cuenta'
                                : 'Reactivar cuenta'
                            }
                          >
                            {u.active === 1 ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 font-heading text-lg">
                  Registrar Integrante de Campaña
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Carlos Mendoza"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Correo Electrónico Oficial *</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@voyconelkz.com"
                  value={createFormData.email}
                  onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#38b6ff] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Contraseña Inicial * (mínimo 6 caracteres)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rol en Campaña *</label>
                  <select
                    value={createFormData.role}
                    onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value as CampaignRole })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-slate-50 focus:ring-2 focus:ring-[#38b6ff] focus:outline-none font-bold"
                  >
                    <option value="coordinador">Coordinador Territorial</option>
                    <option value="candidato">Candidato Oficial</option>
                    <option value="prensa">Equipo de Prensa</option>
                    <option value="lider">Líder Barrial / Comunal</option>
                    <option value="admin">Administrador General</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Zona Territorial</label>
                  <input
                    type="text"
                    placeholder="Ej. Comuna 3, Zona Sur o General"
                    value={createFormData.zone}
                    onChange={(e) => setCreateFormData({ ...createFormData, zone: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Teléfono Móvil (WhatsApp Oficial E.164)
                </label>
                <input
                  type="text"
                  placeholder="+573001234567"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Debe iniciar con el signo más y el indicativo de país (Ej. +57 para Colombia).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-[#38b6ff] hover:bg-[#1ea2f3] text-slate-950 font-bold px-5 py-2 rounded-xl shadow-sm transition-transform hover:scale-[1.02] flex items-center gap-1.5"
                >
                  {createLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Crear Integrante</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditOpen && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0c7ab8] flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 font-heading text-lg">
                    Editar Datos y Privilegios
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">{editingUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rol en Campaña</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as CampaignRole })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-slate-50 focus:ring-2 focus:ring-[#38b6ff] focus:outline-none font-bold"
                  >
                    <option value="coordinador">Coordinador Territorial</option>
                    <option value="candidato">Candidato Oficial</option>
                    <option value="prensa">Equipo de Prensa</option>
                    <option value="lider">Líder Barrial / Comunal</option>
                    <option value="admin">Administrador General</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Zona Territorial</label>
                  <input
                    type="text"
                    value={editFormData.zone}
                    onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Teléfono Móvil (E.164)</label>
                <input
                  type="text"
                  placeholder="+573001234567"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-[#38b6ff] focus:outline-none"
                />
              </div>

              {/* Status active/deactivated */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Estado de la Cuenta</span>
                    <span className="text-[11px] text-slate-500">
                      Si se desactiva, cualquier sesión abierta se cerrará en tiempo real.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, active: editFormData.active === 1 ? 0 : 1 })}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      editFormData.active === 1
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {editFormData.active === 1 ? 'Activo' : 'Desactivado'}
                  </button>
                </div>
              </div>

              {/* Password update option */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Cambiar Contraseña (Opcional)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="border border-slate-300 rounded-lg p-2 text-xs bg-white"
                  />
                  <input
                    type="password"
                    placeholder="Confirmar contraseña"
                    value={editFormData.newPasswordConfirm}
                    onChange={(e) => setEditFormData({ ...editFormData, newPasswordConfirm: e.target.value })}
                    className="border border-slate-300 rounded-lg p-2 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="bg-[#38b6ff] hover:bg-[#1ea2f3] text-slate-950 font-bold px-5 py-2 rounded-xl shadow-sm transition-transform hover:scale-[1.02] flex items-center gap-1.5"
                >
                  {editLoading ? (
                    <div className="animate-spin w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
