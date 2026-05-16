# Academy FE — Guía de estilo y patrones

Referencia mínima para generar módulos nuevos sin re-leer todo el código. Todo el CSS vive en [src/styles.css](src/styles.css); no se agregan estilos inline ni librerías de UI.

## Stack

React 18 + Vite + TS + React Router 6. Sin CSS-in-JS, sin Tailwind. Idioma UI: **Español**.

## Tokens (CSS vars en `:root`)

```
Colores:     --color-primary --color-secondary --color-accent
             --color-bg --color-surface --color-border
             --color-text --color-text-muted --color-text-subtle
             --color-danger --color-danger-bg
Tipografía:  --font-display (Fraunces, serif) para h1/h2/h3 y números grandes
             --font-body    (Manrope, sans)   para todo lo demás
Radios:      --radius-sm 6  --radius-md 10  --radius-lg 16  --radius-xl 24
Sombras:     --shadow-sm --shadow-md --shadow-lg
```

`--color-primary/secondary/accent` se sobreescriben en runtime desde la academia (ver [src/theme.ts](src/theme.ts)). Usa `color-mix(in srgb, var(--color-primary) N%, transparent|white)` para tintes/halos en vez de hex fijo.

## Layout de app autenticada

Envuelve la página en `<Layout title="..." actions={...}>`. Layout ya pinta sidebar + topbar y maneja `useAuth`/logout. Ver [src/components/Layout.tsx](src/components/Layout.tsx).

Dentro de `<Layout>` usa secciones en este orden:

```tsx
<section className="summary-grid"> ... </section>      // tarjetas KPI
<section className="filter-bar"> ... </section>        // search + tabs
<section><div className="table-wrapper"> ... </div></section>
```

Agregar un módulo al sidebar: editar `<nav className="sidebar__nav">` en [Layout.tsx](src/components/Layout.tsx) y añadir ruta en [src/App.tsx](src/App.tsx).

## Catálogo de clases CSS

**Botones** — `.btn` + variante: `.btn--primary` (gradiente primary→secondary) · `.btn--ghost` · `.btn--danger` · `.btn--block` (full width). Icono interno: `<Icon size={14} />` antes del texto.

**Formularios** — wrapper `.field` (`gap:6 margin-bottom:16`) o `.field--row` (2 cols). Dentro: `.field__label`, `.input` o `.select` o `.textarea`, `.field__hint`, `.field__error`. Usa `aria-invalid="true"` para estado de error.

**Alertas** — `.alert` (rojo por default) · `.alert--success`.

**KPIs** — `.summary-grid` → `.summary-card` con `.summary-card__label` + `.summary-card__value` (número grande en font-display).

**Filtros** — `.filter-bar` con:
- `.search-input` (relativo, icono `<SearchIcon>` absoluto a la izquierda + `<input type="search">`)
- `.tab-group` con `.tab-group__item` (+ `--active`)

**Tabla** — `.table-wrapper > table.users-table`. Th uppercase muted; tbody hover con tinte primary. Celda de usuario: `.user-cell` con `.user-cell__avatar` (iniciales) + `.user-cell__name`. Acciones por fila: `.row-actions > .icon-btn` (+ `--danger`). Vacío: `.empty-state` con `.empty-state__title`. Cargando: `.loading-row` + `<SpinnerIcon />`.

**Badges de estado** — `.badge` + `.badge--active|--pending|--inactive`. Usa el componente `<StatusBadge status>` directamente.

**Panel lateral** — usa `<SidePanel open title subtitle? footer? onClose>` ([src/components/SidePanel.tsx](src/components/SidePanel.tsx)). Maneja Esc, backdrop y scroll-lock. Clases internas (`.side-panel*`) ya las gestiona el componente.

**Modal confirm** — `<ConfirmModal open title message confirmLabel danger? loading onConfirm onCancel>` ([src/components/ConfirmModal.tsx](src/components/ConfirmModal.tsx)).

**Lista de detalle (vista read-only)** — `.detail-list > .detail-item` con `.detail-item__label` + `.detail-item__value` (`--empty` si no hay valor).

**Auth shell (Login/Register/Invite)** — `.auth-shell` (split 2 cols ≥960px), `.auth-aside` (gradiente con quote), `.auth-main > .auth-card`. Stepper de pasos: `.stepper` con `.stepper__step` (+ `--active` / `--done`).

## Iconos disponibles

Importar de `../brand`: `Logo, CheckIcon, ArrowRightIcon, ArrowLeftIcon, SpinnerIcon, PlusIcon, MailIcon, SearchIcon, CloseIcon, PencilIcon, EyeIcon, TrashIcon, UsersIcon, GraduationIcon, CopyIcon, LogoutIcon`. Todos aceptan `size` (default 16) y `color` (default `currentColor`). No instalar lucide ni heroicons.

## API y tipos

Endpoints centralizados en [src/api.ts](src/api.ts) (lanzan `ApiError` con `.message`, `.status`, `.detail`). Token via `getToken()` / `useAuth()`. Tipos en [src/types.ts](src/types.ts).

Patrón estándar en una página:
```ts
try { ... } catch (err) {
  if (err instanceof ApiError) { setPanelApiError(err); setPanelError(err.message); }
  else { setPanelError('Mensaje genérico en español.'); }
}
```

## Receta para un módulo CRUD nuevo

Si el módulo se parece a Students/Instructors (lista + invitar + crear + editar + ver + borrar), **no escribir un módulo nuevo**: parametrizar [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx) como hace [src/pages/Students.tsx](src/pages/Students.tsx). Solo agregar ruta en `App.tsx` y link en `Layout.tsx`.

Para un módulo diferente, este es el esqueleto mínimo:

```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ApiError, getToken /*, ...endpoints */ } from '../api';
import { PlusIcon, SearchIcon, SpinnerIcon } from '../brand';

export default function MyModule() {
  const token = getToken();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { /* fetch */ }, []);

  if (!token) return <Navigate to="/login" replace />;

  const actions = (
    <button className="btn btn--primary" onClick={...}>
      <PlusIcon size={14} /> Crear
    </button>
  );

  return (
    <Layout title="Mi módulo" actions={actions}>
      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-card__label">Total</p>
          <div className="summary-card__value">{items.length}</div>
        </div>
      </section>

      <section className="filter-bar">
        <div className="search-input">
          <SearchIcon size={16} />
          <input type="search" placeholder="Buscar" aria-label="Buscar" />
        </div>
      </section>

      <section>
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-row"><SpinnerIcon size={16} /> Cargando…</div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">Sin resultados</p>
            </div>
          ) : (
            <table className="users-table">{/* thead/tbody */}</table>
          )}
        </div>
      </section>
    </Layout>
  );
}
```

## Reglas

- **No** crear archivos CSS por componente. Si un patrón se repite, añadirlo a [styles.css](src/styles.css) con clase semántica (`.summary-card`, no `.box-1`).
- **No** instalar dependencias de UI. Las que hay (`react`, `react-dom`, `react-router-dom`) bastan.
- **No** usar emojis en UI ni hex hard-codeados para primary/secondary/accent — siempre tokens CSS.
- Estado de error/carga/vacío en toda lista (los tres). Mensajes y labels en español.
- Acciones destructivas pasan por `<ConfirmModal danger>`. Toast de éxito: `.alert.alert--success` con auto-dismiss 4s (ver el patrón `showToast` en [UsersModule.tsx](src/pages/UsersModule.tsx)).
