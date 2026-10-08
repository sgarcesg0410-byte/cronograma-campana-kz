import React, { useState, useEffect } from 'react';
import { Activity, Contact } from '../types';
import { api } from '../services/api';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Share2, 
  Bot, 
  Smartphone, 
  User, 
  ExternalLink 
} from 'lucide-react';

interface WhatsAppActivityQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  type: 'activity' | 'call_leaders';
  contacts: Contact[];
}

export const WhatsAppActivityQuickModal: React.FC<WhatsAppActivityQuickModalProps> = ({
  isOpen,
  onClose,
  activity,
  type,
  contacts,
}) => {
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [preview, setPreview] = useState<{ title: string; messageText: string; directLink: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingApi, setSendingApi] = useState(false);

  useEffect(() => {
    if (activity && isOpen) {
      loadPreview();
    }
  }, [activity, type, isOpen, selectedPhone, customPhone]);

  const loadPreview = async () => {
    if (!activity) return;
    try {
      const phone = customPhone || selectedPhone;
      const data = await api.getWhatsAppPreview(type, {
        activityId: activity.id,
        phone: phone || undefined,
      });
      setPreview(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen || !activity) return null;

  const handleCopy = () => {
    if (!preview) return;
    navigator.clipboard.writeText(preview.messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendApi = async () => {
    if (!preview) return;
    setSendingApi(true);
    try {
      const phone = customPhone || selectedPhone || 'Equipo de Campaña';
      const res = await api.sendAutomatedWhatsApp({
        phone,
        recipientName: activity.responsible_name,
        messageText: preview.messageText,
        activityId: activity.id,
      });
      alert(res.message);
      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSendingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#075e54] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base text-white">
                {type === 'activity' ? 'Notificar Actividad por WhatsApp' : 'Convocatoria a Líderes y Simpatizantes'}
              </h3>
              <p className="text-xs text-emerald-200">
                #VOY CON EL KZ | {activity.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
          
          {/* Recipient picker */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Destinatario (Contacto o Grupo de Campaña)
            </label>
            <select
              value={selectedPhone}
              onChange={(e) => {
                setSelectedPhone(e.target.value);
                if (e.target.value) setCustomPhone('');
              }}
              className="w-full border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Sin destinatario fijo (Elegir en WhatsApp) --</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.phone}>
                  {c.name} ({c.role_description} - {c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Formatted Message Preview */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Mensaje Formateado con Estilo de Campaña:
            </label>
            <div className="bg-[#efeae2] p-4 rounded-2xl border border-slate-300 max-h-56 overflow-y-auto">
              <div className="bg-[#dcf8c6] p-3 rounded-xl shadow-xs text-slate-800 font-sans whitespace-pre-wrap leading-relaxed text-xs">
                {preview?.messageText || 'Cargando formato...'}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            {preview && (
              <a
                href={preview.directLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
              >
                <Smartphone className="w-4 h-4" />
                <span>Abrir en WhatsApp Web / Celular (1-Clic)</span>
              </a>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopy}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-300 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Texto Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button
                onClick={handleSendApi}
                disabled={sendingApi}
                className="bg-[#38b6ff] hover:bg-[#1fa5f5] text-slate-950 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{sendingApi ? 'Enviando...' : 'Despachar por API'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
