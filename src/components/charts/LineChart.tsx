export interface LineDatum {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineDatum[];
  formatValue?: (n: number) => string;
}

// Geometría del lienzo (viewBox). El SVG escala al ancho del contenedor vía CSS.
const W = 640;
const H = 240;
const PAD_X = 16;
const PAD_TOP = 20;
const PAD_BOTTOM = 34;

// Gráfico de línea en SVG. Dibuja eje base (cero), la serie y sus puntos, con
// etiquetas de mes. Soporta valores negativos (utilidad neta), el caso de
// todos-cero y el de un solo punto.
export default function LineChart({ data, formatValue }: LineChartProps) {
  const fmt = (n: number) => (formatValue ? formatValue(n) : String(n));
  const values = data.map((d) => d.value);

  // Rango vertical: siempre incluye el cero para anclar el eje base.
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  // Todos-cero → rango simbólico para no dividir entre cero.
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const span = max - min;

  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const xAt = (i: number) =>
    data.length <= 1 ? W / 2 : PAD_X + (i / (data.length - 1)) * plotW;
  const yAt = (v: number) => PAD_TOP + (1 - (v - min) / span) * plotH;

  const zeroY = yAt(0);
  const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value), d }));
  const linePath = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="chart-line" role="img">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-line__svg">
        {/* Eje base (cero). */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={zeroY}
          y2={zeroY}
          className="chart-line__axis"
        />
        {/* Línea de la serie (solo con 2+ puntos). */}
        {points.length > 1 && (
          <polyline points={linePath} className="chart-line__path" />
        )}
        {/* Puntos + etiquetas de mes. */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} className="chart-line__dot">
              <title>{`${p.d.label}: ${fmt(p.d.value)}`}</title>
            </circle>
            <text
              x={p.x}
              y={H - 12}
              className="chart-line__label"
              textAnchor="middle"
            >
              {p.d.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
