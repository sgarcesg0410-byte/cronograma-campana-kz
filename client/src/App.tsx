import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { Activity, ActivityStatus, Contact, DashboardStats, User } from './types';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DailyAgendaView } from './components/DailyAgendaView';
import { CalendarView } from './components/CalendarView';
import { ReportsView } from './components/ReportsView';
import { WhatsAppCenterView } from './components/WhatsAppCenterView';
import { ContactsView } from './components/ContactsView';
import { PrintReportView } from './components/PrintReportView';
import { ActivityModal } from './components/ActivityModal';
import { WhatsAppActivityQuickModal } from './components/WhatsAppActivityQuickModal';
import { LoginModal } from './components/LoginModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [currentView, setCurrentView] = useState<string>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<string | undefined>(undefined);

  const [isQuickWhatsAppOpen, setIsQuickWhatsAppOpen] = useState(false);
  const [quickWhatsAppActivity, setQuickWhatsAppActivity] = useState<Activity | null>(null);
  const [quickWhatsAppType, setQuickWhatsAppType] = useState<'activity' | 'call_leaders'>('activity');

  // Check initial authentication
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const user = await api.getCurrentUser();
    setCurrentUser(user);
    setAuthChecked(true);
    if (user) {
      loadInitialData();
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [acts, cts, st] = await Promise.all([
        api.getActivities(),
        api.getContacts(),
        api.getDashboardStats(),
      ]);
      setActivities(acts);
      setContacts(cts);
      setStats(st);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadInitialData();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  // Activity Actions
  const handleOpenCreateModal = (dateToUse?: string) => {
    setActivityToEdit(null);
    setDefaultModalDate(dateToUse || selectedDate);
    setIsActivityModalOpen(true);
  };

  const handleEditActivity = (act: Activity) => {
    setActivityToEdit(act);
    setDefaultModalDate(act.date);
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (data: Partial<Activity>) => {
    if (activityToEdit) {
      await api.updateActivity(activityToEdit.id, data);
    } else {
      await api.createActivity(data);
    }
    await loadInitialData();
  };

  const handleDeleteActivity = async (id: number) => {
    if (!confirm('¿Confirma que desea eliminar esta actividad del cronograma?')) return;
    try {
      await api.deleteActivity(id);
      await loadInitialData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdateStatus = async (id: number, status: ActivityStatus) => {
    try {
      await api.updateActivity(id, { status });
      await loadInitialData();
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  // Quick WhatsApp for specific activity
  const handleOpenWhatsAppActivity = (activity: Activity, type: 'activity' | 'call_leaders') => {
    setQuickWhatsAppActivity(activity);
    setQuickWhatsAppType(type);
    setIsQuickWhatsAppOpen(true);
  };

  // Contact actions
  const handleAddContact = async (contactData: Partial<Contact>) => {
    await api.createContact(contactData);
    await loadInitialData();
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm('¿Eliminar contacto del directorio?')) return;
    await api.deleteContact(id);
    await loadInitialData();
  };

  const handleOpenWhatsAppDirectFromContact = (phone: string, name: string) => {
    setCurrentView('whatsapp');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin w-8 h-8 border-4 border-[#38b6ff] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenCreateModal={() => handleOpenCreateModal()}
        onOpenWhatsAppModal={() => setCurrentView('whatsapp')}
        onSelectView={setCurrentView}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          summary={stats?.summary}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl">
          {loading && activities.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#38b6ff] border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {currentView === 'daily' && (
                <DailyAgendaView
                  activities={activities}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onOpenCreateModal={handleOpenCreateModal}
                  onEditActivity={handleEditActivity}
                  onDeleteActivity={handleDeleteActivity}
                  onUpdateStatus={handleUpdateStatus}
                  onOpenWhatsAppActivity={handleOpenWhatsAppActivity}
                />
              )}

              {currentView === 'calendar' && (
                <CalendarView
                  activities={activities}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setCurrentView('daily');
                  }}
                  onOpenCreateModal={handleOpenCreateModal}
                  onSelectActivity={(act) => {
                    setSelectedDate(act.date);
                    setCurrentView('daily');
                  }}
                />
              )}

              {currentView === 'reports' && (
                <ReportsView
                  stats={stats}
                  activities={activities}
                  onSelectView={setCurrentView}
                />
              )}

              {currentView === 'whatsapp' && (
                <WhatsAppCenterView
                  activities={activities}
                  contacts={contacts}
                  selectedDate={selectedDate}
                />
              )}

              {currentView === 'contacts' && (
                <ContactsView
                  contacts={contacts}
                  onAddContact={handleAddContact}
                  onDeleteContact={handleDeleteContact}
                  onOpenWhatsAppDirect={handleOpenWhatsAppDirectFromContact}
                />
              )}

              {currentView === 'print' && (
                <PrintReportView
                  activities={activities}
                  selectedDate={selectedDate}
                />
              )}
            </>
          )}
        </main>

      </div>

      {/* Activity Create / Edit Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onSave={handleSaveActivity}
        activityToEdit={activityToEdit}
        defaultDate={defaultModalDate}
      />

      {/* Quick WhatsApp Activity Modal */}
      <WhatsAppActivityQuickModal
        isOpen={isQuickWhatsAppOpen}
        onClose={() => setIsQuickWhatsAppOpen(false)}
        activity={quickWhatsAppActivity}
        type={quickWhatsAppType}
        contacts={contacts}
      />

    </div>
  );
};

export default App;
