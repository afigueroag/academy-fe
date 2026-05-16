export function fromCents(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

export function toCents(
  amount: number | string | null | undefined,
): number | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function formatMoney(
  cents: number | null | undefined,
  currency: string | null,
): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format(cents / 100);
}
