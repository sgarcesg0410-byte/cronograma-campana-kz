import React, { useState } from 'react';
import { Contact } from '../types';
import { 
  Users, 
  Plus, 
  Phone, 
  Share2, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  UserPlus, 
  Search, 
  Radio, 
  Shield, 
  Truck,
  Sparkles
} from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onAddContact: (contact: Partial<Contact>) => Promise<void>;
  onDeleteContact: (id: number) => Promise<void>;
  onOpenWhatsAppDirect: (phone: string, name: string) => void;
}

export const CONTACT_CATEGORIES: Record<Contact['category'], { label: string; color: string; icon: any }> = {
  comitiva: { label: 'Comitiva de Avanzada', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Users },
  prensa: { label: 'Prensa y Comunicaciones', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Radio },
  lider_barrial: { label: 'Líder Territorial / Barrial', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Sparkles },
  seguridad: { label: 'Seguridad y Protocolo', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Shield },
  logistica: { label: 'Transporte y Sonido', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Truck },
};

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onAddContact,
  onDeleteContact,
  onOpenWhatsAppDirect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    role_description: '',
    phone: '',
    category: 'comitiva',
    active: 1,
  });

  const filteredContacts = contacts.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.role_description.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) return;
    await onAddContact(newContact);
    setNewContact({
      name: '',
      role_description: '',
      phone: '',
      category: 'comitiva',
      active: 1,
    });
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
            Directorio de Comitivas y Contactos de Campaña
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Grupos de líderes, avanzada, seguridad y prensa para difusiones en tiempo real por WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform hover:scale-105"
        >
          <UserPlus className="w-4 h-4" />
          <span>Agregar Contacto / Grupo</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar contacto por nombre, comisión o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38b6ff] bg-slate-50"
          />
        </div>
      </div>

      {/* Contacts List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((c) => {
          const cat = CONTACT_CATEGORIES[c.category] || CONTACT_CATEGORIES.comitiva;
          const CatIcon = cat.icon;

          return (
            <div
              key={c.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border ${cat.color}`}>
                    <CatIcon className="w-3 h-3" />
                    <span>{cat.label}</span>
                  </span>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {c.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 leading-snug">
                  {c.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {c.role_description}
                </p>

                <div className="mt-3 flex items-center gap-2 text-xs font-mono font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{c.phone}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onOpenWhatsAppDirect(c.phone, c.name)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Enviar WhatsApp</span>
                </button>

                <button
                  onClick={() => onDeleteContact(c.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Eliminar contacto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 font-heading mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#38b6ff]" />
              Nuevo Contacto de Campaña
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre o Grupo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Líderes Zona Occidental o Carlos Méndez"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Rol / Comisión *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Coordinador de Prensa / Comitiva Territorial"
                  value={newContact.role_description}
                  onChange={(e) => setNewContact({ ...newContact, role_description: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Número de WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. +573001234567"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-[#38b6ff]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Incluir indicativo de país (ej. +57)</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                <select
                  value={newContact.category}
                  onChange={(e) => setNewContact({ ...newContact, category: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-[#38b6ff]"
                >
                  <option value="comitiva">Comitiva de Avanzada</option>
                  <option value="prensa">Prensa y Comunicaciones</option>
                  <option value="lider_barrial">Líder Territorial / Barrial</option>
                  <option value="seguridad">Seguridad y Protocolo</option>
                  <option value="logistica">Transporte y Sonido</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold px-5 py-2 rounded-xl"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
