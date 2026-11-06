import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { DashboardOverview } from './components/DashboardOverview';
import { TransactionsManager } from './components/TransactionsManager';
import { ThirdPartyLoansManager } from './components/ThirdPartyLoansManager';
import { OwnDebtsManager } from './components/OwnDebtsManager';
import { CashFlowReports } from './components/CashFlowReports';
import { NotificationCenter } from './components/NotificationCenter';
import { QuickAddModal } from './components/QuickAddModal';
import {
  Bell,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
  Database,
} from 'lucide-react';

type NavTab = 'resumen' | 'transacciones' | 'prestamos' | 'deudas' | 'reportes';

function MainApp() {
  const {
    data,
    activeAlerts,
    syncStatus,
    lastSyncTime,
    triggerManualSync,
    resetData,
    setCurrency,
    exportBackup,
    importBackup,
  } = useFinance();

  const [activeTab, setActiveTab] = useState<NavTab>('resumen');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);

  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialType, setQuickAddInitialType] = useState<
    'ingreso' | 'egreso' | 'prestamo' | 'deuda'
  >('ingreso');

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* ================= TOP BAR (CONFORMS STRICTLY TO TOP BAR CONTRACT) ================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark in display face */}
          <button
            onClick={() => setActiveTab('resumen')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-700 transition-colors"
          >
            FinanZen
          </button>

          {/* Zone 2: 4-5 single-line clean navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('resumen')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'resumen' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('transacciones')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'transacciones' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Ingresos y Gastos
            </button>
            <button
              onClick={() => setActiveTab('prestamos')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'prestamos' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Préstamos a Terceros
            </button>
            <button
              onClick={() => setActiveTab('deudas')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'deudas' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Mis Deudas (E.A.)
            </button>
            <button
              onClick={() => setActiveTab('reportes')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'reportes' ? 'text-slate-950 font-bold' : ''
              }`}
            >
              Flujo de Caja
            </button>
          </nav>

          {/* Zone 3: 1 primary action & utility triggers */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Real-time status indicator */}
            <div
              onClick={triggerManualSync}
              className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors"
              title={
                lastSyncTime
                  ? `Sincronizado a las ${lastSyncTime.toLocaleTimeString('es-CO')}`
                  : 'Sincronizado en tiempo real'
              }
            >
              {syncStatus === 'online' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              ) : syncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="font-mono text-[11px]">En tiempo real</span>
            </div>

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setIsNotificationCenterOpen(true)}
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Abrir centro de notificaciones y recordatorios"
            >
              <Bell className="w-5 h-5" />
              {activeAlerts.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center font-mono animate-pulse">
                  {activeAlerts.length}
                </span>
              )}
            </button>

            {/* Primary Action Button */}
            <button
              onClick={() => handleOpenQuickAdd('ingreso')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      </main>

      {/* ================= FOOTER / STATUS BAR ================= */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">FinanZen</span>
            <span>·</span>
            <span>Sincronizado en tiempo real en la nube</span>
            <span>·</span>
            <span>Acceso seguro desde cualquier dispositivo</span>
          </div>

          <div className="flex items-center gap-4">
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

            {/* Export & Import Backup (especially useful for static GitHub Pages) */}
            <button
              onClick={exportBackup}
              className="text-slate-600 hover:text-slate-900 transition-colors font-medium"
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
                  reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                      const success = importBackup(text);
                      if (success) {
                        alert('¡Copia de seguridad restaurada exitosamente!');
                      } else {
                        alert('Error al leer el archivo. Asegúrate de que sea un archivo JSON exportado por FinanZen.');
                      }
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>

            {/* Seed / Reset option */}
            <button
              onClick={() => {
                if (
                  confirm(
                    '¿Deseas restaurar los datos de ejemplo iniciales (Colombia)? Tus cambios actuales se reemplazarán.'
                  )
                ) {
                  resetData('seed');
                }
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
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
              className="text-slate-400 hover:text-rose-600 transition-colors"
              title="Empezar en blanco"
            >
              Limpiar todo
            </button>
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
