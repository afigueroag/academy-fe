import type { TransactionKind, TransactionRead } from '../types';
import { TransactionStatusBadge } from './Badges';
import { formatMoney, grossFromNet } from '../utils/money';
import {
  labelPaymentMethod,
  labelTransactionCategory,
} from '../utils/salesLabels';

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string | null | React.ReactNode;
}) {
  const isEmpty =
    value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span
        className={
          'detail-item__value' + (isEmpty ? ' detail-item__value--empty' : '')
        }
      >
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

interface Props {
  transaction: TransactionRead;
  currency: string | null;
  kind?: TransactionKind;
}

export default function TransactionDetails({
  transaction,
  currency,
  kind = 'sale',
}: Props) {
  const isExpense = kind === 'expense';
  // El backend solo devuelve el neto; el bruto se reconstruye desde el descuento.
  const grossAmount = grossFromNet(
    transaction.amount,
    transaction.discount_amount,
    transaction.discount_percentage,
  );
  const hasDiscount =
    transaction.discount_amount != null ||
    transaction.discount_percentage != null;
  const discountValue =
    transaction.discount_amount != null
      ? formatMoney(transaction.discount_amount, currency)
      : transaction.discount_percentage != null
        ? `${transaction.discount_percentage}%`
        : null;
  const client = transaction.user
    ? `${transaction.user.first_name} ${transaction.user.last_name}`
    : transaction.external_name
      ? `${transaction.external_name} (externo)`
      : null;

  return (
    <div className="detail-list">
      <Item label="Estado" value={<TransactionStatusBadge status={transaction.status} />} />
      <Item
        label={isExpense ? 'Proveedor / Beneficiario' : 'Cliente'}
        value={client}
      />
      <Item label="Categoría" value={labelTransactionCategory(transaction.category)} />
      <Item label="Descripción" value={transaction.description} />
      <Item label="Monto bruto" value={formatMoney(grossAmount, currency)} />
      {hasDiscount && (
        <Item label="Descuento" value={discountValue} />
      )}
      {hasDiscount && transaction.discount_description && (
        <Item label="Motivo del descuento" value={transaction.discount_description} />
      )}
      {transaction.discount_id !== null && (
        <Item
          label="Origen del descuento"
          value="Configuración del estudiante"
        />
      )}
      <Item label="Monto neto" value={formatMoney(transaction.amount, currency)} />
      <Item label="Fecha" value={formatDate(transaction.transaction_date)} />
      <Item label="Fecha de pago" value={formatDate(transaction.paid_date)} />
      <Item
        label="Método de pago"
        value={
          transaction.payment_method
            ? labelPaymentMethod(transaction.payment_method)
            : null
        }
      />
      <Item label="Comprobante" value={transaction.payment_reference} />
      <Item label="Nota" value={transaction.payment_notes} />
      <Item label="Inicio del periodo" value={formatDate(transaction.period_start)} />
      <Item label="Fin del periodo" value={formatDate(transaction.period_end)} />
      {transaction.recurring_id !== null && (
        <Item
          label={isExpense ? 'Gasto recurrente' : 'Cobro recurrente'}
          value={`#${transaction.recurring_id}`}
        />
      )}
    </div>
  );
}
