interface WaterfallBarProps {
  income: number;
  expense: number;
  netProfit: number;
  formatValue: (n: number) => string;
}

// "Resumen del mes": Ingresos → (−) Gastos → Utilidad neta, en cascada.
export default function WaterfallBar({
  income,
  expense,
  netProfit,
  formatValue,
}: WaterfallBarProps) {
  const max = Math.max(1, income, expense, Math.abs(netProfit));
  const pct = (n: number) => Math.max(0, (n / max) * 100);

  const netNeg = netProfit < 0;

  const cols = [
    {
      key: 'income',
      label: 'Ingresos',
      bottom: 0,
      height: pct(income),
      display: formatValue(income),
      variant: 'income',
    },
    {
      key: 'expense',
      label: 'Gastos',
      // Barra flotante: cae desde Ingresos hasta Ingresos − Gastos.
      bottom: pct(income - expense),
      height: pct(expense),
      display: `−${formatValue(expense)}`,
      variant: 'expense',
    },
    {
      key: 'net',
      label: 'Utilidad neta',
      bottom: 0,
      height: pct(Math.abs(netProfit)),
      display: formatValue(netProfit),
      variant: netNeg ? 'net-neg' : 'net',
    },
  ];

  return (
    <div className="waterfall" role="img">
      {cols.map((c) => (
        <div className="waterfall__col" key={c.key}>
          <div className="waterfall__value">{c.display}</div>
          <div className="waterfall__track">
            <div
              className={`waterfall__bar waterfall__bar--${c.variant}`}
              style={{ bottom: `${c.bottom}%`, height: `${c.height}%` }}
            />
          </div>
          <div className="waterfall__label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
