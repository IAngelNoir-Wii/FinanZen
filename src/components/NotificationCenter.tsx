import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate, generateWhatsAppReminderUrl } from '../utils/financialCalculations';
import { Bell, AlertTriangle, Clock, CheckCircle2, MessageCircle, X } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLoan: (loanId: string) => void;
  onSelectDebt: (debtId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onSelectLoan,
  onSelectDebt,
}) => {
  const {
    activeAlerts,
    data,
    browserNotificationsAllowed,
    requestNotificationPermission,
  } = useFinance();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recordatorios de Pago</h2>
              <p className="text-xs text-slate-500">
                {activeAlerts.length} alerta{activeAlerts.length === 1 ? '' : 's'} pendiente{activeAlerts.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Cerrar panel de notificaciones"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Permission Banner if not enabled */}
        {!browserNotificationsAllowed && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800">
              <p className="font-medium">Activa notificaciones automáticas</p>
              <p className="text-amber-700 mt-0.5">
                Recibe avisos automáticos en tu dispositivo cuando se acerquen las fechas límite.
              </p>
              <button
                onClick={requestNotificationPermission}
                className="mt-2 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition-colors"
              >
                Permitir en este navegador
              </button>
            </div>
          </div>
        )}

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700">¡Al día!</p>
              <p className="text-xs text-slate-500 mt-1">
                No tienes pagos vencidos ni fechas próximas en los siguientes 7 días.
              </p>
            </div>
          ) : (
            activeAlerts.map((alert) => {
              const isLoan = alert.type === 'prestamo_por_cobrar';
              const isOverdue = alert.daysRemaining < 0;
              const isToday = alert.daysRemaining === 0;

              // Find associated loan for WhatsApp link if applicable
              const loan = isLoan ? data.loans.find((l) => l.id === alert.entityId) : null;
              const waUrl = loan ? generateWhatsAppReminderUrl(loan) : '';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isOverdue
                      ? 'bg-rose-50/60 border-rose-200'
                      : isToday
                      ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isLoan
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {isLoan ? 'Cobro a Tercero' : 'Pago Deuda Propia'}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        isOverdue
                          ? 'text-rose-600'
                          : isToday
                          ? 'text-amber-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {isOverdue
                        ? `Vencido hace ${Math.abs(alert.daysRemaining)}d`
                        : isToday
                        ? '¡Vence Hoy!'
                        : `Vence en ${alert.daysRemaining}d`}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 mt-1.5">{alert.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDate(alert.dueDate)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLoan && waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                          title="Enviar recordatorio cortés por WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          if (isLoan) {
                            onSelectLoan(alert.entityId);
                          } else {
                            onSelectDebt(alert.entityId);
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors"
                      >
                        Ver cuenta
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
          Sincronizado en tiempo real en todos tus dispositivos
        </div>
      </div>
    </div>
  );
};
