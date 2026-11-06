import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatDate } from '../utils/financialCalculations';
import {
  Calendar,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

export const CashFlowReports: React.FC = () => {
  const { data } = useFinance();

  const currentDate = new Date();
  const [reportMonth, setReportMonth] = useState<number>(currentDate.getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(currentDate.getFullYear());

  const months = [
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

  // Calculate monthly metrics
  const monthlyMetrics = useMemo(() => {
    const monthTransactions = data.transactions.filter((tx) => {
      const parts = tx.date.split('-');
      if (parts.length === 3) {
        return parseInt(parts[0], 10) === reportYear && parseInt(parts[1], 10) === reportMonth;
      }
      return false;
    });

    const regularIncome = monthTransactions
      .filter((t) => t.type === 'ingreso' && t.category !== 'Abono Préstamo a Tercero')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const loanAbonosReceived = monthTransactions
      .filter((t) => t.type === 'ingreso' && t.category === 'Abono Préstamo a Tercero')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const totalIncome = regularIncome + loanAbonosReceived;

    const regularExpenses = monthTransactions
      .filter(
        (t) =>
          t.type === 'egreso' &&
          t.category !== 'Pago Cuota Deuda Propia' &&
          t.category !== 'Préstamo Entregado a Tercero'
      )
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const debtPaymentsMade = monthTransactions
      .filter((t) => t.type === 'egreso' && t.category === 'Pago Cuota Deuda Propia')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const loansGiven = monthTransactions
      .filter((t) => t.type === 'egreso' && t.category === 'Préstamo Entregado a Tercero')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    const totalExpenses = regularExpenses + debtPaymentsMade + loansGiven;
    const netCashFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;

    // Category breakdown
    const expensesByCategory: Record<string, number> = {};
    monthTransactions
      .filter((t) => t.type === 'egreso')
      .forEach((t) => {
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
      });

    const incomeByCategory: Record<string, number> = {};
    monthTransactions
      .filter((t) => t.type === 'ingreso')
      .forEach((t) => {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + Number(t.amount);
      });

    return {
      monthTransactions,
      regularIncome,
      loanAbonosReceived,
      totalIncome,
      regularExpenses,
      debtPaymentsMade,
      loansGiven,
      totalExpenses,
      netCashFlow,
      savingsRate,
      expensesByCategory,
      incomeByCategory,
    };
  }, [data.transactions, reportMonth, reportYear]);

  // Annual comparison data for all 12 months of reportYear
  const annualHistory = useMemo(() => {
    return months.map((m) => {
      const txs = data.transactions.filter((tx) => {
        const parts = tx.date.split('-');
        return (
          parts.length === 3 &&
          parseInt(parts[0], 10) === reportYear &&
          parseInt(parts[1], 10) === m.value
        );
      });
      const inc = txs
        .filter((t) => t.type === 'ingreso')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const exp = txs
        .filter((t) => t.type === 'egreso')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      return {
        month: m.label.substring(0, 3),
        income: inc,
        expense: exp,
        net: inc - exp,
      };
    });
  }, [data.transactions, reportYear]);

  // Max value for SVG bar chart scaling
  const maxAnnualVal = Math.max(
    ...annualHistory.map((h) => Math.max(h.income, h.expense)),
    1000000
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Month Selector & Print Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Reporte de Flujo de Caja</h2>
            <p className="text-xs text-slate-500">
              Análisis financiero mensual de ingresos, gastos, cobro de préstamos y pago de deudas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={reportYear}
              onChange={(e) => setReportYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {[2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Exportar</span>
          </button>
        </div>
      </div>

      {/* Main Cash Flow Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ingresos Totales</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            +{formatCurrency(monthlyMetrics.totalIncome, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-2">
            <div className="flex justify-between">
              <span>Operacionales:</span>
              <span className="font-mono">{formatCurrency(monthlyMetrics.regularIncome, data.currency)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Abonos recibidos:</span>
              <span className="font-mono">+{formatCurrency(monthlyMetrics.loanAbonosReceived, data.currency)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Egresos Totales</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
            -{formatCurrency(monthlyMetrics.totalExpenses, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 pt-2">
            <div className="flex justify-between">
              <span>Gastos del mes:</span>
              <span className="font-mono">{formatCurrency(monthlyMetrics.regularExpenses, data.currency)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Pago de deudas:</span>
              <span className="font-mono">-{formatCurrency(monthlyMetrics.debtPaymentsMade, data.currency)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Flujo de Caja Neto</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              monthlyMetrics.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(monthlyMetrics.netCashFlow, data.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">
            {monthlyMetrics.netCashFlow >= 0 ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Superávit mensual
              </span>
            ) : (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Déficit en el periodo
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tasa de Ahorro</span>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {monthlyMetrics.savingsRate}%
          </div>
          <p className="text-xs text-slate-500 mt-2 border-t border-slate-100 pt-2">
            {monthlyMetrics.savingsRate >= 20
              ? 'Excelente índice de ahorro (>20%)'
              : monthlyMetrics.savingsRate > 0
              ? 'Margen positivo de liquidez'
              : 'Revisa gastos o deudas'}
          </p>
        </div>
      </div>

      {/* Visual Charts: Annual Comparison & Expense Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Annual Cash Flow Bar Chart */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Evolución del Flujo de Caja en {reportYear}
              </h3>
              <p className="text-xs text-slate-500">Comparativa mensual de Ingresos vs Egresos</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Ingresos
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Egresos
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-56 flex items-end justify-between gap-1 pt-6 pb-2 px-1 border-b border-slate-100">
            {annualHistory.map((item, idx) => {
              const incHeight = maxAnnualVal > 0 ? (item.income / maxAnnualVal) * 160 : 0;
              const expHeight = maxAnnualVal > 0 ? (item.expense / maxAnnualVal) * 160 : 0;
              const isSelected = idx + 1 === reportMonth;

              return (
                <div
                  key={item.month}
                  onClick={() => setReportMonth(idx + 1)}
                  className={`flex-1 flex flex-col items-center gap-1 cursor-pointer group p-1 rounded-lg transition-colors ${
                    isSelected ? 'bg-slate-100/80 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-full flex items-end justify-center gap-1 h-44">
                    {/* Income Bar */}
                    <div
                      className="w-2.5 sm:w-3.5 bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-600"
                      style={{ height: `${Math.max(4, incHeight)}px` }}
                      title={`Ingresos ${item.month}: ${formatCurrency(item.income, data.currency)}`}
                    />
                    {/* Expense Bar */}
                    <div
                      className="w-2.5 sm:w-3.5 bg-rose-500 rounded-t-sm transition-all duration-300 group-hover:bg-rose-600"
                      style={{ height: `${Math.max(4, expHeight)}px` }}
                      title={`Egresos ${item.month}: ${formatCurrency(item.expense, data.currency)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono mt-1">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Distribution of Expenses by Category */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Desglose de Gastos ({months.find((m) => m.value === reportMonth)?.label})
            </h3>
            <p className="text-xs text-slate-500">Distribución porcentual por grupo de egreso</p>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {Object.keys(monthlyMetrics.expensesByCategory).length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Sin egresos registrados en este mes.
              </div>
            ) : (
              Object.entries(monthlyMetrics.expensesByCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const pct =
                    monthlyMetrics.totalExpenses > 0
                      ? Math.round((amount / monthlyMetrics.totalExpenses) * 100)
                      : 0;

                  return (
                    <div key={category} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold truncate pr-2">{category}</span>
                        <div className="text-right shrink-0">
                          <span className="font-mono tabular-nums font-bold">
                            {formatCurrency(amount, data.currency)}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px] ml-1.5">
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-slate-800 h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Printable / Executive Detailed Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Detalle Completo de Operaciones - {months.find((m) => m.value === reportMonth)?.label}{' '}
              {reportYear}
            </h3>
            <p className="text-xs text-slate-500">
              {monthlyMetrics.monthTransactions.length} movimiento(s) computado(s) en este periodo
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Saldo Neto del Periodo</span>
            <span
              className={`font-mono font-bold text-base tabular-nums ${
                monthlyMetrics.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatCurrency(monthlyMetrics.netCashFlow, data.currency)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3">Concepto</th>
                <th className="py-2.5 px-3">Medio de Pago</th>
                <th className="py-2.5 px-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
              {monthlyMetrics.monthTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Sin movimientos registrados en este mes.
                  </td>
                </tr>
              ) : (
                monthlyMetrics.monthTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{formatDate(tx.date)}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      <span
                        className={tx.type === 'ingreso' ? 'text-emerald-700' : 'text-rose-700'}
                      >
                        {tx.type === 'ingreso' ? 'Ingreso (+)' : 'Egreso (-)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{tx.category}</td>
                    <td className="py-2.5 px-3 text-slate-700">{tx.description}</td>
                    <td className="py-2.5 px-3 text-slate-500">{tx.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      <span
                        className={tx.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}
                      >
                        {tx.type === 'ingreso' ? '+' : '-'}
                        {formatCurrency(tx.amount, data.currency)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
