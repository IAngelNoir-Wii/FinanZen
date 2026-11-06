import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ThirdPartyLoan, LoanPayment } from '../types/finance';
import {
  calculateLoanSummary,
  formatCurrency,
  formatDate,
  getDaysDifference,
  generateWhatsAppReminderUrl,
} from '../utils/financialCalculations';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageCircle,
  DollarSign,
  ArrowDownLeft,
  Calendar,
  Share2,
  Trash2,
  Edit2,
  X,
  FileText,
  User,
  Phone,
  CreditCard,
} from 'lucide-react';

interface ThirdPartyLoansManagerProps {
  selectedLoanId?: string | null;
  onClearSelectedLoan?: () => void;
}

export const ThirdPartyLoansManager: React.FC<ThirdPartyLoansManagerProps> = ({
  selectedLoanId,
  onClearSelectedLoan,
}) => {
  const { data, addLoan, updateLoan, deleteLoan, addLoanPayment, deleteLoanPayment } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'pagados'>('todos');
  const [activeAccountLoanId, setActiveAccountLoanId] = useState<string | null>(selectedLoanId || null);

  // Modals state
  const [isAddLoanModalOpen, setIsAddLoanModalOpen] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isEditLoanModalOpen, setIsEditLoanModalOpen] = useState(false);
  const [paymentLoanTarget, setPaymentLoanTarget] = useState<ThirdPartyLoan | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // New Loan Form State
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [newBorrowerPhone, setNewBorrowerPhone] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [syncWithCashFlow, setSyncWithCashFlow] = useState(true);

  // Sync prop if changed externally (e.g. from notifications)
  React.useEffect(() => {
    if (selectedLoanId) {
      setActiveAccountLoanId(selectedLoanId);
    }
  }, [selectedLoanId]);

  // Overall calculations for third-party loans
  const totalLoaned = data.loans.reduce((acc, l) => acc + (Number(l.initialAmount) || 0), 0);
  const totalCollected = data.loans.reduce((acc, l) => {
    const summary = calculateLoanSummary(l);
    return acc + summary.totalPaid;
  }, 0);
  const totalOutstanding = Math.max(0, totalLoaned - totalCollected);

  // Filter loans
  const filteredLoans = data.loans.filter((loan) => {
    const matchesSearch =
      loan.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.concept.toLowerCase().includes(searchQuery.toLowerCase());

    const { isSettled } = calculateLoanSummary(loan);
    if (statusFilter === 'activos') return matchesSearch && !isSettled;
    if (statusFilter === 'pagados') return matchesSearch && isSettled;
    return matchesSearch;
  });

  const activeLoan = activeAccountLoanId
    ? data.loans.find((l) => l.id === activeAccountLoanId) || null
    : null;

  // Handle create loan
  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newAmount);
    if (!newBorrowerName || isNaN(amountNum) || amountNum <= 0) return;

    addLoan({
      borrowerName: newBorrowerName.trim(),
      borrowerPhone: newBorrowerPhone.trim() || undefined,
      concept: newConcept.trim() || 'Préstamo personal',
      initialAmount: amountNum,
      monthlyInterestRate: 0,
      startDate: newStartDate,
      dueDate: newDueDate || newStartDate,
      notes: newNotes.trim() || undefined,
    });

    setIsAddLoanModalOpen(false);
    // Reset form
    setNewBorrowerName('');
    setNewBorrowerPhone('');
    setNewConcept('');
    setNewAmount('');
    setNewDueDate('');
    setNewNotes('');
  };

  // Handle add payment / abono
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentLoanTarget) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    addLoanPayment(
      paymentLoanTarget.id,
      {
        amount: amountNum,
        date: paymentDate,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
      },
      syncWithCashFlow
    );

    setIsAddPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentLoanTarget(null);
  };

  // Copy account summary to clipboard
  const handleCopyAccountSummary = (loan: ThirdPartyLoan) => {
    const { totalPaid, remainingBalance, progressPercentage, isSettled } = calculateLoanSummary(loan);
    const text = `📋 ESTADO DE CUENTA - PRÉSTAMO
━━━━━━━━━━━━━━━━━━━━━━
👤 Titular: ${loan.borrowerName}
📝 Motivo: ${loan.concept}
📅 Fecha de Préstamo: ${formatDate(loan.startDate)}
⏰ Fecha Límite de Pago: ${formatDate(loan.dueDate)}

💰 Monto Inicial Prestado: ${formatCurrency(loan.initialAmount, data.currency)}
✅ Total Abonado a la Fecha: ${formatCurrency(totalPaid, data.currency)} (${progressPercentage}%)
⏳ Saldo Pendiente: ${formatCurrency(remainingBalance, data.currency)}
📌 Estado: ${isSettled ? 'PAZ Y SALVO ✅' : 'ACTIVO / EN COBRO'}

HISTORIAL DE ABONOS RECIBIDOS:
${(loan.payments || []).length === 0 ? '- Sin abonos registrados aún.' : (loan.payments || []).map((p, i) => `${i + 1}. ${formatDate(p.date)}: ${formatCurrency(p.amount, data.currency)} (${p.paymentMethod})${p.notes ? ` - ${p.notes}` : ''}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━
Generado automáticamente por FinanZen`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Prestado</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totalLoaned, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Capital entregado a terceros</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Recuperado</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {formatCurrency(totalCollected, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {totalLoaned > 0
              ? `${Math.round((totalCollected / totalLoaned) * 100)}% amortizado del total`
              : '0% amortizado'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo por Cobrar</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {formatCurrency(totalOutstanding, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Pendiente por recaudar</p>
        </div>
      </div>

      {/* Main Content: Split View on Large Screens (List + Personal Account Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of Borrowers / Loans */}
        <div className={`space-y-4 ${activeLoan ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre o concepto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setStatusFilter('todos')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('activos')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'activos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setStatusFilter('pagados')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === 'pagados' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paz y Salvo
                </button>
              </div>

              <button
                onClick={() => setIsAddLoanModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Préstamo</span>
              </button>
            </div>
          </div>

          {/* Loans Cards List */}
          <div className="space-y-3">
            {filteredLoans.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No se encontraron préstamos</p>
                <p className="text-xs text-slate-500 mt-1">
                  Registra un préstamo a un amigo o conocido para empezar a registrar sus abonos.
                </p>
                <button
                  onClick={() => setIsAddLoanModalOpen(true)}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                >
                  Registrar Primer Préstamo
                </button>
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const { totalPaid, remainingBalance, progressPercentage, isSettled } =
                  calculateLoanSummary(loan);
                const daysRemaining = getDaysDifference(loan.dueDate);
                const isSelected = activeAccountLoanId === loan.id;
                const isOverdue = !isSettled && daysRemaining < 0;
                const isToday = !isSettled && daysRemaining === 0;

                return (
                  <div
                    key={loan.id}
                    onClick={() => setActiveAccountLoanId(loan.id)}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {loan.borrowerName}
                          </h3>
                          {isSettled ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                              Paz y Salvo
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                              Mora ({Math.abs(daysRemaining)}d)
                            </span>
                          ) : isToday ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                              Vence Hoy
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-500">
                              Vence en {daysRemaining}d
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{loan.concept}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {formatCurrency(remainingBalance, data.currency)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isSettled ? 'Completado' : 'Faltante'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Abonado: {formatCurrency(totalPaid, data.currency)}</span>
                        <span className="font-mono font-medium">{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isSettled ? 'bg-emerald-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom Quick Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">
                        {(loan.payments || []).length} abono{(loan.payments || []).length === 1 ? '' : 's'}
                      </span>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!isSettled && (
                          <button
                            onClick={() => {
                              setPaymentLoanTarget(loan);
                              setIsAddPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Abonar</span>
                          </button>
                        )}

                        {loan.borrowerPhone && (
                          <a
                            href={generateWhatsAppReminderUrl(loan)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded transition-colors"
                            title="Recordatorio por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: DETAILED PERSONAL ACCOUNT (Cuenta Personal por Deudor) */}
        {activeLoan && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Account Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                  {activeLoan.borrowerName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{activeLoan.borrowerName}</h2>
                    {calculateLoanSummary(activeLoan).isSettled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                        Paz y Salvo ✅
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                        Cuenta Activa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{activeLoan.concept}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopyAccountSummary(activeLoan)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative"
                  title="Copiar comprobante de estado de cuenta"
                >
                  <Share2 className="w-4 h-4" />
                  {copiedSuccess && (
                    <span className="absolute -bottom-7 right-0 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded shadow whitespace-nowrap">
                      ¡Copiado!
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (confirm(`¿Estás seguro de eliminar el préstamo de ${activeLoan.borrowerName}?`)) {
                      deleteLoan(activeLoan.id);
                      setActiveAccountLoanId(null);
                      if (onClearSelectedLoan) onClearSelectedLoan();
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Eliminar préstamo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setActiveAccountLoanId(null);
                    if (onClearSelectedLoan) onClearSelectedLoan();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Account Contact & Schedule Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">Teléfono / WhatsApp</span>
                <span className="font-semibold text-slate-700">
                  {activeLoan.borrowerPhone || 'No registrado'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Fecha Préstamo</span>
                <span className="font-semibold text-slate-700">{formatDate(activeLoan.startDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Fecha Límite</span>
                <span className="font-semibold text-slate-700">{formatDate(activeLoan.dueDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Días Restantes</span>
                <span
                  className={`font-semibold font-mono ${
                    getDaysDifference(activeLoan.dueDate) < 0
                      ? 'text-rose-600'
                      : 'text-slate-700'
                  }`}
                >
                  {getDaysDifference(activeLoan.dueDate) < 0
                    ? `${Math.abs(getDaysDifference(activeLoan.dueDate))}d en mora`
                    : `${getDaysDifference(activeLoan.dueDate)} días`}
                </span>
              </div>
            </div>

            {/* Financial Balance Breakdown Card */}
            {(() => {
              const { totalPaid, remainingBalance, progressPercentage, isSettled } =
                calculateLoanSummary(activeLoan);
              return (
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Estado Actual de la Cuenta</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {progressPercentage}% amortizado
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Total Prestado
                      </span>
                      <span className="text-lg font-bold font-mono tabular-nums">
                        {formatCurrency(activeLoan.initialAmount, data.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-emerald-400 uppercase tracking-wider block">
                        Total Abonado
                      </span>
                      <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                        {formatCurrency(totalPaid, data.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-amber-300 uppercase tracking-wider block">
                        Saldo Faltante
                      </span>
                      <span className="text-lg font-bold font-mono text-amber-300 tabular-nums">
                        {formatCurrency(remainingBalance, data.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Actions inside card */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {!isSettled && (
                        <button
                          onClick={() => {
                            setPaymentLoanTarget(activeLoan);
                            setIsAddPaymentModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Registrar Abono</span>
                        </button>
                      )}

                      {activeLoan.borrowerPhone && (
                        <a
                          href={generateWhatsAppReminderUrl(activeLoan)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>Recordar por WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {isSettled && (
                      <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Préstamo liquidado totalmente
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Payment / Abonos History Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Historial Completo de Abonos Realizados</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {(activeLoan.payments || []).length} registro{(activeLoan.payments || []).length === 1 ? '' : 's'}
                </span>
              </div>

              {(activeLoan.payments || []).length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Aún no se han registrado abonos para este préstamo. Haz clic en "Registrar Abono" cuando la persona realice un pago.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {(activeLoan.payments || []).map((payment, index) => (
                    <div
                      key={payment.id}
                      className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            Abono #{activeLoan.payments.length - index}
                          </div>
                          <div className="text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{formatDate(payment.date)}</span>
                            <span>·</span>
                            <span>{payment.paymentMethod}</span>
                          </div>
                          {payment.notes && (
                            <p className="text-slate-600 mt-1 italic">"{payment.notes}"</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
                          +{formatCurrency(payment.amount, data.currency)}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar este registro de abono? El saldo del préstamo se recalculará automáticamente.')) {
                              deleteLoanPayment(activeLoan.id, payment.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                          title="Eliminar abono"
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

      {/* ================= MODAL: NUEVO PRÉSTAMO A TERCERO ================= */}
      {isAddLoanModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Préstamo a Tercero</h3>
                  <p className="text-xs text-slate-500">
                    Crea una cuenta personal para llevar el control de lo prestado y sus futuros abonos.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddLoanModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de la Persona que Debe *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Mendoza, Andrea Gómez..."
                  value={newBorrowerName}
                  onChange={(e) => setNewBorrowerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp (para recordatorios)
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: +57 312 456 7890"
                    value={newBorrowerPhone}
                    onChange={(e) => setNewBorrowerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monto Prestado ({data.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 1500000"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo / Concepto del Préstamo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Arreglo de vehículo, compra de mercancía, apoyo temporal..."
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fecha en que se Prestó *
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fecha Límite o Próximo Cobro *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Se generará alerta automática cuando se acerque esta fecha.
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notas adicionales (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Acuerdos de cuotas, condiciones pactadas..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLoanModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Guardar Préstamo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR ABONO / PAGO ================= */}
      {isAddPaymentModalOpen && paymentLoanTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Registrar Abono</h3>
                  <p className="text-xs text-slate-500">{paymentLoanTarget.borrowerName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Balance Status */}
            {(() => {
              const { remainingBalance } = calculateLoanSummary(paymentLoanTarget);
              return (
                <div className="p-3 bg-slate-50 rounded-xl mb-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Saldo actual pendiente:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatCurrency(remainingBalance, data.currency)}
                  </span>
                </div>
              );
            })()}

            <form onSubmit={handleAddPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monto del Abono ({data.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej: 300000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-base font-bold font-mono text-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha del Abono *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medio de Pago *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs bg-white"
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta Débito">Tarjeta Débito</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Comprobante o Nota (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Comprobante #9482, abono cuota 2..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="syncCashFlow"
                  checked={syncWithCashFlow}
                  onChange={(e) => setSyncWithCashFlow(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="syncCashFlow" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Registrar automáticamente como ingreso en el Flujo de Caja
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
