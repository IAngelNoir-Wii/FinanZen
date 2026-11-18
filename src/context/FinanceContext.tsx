import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
  Timestamp,
  getDocs,
  DocumentReference,
  WriteBatch,
} from 'firebase/firestore';
import {
  FinanceData,
  Transaction,
  ThirdPartyLoan,
  LoanPayment,
  OwnDebt,
  DebtPayment,
  AlertNotification,
} from '../types/finance';
import {
  getInitialFinanceData,
  defaultIncomeCategories,
  defaultExpenseCategories,
} from '../utils/defaultData';
import { calculateAllRates, generateAlertNotifications } from '../utils/financialCalculations';
import {
  auth,
  db,
  loginWithGoogle,
  logoutFirebase,
  handleFirestoreError,
  OperationType,
  stripUndefined,
  generateSafeId,
  normalizeDateStr,
  truncateStr,
} from '../lib/firebase';
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

  // Firebase Auth state & actions
  user: User | null;
  isAuthReady: boolean;
  authError: string | null;
  localModeBypassed: boolean;
  setLocalModeBypassed: (bypass: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  hasCloudProfile: boolean | null;
  migrateLocalDataToFirebase: () => Promise<void>;

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;

  // Third Party Loans
  addLoan: (loan: Omit<ThirdPartyLoan, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'status'>) => void;
  updateLoan: (loan: ThirdPartyLoan) => void;
  deleteLoan: (id: string) => void;
  addLoanPayment: (
    loanId: string,
    payment: Omit<LoanPayment, 'id' | 'createdAt' | 'loanId'>,
    registerInCashFlow?: boolean
  ) => void;
  deleteLoanPayment: (loanId: string, paymentId: string) => void;

  // Own Debts
  addOwnDebt: (
    debt: Omit<
      OwnDebt,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'payments'
      | 'effectiveAnnualRate'
      | 'monthlyRate'
      | 'nominalAnnualRate'
      | 'estimatedMonthlyInterest'
      | 'status'
    >
  ) => void;
  updateOwnDebt: (debt: OwnDebt) => void;
  deleteOwnDebt: (id: string) => void;
  addDebtPayment: (
    debtId: string,
    payment: Omit<DebtPayment, 'id' | 'createdAt' | 'debtId'>,
    registerInCashFlow?: boolean
  ) => void;
  deleteDebtPayment: (debtId: string, paymentId: string) => void;

  // Settings & Reset
  resetData: (mode?: 'seed' | 'clean') => Promise<void>;
  setCurrency: (currency: string) => void;
  triggerManualSync: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (jsonString: string) => Promise<ImportBackupResult>;
}

export interface ImportBackupResult {
  success: boolean;
  message: string;
  counts?: {
    transactions: number;
    loans: number;
    debts: number;
  };
}

const LOCAL_STORAGE_KEY = 'finanzen_local_cache_v1';

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local fallback data (used only if not logged in / local preview mode)
  const [localData, setLocalData] = useState<FinanceData>(() => {
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

  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [localModeBypassed, setLocalModeBypassed] = useState(false);
  const [hasCloudProfile, setHasCloudProfile] = useState<boolean | null>(null);

  // Cloud Firestore state slices
  const [cloudProfile, setCloudProfile] = useState<{
    currency: string;
    incomeCategories: string[];
    expenseCategories: string[];
    updatedAt: string;
  } | null>(null);
  const [cloudTransactions, setCloudTransactions] = useState<Transaction[]>([]);
  const [cloudLoans, setCloudLoans] = useState<Omit<ThirdPartyLoan, 'payments'>[]>([]);
  const [cloudLoanPayments, setCloudLoanPayments] = useState<LoanPayment[]>([]);
  const [cloudDebts, setCloudDebts] = useState<Omit<OwnDebt, 'payments'>[]>([]);
  const [cloudDebtPayments, setCloudDebtPayments] = useState<DebtPayment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('syncing');
  const [browserNotificationsAllowed, setBrowserNotificationsAllowed] = useState(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (!firebaseUser) {
        setHasCloudProfile(null);
        setCloudProfile(null);
        setCloudTransactions([]);
        setCloudLoans([]);
        setCloudLoanPayments([]);
        setCloudDebts([]);
        setCloudDebtPayments([]);
        setIsLoading(false);
        setSyncStatus('offline');
      } else {
        setLocalModeBypassed(false);
      }
    });

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotificationsAllowed(Notification.permission === 'granted');
    }

    return () => unsubscribe();
  }, []);

  // Ensure user root document exists when signed in
  const ensureUserProfile = useCallback(async (uid: string, initialCurrency = 'COP') => {
    const userRef = doc(db, 'users', uid);
    try {
      await setDoc(
        userRef,
        {
          ownerId: uid,
          currency: initialCurrency,
          incomeCategories: defaultIncomeCategories.slice(0, 50),
          expenseCategories: defaultExpenseCategories.slice(0, 50),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  }, []);

  // Attach Firestore real-time onSnapshot listeners ONLY when authenticated
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const uid = user.uid;
    setIsLoading(true);
    setSyncStatus('syncing');

    const userDocPath = `users/${uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      async (snapshot) => {
        if (snapshot.exists()) {
          const d = snapshot.data();
          setHasCloudProfile(true);
          setCloudProfile({
            currency: d.currency || 'COP',
            incomeCategories: Array.isArray(d.incomeCategories)
              ? d.incomeCategories
              : defaultIncomeCategories,
            expenseCategories: Array.isArray(d.expenseCategories)
              ? d.expenseCategories
              : defaultExpenseCategories,
            updatedAt: timestampToIso(d.updatedAt),
          });
          setLastSyncTime(new Date());
          setSyncStatus('online');
          setIsLoading(false);
        } else {
          setHasCloudProfile(false);
          // Automatically initialize user root doc so subcollections can be written immediately
          await ensureUserProfile(uid, localData.currency || 'COP');
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userDocPath);
      }
    );

    const txPath = `users/${uid}/transactions`;
    const unsubTx = onSnapshot(
      query(collection(db, 'users', uid, 'transactions'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: Transaction[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            type: d.type,
            amount: Number(d.amount) || 0,
            date: d.date,
            category: d.category,
            description: d.description,
            paymentMethod: d.paymentMethod,
            relatedLoanId: d.relatedLoanId,
            relatedDebtId: d.relatedDebtId,
            isRecurring: d.isRecurring,
            notes: d.notes,
            createdAt: timestampToIso(d.createdAt),
          };
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setCloudTransactions(list);
        setLastSyncTime(new Date());
        setSyncStatus('online');
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, txPath);
      }
    );

    const loansPath = `users/${uid}/loans`;
    const unsubLoans = onSnapshot(
      query(collection(db, 'users', uid, 'loans'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: Omit<ThirdPartyLoan, 'payments'>[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            borrowerName: d.borrowerName,
            borrowerPhone: d.borrowerPhone,
            borrowerEmail: d.borrowerEmail,
            concept: d.concept,
            initialAmount: Number(d.initialAmount) || 0,
            monthlyInterestRate: Number(d.monthlyInterestRate) || 0,
            startDate: d.startDate,
            dueDate: d.dueDate,
            notes: d.notes,
            status: d.status,
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudLoans(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, loansPath);
      }
    );

    const loanPayPath = `users/${uid}/loanPayments`;
    const unsubLoanPayments = onSnapshot(
      query(collection(db, 'users', uid, 'loanPayments'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: LoanPayment[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            loanId: d.loanId,
            amount: Number(d.amount) || 0,
            date: d.date,
            paymentMethod: d.paymentMethod,
            notes: d.notes,
            createdAt: timestampToIso(d.createdAt),
          };
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setCloudLoanPayments(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, loanPayPath);
      }
    );

    const debtsPath = `users/${uid}/debts`;
    const unsubDebts = onSnapshot(
      query(collection(db, 'users', uid, 'debts'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: Omit<OwnDebt, 'payments'>[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            creditor: d.creditor,
            concept: d.concept,
            originalAmount: Number(d.originalAmount) || 0,
            currentBalance: Number(d.currentBalance) || 0,
            monthlyPayment: Number(d.monthlyPayment) || 0,
            cutoffDay: Number(d.cutoffDay) || 15,
            paymentDay: Number(d.paymentDay) || 5,
            rateType: d.rateType,
            enteredRate: Number(d.enteredRate) || 0,
            effectiveAnnualRate: Number(d.effectiveAnnualRate) || 0,
            monthlyRate: Number(d.monthlyRate) || 0,
            nominalAnnualRate: Number(d.nominalAnnualRate) || 0,
            estimatedMonthlyInterest: Number(d.estimatedMonthlyInterest) || 0,
            status: d.status,
            notes: d.notes,
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          };
        });
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudDebts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, debtsPath);
      }
    );

    const debtPayPath = `users/${uid}/debtPayments`;
    const unsubDebtPayments = onSnapshot(
      query(collection(db, 'users', uid, 'debtPayments'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: DebtPayment[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            debtId: d.debtId,
            amount: Number(d.amount) || 0,
            date: d.date,
            principalAmount: d.principalAmount !== undefined ? Number(d.principalAmount) : undefined,
            interestAmount: d.interestAmount !== undefined ? Number(d.interestAmount) : undefined,
            notes: d.notes,
            createdAt: timestampToIso(d.createdAt),
          };
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setCloudDebtPayments(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, debtPayPath);
      }
    );

    return () => {
      unsubProfile();
      unsubTx();
      unsubLoans();
      unsubLoanPayments();
      unsubDebts();
      unsubDebtPayments();
    };
  }, [isAuthReady, user, ensureUserProfile, localData.currency]);

  // Combine cloud data or fallback to localData
  const data: FinanceData = useMemo(() => {
    if (user) {
      const loansWithPayments: ThirdPartyLoan[] = cloudLoans.map((loan) => ({
        ...loan,
        payments: cloudLoanPayments.filter((p) => p.loanId === loan.id),
      }));

      const debtsWithPayments: OwnDebt[] = cloudDebts.map((debt) => ({
        ...debt,
        payments: cloudDebtPayments.filter((p) => p.debtId === debt.id),
      }));

      return {
        version: 1,
        lastUpdated: cloudProfile?.updatedAt || new Date().toISOString(),
        currency: cloudProfile?.currency || 'COP',
        incomeCategories: cloudProfile?.incomeCategories || defaultIncomeCategories,
        expenseCategories: cloudProfile?.expenseCategories || defaultExpenseCategories,
        transactions: cloudTransactions,
        loans: loansWithPayments,
        debts: debtsWithPayments,
      };
    }
    return localData;
  }, [
    user,
    localData,
    cloudProfile,
    cloudTransactions,
    cloudLoans,
    cloudLoanPayments,
    cloudDebts,
    cloudDebtPayments,
  ]);

  // Persist localData to localStorage when in local mode
  const saveLocalData = useCallback((newData: FinanceData) => {
    const stamped = {
      ...newData,
      version: (newData.version || 0) + 1,
      lastUpdated: new Date().toISOString(),
    };
    setLocalData(stamped);
    setLastSyncTime(new Date());
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stamped));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, []);

  // Auth Actions
  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/unauthorized-domain')) {
        setAuthError(
          'Este dominio aún no está autorizado en Firebase Auth. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.'
        );
      } else if (msg.includes('auth/popup-closed-by-user')) {
        setAuthError('Cerraste la ventana de inicio de sesión antes de completar el acceso.');
      } else {
        setAuthError(`No se pudo iniciar sesión con Google: ${msg}`);
      }
    }
  };

  const signOutUser = async () => {
    try {
      await logoutFirebase();
      setLocalModeBypassed(false);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Helper to upload a FinanceData snapshot cleanly into Firestore
  const writeSnapshotToFirestore = useCallback(
    async (uid: string, source: FinanceData, clearExistingFirst = false) => {
      setIsSyncing(true);
      const BATCH_LIMIT = 400;

      const commitSetChunks = async (
        ops: Array<{ ref: DocumentReference; data: Record<string, unknown> }>
      ) => {
        for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
          const batch: WriteBatch = writeBatch(db);
          const slice = ops.slice(i, i + BATCH_LIMIT);
          for (const op of slice) {
            batch.set(op.ref, op.data);
          }
          await batch.commit();
        }
      };

      try {
        if (clearExistingFirst) {
          const subCols = ['loanPayments', 'debtPayments', 'transactions', 'loans', 'debts'];
          for (const colName of subCols) {
            const snap = await getDocs(
              query(collection(db, 'users', uid, colName), where('ownerId', '==', uid))
            );
            if (!snap.empty) {
              for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
                const delBatch = writeBatch(db);
                snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => delBatch.delete(d.ref));
                await delBatch.commit();
              }
            }
          }
        }

        // Merge any custom categories used in transactions into category lists
        const txList = Array.isArray(source.transactions) ? source.transactions : [];
        const baseIncomeCats = Array.isArray(source.incomeCategories)
          ? source.incomeCategories
          : defaultIncomeCategories;
        const baseExpenseCats = Array.isArray(source.expenseCategories)
          ? source.expenseCategories
          : defaultExpenseCategories;

        const extraIncomeCats = txList
          .filter((t) => t?.type === 'ingreso' && t?.category)
          .map((t) => truncateStr(t.category, 100));
        const extraExpenseCats = txList
          .filter((t) => t?.type !== 'ingreso' && t?.category)
          .map((t) => truncateStr(t.category, 100));

        const cleanIncomeCategories = Array.from(
          new Set([...baseIncomeCats.map((c) => truncateStr(c, 100)), ...extraIncomeCats].filter(Boolean))
        ).slice(0, 50);
        const cleanExpenseCategories = Array.from(
          new Set([...baseExpenseCats.map((c) => truncateStr(c, 100)), ...extraExpenseCats].filter(Boolean))
        ).slice(0, 50);

        const cleanCurrency = ['COP', 'USD', 'EUR', 'MXN'].includes(source.currency)
          ? source.currency
          : 'COP';

        // 1. Create or update user profile doc without overwriting immutable createdAt/ownerId
        const userRef = doc(db, 'users', uid);
        const existingUserSnap = await getDoc(userRef);
        if (existingUserSnap.exists()) {
          await updateDoc(userRef, {
            currency: cleanCurrency,
            incomeCategories: cleanIncomeCategories,
            expenseCategories: cleanExpenseCategories,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, {
            ownerId: uid,
            currency: cleanCurrency,
            incomeCategories: cleanIncomeCategories,
            expenseCategories: cleanExpenseCategories,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // 2. Write parent loans, debts, and transactions
        const parentOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
        const loanIdMap = new Map<string, string>();
        const debtIdMap = new Map<string, string>();

        for (const loan of source.loans || []) {
          const safeId = generateSafeId('loan');
          if (loan.id) {
            loanIdMap.set(loan.id, safeId);
          }
          const startDate = normalizeDateStr(loan.startDate);
          const dueDate = normalizeDateStr(loan.dueDate || startDate);
          parentOps.push({
            ref: doc(db, 'users', uid, 'loans', safeId),
            data: stripUndefined({
              ownerId: uid,
              borrowerName: truncateStr(loan.borrowerName, 120) || 'Deudor',
              borrowerPhone: loan.borrowerPhone ? truncateStr(loan.borrowerPhone, 30) : undefined,
              borrowerEmail: loan.borrowerEmail ? truncateStr(loan.borrowerEmail, 150) : undefined,
              concept: truncateStr(loan.concept, 300) || 'Préstamo personal',
              initialAmount: Math.max(1, Number(loan.initialAmount) || 1),
              monthlyInterestRate: Math.max(0, Number(loan.monthlyInterestRate) || 0),
              startDate,
              dueDate,
              notes: loan.notes ? truncateStr(loan.notes, 500) : undefined,
              status: ['al_dia', 'proximo', 'vencido', 'pagado'].includes(loan.status)
                ? loan.status
                : 'al_dia',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          });
        }

        for (const debt of source.debts || []) {
          const safeId = generateSafeId('debt');
          if (debt.id) {
            debtIdMap.set(debt.id, safeId);
          }
          const rateType = ['ea', 'mv', 'namv'].includes(debt.rateType) ? debt.rateType : 'ea';
          const enteredRate = Math.max(0, Number(debt.enteredRate) || 0);
          const currentBalance = Math.max(0, Number(debt.currentBalance) || 0);
          const rates = calculateAllRates(rateType, enteredRate, currentBalance);
          parentOps.push({
            ref: doc(db, 'users', uid, 'debts', safeId),
            data: stripUndefined({
              ownerId: uid,
              creditor: truncateStr(debt.creditor, 120) || 'Entidad',
              concept: truncateStr(debt.concept, 300) || 'Crédito',
              originalAmount: Math.max(1, Number(debt.originalAmount) || 1),
              currentBalance,
              monthlyPayment: Math.max(0, Number(debt.monthlyPayment) || 0),
              cutoffDay: Math.min(31, Math.max(1, Number(debt.cutoffDay) || 15)),
              paymentDay: Math.min(31, Math.max(1, Number(debt.paymentDay) || 5)),
              rateType,
              enteredRate,
              effectiveAnnualRate: rates.effectiveAnnualRate,
              monthlyRate: rates.monthlyRate,
              nominalAnnualRate: rates.nominalAnnualRate,
              estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
              status: ['al_dia', 'proximo', 'vencido', 'liquidado'].includes(debt.status)
                ? debt.status
                : 'al_dia',
              notes: debt.notes ? truncateStr(debt.notes, 500) : undefined,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          });
        }

        for (const tx of txList) {
          const safeId = generateSafeId('tx');
          parentOps.push({
            ref: doc(db, 'users', uid, 'transactions', safeId),
            data: stripUndefined({
              ownerId: uid,
              type: tx.type === 'ingreso' ? 'ingreso' : 'egreso',
              amount: Math.max(1, Number(tx.amount) || 1),
              date: normalizeDateStr(tx.date),
              category: truncateStr(tx.category, 100) || 'Varios',
              description: truncateStr(tx.description, 300) || 'Movimiento',
              paymentMethod: truncateStr(tx.paymentMethod, 60) || 'Transferencia',
              relatedLoanId: tx.relatedLoanId ? loanIdMap.get(tx.relatedLoanId) : undefined,
              relatedDebtId: tx.relatedDebtId ? debtIdMap.get(tx.relatedDebtId) : undefined,
              isRecurring: typeof tx.isRecurring === 'boolean' ? tx.isRecurring : undefined,
              notes: tx.notes ? truncateStr(tx.notes, 500) : undefined,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          });
        }

        if (parentOps.length > 0) {
          await commitSetChunks(parentOps);
        }

        // 3. Write child payments referencing the newly created loan/debt IDs
        const childOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

        for (const loan of source.loans || []) {
          const mappedLoanId = loanIdMap.get(loan.id);
          if (!mappedLoanId) continue;
          for (const p of loan.payments || []) {
            childOps.push({
              ref: doc(db, 'users', uid, 'loanPayments', generateSafeId('pay')),
              data: stripUndefined({
                ownerId: uid,
                loanId: mappedLoanId,
                amount: Math.max(1, Number(p.amount) || 1),
                date: normalizeDateStr(p.date),
                paymentMethod: truncateStr(p.paymentMethod, 60) || 'Transferencia',
                notes: p.notes ? truncateStr(p.notes, 500) : undefined,
                createdAt: serverTimestamp(),
              }),
            });
          }
        }

        for (const debt of source.debts || []) {
          const mappedDebtId = debtIdMap.get(debt.id);
          if (!mappedDebtId) continue;
          for (const p of debt.payments || []) {
            childOps.push({
              ref: doc(db, 'users', uid, 'debtPayments', generateSafeId('dpay')),
              data: stripUndefined({
                ownerId: uid,
                debtId: mappedDebtId,
                amount: Math.max(1, Number(p.amount) || 1),
                date: normalizeDateStr(p.date),
                principalAmount:
                  p.principalAmount !== undefined ? Math.max(0, Number(p.principalAmount)) : undefined,
                interestAmount:
                  p.interestAmount !== undefined ? Math.max(0, Number(p.interestAmount)) : undefined,
                notes: p.notes ? truncateStr(p.notes, 500) : undefined,
                createdAt: serverTimestamp(),
              }),
            });
          }
        }

        if (childOps.length > 0) {
          await commitSetChunks(childOps);
        }

        setLastSyncTime(new Date());
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  const migrateLocalDataToFirebase = async () => {
    if (!user) return;
    await writeSnapshotToFirestore(user.uid, localData, false);
  };

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserNotificationsAllowed(perm === 'granted');
        if (perm === 'granted') {
          new Notification('FinanZen Notificaciones Activas', {
            body: '¡Listo! Te avisaremos automáticamente cuando se acerque la fecha de pago de préstamos y deudas.',
          });
        }
      } catch (err) {
        console.error('Permission request error:', err);
      }
    }
  };

  // Derive active notifications / alerts
  const activeAlerts = useMemo(
    () => generateAlertNotifications(data.loans, data.debts),
    [data.loans, data.debts]
  );

  // =================== TRANSACTION OPERATIONS ===================
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (user) {
      const uid = user.uid;
      const txId = generateSafeId('tx');
      const path = `users/${uid}/transactions/${txId}`;
      const cleanCategory = truncateStr(txData.category, 100) || 'Varios';

      setIsSyncing(true);
      try {
        await setDoc(
          doc(db, 'users', uid, 'transactions', txId),
          stripUndefined({
            ownerId: uid,
            type: txData.type,
            amount: Math.max(1, Number(txData.amount) || 1),
            date: normalizeDateStr(txData.date),
            category: cleanCategory,
            description: truncateStr(txData.description, 300) || 'Movimiento',
            paymentMethod: truncateStr(txData.paymentMethod, 60) || 'Transferencia',
            relatedLoanId: txData.relatedLoanId,
            relatedDebtId: txData.relatedDebtId,
            isRecurring: typeof txData.isRecurring === 'boolean' ? txData.isRecurring : undefined,
            notes: txData.notes ? truncateStr(txData.notes, 500) : undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        // Add custom category to user profile if new
        if (txData.type === 'ingreso' && !data.incomeCategories.includes(cleanCategory)) {
          await updateDoc(doc(db, 'users', uid), {
            incomeCategories: [...data.incomeCategories, cleanCategory].slice(0, 50),
            updatedAt: serverTimestamp(),
          });
        } else if (txData.type === 'egreso' && !data.expenseCategories.includes(cleanCategory)) {
          await updateDoc(doc(db, 'users', uid), {
            expenseCategories: [...data.expenseCategories, cleanCategory].slice(0, 50),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const newTx: Transaction = {
      ...txData,
      id: generateSafeId('tx'),
      createdAt: new Date().toISOString(),
    };
    saveLocalData({
      ...localData,
      transactions: [newTx, ...localData.transactions],
    });
  };

  const updateTransaction = async (tx: Transaction) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/transactions/${tx.id}`;
      setIsSyncing(true);
      try {
        await updateDoc(doc(db, 'users', uid, 'transactions', tx.id), {
          type: tx.type,
          amount: Math.max(1, Number(tx.amount) || 1),
          date: normalizeDateStr(tx.date),
          category: truncateStr(tx.category, 100) || 'Varios',
          description: truncateStr(tx.description, 300) || 'Movimiento',
          paymentMethod: truncateStr(tx.paymentMethod, 60) || 'Transferencia',
          isRecurring: typeof tx.isRecurring === 'boolean' ? tx.isRecurring : deleteField(),
          notes: tx.notes ? truncateStr(tx.notes, 500) : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      transactions: localData.transactions.map((t) => (t.id === tx.id ? tx : t)),
    });
  };

  const deleteTransaction = async (id: string) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/transactions/${id}`;
      setIsSyncing(true);
      try {
        await deleteDoc(doc(db, 'users', uid, 'transactions', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      transactions: localData.transactions.filter((t) => t.id !== id),
    });
  };

  // =================== THIRD-PARTY LOAN OPERATIONS ===================
  const addLoan = async (
    loanData: Omit<ThirdPartyLoan, 'id' | 'createdAt' | 'updatedAt' | 'payments' | 'status'>
  ) => {
    if (user) {
      const uid = user.uid;
      const loanId = generateSafeId('loan');
      const txId = generateSafeId('tx-loan');
      const path = `users/${uid}/loans/${loanId}`;

      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        const startDate = normalizeDateStr(loanData.startDate);
        const dueDate = normalizeDateStr(loanData.dueDate || startDate);
        const initialAmount = Math.max(1, Number(loanData.initialAmount) || 1);
        const borrowerName = truncateStr(loanData.borrowerName, 120) || 'Deudor';
        const concept = truncateStr(loanData.concept, 300) || 'Préstamo personal';

        batch.set(
          doc(db, 'users', uid, 'loans', loanId),
          stripUndefined({
            ownerId: uid,
            borrowerName,
            borrowerPhone: loanData.borrowerPhone
              ? truncateStr(loanData.borrowerPhone, 30)
              : undefined,
            borrowerEmail: loanData.borrowerEmail
              ? truncateStr(loanData.borrowerEmail, 150)
              : undefined,
            concept,
            initialAmount,
            monthlyInterestRate: Math.max(0, Number(loanData.monthlyInterestRate) || 0),
            startDate,
            dueDate,
            notes: loanData.notes ? truncateStr(loanData.notes, 500) : undefined,
            status: 'al_dia',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        batch.set(
          doc(db, 'users', uid, 'transactions', txId),
          stripUndefined({
            ownerId: uid,
            type: 'egreso',
            amount: initialAmount,
            date: startDate,
            category: 'Préstamo Entregado a Tercero',
            description: truncateStr(`Préstamo entregado a ${borrowerName} (${concept})`, 300),
            paymentMethod: 'Transferencia',
            relatedLoanId: loanId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const loanId = generateSafeId('loan');
    const newLoan: ThirdPartyLoan = {
      ...loanData,
      id: loanId,
      payments: [],
      status: 'al_dia',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const loanExpenseTx: Transaction = {
      id: `tx-loan-${loanId}`,
      type: 'egreso',
      amount: newLoan.initialAmount,
      date: newLoan.startDate || new Date().toISOString().split('T')[0],
      category: 'Préstamo Entregado a Tercero',
      description: `Préstamo entregado a ${newLoan.borrowerName} (${newLoan.concept})`,
      paymentMethod: 'Transferencia',
      relatedLoanId: loanId,
      createdAt: new Date().toISOString(),
    };
    saveLocalData({
      ...localData,
      loans: [newLoan, ...localData.loans],
      transactions: [loanExpenseTx, ...localData.transactions],
    });
  };

  const updateLoan = async (loan: ThirdPartyLoan) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/loans/${loan.id}`;
      setIsSyncing(true);
      try {
        await updateDoc(doc(db, 'users', uid, 'loans', loan.id), {
          borrowerName: truncateStr(loan.borrowerName, 120) || 'Deudor',
          borrowerPhone: loan.borrowerPhone ? truncateStr(loan.borrowerPhone, 30) : deleteField(),
          borrowerEmail: loan.borrowerEmail ? truncateStr(loan.borrowerEmail, 150) : deleteField(),
          concept: truncateStr(loan.concept, 300) || 'Préstamo personal',
          initialAmount: Math.max(1, Number(loan.initialAmount) || 1),
          monthlyInterestRate: Math.max(0, Number(loan.monthlyInterestRate) || 0),
          startDate: normalizeDateStr(loan.startDate),
          dueDate: normalizeDateStr(loan.dueDate),
          notes: loan.notes ? truncateStr(loan.notes, 500) : deleteField(),
          status: loan.status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      loans: localData.loans.map((l) =>
        l.id === loan.id ? { ...loan, updatedAt: new Date().toISOString() } : l
      ),
    });
  };

  const deleteLoan = async (id: string) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/loans/${id}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'loans', id));
        const relatedPayments = cloudLoanPayments.filter((p) => p.loanId === id);
        for (const p of relatedPayments) {
          batch.delete(doc(db, 'users', uid, 'loanPayments', p.id));
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      loans: localData.loans.filter((l) => l.id !== id),
    });
  };

  const addLoanPayment = async (
    loanId: string,
    paymentData: Omit<LoanPayment, 'id' | 'createdAt' | 'loanId'>,
    registerInCashFlow: boolean = true
  ) => {
    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) return;

    const paymentAmount = Math.max(1, Number(paymentData.amount) || 1);
    const previousPaid = (loan.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalPaid = previousPaid + paymentAmount;
    const isSettled = totalPaid >= loan.initialAmount;

    if (isSettled && loan.initialAmount - previousPaid > 0) {
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

    if (user) {
      const uid = user.uid;
      const paymentId = generateSafeId('pay');
      const path = `users/${uid}/loanPayments/${paymentId}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        const payDate = normalizeDateStr(paymentData.date);
        const payMethod = truncateStr(paymentData.paymentMethod, 60) || 'Transferencia';

        batch.set(
          doc(db, 'users', uid, 'loanPayments', paymentId),
          stripUndefined({
            ownerId: uid,
            loanId,
            amount: paymentAmount,
            date: payDate,
            paymentMethod: payMethod,
            notes: paymentData.notes ? truncateStr(paymentData.notes, 500) : undefined,
            createdAt: serverTimestamp(),
          })
        );

        batch.update(doc(db, 'users', uid, 'loans', loanId), {
          status: isSettled ? 'pagado' : loan.status === 'pagado' ? 'al_dia' : loan.status,
          updatedAt: serverTimestamp(),
        });

        if (registerInCashFlow) {
          const txId = generateSafeId('tx-abono');
          batch.set(
            doc(db, 'users', uid, 'transactions', txId),
            stripUndefined({
              ownerId: uid,
              type: 'ingreso',
              amount: paymentAmount,
              date: payDate,
              category: 'Abono Préstamo a Tercero',
              description: truncateStr(
                `Abono de ${loan.borrowerName} (${loan.concept})${
                  paymentData.notes ? ` - ${paymentData.notes}` : ''
                }`,
                300
              ),
              paymentMethod: payMethod,
              relatedLoanId: loanId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const newPayment: LoanPayment = {
      ...paymentData,
      id: generateSafeId('pay'),
      loanId,
      createdAt: new Date().toISOString(),
    };
    const updatedLoan: ThirdPartyLoan = {
      ...loan,
      payments: [...(loan.payments || []), newPayment],
      status: isSettled ? 'pagado' : loan.status,
      updatedAt: new Date().toISOString(),
    };
    let updatedTransactions = [...localData.transactions];
    if (registerInCashFlow) {
      updatedTransactions = [
        {
          id: `tx-abono-${newPayment.id}`,
          type: 'ingreso',
          amount: newPayment.amount,
          date: newPayment.date,
          category: 'Abono Préstamo a Tercero',
          description: `Abono de ${loan.borrowerName} (${loan.concept})${
            newPayment.notes ? ` - ${newPayment.notes}` : ''
          }`,
          paymentMethod: newPayment.paymentMethod,
          relatedLoanId: loan.id,
          createdAt: new Date().toISOString(),
        },
        ...updatedTransactions,
      ];
    }
    saveLocalData({
      ...localData,
      loans: localData.loans.map((l) => (l.id === loanId ? updatedLoan : l)),
      transactions: updatedTransactions,
    });
  };

  const deleteLoanPayment = async (loanId: string, paymentId: string) => {
    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) return;

    const remainingPayments = loan.payments.filter((p) => p.id !== paymentId);
    const totalPaid = remainingPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const isSettled = totalPaid >= loan.initialAmount;

    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/loanPayments/${paymentId}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'loanPayments', paymentId));
        batch.update(doc(db, 'users', uid, 'loans', loanId), {
          status: isSettled ? 'pagado' : 'al_dia',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      loans: localData.loans.map((l) =>
        l.id === loanId
          ? {
              ...l,
              payments: remainingPayments,
              status: isSettled ? 'pagado' : 'al_dia',
              updatedAt: new Date().toISOString(),
            }
          : l
      ),
      transactions: localData.transactions.filter((t) => t.id !== `tx-abono-${paymentId}`),
    });
  };

  // =================== OWN DEBTS OPERATIONS ===================
  const addOwnDebt = async (
    debtData: Omit<
      OwnDebt,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'payments'
      | 'effectiveAnnualRate'
      | 'monthlyRate'
      | 'nominalAnnualRate'
      | 'estimatedMonthlyInterest'
      | 'status'
    >
  ) => {
    const rates = calculateAllRates(debtData.rateType, debtData.enteredRate, debtData.currentBalance);

    if (user) {
      const uid = user.uid;
      const debtId = generateSafeId('debt');
      const path = `users/${uid}/debts/${debtId}`;
      setIsSyncing(true);
      try {
        await setDoc(
          doc(db, 'users', uid, 'debts', debtId),
          stripUndefined({
            ownerId: uid,
            creditor: truncateStr(debtData.creditor, 120) || 'Entidad',
            concept: truncateStr(debtData.concept, 300) || 'Crédito',
            originalAmount: Math.max(1, Number(debtData.originalAmount) || 1),
            currentBalance: Math.max(0, Number(debtData.currentBalance) || 0),
            monthlyPayment: Math.max(0, Number(debtData.monthlyPayment) || 0),
            cutoffDay: Math.min(31, Math.max(1, Number(debtData.cutoffDay) || 15)),
            paymentDay: Math.min(31, Math.max(1, Number(debtData.paymentDay) || 5)),
            rateType: debtData.rateType,
            enteredRate: Math.max(0, Number(debtData.enteredRate) || 0),
            effectiveAnnualRate: rates.effectiveAnnualRate,
            monthlyRate: rates.monthlyRate,
            nominalAnnualRate: rates.nominalAnnualRate,
            estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
            status: 'al_dia',
            notes: debtData.notes ? truncateStr(debtData.notes, 500) : undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const newDebt: OwnDebt = {
      ...debtData,
      id: generateSafeId('debt'),
      effectiveAnnualRate: rates.effectiveAnnualRate,
      monthlyRate: rates.monthlyRate,
      nominalAnnualRate: rates.nominalAnnualRate,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      payments: [],
      status: 'al_dia',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveLocalData({
      ...localData,
      debts: [newDebt, ...localData.debts],
    });
  };

  const updateOwnDebt = async (debt: OwnDebt) => {
    const rates = calculateAllRates(debt.rateType, debt.enteredRate, debt.currentBalance);

    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/debts/${debt.id}`;
      setIsSyncing(true);
      try {
        await updateDoc(doc(db, 'users', uid, 'debts', debt.id), {
          creditor: truncateStr(debt.creditor, 120) || 'Entidad',
          concept: truncateStr(debt.concept, 300) || 'Crédito',
          originalAmount: Math.max(1, Number(debt.originalAmount) || 1),
          currentBalance: Math.max(0, Number(debt.currentBalance) || 0),
          monthlyPayment: Math.max(0, Number(debt.monthlyPayment) || 0),
          cutoffDay: Math.min(31, Math.max(1, Number(debt.cutoffDay) || 15)),
          paymentDay: Math.min(31, Math.max(1, Number(debt.paymentDay) || 5)),
          rateType: debt.rateType,
          enteredRate: Math.max(0, Number(debt.enteredRate) || 0),
          effectiveAnnualRate: rates.effectiveAnnualRate,
          monthlyRate: rates.monthlyRate,
          nominalAnnualRate: rates.nominalAnnualRate,
          estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
          status: debt.currentBalance <= 0 ? 'liquidado' : debt.status,
          notes: debt.notes ? truncateStr(debt.notes, 500) : deleteField(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const updatedDebt: OwnDebt = {
      ...debt,
      effectiveAnnualRate: rates.effectiveAnnualRate,
      monthlyRate: rates.monthlyRate,
      nominalAnnualRate: rates.nominalAnnualRate,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      updatedAt: new Date().toISOString(),
    };
    saveLocalData({
      ...localData,
      debts: localData.debts.map((d) => (d.id === debt.id ? updatedDebt : d)),
    });
  };

  const deleteOwnDebt = async (id: string) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/debts/${id}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'debts', id));
        const relatedPayments = cloudDebtPayments.filter((p) => p.debtId === id);
        for (const p of relatedPayments) {
          batch.delete(doc(db, 'users', uid, 'debtPayments', p.id));
        }
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      debts: localData.debts.filter((d) => d.id !== id),
    });
  };

  const addDebtPayment = async (
    debtId: string,
    paymentData: Omit<DebtPayment, 'id' | 'createdAt' | 'debtId'>,
    registerInCashFlow: boolean = true
  ) => {
    const debt = data.debts.find((d) => d.id === debtId);
    if (!debt) return;

    const paymentAmount = Math.max(1, Number(paymentData.amount) || 1);
    const principalPaid =
      paymentData.principalAmount !== undefined
        ? Math.max(0, Number(paymentData.principalAmount))
        : paymentAmount;
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

    if (user) {
      const uid = user.uid;
      const paymentId = generateSafeId('dpay');
      const path = `users/${uid}/debtPayments/${paymentId}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        const payDate = normalizeDateStr(paymentData.date);

        batch.set(
          doc(db, 'users', uid, 'debtPayments', paymentId),
          stripUndefined({
            ownerId: uid,
            debtId,
            amount: paymentAmount,
            date: payDate,
            principalAmount: principalPaid,
            interestAmount:
              paymentData.interestAmount !== undefined
                ? Math.max(0, Number(paymentData.interestAmount))
                : undefined,
            notes: paymentData.notes ? truncateStr(paymentData.notes, 500) : undefined,
            createdAt: serverTimestamp(),
          })
        );

        batch.update(doc(db, 'users', uid, 'debts', debtId), {
          currentBalance: newBalance,
          estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
          status: isLiquidated ? 'liquidado' : debt.status === 'liquidado' ? 'al_dia' : debt.status,
          updatedAt: serverTimestamp(),
        });

        if (registerInCashFlow) {
          const txId = generateSafeId('tx-debtpay');
          batch.set(
            doc(db, 'users', uid, 'transactions', txId),
            stripUndefined({
              ownerId: uid,
              type: 'egreso',
              amount: paymentAmount,
              date: payDate,
              category: 'Pago Cuota Deuda Propia',
              description: truncateStr(
                `Pago cuota a ${debt.creditor} (${debt.concept})${
                  paymentData.notes ? ` - ${paymentData.notes}` : ''
                }`,
                300
              ),
              paymentMethod: 'Transferencia',
              relatedDebtId: debtId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    const newPayment: DebtPayment = {
      ...paymentData,
      id: generateSafeId('dpay'),
      debtId,
      createdAt: new Date().toISOString(),
    };
    const updatedDebt: OwnDebt = {
      ...debt,
      currentBalance: newBalance,
      estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
      status: isLiquidated ? 'liquidado' : debt.status,
      payments: [...(debt.payments || []), newPayment],
      updatedAt: new Date().toISOString(),
    };
    let updatedTransactions = [...localData.transactions];
    if (registerInCashFlow) {
      updatedTransactions = [
        {
          id: `tx-debtpay-${newPayment.id}`,
          type: 'egreso',
          amount: newPayment.amount,
          date: newPayment.date,
          category: 'Pago Cuota Deuda Propia',
          description: `Pago cuota a ${debt.creditor} (${debt.concept})${
            newPayment.notes ? ` - ${newPayment.notes}` : ''
          }`,
          paymentMethod: 'Transferencia',
          relatedDebtId: debt.id,
          createdAt: new Date().toISOString(),
        },
        ...updatedTransactions,
      ];
    }
    saveLocalData({
      ...localData,
      debts: localData.debts.map((d) => (d.id === debtId ? updatedDebt : d)),
      transactions: updatedTransactions,
    });
  };

  const deleteDebtPayment = async (debtId: string, paymentId: string) => {
    const debt = data.debts.find((d) => d.id === debtId);
    if (!debt) return;

    const paymentToRemove = debt.payments.find((p) => p.id === paymentId);
    const amountToRestore = paymentToRemove?.principalAmount ?? paymentToRemove?.amount ?? 0;
    const restoredBalance = debt.currentBalance + amountToRestore;
    const rates = calculateAllRates(debt.rateType, debt.enteredRate, restoredBalance);

    if (user) {
      const uid = user.uid;
      const path = `users/${uid}/debtPayments/${paymentId}`;
      setIsSyncing(true);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'users', uid, 'debtPayments', paymentId));
        batch.update(doc(db, 'users', uid, 'debts', debtId), {
          currentBalance: restoredBalance,
          estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
          status: 'al_dia',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      debts: localData.debts.map((d) =>
        d.id === debtId
          ? {
              ...d,
              currentBalance: restoredBalance,
              estimatedMonthlyInterest: rates.estimatedMonthlyInterest,
              status: 'al_dia',
              payments: d.payments.filter((p) => p.id !== paymentId),
              updatedAt: new Date().toISOString(),
            }
          : d
      ),
      transactions: localData.transactions.filter((t) => t.id !== `tx-debtpay-${paymentId}`),
    });
  };

  // =================== SETTINGS & RESET ===================
  const resetData = async (mode: 'seed' | 'clean' = 'seed') => {
    const targetData: FinanceData =
      mode === 'clean'
        ? {
            ...getInitialFinanceData(),
            transactions: [],
            loans: [],
            debts: [],
          }
        : getInitialFinanceData();

    if (user) {
      await writeSnapshotToFirestore(user.uid, targetData, true);
      return;
    }

    saveLocalData(targetData);
  };

  const setCurrency = async (currency: string) => {
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}`;
      setIsSyncing(true);
      try {
        await updateDoc(doc(db, 'users', uid), {
          currency,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    saveLocalData({
      ...localData,
      currency,
    });
  };

  const triggerManualSync = async () => {
    setLastSyncTime(new Date());
  };

  const exportBackup = () => {
    try {
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `finanzen_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Error al exportar copia de seguridad:', err);
    }
  };

  const importBackup = async (jsonString: string): Promise<ImportBackupResult> => {
    try {
      const cleanedJson = jsonString.replace(/^\uFEFF/, '').trim();
      const rawParsed = JSON.parse(cleanedJson);
      const parsed =
        rawParsed && typeof rawParsed === 'object' && rawParsed.data && !rawParsed.transactions
          ? rawParsed.data
          : rawParsed;

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.transactions) ||
        !Array.isArray(parsed.loans) ||
        !Array.isArray(parsed.debts)
      ) {
        return {
          success: false,
          message:
            'El archivo JSON no tiene el formato esperado de FinanZen (debe incluir transactions, loans y debts).',
        };
      }

      const txList: Transaction[] = parsed.transactions;
      const loanList: ThirdPartyLoan[] = parsed.loans;
      const debtList: OwnDebt[] = parsed.debts;

      const baseIncomeCats: string[] = Array.isArray(parsed.incomeCategories)
        ? parsed.incomeCategories
        : defaultIncomeCategories;
      const baseExpenseCats: string[] = Array.isArray(parsed.expenseCategories)
        ? parsed.expenseCategories
        : defaultExpenseCategories;

      const mergedIncomeCats = Array.from(
        new Set(
          [
            ...baseIncomeCats.map((c) => truncateStr(c, 100)),
            ...txList.filter((t) => t?.type === 'ingreso').map((t) => truncateStr(t.category, 100)),
          ].filter(Boolean)
        )
      ).slice(0, 50);

      const mergedExpenseCats = Array.from(
        new Set(
          [
            ...baseExpenseCats.map((c) => truncateStr(c, 100)),
            ...txList.filter((t) => t?.type !== 'ingreso').map((t) => truncateStr(t.category, 100)),
          ].filter(Boolean)
        )
      ).slice(0, 50);

      const normalizedSnapshot: FinanceData = {
        version: Number(parsed.version) || 1,
        lastUpdated:
          typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : new Date().toISOString(),
        currency: ['COP', 'USD', 'EUR', 'MXN'].includes(parsed.currency) ? parsed.currency : 'COP',
        incomeCategories: mergedIncomeCats.length > 0 ? mergedIncomeCats : defaultIncomeCategories,
        expenseCategories:
          mergedExpenseCats.length > 0 ? mergedExpenseCats : defaultExpenseCategories,
        transactions: txList,
        loans: loanList,
        debts: debtList,
      };

      if (user) {
        await writeSnapshotToFirestore(user.uid, normalizedSnapshot, true);
      } else {
        saveLocalData(normalizedSnapshot);
      }

      const counts = {
        transactions: txList.length,
        loans: loanList.length,
        debts: debtList.length,
      };

      return {
        success: true,
        message: `¡Copia de seguridad restaurada! Se importaron ${counts.transactions} movimientos, ${counts.loans} préstamos y ${counts.debts} deudas.`,
        counts,
      };
    } catch (err) {
      console.error('Error al importar copia de seguridad:', err);
      const rawMessage = err instanceof Error ? err.message : String(err);
      let friendlyMessage =
        'No se pudo importar el archivo JSON. Verifica que sea una copia válida de FinanZen.';

      if (err instanceof SyntaxError) {
        friendlyMessage = 'El archivo no es un JSON válido (error de sintaxis al leer el archivo).';
      } else if (rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('permission')) {
        friendlyMessage =
          'No se pudieron guardar los datos en Firebase por permisos. Verifica que hayas iniciado sesión con tu cuenta de Google verificada.';
      } else if (rawMessage.includes('Quota exceeded')) {
        friendlyMessage = 'Se alcanzó el límite diario gratuito de Firebase Firestore. Intenta mañana.';
      }

      return {
        success: false,
        message: friendlyMessage,
      };
    }
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
        user,
        isAuthReady,
        authError,
        localModeBypassed,
        setLocalModeBypassed,
        signInWithGoogle,
        signOutUser,
        hasCloudProfile,
        migrateLocalDataToFirebase,
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
        exportBackup,
        importBackup,
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
