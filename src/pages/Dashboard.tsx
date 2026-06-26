import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import NewTransactionPanel from '../components/NewTransactionPanel';
import Overview from './dashboard/Overview';
import Income from './dashboard/Income';
import Expenses from './dashboard/Expenses';
import { getToken } from '../api';
import { useAuth } from '../auth';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from '../brand';
import type { TransactionKind } from '../types';
import { monthName } from '../utils/finance';

type Tab = 'resumen' | 'ingresos' | 'gastos';

const MIN_YEAR = 2025;

const TABS: { value: Tab; label: string }[] = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'gastos', label: 'Gastos' },
];

const SOON_TABS = ['P&L', 'Nómina', 'Reportes'];

export default function Dashboard() {
  const token = getToken();
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState<Tab>('resumen');

  // Se incrementa al crear una transacción para forzar refresco de la sección.
  const [reloadToken, setReloadToken] = useState(0);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKind, setPanelKind] = useState<TransactionKind | undefined>(
    undefined,
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const atMin = year === MIN_YEAR && month === 1;

  const prevMonth = () => {
    if (atMin) return;
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const openPanel = (kind?: TransactionKind) => {
    setPanelKind(kind);
    setPanelOpen(true);
  };

  const handleCreated = (kind: TransactionKind) => {
    setPanelOpen(false);
    showToast(kind === 'expense' ? 'Gasto registrado' : 'Ingreso registrado');
    setReloadToken((t) => t + 1);
  };

  const actions = useMemo(
    () => (
      <>
        <div className="period-picker">
          <button
            type="button"
            className="period-picker__btn"
            onClick={prevMonth}
            disabled={atMin}
            aria-label="Mes anterior"
          >
            <ArrowLeftIcon size={16} />
          </button>
          <span className="period-picker__label">
            {monthName(month)} {year}
          </span>
          <button
            type="button"
            className="period-picker__btn"
            onClick={nextMonth}
            aria-label="Mes siguiente"
          >
            <ArrowRightIcon size={16} />
          </button>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => openPanel()}
        >
          <PlusIcon size={14} /> Nueva transacción
        </button>
        <button type="button" className="btn btn--ghost" disabled>
          Exportar <span className="pill-soon">Preview</span>
        </button>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, year, atMin],
  );

  if (!token) return <Navigate to="/login" replace />;

  return (
    <Layout title="Finanzas" actions={actions}>
      <div className="module-tabs">
        <div className="tab-group" role="tablist" aria-label="Secciones de finanzas">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={
                'tab-group__item' +
                (tab === t.value ? ' tab-group__item--active' : '')
              }
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
          {SOON_TABS.map((label) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={false}
              className="tab-group__item"
              disabled
              title="Próximamente"
            >
              {label}
              <span className="pill-soon">Pronto</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div
          className="alert alert--success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {toast}
        </div>
      )}

      {tab === 'resumen' && (
        <Overview
          month={month}
          year={year}
          currency={currency}
          reloadToken={reloadToken}
          onNewTransaction={openPanel}
        />
      )}
      {tab === 'ingresos' && (
        <Income
          month={month}
          year={year}
          currency={currency}
          reloadToken={reloadToken}
        />
      )}
      {tab === 'gastos' && (
        <Expenses
          month={month}
          year={year}
          currency={currency}
          reloadToken={reloadToken}
        />
      )}

      <NewTransactionPanel
        open={panelOpen}
        defaultKind={panelKind}
        onClose={() => setPanelOpen(false)}
        onSuccess={handleCreated}
      />
    </Layout>
  );
}
