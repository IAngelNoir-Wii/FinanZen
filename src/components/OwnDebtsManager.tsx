import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { OwnDebt, RateInputType } from '../types/finance';
import {
  calculateAllRates,
  formatCurrency,
  formatDate,
  getDaysDifference,
  simulateAmortizationSchedule,
} from '../utils/financialCalculations';
import {
  Building2,
  Plus,
  Percent,
  Calendar,
  CreditCard,
  TrendingDown,
  Trash2,
  X,
  ArrowUpRight,
  Calculator,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';

interface OwnDebtsManagerProps {
  selectedDebtId?: string | null;
  onClearSelectedDebt?: () => void;
}

export const OwnDebtsManager: React.FC<OwnDebtsManagerProps> = ({
  selectedDebtId,
  onClearSelectedDebt,
}) => {
  const { data, addOwnDebt, updateOwnDebt, deleteOwnDebt, addDebtPayment, deleteDebtPayment } =
    useFinance();

  const [activeDebtId, setActiveDebtId] = useState<string | null>(selectedDebtId || null);
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [paymentTargetDebt, setPaymentTargetDebt] = useState<OwnDebt | null>(null);
  const [showAmortizationSim, setShowAmortizationSim] = useState(false);

  // New Debt Form State
  const [newCreditor, setNewCreditor] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [newOriginalAmount, setNewOriginalAmount] = useState('');
  const [newCurrentBalance, setNewCurrentBalance] = useState('');
  const [newMonthlyPayment, setNewMonthlyPayment] = useState('');
  const [newCutoffDay, setNewCutoffDay] = useState('18');
  const [newPaymentDay, setNewPaymentDay] = useState('5');
  const [newRateType, setNewRateType] = useState<RateInputType>('ea');
  const [newEnteredRate, setNewEnteredRate] = useState('24.5');
  const [newNotes, setNewNotes] = useState('');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPrincipal, setPaymentPrincipal] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [syncWithCashFlow, setSyncWithCashFlow] = useState(true);

  // Sync prop if changed externally
  React.useEffect(() => {
    if (selectedDebtId) {
      setActiveDebtId(selectedDebtId);
    }
  }, [selectedDebtId]);

  // Overall totals
  const totalBalance = data.debts.reduce((acc, d) => acc + (Number(d.currentBalance) || 0), 0);
  const totalMonthlyCommitment = data.debts.reduce(
    (acc, d) => (d.currentBalance > 0 ? acc + (Number(d.monthlyPayment) || 0) : acc),
    0
  );
  const totalMonthlyInterest = data.debts.reduce(
    (acc, d) => (d.currentBalance > 0 ? acc + (Number(d.estimatedMonthlyInterest) || 0) : acc),
    0
  );

  // Live calculation preview in new debt modal
  const previewRates = calculateAllRates(
    newRateType,
    parseFloat(newEnteredRate) || 0,
    parseFloat(newCurrentBalance || newOriginalAmount) || 0
  );

  const activeDebt = activeDebtId ? data.debts.find((d) => d.id === activeDebtId) || null : null;

  // Handle create debt
  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const origNum = parseFloat(newOriginalAmount);
    const balNum = parseFloat(newCurrentBalance) || origNum;
    const paymentNum = parseFloat(newMonthlyPayment) || 0;
    const rateNum = parseFloat(newEnteredRate) || 0;

    if (!newCreditor || isNaN(origNum) || origNum <= 0) return;

    addOwnDebt({
      creditor: newCreditor.trim(),
      concept: newConcept.trim() || 'Crédito bancario',
      originalAmount: origNum,
      currentBalance: balNum,
      monthlyPayment: paymentNum,
      cutoffDay: parseInt(newCutoffDay, 10) || 15,
      paymentDay: parseInt(newPaymentDay, 10) || 5,
      rateType: newRateType,
      enteredRate: rateNum,
      notes: newNotes.trim() || undefined,
    });

    setIsAddDebtModalOpen(false);
    // Reset form
    setNewCreditor('');
    setNewConcept('');
    setNewOriginalAmount('');
    setNewCurrentBalance('');
    setNewMonthlyPayment('');
    setNewEnteredRate('24.5');
    setNewNotes('');
  };

  // Handle debt payment
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetDebt) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const principalNum = parseFloat(paymentPrincipal) || amountNum;
    const interestNum = Math.max(0, amountNum - principalNum);

    addDebtPayment(
      paymentTargetDebt.id,
      {
        amount: amountNum,
        date: paymentDate,
        principalAmount: principalNum,
        interestAmount: interestNum,
        notes: paymentNotes.trim() || undefined,
      },
      syncWithCashFlow
    );

    setIsAddPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentPrincipal('');
    setPaymentNotes('');
    setPaymentTargetDebt(null);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Deuda Actual</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totalBalance, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Saldo pendiente con entidades</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Compromiso Mensual</span>
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
            {formatCurrency(totalMonthlyCommitment, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Suma de cuotas a pagar al mes</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Costo Intereses Estimado</span>
            <Percent className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            ~{formatCurrency(totalMonthlyInterest, data.currency)}/mes
          </div>
          <p className="text-xs text-slate-500 mt-1">Cálculo exacto según Tasa E.A.</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Debts */}
        <div className={`space-y-4 ${activeDebt ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Entidades y Acreedores</h2>
              <p className="text-xs text-slate-500">
                {data.debts.length} entidad{data.debts.length === 1 ? '' : 'es'} registrada{data.debts.length === 1 ? '' : 's'}
              </p>
            </div>

            <button
              onClick={() => setIsAddDebtModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Deuda / Banco</span>
            </button>
          </div>

          <div className="space-y-3">
            {data.debts.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Sin deudas registradas</p>
                <p className="text-xs text-slate-500 mt-1">
                  Registra tus tarjetas o créditos bancarios para calcular su Tasa E.A. y proyectar su pago.
                </p>
                <button
                  onClick={() => setIsAddDebtModalOpen(true)}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                >
                  Registrar Primera Deuda
                </button>
              </div>
            ) : (
              data.debts.map((debt) => {
                const isSelected = activeDebtId === debt.id;
                const isLiquidated = debt.currentBalance <= 0;

                return (
                  <div
                    key={debt.id}
                    onClick={() => setActiveDebtId(debt.id)}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {debt.creditor}
                          </h3>
                          {isLiquidated ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              Liquidada
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                              Pago día {debt.paymentDay}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{debt.concept}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {formatCurrency(debt.currentBalance, data.currency)}
                        </div>
                        <div className="text-[11px] text-slate-400">Saldo actual</div>
                      </div>
                    </div>

                    {/* Rates & Payment Strip */}
                    <div className="mt-3 grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Tasa E.A.</span>
                        <span className="font-bold font-mono text-indigo-600">
                          {debt.effectiveAnnualRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Mes Vencido</span>
                        <span className="font-bold font-mono text-slate-700">
                          {debt.monthlyRate}%/m
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Cuota Mensual</span>
                        <span className="font-bold font-mono text-slate-800">
                          {formatCurrency(debt.monthlyPayment, data.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">
                        Interés: ~{formatCurrency(debt.estimatedMonthlyInterest, data.currency)}/mes
                      </span>

                      {!isLiquidated && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentTargetDebt(debt);
                            setPaymentAmount(String(debt.monthlyPayment || ''));
                            setIsAddPaymentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pagar Cuota</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Panel: Debt & Financial Rates Inspector */}
        {activeDebt && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-lg">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{activeDebt.creditor}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{activeDebt.concept}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAmortizationSim(!showAmortizationSim)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    showAmortizationSim
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Simulador</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar la deuda de ${activeDebt.creditor}?`)) {
                      deleteOwnDebt(activeDebt.id);
                      setActiveDebtId(null);
                      if (onClearSelectedDebt) onClearSelectedDebt();
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Eliminar registro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setActiveDebtId(null);
                    if (onClearSelectedDebt) onClearSelectedDebt();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial Rates Breakdown Box */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-indigo-400" />
                  <span>Análisis de Tasas de Interés Calculadas</span>
                </span>
                <span className="text-indigo-400 font-mono text-[11px]">
                  Tasa introducida como {activeDebt.rateType.toUpperCase()}: {activeDebt.enteredRate}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block uppercase">Tasa E.A.</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {activeDebt.effectiveAnnualRate}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">Efectiva Anual</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block uppercase">Mes Vencido (M.V.)</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {activeDebt.monthlyRate}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">Periódica mensual</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block uppercase">Nominal Anual</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {activeDebt.nominalAnnualRate}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">NAMV (i_mv × 12)</span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block uppercase">Interés del Mes</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    {formatCurrency(activeDebt.estimatedMonthlyInterest, data.currency)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Sobre saldo actual</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Día de Corte: {activeDebt.cutoffDay} · Día Límite de Pago: {activeDebt.paymentDay}</span>
                <button
                  onClick={() => {
                    setPaymentTargetDebt(activeDebt);
                    setPaymentAmount(String(activeDebt.monthlyPayment || ''));
                    setIsAddPaymentModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Pago</span>
                </button>
              </div>
            </div>

            {/* Amortization Simulator Preview if toggled */}
            {showAmortizationSim && (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <h4 className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>Proyección de Amortización (Cuota Estimada a 12 meses)</span>
                  </h4>
                  <span className="text-indigo-700">Sistema Francés</span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-indigo-100 rounded-xl bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Mes</th>
                        <th className="py-2 px-3">Cuota</th>
                        <th className="py-2 px-3">Interés</th>
                        <th className="py-2 px-3">Abono Capital</th>
                        <th className="py-2 px-3 text-right">Saldo Restante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                      {simulateAmortizationSchedule(
                        activeDebt.currentBalance,
                        activeDebt.monthlyRate,
                        12
                      ).map((row) => (
                        <tr key={row.period} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-sans font-medium text-slate-500">
                            Mes {row.period}
                          </td>
                          <td className="py-1.5 px-3 tabular-nums">
                            {formatCurrency(row.quota, data.currency)}
                          </td>
                          <td className="py-1.5 px-3 text-amber-600 tabular-nums">
                            {formatCurrency(row.interest, data.currency)}
                          </td>
                          <td className="py-1.5 px-3 text-emerald-600 tabular-nums">
                            {formatCurrency(row.principal, data.currency)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-semibold tabular-nums">
                            {formatCurrency(row.remainingBalance, data.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment History */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Historial de Pagos de Cuota</h3>
              {(activeDebt.payments || []).length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  No se han registrado pagos para este crédito aún.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {(activeDebt.payments || []).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          Pago de Cuota {formatDate(p.date)}
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          {p.principalAmount && (
                            <span>Capital: {formatCurrency(p.principalAmount, data.currency)}</span>
                          )}
                          {p.interestAmount && (
                            <span>· Interés: {formatCurrency(p.interestAmount, data.currency)}</span>
                          )}
                          {p.notes && <span>· {p.notes}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(p.amount, data.currency)}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar registro de pago?')) {
                              deleteDebtPayment(activeDebt.id, p.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: NUEVA DEUDA CON ENTIDAD ================= */}
      {isAddDebtModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Agregar Deuda o Tarjeta Bancaria</h3>
                  <p className="text-xs text-slate-500">
                    Calcula automáticamente la Tasa Efectiva Anual (E.A.) y el interés mensual.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddDebtModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Entidad o Banco *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Bancolombia, Davivienda, Nu..."
                    value={newCreditor}
                    onChange={(e) => setNewCreditor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Concepto / Tipo de Crédito *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Tarjeta de Crédito, Libre Inversión..."
                    value={newConcept}
                    onChange={(e) => setNewConcept(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monto Inicial ({data.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 5000000"
                    value={newOriginalAmount}
                    onChange={(e) => {
                      setNewOriginalAmount(e.target.value);
                      if (!newCurrentBalance) setNewCurrentBalance(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Pendiente Actual *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ej: 3200000"
                    value={newCurrentBalance}
                    onChange={(e) => setNewCurrentBalance(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cuota Mensual Pactada *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ej: 280000"
                    value={newMonthlyPayment}
                    onChange={(e) => setNewMonthlyPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* TASA DE INTERÉS INPUT & CONVERSOR AUTOMÁTICO */}
              <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <span>Configuración de Tasa de Interés</span>
                  </span>
                  <span className="text-[11px] text-indigo-700 font-medium">Conversión Automática</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Ingresar Tasa como:</label>
                    <select
                      value={newRateType}
                      onChange={(e) => setNewRateType(e.target.value as RateInputType)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option value="ea">Tasa Efectiva Anual (% E.A.)</option>
                      <option value="mv">Tasa Mes Vencido (% M.V.)</option>
                      <option value="namv">Tasa Nominal Anual (% NAMV)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Valor Porcentual (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newEnteredRate}
                      onChange={(e) => setNewEnteredRate(e.target.value)}
                      placeholder="Ej: 24.8"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono font-bold text-indigo-700"
                    />
                  </div>
                </div>

                {/* Real-time Calculation Result Box */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Tasa E.A.:</span>
                    <span className="font-bold font-mono text-emerald-700">
                      {previewRates.effectiveAnnualRate}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Mes Vencido:</span>
                    <span className="font-bold font-mono text-indigo-800">
                      {previewRates.monthlyRate}%/m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Interés mensual:</span>
                    <span className="font-bold font-mono text-amber-700">
                      ~{formatCurrency(previewRates.estimatedMonthlyInterest, data.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dates: Cutoff & Payment Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Día de Corte Mensual (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newCutoffDay}
                    onChange={(e) => setNewCutoffDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Día Límite de Pago Mensual (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newPaymentDay}
                    onChange={(e) => setNewPaymentDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Detalles sobre beneficios, seguros, etc."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDebtModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Guardar Deuda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR PAGO DE CUOTA ================= */}
      {isAddPaymentModalOpen && paymentTargetDebt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Pago de Cuota</h3>
                  <p className="text-xs text-slate-500">{paymentTargetDebt.creditor}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monto Total Pagado ({data.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value);
                    if (!paymentPrincipal) {
                      const estInt = paymentTargetDebt.estimatedMonthlyInterest;
                      const val = parseFloat(e.target.value) || 0;
                      setPaymentPrincipal(String(Math.max(0, val - estInt)));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-base font-bold font-mono text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Abono a Capital (reduce saldo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Capital amortizado"
                    value={paymentPrincipal}
                    onChange={(e) => setPaymentPrincipal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha del Pago *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Pago cuota mensual, comprobante #..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="syncDebtCashFlow"
                  checked={syncWithCashFlow}
                  onChange={(e) => setSyncWithCashFlow(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="syncDebtCashFlow" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Registrar automáticamente como egreso en el Flujo de Caja
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
