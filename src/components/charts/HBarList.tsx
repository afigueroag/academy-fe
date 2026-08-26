import { formatPct } from '../../utils/finance';

export interface HBarDatum {
  label: string;
  value: number;
  // Peso sobre el total, como fracción 0–1 tal cual lo devuelve el backend
  // (ver utils/finance.ts). Opcional.
  pct?: number;
}

interface HBarListProps {
  data: HBarDatum[];
  formatValue?: (n: number) => string;
}

export default function HBarList({ data, formatValue }: HBarListProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (n: number) => (formatValue ? formatValue(n) : String(n));

  return (
    <ul className="hbar-list">
      {data.map((d, i) => {
        // Ancho calculado relativo al mayor valor (estilo inline permitido).
        const width = `${Math.max(0, (d.value / max) * 100)}%`;
        return (
          <li className="hbar-list__row" key={i}>
            <div className="hbar-list__head">
              <span className="hbar-list__label" title={d.label}>
                {d.label}
              </span>
              <span className="hbar-list__value">
                {fmt(d.value)}
                {d.pct != null && (
                  <span className="hbar-list__pct"> · {formatPct(d.pct)}</span>
                )}
              </span>
            </div>
            <div className="hbar-list__track">
              <div className="hbar-list__fill" style={{ width }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
