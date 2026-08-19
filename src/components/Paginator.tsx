import { ChevronLeftIcon, ChevronRightIcon } from '../brand';

interface PaginatorProps {
  // Página actual, base 0.
  page: number;
  pageSize: number;
  // Total con los filtros aplicados (header X-Total-Count), no el de la página.
  total: number;
  // Cantidad de filas que se están viendo. Cuando el total no se pudo leer, es
  // lo único fiable que hay para el texto.
  shown: number;
  disabled?: boolean;
  // 'top' invierte el margen para que respire contra la tabla que va debajo.
  // Las listas largas lo llevan arriba y abajo: obliga a menos scroll para
  // cambiar de página y deja el "Mostrando X–Y de Z" a la vista al llegar.
  position?: 'top' | 'bottom';
  onChange: (page: number) => void;
}

/**
 * Paginador de listas servidas con `skip`/`limit`. Se oculta solo si todo cabe
 * en una página, para no ensuciar las listas cortas.
 */
export default function Paginator({
  page,
  pageSize,
  total,
  shown,
  disabled = false,
  position = 'bottom',
  onChange,
}: PaginatorProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = page * pageSize + 1;
  const to = page * pageSize + shown;
  const isFirst = page === 0;
  const isLast = page >= pages - 1;

  return (
    <nav
      className={'paginator' + (position === 'top' ? ' paginator--top' : '')}
      aria-label="Paginación"
    >
      <p className="paginator__count">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="paginator__controls">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onChange(page - 1)}
          disabled={disabled || isFirst}
        >
          <ChevronLeftIcon size={14} />
          Anterior
        </button>
        <span className="paginator__page">
          Página {page + 1} de {pages}
        </span>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onChange(page + 1)}
          disabled={disabled || isLast}
        >
          Siguiente
          <ChevronRightIcon size={14} />
        </button>
      </div>
    </nav>
  );
}
