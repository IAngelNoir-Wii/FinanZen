import { RateInputType, ThirdPartyLoan, OwnDebt, AlertNotification } from '../types/finance';

/**
 * Convierte cualquier tipo de tasa a sus equivalentes financieros (E.A., Mes Vencido y Nominal Anual).
 * Fórmulas financieras estándar utilizadas en el sistema bancario colombiano e internacional:
 * - De E.A. a Mensual: i_mv = (1 + EA)^(1/12) - 1
 * - De Mensual a E.A.: EA = (1 + i_mv)^12 - 1
 * - De Nominal Anual (NAMV) a Mensual: i_mv = NAMV / 12
 */
export function calculateAllRates(
  rateType: RateInputType,
  enteredRate: number,
  currentBalance: number = 0
) {
  const rateVal = Math.max(0, enteredRate);
  let effectiveAnnualRate = 0;
  let monthlyRate = 0;
  let nominalAnnualRate = 0;

  if (rateType === 'ea') {
    effectiveAnnualRate = rateVal;
    // (1 + EA)^(1/12) - 1
    const factor = Math.pow(1 + rateVal / 100, 1 / 12) - 1;
    monthlyRate = factor * 100;
    nominalAnnualRate = monthlyRate * 12;
  } else if (rateType === 'mv') {
    monthlyRate = rateVal;
    // (1 + i_mv)^12 - 1
    const factor = Math.pow(1 + rateVal / 100, 12) - 1;
    effectiveAnnualRate = factor * 100;
    nominalAnnualRate = monthlyRate * 12;
  } else if (rateType === 'namv') {
    nominalAnnualRate = rateVal;
    monthlyRate = rateVal / 12;
    const factor = Math.pow(1 + monthlyRate / 100, 12) - 1;
    effectiveAnnualRate = factor * 100;
  }

  // Interés mensual estimado = Saldo actual * Tasa Mensual Vencida
  const estimatedMonthlyInterest = currentBalance > 0 ? (currentBalance * (monthlyRate / 100)) : 0;

  return {
    effectiveAnnualRate: Number(effectiveAnnualRate.toFixed(2)),
    monthlyRate: Number(monthlyRate.toFixed(4)),
    nominalAnnualRate: Number(nominalAnnualRate.toFixed(2)),
    estimatedMonthlyInterest: Math.round(estimatedMonthlyInterest),
  };
}

/**
 * Calcula el resumen de abonos y saldo para un préstamo a terceros
 */
export function calculateLoanSummary(loan: ThirdPartyLoan) {
  const totalPaid = (loan.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const remainingBalance = Math.max(0, loan.initialAmount - totalPaid);
  const progressPercentage = loan.initialAmount > 0 
    ? Math.min(100, Math.round((totalPaid / loan.initialAmount) * 100))
    : 100;
  const isSettled = remainingBalance <= 0;

  return {
    totalPaid,
    remainingBalance,
    progressPercentage,
    isSettled,
  };
}

/**
 * Formato de moneda con configuración en español (por defecto Pesos Colombianos COP o USD)
 */
export function formatCurrency(amount: number, currency: string = 'COP'): string {
  const num = isNaN(amount) ? 0 : amount;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'COP' ? 'COP' : currency,
      maximumFractionDigits: currency === 'COP' ? 0 : 2,
      minimumFractionDigits: currency === 'COP' ? 0 : 2,
    }).format(num);
  } catch {
    return `$ ${num.toLocaleString('es-CO')}`;
  }
}

/**
 * Formato de fecha legible en español (ej: "15 de mayo de 2026")
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return new Date(dateString).toLocaleDateString('es-CO');
  } catch {
    return dateString;
  }
}

/**
 * Calcula los días faltantes o vencidos respecto a la fecha actual
 */
export function getDaysDifference(dueDateString: string): number {
  if (!dueDateString) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dueDateString.split('-');
  if (parts.length !== 3) return 0;
  const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Genera alertas y notificaciones automáticas para préstamos y deudas
 */
export function generateAlertNotifications(
  loans: ThirdPartyLoan[],
  debts: OwnDebt[]
): AlertNotification[] {
  const alerts: AlertNotification[] = [];

  // 1. Alertas de préstamos por cobrar a terceros
  for (const loan of loans) {
    const { remainingBalance, isSettled } = calculateLoanSummary(loan);
    if (isSettled) continue;

    const daysRemaining = getDaysDifference(loan.dueDate);

    // Alertar si está vencido o vence en los próximos 7 días
    if (daysRemaining <= 7) {
      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      let title = '';
      let description = '';

      if (daysRemaining < 0) {
        urgency = 'critical';
        title = `Pago vencido de ${loan.borrowerName}`;
        description = `Tenía fecha límite el ${formatDate(loan.dueDate)} (${Math.abs(daysRemaining)} día(s) de mora). Saldo pendiente: ${formatCurrency(remainingBalance)}`;
      } else if (daysRemaining === 0) {
        urgency = 'critical';
        title = `¡Cobro vence HOY! - ${loan.borrowerName}`;
        description = `Hoy es la fecha programada de cobro de ${loan.borrowerName}. Saldo pendiente: ${formatCurrency(remainingBalance)}`;
      } else if (daysRemaining <= 3) {
        urgency = 'warning';
        title = `Cobro próximo (${daysRemaining}d) - ${loan.borrowerName}`;
        description = `El pago programado vence en ${daysRemaining} días (${formatDate(loan.dueDate)}). Saldo: ${formatCurrency(remainingBalance)}`;
      } else {
        urgency = 'normal';
        title = `Próximo cobro - ${loan.borrowerName}`;
        description = `Vence en ${daysRemaining} días (${formatDate(loan.dueDate)}). Saldo: ${formatCurrency(remainingBalance)}`;
      }

      alerts.push({
        id: `loan-${loan.id}-${daysRemaining}`,
        type: 'prestamo_por_cobrar',
        entityId: loan.id,
        title,
        description,
        amount: remainingBalance,
        dueDate: loan.dueDate,
        daysRemaining,
        urgency,
        personName: loan.borrowerName,
        personPhone: loan.borrowerPhone,
      });
    }
  }

  // 2. Alertas de deudas propias que vencen
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  for (const debt of debts) {
    if (debt.currentBalance <= 0) continue;

    // Calcular la fecha límite de pago para este mes
    const paymentDay = Math.min(debt.paymentDay || 15, 28);
    let targetMonth = currentMonth;
    let targetYear = currentYear;

    // Si ya pasó el día de pago de este mes, mirar el siguiente mes
    if (currentDay > paymentDay) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }

    const dueDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(paymentDay).padStart(2, '0')}`;
    const daysRemaining = getDaysDifference(dueDateStr);

    if (daysRemaining <= 7) {
      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      let title = '';
      let description = '';

      if (daysRemaining === 0) {
        urgency = 'critical';
        title = `¡Hoy vence cuota de ${debt.creditor}!`;
        description = `Cuota estimada de ${formatCurrency(debt.monthlyPayment || debt.currentBalance)}. Saldo total: ${formatCurrency(debt.currentBalance)}`;
      } else if (daysRemaining <= 3) {
        urgency = 'warning';
        title = `Cuota por vencer (${daysRemaining}d) - ${debt.creditor}`;
        description = `Vence el ${formatDate(dueDateStr)}. Cuota de ${formatCurrency(debt.monthlyPayment)} (E.A.: ${debt.effectiveAnnualRate}%)`;
      } else {
        urgency = 'normal';
        title = `Próximo vencimiento de deuda - ${debt.creditor}`;
        description = `Vence en ${daysRemaining} días. Cuota estimada: ${formatCurrency(debt.monthlyPayment)}`;
      }

      alerts.push({
        id: `debt-${debt.id}-${daysRemaining}`,
        type: 'deuda_por_pagar',
        entityId: debt.id,
        title,
        description,
        amount: debt.monthlyPayment || debt.currentBalance,
        dueDate: dueDateStr,
        daysRemaining,
        urgency,
        creditorName: debt.creditor,
      });
    }
  }

  // Ordenar alertas por urgencia: días negativos (vencidos) primero, luego 0 (hoy), luego días ascendentes
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Genera el enlace de WhatsApp con mensaje predeterminado para recordarle a un deudor de forma cortés
 */
export function generateWhatsAppReminderUrl(loan: ThirdPartyLoan): string {
  if (!loan.borrowerPhone) return '';
  const { remainingBalance } = calculateLoanSummary(loan);
  const days = getDaysDifference(loan.dueDate);

  let message = `Hola ${loan.borrowerName}, espero te encuentres muy bien. `;
  if (days < 0) {
    message += `Te escribo para recordarte amablemente que el compromiso de pago acordado por valor de ${formatCurrency(remainingBalance)} tenía fecha límite el ${formatDate(loan.dueDate)}. ¿Cómo podríamos coordinar el pago? Quedo atento/a, muchas gracias.`;
  } else if (days === 0) {
    message += `Te escribo para recordarte que hoy ${formatDate(loan.dueDate)} es la fecha programada para el pago acordado por valor de ${formatCurrency(remainingBalance)}. Me confirmas por favor una vez realices el abono. ¡Muchas gracias!`;
  } else {
    message += `Te escribo para saludarte y recordarte con tiempo que la fecha programada para el pago de tu saldo de ${formatCurrency(remainingBalance)} es el próximo ${formatDate(loan.dueDate)}. Quedo atento/a a cualquier duda. ¡Feliz día!`;
  }

  const cleanPhone = loan.borrowerPhone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera tabla de simulación de amortización (Método Francés - Cuota fija)
 */
export function simulateAmortizationSchedule(
  balance: number,
  monthlyRatePercent: number,
  months: number
) {
  if (balance <= 0 || months <= 0) return [];
  const i = monthlyRatePercent / 100;
  let quota = 0;

  if (i > 0) {
    quota = (balance * i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
  } else {
    quota = balance / months;
  }

  let currentBal = balance;
  const schedule = [];

  for (let m = 1; m <= months; m++) {
    const interest = i > 0 ? currentBal * i : 0;
    const principal = quota - interest;
    currentBal = Math.max(0, currentBal - principal);

    schedule.push({
      period: m,
      quota: Math.round(quota),
      interest: Math.round(interest),
      principal: Math.round(principal),
      remainingBalance: Math.round(currentBal),
    });

    if (currentBal <= 0) break;
  }

  return schedule;
}
