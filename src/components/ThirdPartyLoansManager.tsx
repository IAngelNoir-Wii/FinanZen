import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ThirdPartyLoan, LoanPayment } from '../types/finance';
import {
  calculateLoanSummary,
  formatCurrency,
  formatDate,
  getDaysDifference,
  generateWhatsAppReminderUrl,
  groupLoansByBorrower,
  generateConsolidatedWhatsAppUrl,
  BorrowerAccountGroup,
} from '../utils/financialCalculations';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MessageCircle,
  DollarSign,
  ArrowDownLeft,
  Share2,
  Trash2,
  X,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ThirdPartyLoansManagerProps {
  selectedLoanId?: string | null;
  onClearSelectedLoan?: () => void;
}

export const ThirdPartyLoansManager: React.FC<ThirdPartyLoansManagerProps> = ({
  selectedLoanId,
  onClearSelectedLoan,
}) => {
  const { data, addLoan, deleteLoan, addLoanPayment, deleteLoanPayment } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'activos' | 'pagados'>('todos');
  const [activeBorrowerKey, setActiveBorrowerKey] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(selectedLoanId || null);

  // Inside person's account: view mode & sub-filter (defaults to showing ALL loans, paid & unpaid)
  const [accountViewTab, setAccountViewTab] = useState<'prestamos' | 'abonos'>('prestamos');
  const [accountLoanFilter, setAccountLoanFilter] = useState<'todos' | 'pendientes' | 'pagados'>('todos');

  // Modals state
  const [isAddLoanModalOpen, setIsAddLoanModalOpen] = useState(false);
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
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

  // Group all loans by person
  const borrowerGroups = useMemo(() => groupLoansByBorrower(data.loans), [data.loans]);

  // Sync external selectedLoanId -> open that person's unified account and expand that loan
  useEffect(() => {
    if (selectedLoanId) {
      const targetLoan = data.loans.find((l) => l.id === selectedLoanId);
      if (targetLoan) {
        const key = (targetLoan.borrowerName || 'Sin nombre').trim().toLowerCase();
        setActiveBorrowerKey(key);
        setExpandedLoanId(selectedLoanId);
        setAccountViewTab('prestamos');
        setAccountLoanFilter('todos');
      }
    }
  }, [selectedLoanId, data.loans]);

  // Overall calculations for third-party loans
  const totalLoaned = data.loans.reduce((acc, l) => acc + (Number(l.initialAmount) || 0), 0);
  const totalCollected = data.loans.reduce((acc, l) => acc + calculateLoanSummary(l).totalPaid, 0);
  const totalOutstanding = Math.max(0, totalLoaned - totalCollected);

  // Filter borrower groups
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return borrowerGroups.filter((group) => {
      const matchesSearch =
        !q ||
        group.borrowerName.toLowerCase().includes(q) ||
        group.loans.some((l) => l.concept.toLowerCase().includes(q));

      if (statusFilter === 'activos') return matchesSearch && !group.isFullySettled;
      if (statusFilter === 'pagados') return matchesSearch && group.isFullySettled;
      return matchesSearch;
    });
  }, [borrowerGroups, searchQuery, statusFilter]);

  const activeGroup = activeBorrowerKey
    ? borrowerGroups.find((g) => g.borrowerKey === activeBorrowerKey) || null
    : null;

  // Loans displayed inside the selected person's account (ALL loans, paid or unpaid)
  const displayedGroupLoans = useMemo(() => {
    if (!activeGroup) return [];
    if (accountLoanFilter === 'pendientes') {
      return activeGroup.loans.filter((l) => !calculateLoanSummary(l).isSettled);
    }
    if (accountLoanFilter === 'pagados') {
      return activeGroup.loans.filter((l) => calculateLoanSummary(l).isSettled);
    }
    return activeGroup.loans;
  }, [activeGroup, accountLoanFilter]);

  // All abonos for the selected person across all their loans
  const allGroupPayments = useMemo(() => {
    if (!activeGroup) return [];
    const entries: Array<{ payment: LoanPayment; loan: ThirdPartyLoan }> = [];
    for (const loan of activeGroup.loans) {
      for (const payment of loan.payments || []) {
        entries.push({ payment, loan });
      }
    }
    return entries.sort((a, b) => b.payment.date.localeCompare(a.payment.date));
  }, [activeGroup]);

  // Open New Loan modal optionally pre-filled for an existing person
  const openNewLoanForPerson = (name?: string, phone?: string) => {
    setNewBorrowerName(name || '');
    setNewBorrowerPhone(phone || '');
    setNewConcept('');
    setNewAmount('');
    setNewStartDate(new Date().toISOString().split('T')[0]);
    setNewDueDate('');
    setNewNotes('');
    setIsAddLoanModalOpen(true);
  };

  // Auto-fill phone when typing an existing borrower's name
  const handleBorrowerNameChange = (value: string) => {
    setNewBorrowerName(value);
    const match = borrowerGroups.find(
      (g) => g.borrowerKey === value.trim().toLowerCase()
    );
    if (match && match.borrowerPhone && !newBorrowerPhone) {
      setNewBorrowerPhone(match.borrowerPhone);
    }
  };

  // Handle create loan
  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newAmount);
    if (!newBorrowerName || isNaN(amountNum) || amountNum <= 0) return;

    const trimmedName = newBorrowerName.trim();
    addLoan({
      borrowerName: trimmedName,
      borrowerPhone: newBorrowerPhone.trim() || undefined,
      concept: newConcept.trim() || 'Préstamo personal',
      initialAmount: amountNum,
      monthlyInterestRate: 0,
      startDate: newStartDate,
      dueDate: newDueDate || newStartDate,
      notes: newNotes.trim() || undefined,
    });

    setActiveBorrowerKey(trimmedName.toLowerCase());
    setIsAddLoanModalOpen(false);
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

  // Copy consolidated account summary for a person (all loans paid & unpaid)
  const handleCopyPersonSummary = (group: BorrowerAccountGroup) => {
    const loansLines = group.loans
      .map((loan, idx) => {
        const s = calculateLoanSummary(loan);
        return `${idx + 1}. ${loan.concept} (${formatDate(loan.startDate)})
   Prestado: ${formatCurrency(loan.initialAmount, data.currency)} · Abonado: ${formatCurrency(s.totalPaid, data.currency)} · Faltante: ${formatCurrency(s.remainingBalance, data.currency)} [${s.isSettled ? 'PAGADO' : `Vence ${formatDate(loan.dueDate)}`}]`;
      })
      .join('\n');

    const text = `ESTADO DE CUENTA CONSOLIDADO - ${group.borrowerName.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
Préstamos registrados: ${group.loans.length} (${group.activeLoansCount} pendientes · ${group.settledLoansCount} pagados)

Total Prestado Histórico: ${formatCurrency(group.totalLoaned, data.currency)}
Total Abonado Histórico: ${formatCurrency(group.totalPaid, data.currency)} (${group.progressPercentage}%)
Saldo Pendiente Actual: ${formatCurrency(group.totalRemaining, data.currency)}

DETALLE DE PRÉSTAMOS:
${loansLines}
━━━━━━━━━━━━━━━━━━━━━━
Generado por FinanZen`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Prestado</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totalLoaned, data.currency)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {data.loans.length} préstamo{data.loans.length === 1 ? '' : 's'} a {borrowerGroups.length} persona{borrowerGroups.length === 1 ? '' : 's'}
          </p>
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

      {/* Main Content: Split View (People List + Unified Person Account Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: List of People (Grouped by Borrower) */}
        <div className={`space-y-4 ${activeGroup ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar persona o concepto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setStatusFilter('todos')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === 'todos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('activos')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === 'activos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Con saldo
                </button>
                <button
                  onClick={() => setStatusFilter('pagados')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === 'pagados'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Paz y Salvo
                </button>
              </div>

              <button
                onClick={() => openNewLoanForPerson()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Préstamo</span>
              </button>
            </div>
          </div>

          {/* People Cards List */}
          <div className="space-y-3">
            {filteredGroups.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No se encontraron personas</p>
                <p className="text-xs text-slate-500 mt-1">
                  Registra un préstamo a un amigo o conocido para ver su cuenta personal y todos sus préstamos.
                </p>
                <button
                  onClick={() => openNewLoanForPerson()}
                  className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Registrar Primer Préstamo
                </button>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isSelected = activeBorrowerKey === group.borrowerKey;
                const isOverdue =
                  !group.isFullySettled &&
                  group.minDaysRemaining !== null &&
                  group.minDaysRemaining < 0;
                const isToday =
                  !group.isFullySettled && group.minDaysRemaining === 0;
                const firstActiveLoan = group.loans.find(
                  (l) => !calculateLoanSummary(l).isSettled
                );

                return (
                  <div
                    key={group.borrowerKey}
                    onClick={() => {
                      setActiveBorrowerKey(group.borrowerKey);
                      setAccountLoanFilter('todos');
                      // Auto-expand the first active loan or most recent loan
                      const target = firstActiveLoan || group.loans[0];
                      setExpandedLoanId(target ? target.id : null);
                    }}
                    className={`bg-white p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {group.borrowerName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>
                            {group.loans.length} préstamo{group.loans.length === 1 ? '' : 's'}
                          </span>
                          <span aria-hidden="true">·</span>
                          {group.isFullySettled ? (
                            <span className="text-emerald-700 font-semibold">Paz y Salvo</span>
                          ) : (
                            <>
                              <span>{group.activeLoansCount} activo{group.activeLoansCount === 1 ? '' : 's'}</span>
                              {group.settledLoansCount > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{group.settledLoansCount} pagado{group.settledLoansCount === 1 ? '' : 's'}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              {isOverdue ? (
                                <span className="text-rose-600 font-semibold">
                                  Mora ({Math.abs(group.minDaysRemaining!)}d)
                                </span>
                              ) : isToday ? (
                                <span className="text-amber-700 font-semibold">Vence hoy</span>
                              ) : (
                                <span>Próx. en {group.minDaysRemaining}d</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                          {formatCurrency(group.totalRemaining, data.currency)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {group.isFullySettled ? 'Al día' : 'Saldo total'}
                        </div>
                      </div>
                    </div>

                    {/* Consolidated Progress Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>
                          Abonado: {formatCurrency(group.totalPaid, data.currency)} de{' '}
                          {formatCurrency(group.totalLoaned, data.currency)}
                        </span>
                        <span className="font-mono font-medium">{group.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            group.isFullySettled ? 'bg-emerald-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${group.progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div
                      className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          openNewLoanForPerson(group.borrowerName, group.borrowerPhone)
                        }
                        className="text-slate-600 hover:text-slate-900 font-medium text-[11px] cursor-pointer"
                      >
                        + Prestar de nuevo
                      </button>

                      <div className="flex items-center gap-2">
                        {firstActiveLoan && (
                          <button
                            onClick={() => {
                              setPaymentLoanTarget(firstActiveLoan);
                              setIsAddPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Abonar</span>
                          </button>
                        )}

                        {group.borrowerPhone && !group.isFullySettled && (
                          <a
                            href={generateConsolidatedWhatsAppUrl(group, data.currency)}
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

        {/* Right Column: UNIFIED PERSONAL ACCOUNT FOR SELECTED PERSON */}
        {activeGroup && (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            {/* Account Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
                  {activeGroup.borrowerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {activeGroup.borrowerName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{activeGroup.borrowerPhone || 'Sin teléfono'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeGroup.loans.length} préstamo{activeGroup.loans.length === 1 ? '' : 's'} en total
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        activeGroup.isFullySettled ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {activeGroup.isFullySettled
                        ? 'Paz y Salvo'
                        : `${activeGroup.activeLoansCount} pendiente${activeGroup.activeLoansCount === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopyPersonSummary(activeGroup)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
                  title="Copiar estado de cuenta consolidado"
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
                    setActiveBorrowerKey(null);
                    setExpandedLoanId(null);
                    if (onClearSelectedLoan) onClearSelectedLoan();
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Cerrar detalle de cuenta"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Consolidated Financial Summary Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Resumen Consolidado de {activeGroup.borrowerName}</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {activeGroup.progressPercentage}% amortizado histórico
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                    Total Prestado
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums">
                    {formatCurrency(activeGroup.totalLoaned, data.currency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-emerald-400 uppercase tracking-wider block">
                    Total Abonado
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                    {formatCurrency(activeGroup.totalPaid, data.currency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-amber-300 uppercase tracking-wider block">
                    Saldo Faltante
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-300 tabular-nums">
                    {formatCurrency(activeGroup.totalRemaining, data.currency)}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${activeGroup.progressPercentage}%` }}
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      openNewLoanForPerson(activeGroup.borrowerName, activeGroup.borrowerPhone)
                    }
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Préstamo a {activeGroup.borrowerName.split(' ')[0]}</span>
                  </button>

                  {activeGroup.borrowerPhone && !activeGroup.isFullySettled && (
                    <a
                      href={generateConsolidatedWhatsAppUrl(activeGroup, data.currency)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>Recordar por WhatsApp</span>
                    </a>
                  )}
                </div>

                {activeGroup.isFullySettled && (
                  <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Todos los préstamos pagados
                  </span>
                )}
              </div>
            </div>

            {/* Section Tabs: Loans List vs All Payments Ledger */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setAccountViewTab('prestamos')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    accountViewTab === 'prestamos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos los Préstamos ({activeGroup.loans.length})
                </button>
                <button
                  onClick={() => setAccountViewTab('abonos')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    accountViewTab === 'abonos'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Historial de Abonos ({allGroupPayments.length})
                </button>
              </div>

              {accountViewTab === 'prestamos' && (
                <div className="flex bg-slate-100 p-1 rounded-lg text-[11px]">
                  <button
                    onClick={() => setAccountLoanFilter('todos')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      accountLoanFilter === 'todos'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos ({activeGroup.loans.length})
                  </button>
                  <button
                    onClick={() => setAccountLoanFilter('pendientes')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      accountLoanFilter === 'pendientes'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pendientes ({activeGroup.activeLoansCount})
                  </button>
                  <button
                    onClick={() => setAccountLoanFilter('pagados')}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      accountLoanFilter === 'pagados'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pagados ({activeGroup.settledLoansCount})
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: ALL LOANS FOR THIS PERSON (PAID & UNPAID) */}
            {accountViewTab === 'prestamos' && (
              <div className="divide-y divide-slate-200">
                {displayedGroupLoans.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No hay préstamos en esta categoría para {activeGroup.borrowerName}.
                  </div>
                ) : (
                  displayedGroupLoans.map((loan) => {
                    const { totalPaid, remainingBalance, progressPercentage, isSettled } =
                      calculateLoanSummary(loan);
                    const daysRemaining = getDaysDifference(loan.dueDate);
                    const isOverdue = !isSettled && daysRemaining < 0;
                    const isToday = !isSettled && daysRemaining === 0;
                    const isExpanded = expandedLoanId === loan.id;

                    return (
                      <div key={loan.id} className="py-4 first:pt-1 last:pb-1 space-y-3">
                        {/* Loan Summary Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">{loan.concept}</h4>
                              <span
                                className={`text-[11px] font-semibold ${
                                  isSettled
                                    ? 'text-emerald-700'
                                    : isOverdue
                                    ? 'text-rose-600'
                                    : isToday
                                    ? 'text-amber-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {isSettled
                                  ? '· Pagado (Paz y Salvo)'
                                  : isOverdue
                                  ? `· Mora (${Math.abs(daysRemaining)}d)`
                                  : isToday
                                  ? '· Vence Hoy'
                                  : `· Vence en ${daysRemaining}d`}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                              <span>Prestado el {formatDate(loan.startDate)}</span>
                              <span aria-hidden="true">·</span>
                              <span>Límite: {formatDate(loan.dueDate)}</span>
                              {loan.notes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="italic text-slate-500">{loan.notes}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                            <div className="text-left sm:text-right">
                              <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                                {isSettled
                                  ? formatCurrency(loan.initialAmount, data.currency)
                                  : formatCurrency(remainingBalance, data.currency)}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                {isSettled
                                  ? '100% pagado'
                                  : `de ${formatCurrency(loan.initialAmount, data.currency)} (${progressPercentage}%)`}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress + Controls Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setExpandedLoanId(isExpanded ? null : loan.id)
                              }
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {(loan.payments || []).length} abono{(loan.payments || []).length === 1 ? '' : 's'} ({formatCurrency(totalPaid, data.currency)})
                              </span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isSettled && (
                              <button
                                onClick={() => {
                                  setPaymentLoanTarget(loan);
                                  setIsAddPaymentModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Registrar Abono</span>
                              </button>
                            )}

                            {loan.borrowerPhone && !isSettled && (
                              <a
                                href={generateWhatsAppReminderUrl(loan)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded transition-colors"
                                title="Recordar este préstamo por WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            )}

                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `¿Eliminar el préstamo "${loan.concept}" de ${loan.borrowerName}?`
                                  )
                                ) {
                                  deleteLoan(loan.id);
                                  if (expandedLoanId === loan.id) setExpandedLoanId(null);
                                  if (activeGroup.loans.length <= 1) {
                                    setActiveBorrowerKey(null);
                                    if (onClearSelectedLoan) onClearSelectedLoan();
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="Eliminar este préstamo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Abonos History for this specific loan */}
                        {isExpanded && (
                          <div className="bg-slate-50 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              <span>Abonos aplicados a este préstamo</span>
                              <span className="font-mono">
                                Abonado: {formatCurrency(totalPaid, data.currency)} · Faltante:{' '}
                                {formatCurrency(remainingBalance, data.currency)}
                              </span>
                            </div>

                            {(loan.payments || []).length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                Aún no se han registrado abonos para este préstamo.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-200/70">
                                {(loan.payments || []).map((payment, index) => (
                                  <div
                                    key={payment.id}
                                    className="py-2 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <div>
                                        <span className="font-semibold text-slate-800">
                                          Abono #{loan.payments.length - index}
                                        </span>
                                        <span className="text-slate-500 ml-2">
                                          {formatDate(payment.date)} · {payment.paymentMethod}
                                        </span>
                                        {payment.notes && (
                                          <p className="text-[11px] text-slate-500 italic">
                                            "{payment.notes}"
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                                        +{formatCurrency(payment.amount, data.currency)}
                                      </span>
                                      <button
                                        onClick={() => {
                                          if (
                                            confirm(
                                              '¿Eliminar este abono? El saldo del préstamo se recalculará automáticamente.'
                                            )
                                          ) {
                                            deleteLoanPayment(loan.id, payment.id);
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
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
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: CHRONOLOGICAL LEDGER OF ALL PAYMENTS BY THIS PERSON */}
            {accountViewTab === 'abonos' && (
              <div>
                {allGroupPayments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Esta persona aún no ha realizado abonos en ninguno de sus préstamos.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {allGroupPayments.map(({ payment, loan }) => (
                      <div
                        key={payment.id}
                        className="py-3 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                            <ArrowDownLeft className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{loan.concept}</div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{formatDate(payment.date)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{payment.paymentMethod}</span>
                            </div>
                            {payment.notes && (
                              <p className="text-slate-500 mt-1 italic">"{payment.notes}"</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
                            +{formatCurrency(payment.amount, data.currency)}
                          </span>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  '¿Eliminar este abono? El saldo se recalculará automáticamente.'
                                )
                              ) {
                                deleteLoanPayment(loan.id, payment.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
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
            )}
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
                    Si ya le prestaste antes, usa el mismo nombre para agruparlo en su cuenta personal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddLoanModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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
                  list="existing-borrowers-list"
                  placeholder="Ej: Carlos Mendoza, Andrea Gómez..."
                  value={newBorrowerName}
                  onChange={(e) => handleBorrowerNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
                <datalist id="existing-borrowers-list">
                  {borrowerGroups.map((g) => (
                    <option key={g.borrowerKey} value={g.borrowerName} />
                  ))}
                </datalist>
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
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
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
                  <p className="text-xs text-slate-500">
                    {paymentLoanTarget.borrowerName} · {paymentLoanTarget.concept}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const { remainingBalance } = calculateLoanSummary(paymentLoanTarget);
              return (
                <div className="p-3 bg-slate-50 rounded-xl mb-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Saldo pendiente de este préstamo:</span>
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
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
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
