import type {
  EnrollmentFeeMode,
  PaymentMethod,
  TransactionCategory,
  TransactionFrequency,
  TransactionKind,
  TransactionStatus,
} from '../types';

const KIND: Record<TransactionKind, string> = {
  sale: 'Venta',
  expense: 'Gasto',
};

const STATUS: Record<TransactionStatus, string> = {
  scheduled: 'Programada',
  pending: 'Pendiente',
  paid: 'Pagada',
  cancelled: 'Cancelada',
};

const CATEGORY: Record<TransactionCategory, string> = {
  tuition: 'Mensualidad',
  enrollment_fee: 'Matrícula anual',
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
  other: 'Otro',
};

const ENROLLMENT_FEE_MODE: Record<EnrollmentFeeMode, string> = {
  annual_recurring: 'Anual recurrente',
  one_time_on_signup: 'Única al matricular',
  none: 'Sin matrícula anual',
};

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

export function labelEnrollmentFeeMode(v: EnrollmentFeeMode): string {
  return ENROLLMENT_FEE_MODE[v];
}

const SALE_CATEGORIES: TransactionCategory[] = [
  'tuition',
  'enrollment_fee',
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
