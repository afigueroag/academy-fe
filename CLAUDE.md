# CLAUDE.md

Proyecto: **Cantera**, SaaS de gestión de academias (deportes, artes marciales, música, arte, escuelas pequeñas, kínders/guarderías).

Stack: React 18 + Vite + TypeScript + React Router 6. Sin CSS-in-JS, sin Tailwind, sin librerías de UI ni de íconos.

Idioma UI: **español**.

## Antes de tocar código, lee siempre

1. [STYLE_GUIDE.md](STYLE_GUIDE.md) — tokens CSS, catálogo de clases y componentes, receta para módulo nuevo. **Vinculante.**
2. [src/api.ts](src/api.ts) — todos los endpoints; lanzan `ApiError` (`.message`, `.status`, `.detail`).
3. [src/types.ts](src/types.ts) — contratos de datos.
4. [openapi.json](openapi.json) — fuente de verdad del backend; si difiere de `api.ts`/`types.ts`, manda OpenAPI y se actualizan los TS.

## Patrones clave

- **Módulo CRUD tipo usuarios** → parametriza [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx). Ejemplos: [Students.tsx](src/pages/Students.tsx) e [Instructors.tsx](src/pages/Instructors.tsx) (cada uno son ~17 líneas).
- **Módulo distinto** → seguir la "Receta para un módulo CRUD nuevo" en STYLE_GUIDE.md. Referencia rica: [src/pages/Classes.tsx](src/pages/Classes.tsx).
- **Auth** → `getToken()` / `useAuth()` desde [src/auth.tsx](src/auth.tsx). Si `!token` → `<Navigate to="/login" replace />`.
- **Layout** → envolver páginas autenticadas en `<Layout title actions>` ([src/components/Layout.tsx](src/components/Layout.tsx)); añadir link de nav editando `<nav className="sidebar__nav">` ahí.
- **Estilos** → todo el CSS vive en [src/styles.css](src/styles.css). No inline, no `.css` por componente.
- **Íconos** → solo los exportados por [src/brand.tsx](src/brand.tsx).
- **Dinero** → en cents (int) en API; usar `fromCents`/`toCents`/`formatMoney` de [src/utils/money.ts](src/utils/money.ts).

## Para pedir un módulo nuevo

Usa la plantilla de [PROMPT_TEMPLATE.md](PROMPT_TEMPLATE.md) y rellena las secciones.

## Reglas duras

- No instalar dependencias de UI ni de íconos.
- No hex hardcoded para `primary`/`secondary`/`accent` — usar tokens CSS (las academias los sobreescriben en runtime, ver [src/theme.ts](src/theme.ts)).
- Toda lista tiene tres estados: cargando, vacío, error. Mensajes en español.
- Acciones destructivas pasan por `<ConfirmModal danger>`.
- No usar emojis en UI.
