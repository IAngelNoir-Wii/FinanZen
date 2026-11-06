export type TransactionType = 'ingreso' | 'egreso';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  paymentMethod: string;
  relatedLoanId?: string; // ID if this was a loan given or an abono received
  relatedDebtId?: string; // ID if this was a payment to an own debt
  isRecurring?: boolean;
  notes?: string;
  createdAt: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes?: string;
  createdAt: string;
}

export type LoanStatus = 'al_dia' | 'proximo' | 'vencido' | 'pagado';

export interface ThirdPartyLoan {
  id: string;
  borrowerName: string; // Nombre del deudor (ej: "Carlos Mendoza")
  borrowerPhone?: string; // Teléfono / WhatsApp para recordatorios
  borrowerEmail?: string;
  concept: string; // Motivo (ej: "Préstamo para arreglo del auto")
  initialAmount: number; // Capital prestado
  monthlyInterestRate: number; // % de interés mensual acordado (0 si no cobra interés)
  startDate: string; // Fecha en que se entregó el dinero
  dueDate: string; // Fecha pactada de pago o siguiente cuota
  notes?: string;
  payments: LoanPayment[]; // Historial de abonos
  status: LoanStatus;
  createdAt: string;
  updatedAt: string;
}

export type RateInputType = 'ea' | 'mv' | 'namv';

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  principalAmount?: number; // Capital amortizado
  interestAmount?: number; // Intereses pagados
  notes?: string;
  createdAt: string;
}

export interface OwnDebt {
  id: string;
  creditor: string; // Entidad o prestamista (ej: "Bancolombia", "Tarjeta Visa Davivienda", "Crédito Libre Inversión")
  concept: string; // Descripción / Tipo de crédito
  originalAmount: number; // Monto inicial adquirido
  currentBalance: number; // Saldo de capital pendiente hoy
  monthlyPayment: number; // Valor de la cuota mensual
  cutoffDay: number; // Día de corte (1-31)
  paymentDay: number; // Día límite de pago en el mes (1-31)
  rateType: RateInputType; // Tipo de tasa introducida: E.A., Mes Vencido o Nominal
  enteredRate: number; // Valor de la tasa ingresada (ej: 24.8%)
  // Tasas calculadas automáticamente
  effectiveAnnualRate: number; // % E.A.
  monthlyRate: number; // % Mes Vencido (i_mv)
  nominalAnnualRate: number; // % Nominal Anual Mes Vencido (NAMV)
  estimatedMonthlyInterest: number; // Interés aproximado que genera al mes sobre el saldo
  status: 'al_dia' | 'proximo' | 'vencido' | 'liquidado';
  payments: DebtPayment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertNotification {
  id: string;
  type: 'prestamo_por_cobrar' | 'deuda_por_pagar';
  entityId: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  daysRemaining: number; // < 0: vencido, 0: hoy, > 0: días faltantes
  urgency: 'critical' | 'warning' | 'normal';
  personName?: string;
  personPhone?: string;
  creditorName?: string;
}

export interface FinanceData {
  version: number;
  lastUpdated: string;
  currency: string;
  transactions: Transaction[];
  loans: ThirdPartyLoan[];
  debts: OwnDebt[];
  incomeCategories: string[];
  expenseCategories: string[];
}
