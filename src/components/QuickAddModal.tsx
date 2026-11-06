import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType, RateInputType } from '../types/finance';
import { calculateAllRates, formatCurrency } from '../utils/financialCalculations';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Building2,
  Percent,
} from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'ingreso' | 'egreso' | 'prestamo' | 'deuda';
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  initialType = 'ingreso',
}) => {
  const { data, addTransaction, addLoan, addOwnDebt } = useFinance();

  const [activeTab, setActiveTab] = useState<'ingreso' | 'egreso' | 'prestamo' | 'deuda'>(
    initialType
  );

  // Transaction state
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState(
    initialType === 'egreso' ? data.expenseCategories[0] : data.incomeCategories[0]
  );
  const [txDescription, setTxDescription] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState('Transferencia');

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

  if (!isOpen) return null;

  const handleTabSwitch = (tab: 'ingreso' | 'egreso' | 'prestamo' | 'deuda') => {
    setActiveTab(tab);
    if (tab === 'ingreso') {
      setTxCategory(data.incomeCategories[0]);
    } else if (tab === 'egreso') {
      setTxCategory(data.expenseCategories[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'ingreso' || activeTab === 'egreso') {
      const amountNum = parseFloat(txAmount);
      if (isNaN(amountNum) || amountNum <= 0) return;

      addTransaction({
        type: activeTab as TransactionType,
        amount: amountNum,
        date: txDate,
        category: txCategory || (activeTab === 'ingreso' ? 'Salario / Sueldo' : 'Alimentación'),
        description: txDescription.trim() || (activeTab === 'ingreso' ? 'Ingreso' : 'Egreso'),
        paymentMethod: txPaymentMethod,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">Nuevo Registro Rápido</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Tabs Selector */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleTabSwitch('ingreso')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'ingreso' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Ingreso</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('egreso')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'egreso' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Egreso</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('prestamo')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'prestamo' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Préstamo</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('deuda')}
            className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1 ${
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
                  <label className="block font-semibold text-slate-700 mb-1">Grupo / Categoría</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {(activeTab === 'ingreso' ? data.incomeCategories : data.expenseCategories).map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
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
              </div>
            </>
          )}

          {/* TAB 3: PRÉSTAMO A TERCEROS */}
          {activeTab === 'prestamo' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de la Persona que Debe *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Mendoza..."
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
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
                  <label className="block font-semibold text-slate-700 mb-1">Teléfono / WhatsApp</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Motivo / Concepto</label>
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

          {/* TAB 4: MIS DEUDAS (E.A.) */}
          {activeTab === 'deuda' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entidad / Banco *</label>
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
                  <span>E.A.: <b className="text-emerald-700">{previewRates.effectiveAnnualRate}%</b></span>
                  <span>M.V.: <b>{previewRates.monthlyRate}%/m</b></span>
                  <span>Interés: <b>~{formatCurrency(previewRates.estimatedMonthlyInterest, data.currency)}/m</b></span>
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
                  <label className="block font-semibold text-slate-700 mb-1">Día Límite de Pago</label>
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
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              Confirmar y Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
