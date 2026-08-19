import type {
  EnrollmentFeeMode,
  PaymentMethod,
  PayrollRole,
  TransactionCategory,
  TransactionFrequency,
  TransactionKind,
  TransactionStatus,
} from '../types';

const KIND: Record<TransactionKind, string> = {
  sale: 'Venta',
  expense: 'Gasto',
};

// "Anulada" y no "Eliminada"/"Cancelada": la transacción sigue existiendo y se
// puede consultar pidiéndola por id. "Cancelada" se reserva para las
// recurrentes, donde sí es un borrado suave (ver `labelRecurringState`).
const STATUS: Record<TransactionStatus, string> = {
  scheduled: 'Programada',
  pending: 'Pendiente',
  paid: 'Pagada',
  cancelled: 'Anulada',
};

const CATEGORY: Record<TransactionCategory, string> = {
  tuition: 'Mensualidad',
  enrollment_fee: 'Matrícula anual',
  class_fee: 'Cuota de clase',
  material_sale: 'Venta de material',
  exam_fee: 'Examen',
  private_class: 'Clase privada',
  other_income: 'Otro ingreso',
  rent: 'Renta',
  utilities: 'Servicios',
  salary: 'Salario',
  marketing: 'Marketing',
  equipment: 'Equipo',
  other_expense: 'Otro gasto',
};

const FREQUENCY: Record<TransactionFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semester: 'Semestral',
  annual: 'Anual',
  one_time: 'Única',
};

const PAYMENT: Record<PaymentMethod, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  paypal: 'PayPal',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
  ath_movil: 'ATH Móvil',
  // Lo pone el backend cuando un descuento del 100% (p. ej. beca) deja la
  // transacción sin nada que cobrar. El motivo va en el descuento, no aquí.
  waived: 'Sin cobro',
  other: 'Otro',
};

const ENROLLMENT_FEE_MODE: Record<EnrollmentFeeMode, string> = {
  annual_recurring: 'Anual recurrente',
  one_time_on_signup: 'Única al matricular',
  none: 'Sin matrícula anual',
};

const PAYROLL_ROLE: Record<PayrollRole, string> = {
  instructor: 'Instructor',
  other: 'Otros',
};

export function payrollRoleLabels(v: PayrollRole): string {
  return PAYROLL_ROLE[v];
}

export function labelTransactionKind(v: TransactionKind): string {
  return KIND[v];
}

export function labelTransactionStatus(v: TransactionStatus): string {
  return STATUS[v];
}

export function labelTransactionCategory(v: TransactionCategory): string {
  return CATEGORY[v];
}

export function labelTransactionFrequency(v: TransactionFrequency): string {
  return FREQUENCY[v];
}

export function labelPaymentMethod(v: PaymentMethod): string {
  return PAYMENT[v];
}

// ATH Móvil es un servicio de Puerto Rico: sus opciones de pago solo se ofrecen
// cuando la academia está registrada en PR.
export function isPuertoRico(country: string | null | undefined): boolean {
  const c = (country ?? '').trim().toLowerCase();
  return c === 'pr' || c === 'puerto rico';
}

// Métodos de pago manuales disponibles, agregando ATH Móvil solo para PR.
export function paymentMethodsFor(country: string | null | undefined): PaymentMethod[] {
  const base: PaymentMethod[] = [
    'credit_card',
    'debit_card',
    'bank_transfer',
    'paypal',
    'cash',
  ];
  return isPuertoRico(country)
    ? [...base, 'ath_movil', 'other']
    : [...base, 'other'];
}

export function labelEnrollmentFeeMode(v: EnrollmentFeeMode): string {
  return ENROLLMENT_FEE_MODE[v];
}

const SALE_CATEGORIES: TransactionCategory[] = [
  'tuition',
  'enrollment_fee',
  'class_fee',
  'material_sale',
  'exam_fee',
  'private_class',
  'other_income',
];

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'rent',
  'utilities',
  'salary',
  'marketing',
  'equipment',
  'other_expense',
];

export function categoriesForKind(
  kind: TransactionKind,
): TransactionCategory[] {
  return kind === 'sale' ? SALE_CATEGORIES : EXPENSE_CATEGORIES;
}

export const REFERENCE_PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'credit_card',
  'debit_card',
  'paypal',
];

export function requiresPaymentReference(m: PaymentMethod | null): boolean {
  return m !== null && REFERENCE_PAYMENT_METHODS.includes(m);
}

/**
 * Estado de una recurrente para pintar en la tabla. Son tres, no dos:
 * `is_active` solo dice si alguien la canceló a mano, **no** si sigue generando
 * cargos. Una con `end_date` pasada sigue llegando con `is_active: true`, y el
 * backend no distingue ese caso: lo hace el front comparando la fecha.
 */
export function labelRecurringState(r: {
  is_active: boolean;
  end_date?: string | null;
}): { label: string; className: string } {
  if (!r.is_active) return { label: 'Cancelado', className: 'badge--cancelled' };
  const today = new Date().toISOString().slice(0, 10);
  if (r.end_date && r.end_date < today)
    return { label: 'Terminado', className: 'badge--completed' };
  return { label: 'Activo', className: 'badge--active' };
}
