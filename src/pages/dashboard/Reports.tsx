// Sección Reportes: placeholder estático (sin API). Los botones de generación
// de PDF están deshabilitados con badge "Preview" hasta que exista endpoint.

interface ReportCard {
  title: string;
  description: string;
}

const REPORTS: ReportCard[] = [
  {
    title: 'Resumen Financiero',
    description: 'Vista consolidada de ingresos, gastos y utilidad del periodo.',
  },
  {
    title: 'Ingresos por Categoría',
    description: 'Desglose de ingresos agrupados por tipo de concepto.',
  },
  {
    title: 'Gastos por Categoría',
    description: 'Desglose de gastos agrupados por tipo de concepto.',
  },
  {
    title: 'P&L',
    description: 'Estado de resultados detallado del periodo seleccionado.',
  },
  {
    title: 'Flujo de Efectivo',
    description: 'Entradas y salidas de efectivo a lo largo del periodo.',
  },
];

export default function Reports() {
  return (
    <>
      <div className="alert" role="status" style={{ marginBottom: 16 }}>
        Generación de reportes en preparación.
      </div>

      <div className="report-grid">
        {REPORTS.map((r) => (
          <div className="report-card" key={r.title}>
            <div className="report-card__head">
              <h2 className="report-card__title">{r.title}</h2>
              <span className="pill-soon">Preview</span>
            </div>
            <p className="report-card__desc">{r.description}</p>
            <button type="button" className="btn btn--ghost" disabled>
              Generar PDF
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
