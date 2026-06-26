export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  // Formatea el valor mostrado encima de cada barra (p. ej. formatMoney).
  formatValue?: (n: number) => string;
}

export default function BarChart({ data, formatValue }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = (n: number) => (formatValue ? formatValue(n) : String(n));

  return (
    <div className="chart-bars" role="img">
      {data.map((d, i) => {
        // Altura calculada (único caso permitido de estilo inline).
        const height = `${Math.max(0, (d.value / max) * 100)}%`;
        return (
          <div className="chart-bars__col" key={i} title={`${d.label}: ${fmt(d.value)}`}>
            <div className="chart-bars__value">{fmt(d.value)}</div>
            <div className="chart-bars__track">
              <div className="chart-bars__bar" style={{ height }} />
            </div>
            <div className="chart-bars__label">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
