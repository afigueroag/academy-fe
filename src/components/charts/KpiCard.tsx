import { formatDeltaPct } from '../../utils/finance';

interface KpiCardProps {
  label: string;
  // Valor ya formateado (moneda, conteo o porcentaje según el KPI).
  value: string;
  // delta_pct del KPI. `undefined` → no se muestra chip; `null` → "—".
  delta?: number | null;
}

export default function KpiCard({ label, value, delta }: KpiCardProps) {
  const showDelta = delta !== undefined;
  const dir =
    delta === null || delta === undefined || delta === 0
      ? 'flat'
      : delta > 0
        ? 'up'
        : 'down';

  return (
    <div className="kpi-card">
      <p className="kpi-card__label">{label}</p>
      <div className="kpi-card__value">{value}</div>
      {showDelta && (
        <div className={`kpi-card__delta kpi-card__delta--${dir}`}>
          {dir !== 'flat' && (
            <span aria-hidden="true">{dir === 'up' ? '↑' : '↓'}</span>
          )}
          <span>{formatDeltaPct(delta)}</span>
          <span className="kpi-card__delta-note">vs. mes anterior</span>
        </div>
      )}
    </div>
  );
}
