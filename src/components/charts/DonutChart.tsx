// Paleta de series derivada de los tokens de marca (sin hex hardcoded). Se
// mezcla con blanco para obtener tintes y distinguir segmentos.
const SERIES_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'color-mix(in srgb, var(--color-primary) 55%, white)',
  'color-mix(in srgb, var(--color-secondary) 55%, white)',
  'color-mix(in srgb, var(--color-accent) 55%, white)',
  'color-mix(in srgb, var(--color-primary) 30%, white)',
  'color-mix(in srgb, var(--color-secondary) 30%, white)',
];

export function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

export interface DonutDatum {
  label: string;
  value: number;
  pct?: number;
}

interface DonutChartProps {
  data: DonutDatum[];
  formatValue?: (n: number) => string;
  // Texto opcional en el centro de la dona.
  centerLabel?: string;
  centerValue?: string;
}

const CX = 80;
const CY = 80;
const R = 58;
const SW = 26;
const C = 2 * Math.PI * R;

export default function DonutChart({
  data,
  formatValue,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = (n: number) => (formatValue ? formatValue(n) : String(n));

  let acc = 0;

  return (
    <div className="donut">
      <div className="donut__chart">
        <svg viewBox="0 0 160 160" className="donut__svg" aria-hidden="true">
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={SW}
            className="donut__track"
          />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * C;
              const seg = (
                <circle
                  key={i}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  strokeWidth={SW}
                  stroke={seriesColor(i)}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-acc}
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              );
              acc += len;
              return seg;
            })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="donut__center">
            {centerValue && (
              <div className="donut__center-value">{centerValue}</div>
            )}
            {centerLabel && (
              <div className="donut__center-label">{centerLabel}</div>
            )}
          </div>
        )}
      </div>
      <ul className="donut__legend">
        {data.map((d, i) => (
          <li className="donut__legend-item" key={i}>
            <span
              className="donut__swatch"
              style={{ background: seriesColor(i) }}
              aria-hidden="true"
            />
            <span className="donut__legend-label" title={d.label}>
              {d.label}
            </span>
            <span className="donut__legend-value">
              {d.pct != null ? `${d.pct.toFixed(1)}%` : fmt(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
