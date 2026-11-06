import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { FinanceData, Transaction, ThirdPartyLoan, LoanPayment, OwnDebt, DebtPayment, AlertNotification } from '../types/finance';
import { getInitialFinanceData } from '../utils/defaultData';
import { calculateAllRates, calculateLoanSummary, generateAlertNotifications } from '../utils/financialCalculations';
import confetti from 'canvas-confetti';

interface FinanceContextType {
  data: FinanceData;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncStatus: 'online' | 'offline' | 'syncing';
  activeAlerts: AlertNotification[];
  browserNotificationsAllowed: boolean;
  requestNotificationPermission: () => Promise<void>;
  
  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;

  // Third Party Loans
  addLoan: (loan: Omit<ThirdPartyLoan, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'status'>) => void;
  updateLoan: (loan: ThirdPartyLoan) => void;
  deleteLoan: (id: string) => void;
  addLoanPayment: (loanId: string, payment: Omit<LoanPayment, 'id' | 'createdAt' | 'loanId'>, registerInCashFlow?: boolean) => void;
  deleteLoanPayment: (loanId: string, paymentId: string) => void;

  // Own Debts
  addOwnDebt: (debt: Omit<OwnDebt, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'effectiveAnnualRate' | 'monthlyRate' | 'nominalAnnualRate' | 'estimatedMonthlyInterest' | 'status'>) => void;
  updateOwnDebt: (debt: OwnDebt) => void;
  deleteOwnDebt: (id: string) => void;
  addDebtPayment: (debtId: string, payment: Omit<DebtPayment, 'id' | 'createdAt' | 'debtId'>, registerInCashFlow?: boolean) => void;
  deleteDebtPayment: (debtId: string, paymentId: string) => void;

  // Settings & Reset
  resetData: (mode?: 'seed' | 'clean') => Promise<void>;
  setCurrency: (currency: string) => void;
  triggerManualSync: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'finanzen_local_cache_v1';

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<FinanceData>(() => {
    // Try to restore immediately from localStorage for instant initial render
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }
    return getInitialFinanceData();
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('syncing');
  const [browserNotificationsAllowed, setBrowserNotificationsAllowed] = useState(false);

  // Sync state with server
  const syncToServer = useCallback(async (newData: FinanceData) => {
    setData(newData);
    setIsSyncing(true);
    setSyncStatus('syncing');

    // Save to localStorage immediately
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    try {
      const response = await fetch('/api/finance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });

      if (response.ok) {
        setSyncStatus('online');
        setLastSyncTime(new Date());
      } else {
        setSyncStatus('offline');
      }
    } catch (err) {
      console.error('Server sync failed, will retry:', err);
      setSyncStatus('offline');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Fetch initial data from server
  const fetchFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/data');
      if (res.ok) {
        const serverData: FinanceData = await res.json();
        setData(serverData);
        setSyncStatus('online');
        setLastSyncTime(new Date());
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverData));
        } catch {
          // Ignore
        }
      } else {
        setSyncStatus('offline');
      }
    } catch {
      setSyncStatus('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up SSE Stream & Fallback Polling for multi-device live sync
  useEffect(() => {
    fetchFromServer();

    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotificationsAllowed(Notification.permission === 'granted');
    }

    // Connect to Server-Sent Events stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/finance/stream');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'SYNC_UPDATE' && parsed.data) {
            setData(parsed.data);
            setLastSyncTime(new Date());
            setSyncStatus('online');
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed.data));
          }
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };
      eventSource.onerror = () => {
        setSyncStatus('offline');
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect:', e);
    }

    // Heartbeat / periodic check every 15s to keep live sync rock-solid across devices
    const interval = setInterval(() => {
      fetchFromServer();
    }, 15000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [fetchFromServer]);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserNotificationsAllowed(perm === 'granted');
        if (perm === 'granted') {
          new Notification('FinanZen Notificaciones Activas', {
            body: '¡Listo! Te avisaremos automáticamente cuando se acerque la fecha de pago de préstamos y deudas.',
            icon: '/favicon.ico',
          });
        }
      } catch (err) {
        console.error('Permission request error:', err);
      }
    }
  };

  // Derive active notifications / alerts
  const activeAlerts = generateAlertNotifications(data.loans, data.debts);

  // Trigger web notification if there are critical alerts
  useEffect(() => {
    if (browserNotificationsAllowed && activeAlerts.length > 0) {
      const criticals = activeAlerts.filter(a => a.urgency === 'critical');
      if (criticals.length > 0) {
        // Send a notification for top critical item
        const top = criticals[0];
        try {
          new Notification(top.title, {
            body: top.description,
            icon: '/favicon.ico',
          });
        } catch {
          // Browser may restrict if not directly from user action
        }
      }
    }
  }, [activeAlerts.length, browserNotificationsAllowed]);

  // =================== TRANSACTION OPERATIONS ===================
  const addTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    const updated: FinanceData = {
      ...data,
      transactions: [newTx, ...data.transactions],
    };
    syncToServer(updated);
  };

  const updateTransaction = (tx: Transaction) => {
    const updated: FinanceData = {
      ...data,
      transactions: data.transactions.map(t => (t.id === tx.id ? tx : t)),
    };
    syncToServer(updated);
  };

  const deleteTransaction = (id: string) => {
    const updated: FinanceData = {
      ...data,
      transactions: data.transactions.filter(t => t.id !== id),
    };
    syncToServer(updated);
  };

  // =================== THIRD-PARTY LOAN OPERATIONS ===================
  const addLoan = (loanData: Omit<ThirdPartyLoan, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'status'>) => {
    const newLoan: ThirdPartyLoan = {
      ...loanData,
      id: `loan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      payments: [],
      status: 'al_dia',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Also register an expense in transactions for giving the loan!
    const loanExpenseTx: Transaction = {
      id: `tx-loan-${newLoan.id}`,
      type: 'egreso',
      amount: newLoan.initialAmount,
      date: newLoan.startDate || new Date().toISOString().split('T')[0],
      category: 'Préstamo Entregado a Tercero',
      description: `Préstamo entregado a ${newLoan.borrowerName} (${newLoan.concept})`,
      paymentMethod: 'Transferencia',
      relatedLoanId: newLoan.id,
      createdAt: new Date().toISOString(),
    };

    const updated: FinanceData = {
      ...data,
      loans: [newLoan, ...data.loans],
      transactions: [loanExpenseTx, ...data.transactions],
    };
    syncToServer(updated);
  };

  const updateLoan = (loan: ThirdPartyLoan) => {
    const updated: FinanceData = {
      ...data,
      loans: data.loans.map(l => (l.id === loan.id ? { ...loan, updatedAt: new Date().toISOString() } : l)),
    };
    syncToServer(updated);
  };

  const deleteLoan = (id: string) => {
    const updated: FinanceData = {
      ...data,
      loans: data.loans.filter(l => l.id !== id),
    };
    syncToServer(updated);
  };

  const addLoanPayment = (
    loanId: string,
    paymentData: Omit<LoanPayment, 'id' | 'createdAt' | 'loanId'>,
    registerInCashFlow: boolean = true
  ) => {
    const loan = data.loans.find(l => l.id === loanId);
    if (!loan) return;

    const newPayment: LoanPayment = {
      ...paymentData,
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      loanId,
      createdAt: new Date().toISOString(),
    };

    const updatedPayments = [...(loan.payments || []), newPayment];
    const totalPaid = updatedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const isSettled = totalPaid >= loan.initialAmount;

    // Check if debt is fully paid! Trigger celebratory confetti
    if (isSettled && (loan.initialAmount - (totalPaid - newPayment.amount)) > 0) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    }

    const updatedLoan: ThirdPartyLoan = {
      ...loan,
      payments: updatedPayments,
      status: isSettled ? 'pagado' : loan.status,
      updatedAt: new Date().toISOString(),
    };

    let updatedTransactions = [...data.transactions];
    if (registerInCashFlow) {
      const incomeTx: Transaction = {
        id: `tx-abono-${newPayment.id}`,
        type: 'ingreso',
        amount: newPayment.amount,
        date: newPayment.date,
        category: 'Abono Préstamo a Tercero',
        description: `Abono de ${loan.borrowerName} (${loan.concept})${newPayment.notes ? ` - ${newPayment.notes}` : ''}`,
        paymentMethod: newPayment.paymentMethod,
        relatedLoanId: loan.id,
        createdAt: new Date().toISOString(),
      };
      updatedTransactions = [incomeTx, ...updatedTransactions];
    }

    const updatedData: FinanceData = {
      ...data,
      loans: data.loans.map(l => (l.id === loanId ? updatedLoan : l)),
      transactions: updatedTransactions,
    };
    syncToServer(updatedData);
  };

  const deleteLoanPayment = (loanId: string, paymentId: string) => {
    const loan = data.loans.find(l => l.id === loanId);
    if (!loan) return;

    const updatedPayments = loan.payments.filter(p => p.id !== paymentId);
    const totalPaid = updatedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const isSettled = totalPaid >= loan.initialAmount;

    const updatedLoan: ThirdPartyLoan = {
      ...loan,
      payments: updatedPayments,
      status: isSettled ? 'pagado' : 'al_dia',
      updatedAt: new Date().toISOString(),
    };

    // Also remove associated cash flow transaction if exists
    const updatedTransactions = data.transactions.filter(t => t.id !== `tx-abono-${paymentId}`);

    const updatedData: FinanceData = {
      ...data,
      loans: data.loans.map(l => (l.id === loanId ? updatedLoan : l)),
      transactions: updatedTransactions,
    };
    syncToServer(updatedData);
  };

  // =================== OWN DEBTS OPERATIONS ===================
  const addOwnDebt = (debtData: Omit<OwnDebt, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'effectiveAnnualRate' | 'monthlyRate' | 'nominalAnnualRate' | 'estimatedMonthlyInterest' | 'status'>) => {
    const rates = calculateAllRates(debtData.rateType, debtData.enteredRate, debtData.currentBalance);

    const newDebt: OwnDebt = {
      ...debtData,
      id: `debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      effectiveAnnualRate: rates.effectiveAnnualRate,
      monthlyRate: rates.monthlyRate,
      nominalAnnualRate: rates.nominalAnnualRate,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      payments: [],
      status: 'al_dia',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: FinanceData = {
      ...data,
      debts: [newDebt, ...data.debts],
    };
    syncToServer(updated);
  };

  const updateOwnDebt = (debt: OwnDebt) => {
    const rates = calculateAllRates(debt.rateType, debt.enteredRate, debt.currentBalance);
    const updatedDebt: OwnDebt = {
      ...debt,
      effectiveAnnualRate: rates.effectiveAnnualRate,
      monthlyRate: rates.monthlyRate,
      nominalAnnualRate: rates.nominalAnnualRate,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      updatedAt: new Date().toISOString(),
    };

    const updated: FinanceData = {
      ...data,
      debts: data.debts.map(d => (d.id === debt.id ? updatedDebt : d)),
    };
    syncToServer(updated);
  };

  const deleteOwnDebt = (id: string) => {
    const updated: FinanceData = {
      ...data,
      debts: data.debts.filter(d => d.id !== id),
    };
    syncToServer(updated);
  };

  const addDebtPayment = (
    debtId: string,
    paymentData: Omit<DebtPayment, 'id' | 'createdAt' | 'debtId'>,
    registerInCashFlow: boolean = true
  ) => {
    const debt = data.debts.find(d => d.id === debtId);
    if (!debt) return;

    const newPayment: DebtPayment = {
      ...paymentData,
      id: `dpay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      debtId,
      createdAt: new Date().toISOString(),
    };

    // Calculate new current balance by reducing principal
    const principalPaid = paymentData.principalAmount || paymentData.amount;
    const newBalance = Math.max(0, debt.currentBalance - principalPaid);
    const rates = calculateAllRates(debt.rateType, debt.enteredRate, newBalance);

    const isLiquidated = newBalance <= 0;
    if (isLiquidated) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    }

    const updatedDebt: OwnDebt = {
      ...debt,
      currentBalance: newBalance,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      status: isLiquidated ? 'liquidado' : debt.status,
      payments: [...(debt.payments || []), newPayment],
      updatedAt: new Date().toISOString(),
    };

    let updatedTransactions = [...data.transactions];
    if (registerInCashFlow) {
      const expenseTx: Transaction = {
        id: `tx-debtpay-${newPayment.id}`,
        type: 'egreso',
        amount: newPayment.amount,
        date: newPayment.date,
        category: 'Pago Cuota Deuda Propia',
        description: `Pago cuota a ${debt.creditor} (${debt.concept})${newPayment.notes ? ` - ${newPayment.notes}` : ''}`,
        paymentMethod: 'Transferencia',
        relatedDebtId: debt.id,
        createdAt: new Date().toISOString(),
      };
      updatedTransactions = [expenseTx, ...updatedTransactions];
    }

    const updatedData: FinanceData = {
      ...data,
      debts: data.debts.map(d => (d.id === debtId ? updatedDebt : d)),
      transactions: updatedTransactions,
    };
    syncToServer(updatedData);
  };

  const deleteDebtPayment = (debtId: string, paymentId: string) => {
    const debt = data.debts.find(d => d.id === debtId);
    if (!debt) return;

    const paymentToRemove = debt.payments.find(p => p.id === paymentId);
    const amountToRestore = paymentToRemove?.principalAmount || paymentToRemove?.amount || 0;
    const restoredBalance = debt.currentBalance + amountToRestore;
    const rates = calculateAllRates(debt.rateType, debt.enteredRate, restoredBalance);

    const updatedDebt: OwnDebt = {
      ...debt,
      currentBalance: restoredBalance,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      status: 'al_dia',
      payments: debt.payments.filter(p => p.id !== paymentId),
      updatedAt: new Date().toISOString(),
    };

    const updatedTransactions = data.transactions.filter(t => t.id !== `tx-debtpay-${paymentId}`);

    const updatedData: FinanceData = {
      ...data,
      debts: data.debts.map(d => (d.id === debtId ? updatedDebt : d)),
      transactions: updatedTransactions,
    };
    syncToServer(updatedData);
  };

  // =================== SETTINGS & RESET ===================
  const resetData = async (mode: 'seed' | 'clean' = 'seed') => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/finance/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (e) {
      console.error('Reset failed:', e);
      if (mode === 'seed') {
        setData(getInitialFinanceData());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrency = (currency: string) => {
    const updated: FinanceData = {
      ...data,
      currency,
    };
    syncToServer(updated);
  };

  const triggerManualSync = async () => {
    await syncToServer(data);
  };

  return (
    <FinanceContext.Provider
      value={{
        data,
        isLoading,
        isSyncing,
        lastSyncTime,
        syncStatus,
        activeAlerts,
        browserNotificationsAllowed,
        requestNotificationPermission,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addLoan,
        updateLoan,
        deleteLoan,
        addLoanPayment,
        deleteLoanPayment,
        addOwnDebt,
        updateOwnDebt,
        deleteOwnDebt,
        addDebtPayment,
        deleteDebtPayment,
        resetData,
        setCurrency,
        triggerManualSync,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance debe usarse dentro de un FinanceProvider');
  }
  return context;
};
