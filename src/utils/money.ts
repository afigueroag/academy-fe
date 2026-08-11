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

// Reconstruye el bruto (cents) a partir del neto que devuelve el backend y el
// descuento aplicado, porque las lecturas de transacción no incluyen el bruto.
// Con descuento porcentual el resultado puede desviarse un cent por redondeo.
// Devuelve null si el bruto es indeterminado (descuento del 100%).
export function grossFromNet(
  net: number,
  discountAmount: number | null,
  discountPercentage: number | null,
): number | null {
  if (discountAmount !== null) return net + discountAmount;
  if (discountPercentage !== null) {
    const factor = 1 - discountPercentage / 100;
    if (factor <= 0) return null;
    return Math.round(net / factor);
  }
  return net;
}

// Locale fijo para todo formateo numérico de la app: punto decimal y coma de
// millares, pase lo que pase con el idioma del navegador. No usar
// `navigator.language` aquí — locales como es-ES rendirían "1.234,56".
export const NUMBER_LOCALE = 'en-US';

export function formatMoney(
  cents: number | null | undefined,
  currency: string | null,
): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    style: 'currency',
    currency: currency ?? 'USD',
    // Sin esto, en-US antepone el código de país a monedas no propias
    // ("MX$1,234.50"). Cada academia usa una sola moneda, así que el símbolo
    // corto no es ambiguo.
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}
