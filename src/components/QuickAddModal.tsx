import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType, RateInputType } from '../types/finance';
import {
  calculateAllRates,
  formatCurrency,
  groupLoansByBorrower,
} from '../utils/financialCalculations';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Building2,
  CreditCard,
} from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'ingreso' | 'egreso' | 'prestamo' | 'deuda' | 'avance';
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  initialType = 'ingreso',
}) => {
  const { data, addTransaction, addLoan, addOwnDebt, addDebtCharge } = useFinance();

  const [activeTab, setActiveTab] = useState<
    'ingreso' | 'egreso' | 'avance' | 'prestamo' | 'deuda'
  >(initialType);

  // Transaction state
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState(
    initialType === 'egreso' ? data.expenseCategories[0] : data.incomeCategories[0]
  );
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Transferencia');
  const [txLinkedDebtId, setTxLinkedDebtId] = useState('');
  const [txLinkToDebtBalance, setTxLinkToDebtBalance] = useState(true);
  const [txServiceFee, setTxServiceFee] = useState('');

  // Cash Advance (Adelanto) state
  const [advDebtId, setAdvDebtId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advServiceFee, setAdvServiceFee] = useState('5000');
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDescription, setAdvDescription] = useState('');
  const [advUpdateDebt, setAdvUpdateDebt] = useState(true);
  const [advRegisterIncome, setAdvRegisterIncome] = useState(true);
  const [advRegisterFeeExpense, setAdvRegisterFeeExpense] = useState(true);

  // Loan state
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanConcept, setLoanConcept] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');

  // Own Debt state
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtConcept, setDebtConcept] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtMonthlyPayment, setDebtMonthlyPayment] = useState('');
  const [debtRateType, setDebtRateType] = useState<RateInputType>('ea');
  const [debtEnteredRate, setDebtEnteredRate] = useState('24.5');
  const [debtCutoffDay, setDebtCutoffDay] = useState('18');
  const [debtPaymentDay, setDebtPaymentDay] = useState('5');

  const borrowerGroups = useMemo(() => groupLoansByBorrower(data.loans), [data.loans]);

  const preferredCardId = useMemo(() => {
    const cardDebt = data.debts.find(
      (d) =>
        d.concept.toLowerCase().includes('tarjeta') ||
        d.creditor.toLowerCase().includes('nu')
    );
    return cardDebt?.id || data.debts[0]?.id || '';
  }, [data.debts]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      if (initialType === 'egreso') {
        setTxCategory(data.expenseCategories[0]);
      } else if (initialType === 'ingreso') {
        setTxCategory(data.incomeCategories[0]);
      }
      if (!advDebtId && preferredCardId) {
        setAdvDebtId(preferredCardId);
      }
      if (!txLinkedDebtId && preferredCardId) {
        setTxLinkedDebtId(preferredCardId);
      }
    }
  }, [
    isOpen,
    initialType,
    data.expenseCategories,
    data.incomeCategories,
    preferredCardId,
    advDebtId,
    txLinkedDebtId,
  ]);

  if (!isOpen) return null;

  const handleTabSwitch = (
    tab: 'ingreso' | 'egreso' | 'avance' | 'prestamo' | 'deuda'
  ) => {
    setActiveTab(tab);
    if (tab === 'ingreso') {
      setTxCategory(data.incomeCategories[0]);
    } else if (tab === 'egreso') {
      setTxCategory(data.expenseCategories[0]);
    } else if (tab === 'avance' && !advDebtId && preferredCardId) {
      setAdvDebtId(preferredCardId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'ingreso' || activeTab === 'egreso') {
      const amountNum = parseFloat(txAmount);
      if (isNaN(amountNum) || amountNum <= 0) return;

      const feeNum = Math.max(0, parseFloat(txServiceFee) || 0);
      const isCreditCardExpense =
        activeTab === 'egreso' &&
        txPaymentMethod === 'Tarjeta Crédito' &&
        Boolean(txLinkedDebtId) &&
        txLinkToDebtBalance;

      if (isCreditCardExpense) {
        await addDebtCharge({
          debtId: txLinkedDebtId,
          mode: 'compra',
          amount: amountNum,
          serviceFee: feeNum,
          date: txDate,
          category: txCategory || 'Imprevistos y Varios',
          description: txDescription.trim() || 'Compra con tarjeta de crédito',
          registerInCashFlow: true,
          registerFeeInCashFlow: feeNum > 0,
          updateDebtBalance: true,
        });
      } else {
        addTransaction({
          type: activeTab as TransactionType,
          amount: amountNum,
          date: txDate,
          category:
            txCategory ||
            (activeTab === 'ingreso' ? 'Salario / Sueldo' : 'Alimentación y Supermercado'),
          description: txDescription.trim() || (activeTab === 'ingreso' ? 'Ingreso' : 'Egreso'),
          paymentMethod: txPaymentMethod,
        });
      }
    } else if (activeTab === 'avance') {
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
    } else if (activeTab === 'prestamo') {
      const amountNum = parseFloat(loanAmount);
      if (!borrowerName || isNaN(amountNum) || amountNum <= 0) return;

      addLoan({
        borrowerName: borrowerName.trim(),
        borrowerPhone: borrowerPhone.trim() || undefined,
        concept: loanConcept.trim() || 'Préstamo a conocido',
        initialAmount: amountNum,
        monthlyInterestRate: 0,
        startDate: txDate,
        dueDate: loanDueDate || txDate,
      });
    } else if (activeTab === 'deuda') {
      const amountNum = parseFloat(debtAmount);
      const paymentNum = parseFloat(debtMonthlyPayment) || 0;
      const rateNum = parseFloat(debtEnteredRate) || 0;
      if (!debtCreditor || isNaN(amountNum) || amountNum <= 0) return;

      addOwnDebt({
        creditor: debtCreditor.trim(),
        concept: debtConcept.trim() || 'Crédito',
        originalAmount: amountNum,
        currentBalance: amountNum,
        monthlyPayment: paymentNum,
        cutoffDay: parseInt(debtCutoffDay, 10) || 15,
        paymentDay: parseInt(debtPaymentDay, 10) || 5,
        rateType: debtRateType,
        enteredRate: rateNum,
      });
    }

    onClose();
  };

  const previewRates = calculateAllRates(
    debtRateType,
    parseFloat(debtEnteredRate) || 0,
    parseFloat(debtAmount) || 0
  );

  // Preview for Credit Card Egreso
  const selectedTxDebt = data.debts.find((d) => d.id === txLinkedDebtId);
  const txCardTotalAdded = (parseFloat(txAmount) || 0) + (parseFloat(txServiceFee) || 0);
  const txProjectedDebtBalance = selectedTxDebt
    ? selectedTxDebt.currentBalance + txCardTotalAdded
    : 0;
  const txProjectedRates = selectedTxDebt
    ? calculateAllRates(
        selectedTxDebt.rateType,
        selectedTxDebt.enteredRate,
        txProjectedDebtBalance
      )
    : null;

  // Preview for Cash Advance
  const selectedAdvDebt = data.debts.find((d) => d.id === advDebtId);
  const advAmountNum = parseFloat(advAmount) || 0;
  const advFeeNum = Math.max(0, parseFloat(advServiceFee) || 0);
  const advTotalCharge = advAmountNum + advFeeNum;
  const advProjectedBalance = selectedAdvDebt
    ? selectedAdvDebt.currentBalance + (advUpdateDebt ? advTotalCharge : 0)
    : 0;
  const advProjectedRates = selectedAdvDebt
    ? calculateAllRates(
        selectedAdvDebt.rateType,
        selectedAdvDebt.enteredRate,
        advProjectedBalance
      )
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">Nuevo Registro Rápido</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Tabs Selector */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => handleTabSwitch('ingreso')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'ingreso' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Ingreso</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('egreso')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'egreso' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Egreso</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('avance')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'avance' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Avance</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('prestamo')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'prestamo' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Préstamo</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('deuda')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'deuda' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Mi Deuda</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* TAB 1 & 2: INGRESO / EGRESO */}
          {(activeTab === 'ingreso' || activeTab === 'egreso') && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monto ({data.currency}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="Ej: 350000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-base font-bold font-mono focus:outline-none focus:ring-2 ${
                    activeTab === 'ingreso'
                      ? 'text-emerald-600 focus:ring-emerald-500/20'
                      : 'text-rose-600 focus:ring-rose-500/20'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concepto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Honorarios freelance, compras del mercado..."
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Grupo / Categoría
                  </label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {(activeTab === 'ingreso'
                      ? data.incomeCategories
                      : data.expenseCategories
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medio de Pago</label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value)}
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Credit Card Debt Linkage when Egreso + Tarjeta Crédito */}
              {activeTab === 'egreso' && txPaymentMethod === 'Tarjeta Crédito' && (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Cargo a Tarjeta de Crédito</span>
                    </span>
                  </div>

                  {data.debts.length === 0 ? (
                    <p className="text-[11px] text-slate-600">
                      Se registrará el egreso por el valor indicado. Si agregas tu tarjeta en{' '}
                      <b>Mis Deudas (E.A.)</b>, podrás vincular compras para actualizar su saldo
                      automáticamente.
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
                                {d.creditor} - {d.concept} (
                                {formatCurrency(d.currentBalance, data.currency)})
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

                      {txLinkedDebtId && selectedTxDebt && (
                        <>
                          <label className="flex items-center gap-2 text-[11px] text-slate-700 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={txLinkToDebtBalance}
                              onChange={(e) => setTxLinkToDebtBalance(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Sumar este valor al saldo de {selectedTxDebt.creditor}</span>
                          </label>

                          {txLinkToDebtBalance && txCardTotalAdded > 0 && txProjectedRates && (
                            <div className="pt-2 border-t border-indigo-200/80 flex flex-wrap justify-between gap-2 text-[11px] text-slate-700">
                              <span>
                                Nuevo saldo:{' '}
                                <b className="font-mono text-indigo-900">
                                  {formatCurrency(txProjectedDebtBalance, data.currency)}
                                </b>
                              </span>
                              <span>
                                Interés est.:{' '}
                                <b className="font-mono text-amber-700">
                                  ~
                                  {formatCurrency(
                                    txProjectedRates.estimatedMonthlyInterest,
                                    data.currency
                                  )}
                                  /mes
                                </b>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 3: ADELANTO / AVANCE DE TARJETA A CUENTA */}
          {activeTab === 'avance' && (
            <>
              {data.debts.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <p className="font-bold">Primero registra tu tarjeta en &quot;Mis Deudas&quot;</p>
                  <p>
                    Para calcular intereses E.A. y sumar el avance con su comisión al saldo de tu
                    tarjeta, agrégala en la pestaña <b>Mi Deuda</b>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('deuda')}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg"
                  >
                    Ir a registrar tarjeta
                  </button>
                </div>
              ) : (
                <>
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Comisión servicio
                        </label>
                        <button
                          type="button"
                          onClick={() => setAdvServiceFee('5000')}
                          className="text-[10px] font-semibold text-amber-700 hover:underline cursor-pointer"
                        >
                          Usar $5.000
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Ej: 5000"
                        value={advServiceFee}
                        onChange={(e) => setAdvServiceFee(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold font-mono text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Concepto / Descripción
                      </label>
                      <input
                        type="text"
                        placeholder={`Adelanto a cuenta (${selectedAdvDebt?.creditor || 'Tarjeta'})`}
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

                  {/* Breakdown Summary */}
                  {selectedAdvDebt && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-[11px]">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-slate-500 block">Entra a tu cuenta</span>
                          <span className="font-bold font-mono text-emerald-700">
                            +{formatCurrency(advAmountNum, data.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Comisión servicio</span>
                          <span className="font-bold font-mono text-rose-700">
                            {formatCurrency(advFeeNum, data.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cargo total tarjeta</span>
                          <span className="font-bold font-mono text-slate-900">
                            +{formatCurrency(advTotalCharge, data.currency)}
                          </span>
                        </div>
                      </div>

                      {advProjectedRates && (
                        <div className="pt-2 border-t border-amber-200/80 flex flex-wrap justify-between gap-2 text-slate-700">
                          <span>
                            Nuevo saldo {selectedAdvDebt.creditor}:{' '}
                            <b className="font-mono text-slate-900">
                              {formatCurrency(advProjectedBalance, data.currency)}
                            </b>
                          </span>
                          <span>
                            Interés mensual ({selectedAdvDebt.effectiveAnnualRate}% E.A.):{' '}
                            <b className="font-mono text-amber-800">
                              ~
                              {formatCurrency(
                                advProjectedRates.estimatedMonthlyInterest,
                                data.currency
                              )}
                              /m
                            </b>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advUpdateDebt}
                        onChange={(e) => setAdvUpdateDebt(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      <span>
                        Sumar adelanto + comisión ({formatCurrency(advTotalCharge, data.currency)})
                        al saldo de la tarjeta
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advRegisterIncome}
                        onChange={(e) => setAdvRegisterIncome(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>
                        Registrar {formatCurrency(advAmountNum, data.currency)} como ingreso a tu
                        cuenta en Flujo de Caja
                      </span>
                    </label>
                    {advFeeNum > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advRegisterFeeExpense}
                          onChange={(e) => setAdvRegisterFeeExpense(e.target.checked)}
                          className="rounded text-rose-600"
                        />
                        <span>
                          Registrar comisión ({formatCurrency(advFeeNum, data.currency)}) como
                          egreso en Flujo de Caja
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* TAB 4: PRÉSTAMO A TERCEROS */}
          {activeTab === 'prestamo' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de la Persona que Debe *
                </label>
                <input
                  type="text"
                  required
                  list="quick-add-borrowers-list"
                  placeholder="Ej: Carlos Mendoza..."
                  value={borrowerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBorrowerName(val);
                    const match = borrowerGroups.find(
                      (g) => g.borrowerKey === val.trim().toLowerCase()
                    );
                    if (match && match.borrowerPhone && !borrowerPhone) {
                      setBorrowerPhone(match.borrowerPhone);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
                <datalist id="quick-add-borrowers-list">
                  {borrowerGroups.map((g) => (
                    <option key={g.borrowerKey} value={g.borrowerName} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monto Prestado ({data.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 1500000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: +57 312 456 7890"
                    value={borrowerPhone}
                    onChange={(e) => setBorrowerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Motivo / Concepto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Arreglo de vehículo..."
                    value={loanConcept}
                    onChange={(e) => setLoanConcept(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fecha de Cobro *</label>
                  <input
                    type="date"
                    required
                    value={loanDueDate}
                    onChange={(e) => setLoanDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 5: MIS DEUDAS (E.A.) */}
          {activeTab === 'deuda' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Entidad / Banco *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Bancolombia, Nu..."
                    value={debtCreditor}
                    onChange={(e) => setDebtCreditor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Crédito</label>
                  <input
                    type="text"
                    placeholder="Ej: Tarjeta de Crédito..."
                    value={debtConcept}
                    onChange={(e) => setDebtConcept(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Actual ({data.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 3200000"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cuota Mensual</label>
                  <input
                    type="number"
                    placeholder="Ej: 280000"
                    value={debtMonthlyPayment}
                    onChange={(e) => setDebtMonthlyPayment(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Tasa E.A. conversor */}
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Tipo de Tasa</label>
                    <select
                      value={debtRateType}
                      onChange={(e) => setDebtRateType(e.target.value as RateInputType)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs"
                    >
                      <option value="ea">Efectiva Anual (% E.A.)</option>
                      <option value="mv">Mes Vencido (% M.V.)</option>
                      <option value="namv">Nominal Anual (% NAMV)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Tasa %</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={debtEnteredRate}
                      onChange={(e) => setDebtEnteredRate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono font-bold text-indigo-700"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 flex justify-between pt-1 border-t border-indigo-200">
                  <span>
                    E.A.: <b className="text-emerald-700">{previewRates.effectiveAnnualRate}%</b>
                  </span>
                  <span>
                    M.V.: <b>{previewRates.monthlyRate}%/m</b>
                  </span>
                  <span>
                    Interés:{' '}
                    <b>~{formatCurrency(previewRates.estimatedMonthlyInterest, data.currency)}/m</b>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Día de Corte</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={debtCutoffDay}
                    onChange={(e) => setDebtCutoffDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Día Límite de Pago
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={debtPaymentDay}
                    onChange={(e) => setDebtPaymentDay(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={activeTab === 'avance' && data.debts.length === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Confirmar y Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
