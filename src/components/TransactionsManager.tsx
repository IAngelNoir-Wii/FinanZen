import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types/finance';
import { calculateAllRates, formatCurrency, formatDate } from '../utils/financialCalculations';
import {
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Trash2,
  Edit2,
  X,
  CreditCard,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export const TransactionsManager: React.FC = () => {
  const { data, addTransaction, updateTransaction, deleteTransaction, addDebtCharge } =
    useFinance();

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [filterType, setFilterType] = useState<'todos' | 'ingreso' | 'egreso'>('todos');
  const [filterCategory, setFilterCategory] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Form State
  const [txType, setTxType] = useState<TransactionType>('egreso');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState(data.expenseCategories[0] || 'Vivienda y Servicios Públicos');
  const [txCustomCategory, setTxCustomCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Transferencia');
  const [txIsRecurring, setTxIsRecurring] = useState(false);
  const [txNotes, setTxNotes] = useState('');
  const [txLinkedDebtId, setTxLinkedDebtId] = useState('');
  const [txLinkToDebtBalance, setTxLinkToDebtBalance] = useState(true);
  const [txServiceFee, setTxServiceFee] = useState('');

  // Cash Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advDebtId, setAdvDebtId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advServiceFee, setAdvServiceFee] = useState('5000');
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDescription, setAdvDescription] = useState('');
  const [advUpdateDebt, setAdvUpdateDebt] = useState(true);
  const [advRegisterIncome, setAdvRegisterIncome] = useState(true);
  const [advRegisterFeeExpense, setAdvRegisterFeeExpense] = useState(true);

  const preferredCardId = useMemo(() => {
    const cardDebt = data.debts.find(
      (d) =>
        d.concept.toLowerCase().includes('tarjeta') ||
        d.creditor.toLowerCase().includes('nu')
    );
    return cardDebt?.id || data.debts[0]?.id || '';
  }, [data.debts]);

  // Update category dropdown when type switches
  const handleTypeChange = (newType: TransactionType) => {
    setTxType(newType);
    if (newType === 'ingreso') {
      setTxCategory(data.incomeCategories[0] || 'Salario / Sueldo');
    } else {
      setTxCategory(data.expenseCategories[0] || 'Alimentación y Supermercado');
      if (!txLinkedDebtId && preferredCardId) {
        setTxLinkedDebtId(preferredCardId);
      }
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return data.transactions
      .filter((tx) => {
        // Month & Year filter
        if (selectedMonth !== 0) {
          const txParts = tx.date.split('-');
          if (txParts.length === 3) {
            const txYear = parseInt(txParts[0], 10);
            const txMonth = parseInt(txParts[1], 10);
            if (txYear !== selectedYear || txMonth !== selectedMonth) return false;
          }
        }

        // Type filter
        if (filterType !== 'todos' && tx.type !== filterType) return false;

        // Category filter
        if (filterCategory !== 'todas' && tx.category !== filterCategory) return false;

        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchCat = tx.category.toLowerCase().includes(q);
          const matchMethod = (tx.paymentMethod || '').toLowerCase().includes(q);
          if (!matchDesc && !matchCat && !matchMethod) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, selectedMonth, selectedYear, filterType, filterCategory, searchQuery]);

  // Totals for filtered selection
  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'ingreso')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'egreso')
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  const netBalance = totalIncome - totalExpense;

  // Available categories based on current type
  const availableCategories = txType === 'ingreso' ? data.incomeCategories : data.expenseCategories;

  // Open modal for editing
  const handleEditClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTxType(tx.type);
    setTxAmount(String(tx.amount));
    setTxDate(tx.date);
    setTxCategory(tx.category);
    setTxDescription(tx.description);
    setTxPaymentMethod(tx.paymentMethod);
    setTxIsRecurring(!!tx.isRecurring);
    setTxNotes(tx.notes || '');
    setIsAddModalOpen(true);
  };

  // Reset form
  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingTransaction(null);
    setTxAmount('');
    setTxDescription('');
    setTxCustomCategory('');
    setTxNotes('');
    setTxServiceFee('');
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const finalCategory = txCustomCategory.trim() ? txCustomCategory.trim() : txCategory;

    if (editingTransaction) {
      updateTransaction({
        ...editingTransaction,
        type: txType,
        amount: amountNum,
        date: txDate,
        category: finalCategory,
        description: txDescription.trim(),
        paymentMethod: txPaymentMethod,
        isRecurring: txIsRecurring,
        notes: txNotes.trim() || undefined,
      });
    } else if (
      txType === 'egreso' &&
      txPaymentMethod === 'Tarjeta Crédito' &&
      Boolean(txLinkedDebtId) &&
      txLinkToDebtBalance
    ) {
      const feeNum = Math.max(0, parseFloat(txServiceFee) || 0);
      await addDebtCharge({
        debtId: txLinkedDebtId,
        mode: 'compra',
        amount: amountNum,
        serviceFee: feeNum,
        date: txDate,
        category: finalCategory,
        description: txDescription.trim(),
        notes: txNotes.trim() || undefined,
        registerInCashFlow: true,
        registerFeeInCashFlow: feeNum > 0,
        updateDebtBalance: true,
      });
    } else {
      addTransaction({
        type: txType,
        amount: amountNum,
        date: txDate,
        category: finalCategory,
        description: txDescription.trim(),
        paymentMethod: txPaymentMethod,
        isRecurring: txIsRecurring,
        notes: txNotes.trim() || undefined,
      });
    }

    handleCloseModal();
  };

  const handleSubmitAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(advAmount);
    const feeNum = Math.max(0, parseFloat(advServiceFee) || 0);
    if (!advDebtId || isNaN(amountNum) || amountNum <= 0) return;

    const selectedDebt = data.debts.find((d) => d.id === advDebtId);
    await addDebtCharge({
      debtId: advDebtId,
      mode: 'adelanto',
      amount: amountNum,
      serviceFee: feeNum,
      date: advDate,
      description:
        advDescription.trim() ||
        `Adelanto a cuenta desde ${selectedDebt?.creditor || 'Tarjeta'}`,
      registerInCashFlow: advRegisterIncome,
      registerFeeInCashFlow: advRegisterFeeExpense,
      updateDebtBalance: advUpdateDebt,
    });

    setIsAdvanceModalOpen(false);
    setAdvAmount('');
    setAdvDescription('');
    setAdvServiceFee('5000');
  };

  // Month names in Spanish
  const months = [
    { value: 0, label: 'Todo el año' },
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  return (
    <div className="space-y-6">
      {/* Month Selector & Filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Month & Year Navigation */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Right CTA */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              handleTypeChange('ingreso');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ingreso</span>
          </button>

          <button
            onClick={() => {
              handleTypeChange('egreso');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Egreso / Gasto</span>
          </button>

          {data.debts.length > 0 && (
            <button
              onClick={() => {
                if (!advDebtId && preferredCardId) {
                  setAdvDebtId(preferredCardId);
                }
                setIsAdvanceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              title="Registrar adelanto de efectivo desde tu tarjeta de crédito a tu cuenta"
            >
              <CreditCard className="w-4 h-4" />
              <span>Adelanto Tarjeta</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Month Snapshot KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Ingresos del Periodo
            </span>
            <div className="text-xl font-bold font-mono text-emerald-600 tabular-nums mt-1">
              +{formatCurrency(totalIncome, data.currency)}
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Egresos del Periodo
            </span>
            <div className="text-xl font-bold font-mono text-rose-600 tabular-nums mt-1">
              -{formatCurrency(totalExpense, data.currency)}
            </div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Balance Neto
            </span>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatCurrency(netBalance, data.currency)}
            </div>
          </div>
          <div
            className={`p-2.5 rounded-xl ${
              netBalance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por concepto o categoría..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Segmented Controls */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('todos')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterType === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('ingreso')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterType === 'ingreso' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ingresos
            </button>
            <button
              onClick={() => setFilterType('egreso')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filterType === 'egreso' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Egresos
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none"
          >
            <option value="todas">Todas las categorías</option>
            <optgroup label="Ingresos">
              {data.incomeCategories.map((c) => (
                <option key={`inc-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Egresos">
              {data.expenseCategories.map((c) => (
                <option key={`exp-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Complete Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Grupo / Categoría</th>
                <th className="py-3 px-4">Concepto / Descripción</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4 text-right">Monto ({data.currency})</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No hay movimientos en este periodo</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Prueba seleccionando otro mes o agrega un nuevo ingreso o gasto.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'ingreso';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono">
                        {formatDate(tx.date)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          <span>{isIncome ? 'Ingreso' : 'Egreso'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{tx.category}</span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{tx.description}</div>
                        {tx.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5 italic">{tx.notes}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                        {tx.paymentMethod || 'Efectivo'}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold tabular-nums">
                        <span className={isIncome ? 'text-emerald-600' : 'text-rose-600'}>
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount, data.currency)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditClick(tx)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar esta transacción?')) {
                                deleteTransaction(tx.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: AGREGAR / EDITAR TRANSACCIÓN ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingTransaction ? 'Editar Movimiento' : `Registrar ${txType === 'ingreso' ? 'Ingreso' : 'Egreso'}`}
              </h3>
              <button onClick={handleCloseModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type selector if not editing */}
            {!editingTransaction && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleTypeChange('ingreso')}
                  className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    txType === 'ingreso'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Ingreso</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('egreso')}
                  className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    txType === 'egreso'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Egreso / Gasto</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monto ({data.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="Ej: 450000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 text-base font-bold font-mono ${
                    txType === 'ingreso'
                      ? 'text-emerald-600 focus:ring-emerald-500/20 focus:border-emerald-500'
                      : 'text-rose-600 focus:ring-rose-500/20 focus:border-rose-500'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Concepto / Descripción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de nómina, mercado, gasolina..."
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medio de Pago</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTxPaymentMethod(val);
                      if (val === 'Tarjeta Crédito' && !txLinkedDebtId && preferredCardId) {
                        setTxLinkedDebtId(preferredCardId);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Nequi / Daviplata">Nequi / Daviplata</option>
                    <option value="Tarjeta Débito">Tarjeta Débito</option>
                    <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Credit Card Debt Linkage when creating new Egreso with Tarjeta Crédito */}
              {!editingTransaction &&
                txType === 'egreso' &&
                txPaymentMethod === 'Tarjeta Crédito' && (
                  <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-950">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Vincular a Tarjeta de Crédito</span>
                    </div>

                    {data.debts.length === 0 ? (
                      <p className="text-[11px] text-slate-600">
                        El egreso se guardará con su valor completo. Si registras tu tarjeta en{' '}
                        <b>Mis Deudas (E.A.)</b>, podrás sumar compras al saldo automáticamente.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Tarjeta / Deuda
                            </label>
                            <select
                              value={txLinkedDebtId}
                              onChange={(e) => setTxLinkedDebtId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                            >
                              <option value="">No vincular a deuda</option>
                              {data.debts.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.creditor} ({formatCurrency(d.currentBalance, data.currency)})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Comisión servicio (opcional)
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Ej: 0 o 5000"
                              value={txServiceFee}
                              onChange={(e) => setTxServiceFee(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        {txLinkedDebtId && (() => {
                          const linkedDebt = data.debts.find((d) => d.id === txLinkedDebtId);
                          if (!linkedDebt) return null;
                          const totalAdd = (parseFloat(txAmount) || 0) + (parseFloat(txServiceFee) || 0);
                          const nextBalance = linkedDebt.currentBalance + totalAdd;
                          const nextRates = calculateAllRates(
                            linkedDebt.rateType,
                            linkedDebt.enteredRate,
                            nextBalance
                          );
                          return (
                            <>
                              <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={txLinkToDebtBalance}
                                  onChange={(e) => setTxLinkToDebtBalance(e.target.checked)}
                                  className="rounded text-indigo-600"
                                />
                                <span>
                                  Sumar este valor al saldo de {linkedDebt.creditor} en Mis Deudas
                                </span>
                              </label>
                              {txLinkToDebtBalance && totalAdd > 0 && (
                                <div className="pt-2 border-t border-indigo-200/80 flex flex-wrap justify-between gap-2 text-[11px] text-slate-700">
                                  <span>
                                    Nuevo saldo:{' '}
                                    <b className="font-mono text-indigo-900">
                                      {formatCurrency(nextBalance, data.currency)}
                                    </b>
                                  </span>
                                  <span>
                                    Interés est.:{' '}
                                    <b className="font-mono text-amber-700">
                                      ~
                                      {formatCurrency(
                                        nextRates.estimatedMonthlyInterest,
                                        data.currency
                                      )}
                                      /m
                                    </b>
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Grupo / Categoría *</label>
                <select
                  value={txCategory}
                  onChange={(e) => {
                    setTxCategory(e.target.value);
                    if (e.target.value !== '__custom__') {
                      setTxCustomCategory('');
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs mb-2"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">+ Crear nuevo grupo / categoría personalizada</option>
                </select>

                {txCategory === '__custom__' && (
                  <input
                    type="text"
                    required
                    placeholder="Escribe el nombre del nuevo grupo..."
                    value={txCustomCategory}
                    onChange={(e) => setTxCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-indigo-50/50 text-xs text-indigo-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notas (opcional)</label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white font-semibold rounded-lg shadow-xs transition-colors ${
                    txType === 'ingreso'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {editingTransaction ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADELANTO / AVANCE DESDE TARJETA ================= */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Adelanto de Tarjeta a mi Cuenta
                  </h3>
                  <p className="text-xs text-slate-500">
                    Suma el adelanto + comisión por servicio al saldo y calcula intereses E.A.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdvance} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tarjeta de Crédito origen *
                </label>
                <select
                  required
                  value={advDebtId}
                  onChange={(e) => setAdvDebtId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-medium"
                >
                  {data.debts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.creditor} ({d.concept}) · Saldo:{' '}
                      {formatCurrency(d.currentBalance, data.currency)} · {d.effectiveAnnualRate}%
                      E.A.
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Valor del Adelanto ({data.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="Ej: 500000"
                    value={advAmount}
                    onChange={(e) => setAdvAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono text-slate-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Comisión servicio</label>
                    <button
                      type="button"
                      onClick={() => setAdvServiceFee('5000')}
                      className="text-[10px] font-semibold text-amber-700 hover:underline cursor-pointer"
                    >
                      $5.000
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={advServiceFee}
                    onChange={(e) => setAdvServiceFee(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono text-amber-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Concepto</label>
                  <input
                    type="text"
                    placeholder="Adelanto a cuenta de ahorros..."
                    value={advDescription}
                    onChange={(e) => setAdvDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={advDate}
                    onChange={(e) => setAdvDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              {(() => {
                const targetDebt = data.debts.find((d) => d.id === advDebtId);
                if (!targetDebt) return null;
                const amt = parseFloat(advAmount) || 0;
                const fee = Math.max(0, parseFloat(advServiceFee) || 0);
                const totalAdd = amt + fee;
                const nextBal = targetDebt.currentBalance + (advUpdateDebt ? totalAdd : 0);
                const nextRates = calculateAllRates(
                  targetDebt.rateType,
                  targetDebt.enteredRate,
                  nextBal
                );
                return (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-[11px]">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-500 block">Entra a cuenta</span>
                        <span className="font-bold font-mono text-emerald-700">
                          +{formatCurrency(amt, data.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Comisión</span>
                        <span className="font-bold font-mono text-rose-700">
                          {formatCurrency(fee, data.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Cargo tarjeta</span>
                        <span className="font-bold font-mono text-slate-900">
                          +{formatCurrency(totalAdd, data.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-amber-200/80 flex flex-wrap justify-between gap-2 text-slate-700">
                      <span>
                        Nuevo saldo {targetDebt.creditor}:{' '}
                        <b className="font-mono text-slate-900">
                          {formatCurrency(nextBal, data.currency)}
                        </b>
                      </span>
                      <span>
                        Interés est.:{' '}
                        <b className="font-mono text-amber-800">
                          ~{formatCurrency(nextRates.estimatedMonthlyInterest, data.currency)}/m
                        </b>
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5 text-[11px] text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advUpdateDebt}
                    onChange={(e) => setAdvUpdateDebt(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Sumar adelanto + comisión al saldo de la tarjeta en Mis Deudas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advRegisterIncome}
                    onChange={(e) => setAdvRegisterIncome(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Registrar el dinero recibido como ingreso en Flujo de Caja</span>
                </label>
                {(parseFloat(advServiceFee) || 0) > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advRegisterFeeExpense}
                      onChange={(e) => setAdvRegisterFeeExpense(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Registrar la comisión por servicio como egreso en Flujo de Caja</span>
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Registrar Adelanto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
