import type { TransactionCategory, TransactionStatus } from '../types';

const CATEGORY: Record<TransactionCategory, string> = {
  tuition: 'Mensualidad',
  enrollment_fee: 'Cuota de inscripción',
  material_sale: 'Material',
  exam_fee: 'Examen',
  private_class: 'Clase privada',
  other_income: 'Otro',
  rent: 'Renta',
  utilities: 'Servicios',
  salary: 'Salario',
  marketing: 'Marketing',
  equipment: 'Equipo',
  other_expense: 'Otro gasto',
};

const STATUS: Record<TransactionStatus, string> = {
  pending: 'Pendiente',
  scheduled: 'Próximo',
  paid: 'Pagado',
  cancelled: 'Cancelada',
};

export function labelTransactionCategory(v: TransactionCategory): string {
  return CATEGORY[v];
}

export function labelTransactionStatus(v: TransactionStatus): string {
  return STATUS[v];
}
