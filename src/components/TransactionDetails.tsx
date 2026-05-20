import type { TransactionRead } from '../types';
import { TransactionStatusBadge } from './Badges';
import { formatMoney } from '../utils/money';
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
}

export default function TransactionDetails({ transaction, currency }: Props) {
  const client = transaction.user
    ? `${transaction.user.first_name} ${transaction.user.last_name}`
    : transaction.external_name
      ? `${transaction.external_name} (externo)`
      : null;

  return (
    <div className="detail-list">
      <Item label="Estado" value={<TransactionStatusBadge status={transaction.status} />} />
      <Item label="Cliente" value={client} />
      <Item label="Categoría" value={labelTransactionCategory(transaction.category)} />
      <Item label="Descripción" value={transaction.description} />
      <Item label="Monto" value={formatMoney(transaction.amount, currency)} />
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
        <Item label="Cobro recurrente" value={`#${transaction.recurring_id}`} />
      )}
    </div>
  );
}
