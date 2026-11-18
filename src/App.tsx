import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { DashboardOverview } from './components/DashboardOverview';
import { TransactionsManager } from './components/TransactionsManager';
import { ThirdPartyLoansManager } from './components/ThirdPartyLoansManager';
import { OwnDebtsManager } from './components/OwnDebtsManager';
import { CashFlowReports } from './components/CashFlowReports';
import { NotificationCenter } from './components/NotificationCenter';
import { QuickAddModal } from './components/QuickAddModal';
import { AuthGate } from './components/AuthGate';
import {
  Bell,
  Plus,
  RefreshCw,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  UploadCloud,
  Sparkles,
  X,
} from 'lucide-react';

type NavTab = 'resumen' | 'transacciones' | 'prestamos' | 'deudas' | 'reportes';

function MainApp() {
  const {
    data,
    isLoading,
    isSyncing,
    activeAlerts,
    syncStatus,
    lastSyncTime,
    user,
    isAuthReady,
    localModeBypassed,
    signInWithGoogle,
    signOutUser,
    migrateLocalDataToFirebase,
    resetData,
    setCurrency,
    exportBackup,
    importBackup,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<NavTab>('resumen');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialType, setQuickAddInitialType] = useState<
    'ingreso' | 'egreso' | 'prestamo' | 'deuda'
  >('ingreso');

  // Show AuthGate if not authenticated and not explicitly in local mode
  if (!user && !localModeBypassed) {
    return <AuthGate />;
  }

  const handleOpenQuickAdd = (type: 'ingreso' | 'egreso' | 'prestamo' | 'deuda' = 'ingreso') => {
    setQuickAddInitialType(type);
    setIsQuickAddOpen(true);
  };

  const handleSelectLoanFromDashboard = (loanId: string) => {
    setSelectedLoanId(loanId);
    setActiveTab('prestamos');
  };

  const handleSelectDebtFromDashboard = (debtId: string) => {
    setSelectedDebtId(debtId);
    setActiveTab('deudas');
  };

  const hasLocalSavedData = (() => {
    try {
      const raw = localStorage.getItem('finanzen_local_cache_v1');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return (
        (parsed.transactions?.length || 0) > 0 ||
        (parsed.loans?.length || 0) > 0 ||
        (parsed.debts?.length || 0) > 0
      );
    } catch {
      return false;
    }
  })();

  const isCloudEmpty =
    Boolean(user) &&
    !isLoading &&
    data.transactions.length === 0 &&
    data.loans.length === 0 &&
    data.debts.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* ================= TOP BAR (CONFORMS STRICTLY TO TOP BAR CONTRACT) ================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark in display face */}
          <button
            onClick={() => setActiveTab('resumen')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            FinanZen
          </button>

          {/* Zone 2: 5 single-line clean navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('resumen')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'resumen' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('transacciones')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'transacciones' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Ingresos y Gastos
            </button>
            <button
              onClick={() => setActiveTab('prestamos')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'prestamos' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Préstamos a Terceros
            </button>
            <button
              onClick={() => setActiveTab('deudas')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'deudas' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Mis Deudas (E.A.)
            </button>
            <button
              onClick={() => setActiveTab('reportes')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'reportes' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Flujo de Caja
            </button>
          </nav>

          {/* Zone 3: Account status, notifications & primary action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {user ? (
              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70">
                {isSyncing || syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span
                  className="max-w-[150px] truncate font-medium text-slate-700"
                  title={
                    lastSyncTime
                      ? `${user.email} · Sincronizado ${lastSyncTime.toLocaleTimeString('es-CO')}`
                      : user.email || ''
                  }
                >
                  {user.email}
                </span>
                <button
                  onClick={signOutUser}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Vincular con Google y Firebase para sincronizar en tiempo real"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Conectar Google</span>
              </button>
            )}

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setIsNotificationCenterOpen(true)}
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Abrir centro de notificaciones y recordatorios"
            >
              <Bell className="w-5 h-5" />
              {activeAlerts.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center font-mono">
                  {activeAlerts.length}
                </span>
              )}
            </button>

            {/* Primary Action Button */}
            <button
              onClick={() => handleOpenQuickAdd('ingreso')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-1 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === 'resumen' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Resumen
          </button>
          <button
            onClick={() => setActiveTab('transacciones')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === 'transacciones' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Ingresos / Gastos
          </button>
          <button
            onClick={() => setActiveTab('prestamos')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === 'prestamos' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Préstamos
          </button>
          <button
            onClick={() => setActiveTab('deudas')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === 'deudas' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Mis Deudas
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ${
              activeTab === 'reportes' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Flujo de Caja
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT VIEWPORT ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Local Mode Banner if user chose to bypass auth */}
        {!user && isAuthReady && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CloudOff className="w-5 h-5 text-slate-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Estás usando el modo local (solo en este navegador)
                </span>
                <span className="text-slate-500">
                  Inicia sesión con tu cuenta de Google para sincronizar tus datos en tiempo real con Firebase.
                </span>
              </div>
            </div>
            <button
              onClick={signInWithGoogle}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              Vincular con Google
            </button>
          </div>
        )}

        {/* First-Time Cloud Onboarding Card */}
        {isCloudEmpty && !onboardingDismissed && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900">
                ¡Bienvenido a tu cuenta en la nube, {user?.displayName || user?.email}!
              </h2>
              <p className="text-xs text-slate-600">
                Tu espacio de Firebase está listo y sincronizado en tiempo real. Puedes subir los datos
                guardados en este navegador, cargar ejemplos para probar o empezar desde cero.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {hasLocalSavedData && (
                <button
                  disabled={isMigrating}
                  onClick={async () => {
                    setIsMigrating(true);
                    await migrateLocalDataToFirebase();
                    setIsMigrating(false);
                    setOnboardingDismissed(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isMigrating ? 'Subiendo...' : 'Subir datos de este dispositivo'}</span>
                </button>
              )}

              <button
                disabled={isMigrating}
                onClick={async () => {
                  setIsMigrating(true);
                  await resetData('seed');
                  setIsMigrating(false);
                  setOnboardingDismissed(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>Cargar datos de ejemplo</span>
              </button>

              <button
                onClick={() => setOnboardingDismissed(true)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                aria-label="Cerrar bienvenida"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Loading Skeleton while Firestore syncs initial snapshot */}
        {user && isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200" />
              ))}
            </div>
            <div className="h-64 bg-white rounded-2xl border border-slate-200" />
          </div>
        ) : (
          <>
            {activeTab === 'resumen' && (
              <DashboardOverview
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenQuickAdd={handleOpenQuickAdd}
                onSelectLoan={handleSelectLoanFromDashboard}
                onSelectDebt={handleSelectDebtFromDashboard}
                onOpenNotifications={() => setIsNotificationCenterOpen(true)}
              />
            )}

            {activeTab === 'transacciones' && <TransactionsManager />}

            {activeTab === 'prestamos' && (
              <ThirdPartyLoansManager
                selectedLoanId={selectedLoanId}
                onClearSelectedLoan={() => setSelectedLoanId(null)}
              />
            )}

            {activeTab === 'deudas' && (
              <OwnDebtsManager
                selectedDebtId={selectedDebtId}
                onClearSelectedDebt={() => setSelectedDebtId(null)}
              />
            )}

            {activeTab === 'reportes' && <CashFlowReports />}
          </>
        )}
      </main>

      {/* ================= FOOTER / STATUS BAR ================= */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-700">FinanZen</span>
            <span aria-hidden="true">·</span>
            <span>
              {user
                ? `Conectado con Firebase (${user.email})`
                : 'Modo local (inicia sesión con Google para sincronizar en la nube)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Currency selector */}
            <div className="flex items-center gap-1.5">
              <span>Moneda:</span>
              <select
                value={data.currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 font-mono font-medium focus:outline-none"
              >
                <option value="COP">COP ($ Pesos)</option>
                <option value="USD">USD ($ Dólares)</option>
                <option value="EUR">EUR (€ Euros)</option>
                <option value="MXN">MXN ($ México)</option>
              </select>
            </div>

            <button
              onClick={exportBackup}
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer"
              title="Descargar archivo de respaldo JSON"
            >
              Exportar copia
            </button>

            <label className="text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer">
              <span>Importar copia</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                      const success = await importBackup(text);
                      if (success) {
                        alert('¡Copia de seguridad restaurada exitosamente!');
                      } else {
                        alert(
                          'Error al leer el archivo. Asegúrate de que sea un archivo JSON exportado por FinanZen.'
                        );
                      }
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>

            <button
              onClick={() => {
                if (
                  confirm(
                    '¿Deseas restaurar los datos de ejemplo iniciales (Colombia)? Tus datos actuales se reemplazarán.'
                  )
                ) {
                  resetData('seed');
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Restaurar datos de ejemplo"
            >
              Restaurar ejemplos
            </button>

            <button
              onClick={() => {
                if (
                  confirm(
                    '¿Deseas vaciar todos los registros para empezar desde cero con tu información propia?'
                  )
                ) {
                  resetData('clean');
                }
              }}
              className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Empezar en blanco"
            >
              Limpiar todo
            </button>

            {user && (
              <button
                onClick={signOutUser}
                className="lg:hidden text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Drawers and Modals */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onSelectLoan={(id) => {
          setSelectedLoanId(id);
          setActiveTab('prestamos');
        }}
        onSelectDebt={(id) => {
          setSelectedDebtId(id);
          setActiveTab('deudas');
        }}
      />

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialType={quickAddInitialType}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <MainApp />
    </FinanceProvider>
  );
}
