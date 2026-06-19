# Prompt — Módulo de Grupos (Cantera)

> Pégale esto a Claude Code. El backend y el `openapi.json` ya están actualizados con todo lo que este módulo necesita. **Antes de tocar código lee** [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts).

---

## 1. Contexto del proyecto

Cantera, SaaS de gestión de academias. Misión de este módulo: que el admin organice a **estudiantes** y **clases** en **grupos** (ej. "Cinta Blanca/Azul/Negra", "Niños/Jóvenes/Adultos", "Principiante/Intermedio/Avanzado") y que la **vista del alumno** respete esos grupos al inscribir clases.

**Importante: este NO es un CRUD tipo `UsersModule.tsx`.** Es un modelo de **dos niveles**: una **Categoría de Grupos** que contiene varios **Grupos**. No intentes parametrizar `UsersModule.tsx`; sigue la "Receta para un módulo CRUD nuevo" de STYLE_GUIDE.md. Referencia rica de un módulo distinto: [src/pages/Classes.tsx](src/pages/Classes.tsx).

El trabajo se divide en **3 fases** (ver §6). Entrega y valida fase por fase.

## 2. Identidad visual

Sigue los tokens y el catálogo de clases de [STYLE_GUIDE.md](STYLE_GUIDE.md). Todo el CSS nuevo va en [src/styles.css](src/styles.css) con clases semánticas; nada inline, sin libs nuevas, sin emojis, sin hex para primary/secondary/accent.

Patrones nuevos que probablemente necesites (proponer clases en `styles.css`):
- **Editor maestro-detalle de categorías** en la página de Grupos: lista de categorías a la izquierda y, al seleccionar una, el detalle/edición de sus grupos a la derecha (o paneles laterales `SidePanel`, lo que quede más limpio con el estilo actual). Sugerencia de clases: `.group-category-list`, `.group-row`, `.group-rank`.
- **Selector de grupos** reutilizable para los formularios de Estudiante y Clase: chips/checkbox agrupados por categoría. Sugerencia: `.group-picker`, `.group-picker__category`, `.group-chip` (+ `--selected`).
- **Chip de bloqueo / requisito** en la vista del alumno: `.course-card__lock` o badge `.badge--locked`.

## 3. Enums

No hay enums nuevos. El único discriminador es `is_ordinal: boolean` en la categoría:
- `is_ordinal = false` → grupo **cualitativo** (coincidencia exacta). El campo `rank` no aplica.
- `is_ordinal = true` → grupo **ordinal** (importa el orden). Cada grupo de la categoría tiene `rank: number` (ej. Principiante=1, Intermedio=2, Avanzado=3).

## 4. Sincronización de tipos y API service

[src/types.ts](src/types.ts) y [src/api.ts](src/api.ts) están **atrás** del `openapi.json`. Hay que sincronizar.

### 4.1 `src/types.ts`

- **Eliminar** el `UserGroup { id, name, order }` actual (está desactualizado; no coincide con el backend).
- **Agregar** (según `openapi.json`):
  ```ts
  export interface GroupCategoryPublic { id: number; name: string; is_ordinal: boolean; }

  export interface GroupPublic {
    id: number;
    name: string;
    category_id: number;
    rank: number | null;
    category: GroupCategoryPublic;   // categoría anidada (úsala para is_ordinal/nombre)
  }

  export interface GroupRead { id: number; name: string; category_id: number; rank: number | null; }
  export interface GroupCreate { name: string; category_id: number; rank?: number | null; }
  export interface GroupUpdate { name: string; category_id: number; rank?: number | null; }

  export interface GroupCategoryRead {
    id: number;
    name: string;
    is_ordinal: boolean;
    groups: GroupRead[];             // grupos anidados
  }
  export interface GroupCategoryCreate { name: string; is_ordinal?: boolean | null; }
  export interface GroupCategoryUpdate { name: string; is_ordinal?: boolean | null; }
  ```
- En `UserRead` cambiar `groups?: UserGroup[] | null` → `groups?: GroupPublic[] | null`. **Agregar** `groups?: GroupPublic[]` a `UserCreate` y `UserUpdate`.
- En `CourseRead`/`CourseCreate`/`CourseUpdate` agregar/confirmar `groups: GroupPublic[]` (default `[]`).
- En `CourseStudentRead` agregar `can_enroll: boolean` y `groups: GroupPublic[]`.

### 4.2 `src/api.ts`

Agregar (todos lanzan `ApiError`):
- `listGroupCategories(): Promise<GroupCategoryRead[]>` → `GET /groups/categories`
- `getGroupCategory(id): Promise<GroupCategoryRead>` → `GET /groups/categories/{id}`
- `createGroupCategory(payload: GroupCategoryCreate)` → `POST /groups/categories`
- `updateGroupCategory(id, payload: GroupCategoryUpdate)` → `PATCH /groups/categories/{id}`
- `deleteGroupCategory(id)` → `DELETE /groups/categories/{id}`
- `listGroups(params?): Promise<GroupRead[]>` → `GET /groups` (acepta `?category=`/`skip`/`limit` según el contrato)
- `createGroup(payload: GroupCreate)` → `POST /groups`
- `updateGroup(id, payload: GroupUpdate)` → `PATCH /groups/{id}`
- `deleteGroup(id)` → `DELETE /groups/{id}`

> Nota: al crear/editar Estudiante o Clase, el campo `groups` viaja como `GroupPublic[]`. El front ya tiene los objetos completos (los obtiene del catálogo de grupos), así que **manda los objetos seleccionados tal cual**.

## 5. Modelo de datos / reglas de negocio

**Jerarquía:** Categoría (`is_ordinal`) → Grupos (`rank` solo si ordinal). Un estudiante y una clase pueden pertenecer a **varios grupos, incluso de la misma categoría**.

**Regla de elegibilidad (la calcula el backend; el front solo la replica para la *advertencia del admin*, ver §6 Fase 3):**
Un estudiante puede inscribir una clase **si cumple TODAS las categorías** (AND). Para cada categoría C en la que la **clase** tenga al menos un grupo:
- Si el estudiante no tiene ningún grupo en C → **no elegible**.
- Si C es **no ordinal** → debe coincidir **al menos un** grupo (intersección no vacía).
- Si C es **ordinal** → `rank_máx(estudiante en C) >= rank_mín(clase en C)`.

Casos borde:
- **Clase sin grupos** → abierta para todos.
- **Estudiante sin grupos** → solo puede inscribir clases sin grupos.

**Quién manda:**
- **Vista del alumno**: NO recalcular la regla. Usar el booleano `can_enroll` que ya entrega `CourseStudentRead`. Los `groups` de la clase sirven solo para mostrar el motivo del bloqueo.
- **Admin**: inscribe a cualquiera siempre. Si el alumno no cumple, mostrar **advertencia** (no bloquear). Esta advertencia SÍ se calcula en el front (helper en §6) con `course.groups` + `student.groups`.

**Validaciones de formulario (Grupos):**
- Categoría: `name` requerido.
- Grupo: `name` requerido; si la categoría es ordinal, `rank` requerido (entero); si no es ordinal, no pedir `rank`.
- **Borrado**: borrar grupo o categoría solo quita las asignaciones (el backend cascada las tablas de enlace; no afecta estudiantes ni clases). Igual: confirmar con `<ConfirmModal danger>` y avisar en el mensaje que se quitará de los estudiantes/clases asignados.

## 6. UI / flujos — 3 fases

### Fase 1 — Módulo de Grupos (página nueva)
Página `src/pages/Groups.tsx` envuelta en `<Layout title="Grupos" actions={…}>`:
- KPIs opcionales (`.summary-grid`): total de categorías, total de grupos.
- Lista de **categorías** (estados loading/empty/error en español). Cada categoría muestra nombre, badge "Ordinal"/"Cualitativa" y sus grupos.
- **Crear/editar categoría** (`SidePanel`): nombre + toggle `is_ordinal`.
- **Gestionar grupos dentro de la categoría**: agregar/editar/borrar grupos; si la categoría es ordinal, capturar y **ordenar por `rank`** (los ordinales se muestran ordenados por rank; permitir reordenar/editar el rank).
- **Borrar** categoría y grupo con `<ConfirmModal danger>`.
- Toast de éxito `.alert.alert--success` con auto-dismiss 4s (patrón `showToast` de `UsersModule.tsx`).

### Fase 2 — Asignar grupos en Estudiantes y Clases
- Construir un componente reutilizable **`GroupPicker`** en `src/components/GroupPicker.tsx`: recibe `value: GroupPublic[]` y `onChange`, carga categorías+grupos, y los presenta **agrupados por categoría** (chips/checkbox). Permite seleccionar varios, incluso de la misma categoría.
- Integrarlo en:
  - **Estudiante**: dentro de [src/components/UserForm.tsx](src/components/UserForm.tsx) (solo cuando el rol es estudiante), como una sección "Grupos". Incluir `groups` en el payload de `createUser`/`updateUser`.
  - **Clase**: dentro del `CourseForm` de [src/pages/Classes.tsx](src/pages/Classes.tsx), como sección "Grupos". Incluir `groups` en el payload de `createCourse`/`updateCourse`.
- Mostrar los grupos asignados también en las vistas de detalle (detalle de usuario y `CourseDetails`), como chips read-only.

### Fase 3 — Restricción en la vista del alumno + advertencia de admin
- **Vista del alumno** ([src/pages/StudentClasses.tsx](src/pages/StudentClasses.tsx)): la lista ya viene de `listStudentCourses()`. Para cada clase con `can_enroll === false`:
  - Mostrar la tarjeta pero con el botón "Inscribirme" **deshabilitado/bloqueado** (estado tipo el actual "Sin cupo").
  - Indicar el motivo con los `groups` de la clase (ej. chip "Requiere: Cinta Azul, Adultos"). No recalcular la regla; confiar en `can_enroll`.
- **Advertencia de admin** en [src/components/EnrollmentSection.tsx](src/components/EnrollmentSection.tsx): ahí ya existe un patrón de "conflictos" al elegir alumno (`studentConflicts`, `findStudentConflicts`). Añadir, en el mismo punto, un cálculo de **elegibilidad por grupos** con un helper nuevo `studentMeetsGroups(studentGroups, courseGroups): boolean` (implementa la regla de §5). Si NO cumple, mostrar una advertencia no bloqueante antes de confirmar la inscripción (el admin puede continuar). El backend permite la inscripción del admin de todos modos.
  - Coloca el helper en `src/utils/groups.ts` (nuevo) para poder reutilizarlo y testearlo.

> Nota sobre errores de auto-inscripción: el backend rechaza la auto-inscripción de un alumno no elegible. `POST /enrollments` documenta `201`/`422` (no un `403` tipado). En el `catch` del `enrollMe`, no asumas el código: muestra `err.message` si es `ApiError`, con fallback en español.

## 7. Ruta y navegación

- Ruta nueva `"/groups"` en [src/App.tsx](src/App.tsx), protegida (admin). Mantén la ruta en **inglés** (`/groups`), consistente con las demás rutas del repo.
- Link en `<nav className="sidebar__nav">` de [src/components/Layout.tsx](src/components/Layout.tsx). Usa un ícono **ya existente** de [src/brand.tsx](src/brand.tsx) (p. ej. `UsersIcon` o `GraduationIcon`). **No** instales íconos nuevos; si crees que falta uno adecuado, dilo en vez de inventarlo.

## 8. Reglas y restricciones

- Todo en español. CSS solo en [src/styles.css](src/styles.css). Sin libs nuevas. Sin emojis. Tokens CSS, no hex.
- Acciones destructivas con `<ConfirmModal danger>`. Toda lista con estados loading/empty/error.
- Patrón de error estándar: `if (err instanceof ApiError) { setPanelApiError(err); setPanelError(err.message); } else { setPanelError('…español…'); }`.
- Dinero en cents con `fromCents`/`toCents`/`formatMoney` (no aplica mucho aquí, pero respétalo si tocas costos).

## 9. Definition of Done

- [ ] [src/types.ts](src/types.ts) refleja los schemas del `openapi.json` (Group*, GroupCategory*, `GroupPublic.category`, `groups` en User/Course Create/Update, `can_enroll`+`groups` en `CourseStudentRead`); se eliminó `UserGroup`.
- [ ] [src/api.ts](src/api.ts) tiene los 9 endpoints de §4.2.
- [ ] **Fase 1**: `src/pages/Groups.tsx` con categorías + grupos (crear/editar/borrar), toggle ordinal y orden por rank; ruta en `App.tsx` y link en sidebar; estados loading/empty/error.
- [ ] **Fase 2**: `src/components/GroupPicker.tsx` integrado en `UserForm` (estudiantes) y `CourseForm` (clases); `groups` viaja en los payloads; chips en las vistas de detalle.
- [ ] **Fase 3**: `StudentClasses.tsx` bloquea clases con `can_enroll === false` y muestra el requisito; `EnrollmentSection.tsx` muestra advertencia no bloqueante para el admin usando `studentMeetsGroups` de `src/utils/groups.ts`.
- [ ] `npm run typecheck` pasa sin warnings.
- [ ] Sin CSS inline ni libs nuevas; estilos nuevos en `styles.css` con clases semánticas.
