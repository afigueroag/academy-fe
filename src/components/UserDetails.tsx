import type { PaymentMethod, UserRead } from '../types';
import StatusBadge from './StatusBadge';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  paypal: 'PayPal',
  bank_transfer: 'Transferencia bancaria',
  cash: 'Efectivo',
  other: 'Otro',
};

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

export default function UserDetails({ user }: { user: UserRead }) {
  return (
    <div className="detail-list">
      <Item
        label="Nombre completo"
        value={`${user.first_name} ${user.last_name}`}
      />
      <Item label="Email" value={user.email} />
      <Item label="Estado" value={<StatusBadge status={user.status} />} />
      <Item label="Teléfono" value={user.phone} />
      <Item label="Dirección" value={user.address} />
      <Item
        label="Fecha de nacimiento"
        value={formatDate(user.date_of_birth)}
      />
      <Item label="Fecha de inicio" value={formatDate(user.start_date)} />
      <Item
        label="Método de pago"
        value={user.payment_method ? PAYMENT_LABELS[user.payment_method] : null}
      />
      <Item label="Condiciones especiales" value={user.special_conditions} />
    </div>
  );
}
