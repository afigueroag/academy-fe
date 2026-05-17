# Plantilla de prompt — Módulo nuevo

Copia esta plantilla y rellena cada sección antes de pegarla a Claude Code. Mantén el orden: el modelo ya conoce este esquema (mismo patrón que los módulos previos del repo).

Borra cualquier sección que realmente no aplique, pero **no** dejes secciones vacías "por completar después" — fuerza la decisión antes de empezar a codificar.

---

## 1. Contexto del proyecto

> Una o dos líneas. Recordatorio del producto (Cantera) y la misión específica de este módulo. Ejemplo: *"Construir el módulo de Pagos: el admin registra cobros por inscripción, ve historial por estudiante y exporta reportes mensuales."*
>
> Si el módulo NO se parece a los CRUD ya construidos (Students/Instructors), dilo explícitamente para que el modelo no intente parametrizar `UsersModule.tsx`.
>
> **Recordar siempre**: antes de tocar código leer [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts).

## 2. Identidad visual

> Confirma que se siguen los tokens y reglas de [STYLE_GUIDE.md](STYLE_GUIDE.md). Solo desviarse si este módulo necesita algo no contemplado (ej. un layout calendario, un gráfico, etc.); en ese caso describir la novedad y proponer dónde vivirían las clases nuevas en `styles.css`.

## 3. Enums

> Enumera los enums exactos del backend involucrados, con los `valor → "Label en español"`. Si el módulo agrega enums nuevos al `openapi.json`, lístalos también.

```ts
type FooStatus = "active" | "draft" | "archived";
```

| Enum | Valor | Label |
|------|-------|-------|
| `FooStatus` | `active` | "Activa" |
| | `draft` | "Borrador" |
| | `archived` | "Archivada" |

## 4. Sincronización de tipos y API service

> Asume que [src/types.ts](src/types.ts) y [src/api.ts](src/api.ts) pueden estar atrás del [openapi.json](openapi.json). Lista qué tipos y endpoints hay que agregar/modificar.

### 4.1 `src/types.ts`

> Tipos nuevos derivados del OpenAPI (Read, Create, Update, Public, etc.).

### 4.2 `src/api.ts`

> Endpoints nuevos a exponer (`listFoos`, `getFoo`, `createFoo`, `updateFoo`, `deleteFoo`, …). Recordar que todos lanzan `ApiError`.

## 5. Modelo de datos / reglas de negocio

> Reglas que NO se ven en el OpenAPI: validaciones cross-field, conflictos, cálculos derivados, restricciones de estado, defaults. Sé específico — esto es donde más tiende a alucinar el modelo.

## 6. UI / flujos

> Por pantalla o por panel: qué se ve, qué se puede hacer, qué componentes reusar de [src/components/](src/components/) (`Layout`, `SidePanel`, `ConfirmModal`, `Badges`, etc.). Describir:
>
> - Vista de lista (KPIs, filtros, tabla, estados loading/empty/error).
> - Crear / editar (formulario, validaciones, panel lateral vs página).
> - Ver detalle.
> - Borrar (confirm modal).
> - Cualquier flujo extra (invitar, importar, exportar, etc.).

## 7. Ruta y navegación

> - Ruta nueva en [src/App.tsx](src/App.tsx).
> - Entrada nueva en `<nav className="sidebar__nav">` de [src/components/Layout.tsx](src/components/Layout.tsx) (ícono desde [src/brand.tsx](src/brand.tsx); si falta el ícono, decirlo).

## 8. Reglas y restricciones

> - Todo en español.
> - CSS solo en [src/styles.css](src/styles.css).
> - Sin libs nuevas.
> - Cualquier otra restricción específica del módulo.

## 9. Definition of Done

> Checklist verificable. Ejemplo:
>
> - [ ] [src/types.ts](src/types.ts) refleja los schemas nuevos.
> - [ ] [src/api.ts](src/api.ts) tiene `listFoos`, `createFoo`, `updateFoo`, `deleteFoo`.
> - [ ] Página `src/pages/Foos.tsx` con KPIs, filtros, tabla, panel lateral de crear/editar/ver.
> - [ ] Ruta en [src/App.tsx](src/App.tsx) y link en sidebar.
> - [ ] `npm run typecheck` pasa sin warnings.
> - [ ] Estados loading/empty/error visibles en la lista.
