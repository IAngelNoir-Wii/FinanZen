import React from 'react';
import { useFinance } from '../context/FinanceContext';
import {
  calculateLoanSummary,
  formatCurrency,
  formatDate,
  getDaysDifference,
  generateWhatsAppReminderUrl,
} from '../utils/financialCalculations';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  MessageCircle,
  ChevronRight,
  CheckCircle2,
  Bell,
  Percent,
} from 'lucide-react';

interface DashboardOverviewProps {
  onNavigateTab: (tab: 'transacciones' | 'prestamos' | 'deudas' | 'reportes') => void;
  onOpenQuickAdd: (type?: 'ingreso' | 'egreso' | 'prestamo' | 'deuda') => void;
  onSelectLoan: (loanId: string) => void;
  onSelectDebt: (debtId: string) => void;
  onOpenNotifications: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateTab,
  onOpenQuickAdd,
  onSelectLoan,
  onSelectDebt,
  onOpenNotifications,
}) => {
  const { data, activeAlerts } = useFinance();

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Current month income & expenses
  const currentMonthTxs = data.transactions.filter((tx) => {
    const parts = tx.date.split('-');
    return (
      parts.length === 3 &&
      parseInt(parts[0], 10) === currentYear &&
      parseInt(parts[1], 10) === currentMonth
    );
  });

  const monthIncome = currentMonthTxs
    .filter((t) => t.type === 'ingreso')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const monthExpense = currentMonthTxs
    .filter((t) => t.type === 'egreso')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const monthNetFlow = monthIncome - monthExpense;

  // Third party loans summary
  const activeLoans = data.loans.filter((l) => !calculateLoanSummary(l).isSettled);
  const totalLoaned = data.loans.reduce((acc, l) => acc + (Number(l.initialAmount) || 0), 0);
  const totalCollectedFromLoans = data.loans.reduce(
    (acc, l) => acc + calculateLoanSummary(l).totalPaid,
    0
  );
  const totalReceivable = Math.max(0, totalLoaned - totalCollectedFromLoans);

  // Own debts summary
  const activeDebts = data.debts.filter((d) => d.currentBalance > 0);
  const totalDebtsBalance = data.debts.reduce(
    (acc, d) => acc + (Number(d.currentBalance) || 0),
    0
  );
  const totalMonthlyDebtQuotas = activeDebts.reduce(
    (acc, d) => acc + (Number(d.monthlyPayment) || 0),
    0
  );

  // Top urgent alerts
  const urgentAlerts = activeAlerts.filter((a) => a.daysRemaining <= 3);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Notification Bar if alerts exist */}
      {urgentAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                ¡Tienes {urgentAlerts.length} compromiso{urgentAlerts.length === 1 ? '' : 's'} de pago
                próximo{urgentAlerts.length === 1 ? '' : 's'} o vencido{urgentAlerts.length === 1 ? '' : 's'}!
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {urgentAlerts[0]?.title}: {urgentAlerts[0]?.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {urgentAlerts[0]?.type === 'prestamo_por_cobrar' && urgentAlerts[0]?.personPhone && (
              <a
                href={
                  generateWhatsAppReminderUrl(
                    data.loans.find((l) => l.id === urgentAlerts[0].entityId)!
                  ) || '#'
                }
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Cobrar por WhatsApp</span>
              </a>
            )}

            <button
              onClick={onOpenNotifications}
              className="px-3 py-1.5 bg-amber-900/10 hover:bg-amber-900/20 text-amber-950 rounded-lg text-xs font-semibold transition-colors"
            >
              Ver todas ({activeAlerts.length})
            </button>
          </div>
        </div>
      )}

      {/* Main KPI Quad Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Flujo Neto del Mes */}
        <div
          onClick={() => onNavigateTab('reportes')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Flujo de Caja Mes</span>
            <div className="p-2 bg-slate-50 group-hover:bg-slate-100 rounded-lg text-slate-700 transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              monthNetFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(monthNetFlow, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>+{formatCurrency(monthIncome, data.currency)} ingresos</span>
            <span className="text-rose-500">-{formatCurrency(monthExpense, data.currency)}</span>
          </div>
        </div>

        {/* Por Cobrar a Terceros */}
        <div
          onClick={() => onNavigateTab('prestamos')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Por Cobrar (Terceros)</span>
            <div className="p-2 bg-emerald-50 group-hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {formatCurrency(totalReceivable, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{activeLoans.length} personas con saldo</span>
            <span className="text-emerald-600 font-medium">Ver cuentas →</span>
          </div>
        </div>

        {/* Total Deuda Propia */}
        <div
          onClick={() => onNavigateTab('deudas')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mis Deudas (Pasivos)</span>
            <div className="p-2 bg-indigo-50 group-hover:bg-indigo-100 rounded-lg text-indigo-700 transition-colors">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totalDebtsBalance, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>{activeDebts.length} créditos / tarjetas</span>
            <span className="text-indigo-600 font-medium">Calcular E.A. →</span>
          </div>
        </div>

        {/* Cuotas del Mes a Pagar */}
        <div
          onClick={() => onNavigateTab('deudas')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuotas Deuda Mes</span>
            <div className="p-2 bg-rose-50 group-hover:bg-rose-100 rounded-lg text-rose-700 transition-colors">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
            {formatCurrency(totalMonthlyDebtQuotas, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Presupuesto mensual fijo</span>
            <span className="text-slate-700 font-medium">Detalles →</span>
          </div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold">Acceso Rápido de Operaciones</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Registra movimientos o crea cuentas de cobro en un solo clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => onOpenQuickAdd('ingreso')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Ingreso</span>
          </button>

          <button
            onClick={() => onOpenQuickAdd('egreso')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Gasto / Egreso</span>
          </button>

          <button
            onClick={() => onOpenQuickAdd('prestamo')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Prestar a Tercero</span>
          </button>

          <button
            onClick={() => onOpenQuickAdd('deuda')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Nueva Deuda Banco</span>
          </button>
        </div>
      </div>

      {/* Split Grid: Third-Party Loans vs Own Debts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Cuentas de Préstamos a Terceros */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cuentas por Cobrar (Préstamos a Terceros)
                </h3>
                <p className="text-xs text-slate-500">
                  Personas que te deben y saldo pendiente de cada una
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('prestamos')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {activeLoans.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No tienes préstamos pendientes de cobro actualmente.
              </div>
            ) : (
              activeLoans.slice(0, 4).map((loan) => {
                const { totalPaid, remainingBalance, progressPercentage } =
                  calculateLoanSummary(loan);
                const daysRemaining = getDaysDifference(loan.dueDate);

                return (
                  <div
                    key={loan.id}
                    onClick={() => {
                      onNavigateTab('prestamos');
                      onSelectLoan(loan.id);
                    }}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors cursor-pointer border border-slate-100"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{loan.borrowerName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {loan.concept}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-emerald-700 tabular-nums">
                          {formatCurrency(remainingBalance, data.currency)}
                        </div>
                        <div className="text-[10px] text-slate-400">Saldo pendiente</div>
                      </div>
                    </div>

                    {/* Progress Bar & due info */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>Abonado: {formatCurrency(totalPaid, data.currency)}</span>
                        <span
                          className={`font-semibold ${
                            daysRemaining < 0 ? 'text-rose-600' : 'text-slate-600'
                          }`}
                        >
                          {daysRemaining < 0
                            ? `Vencido hace ${Math.abs(daysRemaining)}d`
                            : daysRemaining === 0
                            ? 'Vence Hoy'
                            : `Vence en ${daysRemaining}d`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Mis Deudas Propias (Bancos y Terceros) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Mis Deudas con Entidades (E.A. y Cuotas)
                </h3>
                <p className="text-xs text-slate-500">Pasivos bancarios y costo en intereses</p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('deudas')}
              className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {activeDebts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No tienes deudas activas registradas. ¡Felicitaciones!
              </div>
            ) : (
              activeDebts.slice(0, 4).map((debt) => (
                <div
                  key={debt.id}
                  onClick={() => {
                    onNavigateTab('deudas');
                    onSelectDebt(debt.id);
                  }}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors cursor-pointer border border-slate-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{debt.creditor}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                        {debt.concept}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                        {formatCurrency(debt.currentBalance, data.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400">Saldo actual</div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tasa E.A.</span>
                      <span className="font-bold font-mono text-indigo-700">
                        {debt.effectiveAnnualRate}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cuota Mes</span>
                      <span className="font-bold font-mono text-slate-800">
                        {formatCurrency(debt.monthlyPayment, data.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Pago Límite</span>
                      <span className="font-bold text-slate-700">Día {debt.paymentDay}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Table Preview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Últimos Movimientos Registrados</h3>
            <p className="text-xs text-slate-500">Historial reciente de ingresos, gastos y abonos</p>
          </div>

          <button
            onClick={() => onNavigateTab('transacciones')}
            className="text-xs text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1"
          >
            <span>Ver historial completo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {data.transactions.slice(0, 5).map((tx) => {
            const isIncome = tx.type === 'ingreso';

            return (
              <div
                key={tx.id}
                className="py-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors px-2 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{tx.description}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{formatDate(tx.date)}</span>
                      <span>·</span>
                      <span className="font-medium text-slate-600">{tx.category}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-sm tabular-nums ${
                      isIncome ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(tx.amount, data.currency)}
                  </div>
                  <div className="text-[10px] text-slate-400">{tx.paymentMethod}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
