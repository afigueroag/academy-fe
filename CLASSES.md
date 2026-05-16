# Contexto del Proyecto

Eres un programador frontend colaborando con un backend developer para construir un SaaS llamado **Cantera** para gestionar academias: deportes, artes marciales, artes, música, escuelas pequeñas, kínders y guarderías.

Ya están implementados los módulos de **Estudiantes** ([src/pages/Students.tsx](src/pages/Students.tsx)) e **Instructores** ([src/pages/Instructors.tsx](src/pages/Instructors.tsx)), ambos parametrizando [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx).

Tu misión es construir el módulo de **Clases** (`/classes`). A diferencia de los anteriores, este módulo NO sigue el patrón de `UsersModule` — tiene una vista calendario con paneles de inscripciones embebidas, así que es un módulo nuevo desde cero. Reusa todo lo posible del style guide y los componentes existentes.

**Antes de tocar código**, lee:
- [STYLE_GUIDE.md](STYLE_GUIDE.md) — reglas de estilo, clases CSS disponibles, catálogo de componentes
- [openapi.json](openapi.json) — contrato del backend (ya está al día con todos los cambios necesarios)
- [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx) — referencia de patrón para listas, filtros, paneles laterales y manejo de errores
- [src/api.ts](src/api.ts) y [src/types.ts](src/types.ts) — vas a extender ambos

---

# Identidad Visual

Sigue [STYLE_GUIDE.md](STYLE_GUIDE.md) al pie de la letra: tokens CSS, fuentes (`--font-display` para titulares, `--font-body` para todo lo demás), iconos SVG inline desde [src/brand.tsx](src/brand.tsx), sin librerías de UI ni iconos externos. El idioma de la UI es **español**.

Los colores de la academia ya se aplican en runtime vía [src/theme.ts](src/theme.ts) — no toques eso.

---

# Enums (valores exactos del backend)

```ts
type CourseStatus     = "active" | "draft" | "archived";
type CourseRecurrence = "weekly" | "one_time";
type ScheduleDay      = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type InstructorType   = "instructor" | "assistant";
type EnrollmentStatus = "active" | "waiting" | "completed" | "cancelled";
```

Labels en español:

| Enum | Valor | Label |
|------|-------|-------|
| `CourseStatus` | `active` | "Activa" |
| | `draft` | "Borrador" |
| | `archived` | "Archivada" |
| `CourseRecurrence` | `weekly` | "Semanal" |
| | `one_time` | "Sesión única" |
| `ScheduleDay` | `monday`…`sunday` | "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo" — abreviadas a 1 letra (L, M, X, J, V, S, D) en chips compactos |
| `InstructorType` | `instructor` | "Instructor" |
| | `assistant` | "Asistente" |
| `EnrollmentStatus` | `active` | "Inscrito" |
| | `waiting` | "En espera" |
| | `completed` | "Completado" |
| | `cancelled` | "Cancelado" |

---

# Sincronización de tipos y API service

Los archivos [src/types.ts](src/types.ts) y [src/api.ts](src/api.ts) están **desactualizados** respecto al [openapi.json](openapi.json) actual. Antes de construir el módulo:

## 1. Actualizar `src/types.ts`

Agregar estos tipos derivados del OpenAPI:

```ts
export interface AcademyMe {
  id: number;                              // NUEVO — ya existe en OpenAPI
  name: string;
  type: AcademyType;
  plan: AcademyPlan;
  default_instructor_hourly_rate: number | null;  // NUEVO — entero en CENTAVOS
  default_assistant_hourly_rate: number | null;   // NUEVO — entero en CENTAVOS
  currency: string | null;                 // NUEVO — código ISO 4217 ("USD", "MXN", etc.)
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

export interface CoursePublic {
  id: number;
  name: string;
  description: string | null;
}

export interface AcademyPublic {
  id: number;
  name: string;
  type: AcademyType;
}

export interface ScheduleCreate {
  schedule_day: ScheduleDay;
  schedule_time: string;        // formato "HH:mm:ss" o "HH:mm" — el BE acepta ambos
}

export interface CourseInstructorLinkCreate {
  instructor_id: number;
  type: InstructorType;
  hourly_rate: number | null;   // entero en CENTAVOS
}

export interface CourseInstructorLinkRead {
  id: number;
  course_id: number;
  instructor_id: number;
  type: InstructorType;
  hourly_rate: number | null;   // entero en CENTAVOS
  instructor: UserPublic;       // nombre embebido
}

export interface CourseRead {
  id: number;
  name: string;
  description: string | null;
  status: CourseStatus | null;
  recurrence: CourseRecurrence | null;
  duration_minutes: number;
  max_students: number | null;
  individual_cost: number | null;  // entero en CENTAVOS
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: ScheduleCreate[];
  instructor_links: CourseInstructorLinkRead[];
}

export interface CourseCreate {
  name: string;
  description: string | null;
  status: CourseStatus | null;            // FE manda siempre "active" por defecto
  recurrence: CourseRecurrence | null;
  duration_minutes: number;
  max_students: number | null;
  individual_cost: number | null;  // entero en CENTAVOS
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: ScheduleCreate[];
  instructor_links: CourseInstructorLinkCreate[];
}

export type CourseUpdate = CourseCreate;  // mismo shape

export interface ListCoursesParams {
  status?: CourseStatus | 'all';
  instructor?: string;          // búsqueda parcial por nombre del instructor (server-side)
  search?: string;              // búsqueda por nombre de la clase
  active?: boolean;
  skip?: number;
  limit?: number;
}

export interface EnrollmentCreate {
  course_id: number;
  student_id: number;
}

export interface EnrollmentUpdate {
  status: EnrollmentStatus | null;
  completion_date: string | null;
}

export interface EnrollmentRead {
  status: EnrollmentStatus | null;
  completion_date: string | null;
  course: CoursePublic;
  student: UserPublic;
  academy: AcademyPublic;
  waiting_position: number | null;
  waitlisted_at: string | null;
}

export interface ListEnrollmentsParams {
  course_id?: number;
  student_id?: number;
  status?: EnrollmentStatus;
  skip?: number;
  limit?: number;
}
```

> **Nota:** `UserRead.academy` ahora es `AcademyPublic` (incluye `id`), no `AcademyBase`. Actualiza también ese tipo si está desincronizado.

## 2. Extender `src/api.ts`

Agregar funciones siguiendo el mismo patrón de las existentes (uso de `authFetch`, `parseError`, `ApiError`):

```ts
listCourses(params: ListCoursesParams): Promise<CourseRead[]>
getCourse(id: number): Promise<CourseRead>
createCourse(payload: CourseCreate): Promise<CourseRead>
updateCourse(id: number, payload: CourseUpdate): Promise<CourseRead>
deleteCourse(id: number): Promise<CourseRead>

listEnrollments(params: ListEnrollmentsParams): Promise<EnrollmentRead[]>
createEnrollment(payload: EnrollmentCreate): Promise<EnrollmentRead>
updateEnrollment(course_id: number, student_id: number, payload: EnrollmentUpdate): Promise<EnrollmentRead>
deleteEnrollment(course_id: number, student_id: number): Promise<EnrollmentRead>
```

> **Importante:** Las rutas de enrollment usan **clave compuesta**: `/enrollments/{course_id}/{student_id}` para GET/PATCH/DELETE. NO uses un `id` simple.

---

# Layout y navegación

1. Agregar el link al sidebar en [src/components/Layout.tsx](src/components/Layout.tsx):
   - Texto: "Clases"
   - Ruta: `/classes`
   - Icono: nuevo `<CalendarIcon>` (ver sección "Iconos nuevos" abajo)
   - Posición: después de Estudiantes/Instructores

2. Agregar la ruta en [src/App.tsx](src/App.tsx):
   ```tsx
   <Route path="/classes" element={<Classes />} />
   ```

3. Crear el archivo [src/pages/Classes.tsx](src/pages/Classes.tsx) usando `<Layout title="Clases" actions={...}>`.

---

# Iconos nuevos

Agregar a [src/brand.tsx](src/brand.tsx) siguiendo el estilo de los existentes (SVG inline minimalista, `IconProps`):

- `CalendarIcon` — para sidebar y toggle de vista calendario
- `ListIcon` — para toggle de vista lista
- `ChevronLeftIcon` / `ChevronRightIcon` — navegación de semana en el calendario
- `MapPinIcon` — para campo "Ubicación" y filtro
- `ClockIcon` — para horarios
- `WarningIcon` — para alertas ámbar de conflicto

No instales librerías de iconos.

---

# Estilos nuevos

Agregar a [src/styles.css](src/styles.css) (NO crear archivos CSS por componente). Sugerencia de clases nuevas:

- `.view-toggle` — grupo de 2 botones (Calendario / Lista) con `--active`. Reusa el patrón de `.tab-group`.
- `.calendar-layout` — grid de 2 columnas: calendario (1fr) + lista de hoy (320px). Colapsa a 1 columna en pantallas <1100px.
- `.calendar` — wrapper con header de navegación y grilla.
- `.calendar__header` — flechas ‹ ›, label de semana, botón "Hoy".
- `.calendar__grid` — grid de 8 columnas (1 hora + 7 días) × N filas (bloques de 30 min de 07:00 a 22:00).
- `.calendar__day-header` — encabezado de cada columna con día + número de fecha.
- `.calendar__hour-label` — label de hora en la primera columna.
- `.calendar__cell` — celda vacía de la grilla.
- `.calendar__event` — bloque de clase posicionado absolutamente sobre la grilla. Fondo: `color-mix(in srgb, var(--color-primary) 18%, white)`, borde izquierdo: `var(--color-primary)`. Hover: aumenta saturación.
- `.calendar__event-title` / `.calendar__event-meta` — texto interno.
- `.day-list` — panel lateral del calendario con clases del día actual.
- `.day-list__item` — cada clase con hora, nombre, instructor, ubicación.
- `.alert--warning` — variante ámbar de `.alert` para warnings de conflicto. Fondo: `color-mix(in srgb, #f59e0b 15%, white)`, borde: `#f59e0b`.
- `.repeater` — wrapper para listas de horarios e instructores en formularios.
- `.repeater__row` — cada fila con campos + botón eliminar.
- `.repeater__add-btn` — botón "Agregar horario / instructor".
- `.enrollment-list` — lista de inscritos en el panel de detalle.
- `.enrollment-list__item` — cada inscrito con avatar (iniciales), nombre, badge de status, acción.
- `.waitlist-position` — chip con número de posición en la waitlist.

Extender `.badge` con variantes para `CourseStatus`:
- `.badge--course-active` (verde, igual a `.badge--active`)
- `.badge--course-draft` (azul-gris)
- `.badge--course-archived` (gris, igual a `.badge--inactive`)

Y para `EnrollmentStatus`:
- `.badge--enrolled` (verde)
- `.badge--waiting` (ámbar)
- `.badge--completed` (azul-gris)
- `.badge--cancelled` (gris)

Crea un componente `<CourseStatusBadge status>` y `<EnrollmentStatusBadge status>` en [src/components/](src/components/) siguiendo el patrón de `<StatusBadge>`.

---

# Vista principal — `/classes`

## Header

```tsx
<Layout title="Clases" actions={
  <>
    <ViewToggle value={view} onChange={setView} />
    <button className="btn btn--primary" onClick={openCreatePanel}>
      <PlusIcon size={14} /> Crear Clase
    </button>
  </>
}>
```

El toggle persiste en `localStorage` con la clave `classes_view` (`"calendar"` | `"list"`). Default: `"calendar"`.

## Tarjetas de resumen (`.summary-grid`)

3 KPIs:

1. **Clases activas** — count de cursos con `status=active` (de la lista filtrada).
2. **Sesiones esta semana** — suma total de schedules de cursos activos cuya recurrencia los hace caer en la semana visible (todas las weekly + las one_time con `start_date` en la semana).
3. **Instructores asignados** — count de instructores únicos en cursos activos.

## Barra de filtros (`.filter-bar`)

- **Búsqueda por nombre** (`.search-input`) — query param `?search=`. Debounce 300ms.
- **Filtro por instructor** — input de texto con icono de búsqueda — query param `?instructor=` (búsqueda parcial server-side por nombre del instructor). Debounce 300ms.
- **Filtro por ubicación** — input de texto — **client-side** (filtra el resultado de la API en memoria sobre `course.location`). No hay query param de location en el backend.
- **Selector de estado** (`.tab-group`):
  - `Activas` (default — manda `?status=active`)
  - `Borrador` (`?status=draft`)
  - `Archivadas` (`?status=archived`)
  - `Todas` (no manda `status`)

Llamar `listCourses` cuando cambien los filtros server-side. El filtro de ubicación NO dispara llamada nueva.

## Estados de UI

Loading, error y vacío en ambas vistas. Mensajes en español. Patrón:

```tsx
if (error) return <div className="alert" role="alert">{error}</div>;
if (loading) return <div className="loading-row"><SpinnerIcon size={16} /> Cargando clases…</div>;
if (courses.length === 0) return <div className="empty-state"><p className="empty-state__title">Sin clases que coincidan con los filtros</p></div>;
```

---

# Vista calendario (default)

Layout dos columnas: calendario izquierda + lista del día derecha.

## Calendario semanal

- Encabezado: ‹ flecha izquierda · "Semana del 12 al 18 de mayo de 2026" · flecha derecha › · botón "Hoy" (regresa a la semana actual).
- Grilla: 7 columnas (Lun → Dom) × bloques de 30 min de 07:00 a 22:00.
- Cabecera de columna: nombre del día + número de fecha (resaltar el día actual con tinte primary).
- Cada clase activa se renderiza como `<button class="calendar__event">`:
  - Posición: `top` = (hora_inicio − 07:00) en bloques de 30 min; `height` = `duration_minutes` proporcional.
  - Si `recurrence=weekly`, una instancia por cada `schedule_day` en la semana.
  - Si `recurrence=one_time`, una sola instancia si `start_date` cae en la semana visible.
  - Si una clase tiene varios schedules el mismo día, renderiza un evento por cada uno.
  - Click → abre el panel "Ver Detalles".
  - Mostrar dentro del bloque: nombre de la clase, hora de inicio, primer instructor (si hay).
  - Si dos eventos se solapan en el mismo día, dividir el ancho de la columna entre ellos (estilo Google Calendar).

## Panel lateral derecho — Clases de hoy

`<aside class="day-list">`:

- Título: "Hoy — lunes 18 de mayo"
- Lista ordenada por hora ascendente de las clases del día actual:
  - Hora (HH:mm)
  - Nombre de la clase
  - Instructor principal (primer `instructor_links` con `type="instructor"`)
  - Ubicación (si hay)
- Click en cualquier item → abre "Ver Detalles".
- Si no hay clases: "Sin clases programadas para hoy".

---

# Vista lista

Tabla `users-table` (reusa la clase) con columnas:

| Nombre | Horarios | Duración | Instructores | Ubicación | Cupos | Estado | Acciones |
|--------|----------|----------|--------------|-----------|-------|--------|----------|

- **Horarios**: chips compactos `L 18:00`, `X 19:30` (1 letra del día + hora). Si recurrencia es `one_time`, mostrar solo la fecha.
- **Duración**: `60 min` (o `1h 30min` si > 60).
- **Instructores**: avatares apilados (iniciales) con tooltip de nombre. Asistentes con borde más sutil.
- **Cupos**: `12 / 20` o `12` si no hay `max_students`. Mostrar count real con `listEnrollments({ course_id, status: 'active' })` — pero NO hagas N+1 al cargar la lista; trae todos los enrollments activos en una sola llamada (`listEnrollments({ status: 'active' })`) y agrupa por `course.id`. Si esto es lento en el futuro, optimizar.
- **Estado**: `<CourseStatusBadge status={course.status} />`.
- **Acciones** (`.row-actions > .icon-btn`):
  - `<PencilIcon>` Editar → abre panel Editar
  - `<EyeIcon>` Ver detalles → abre panel Ver
  - `<TrashIcon>` Eliminar → modal confirm (variante `--danger`)

---

# Panel lateral: Crear Clase

Endpoint: `POST /courses` — `Authorization: Bearer <token>`

Usar `<SidePanel open title="Crear clase" subtitle="..." footer={...} onClose={...}>` — ancho similar al de Crear Estudiante. Footer con botones "Cancelar" y "Crear clase".

Estructura del formulario (secciones visualmente separadas con título `<h3>` en `--font-display`):

## Sección 1: Información general

- Nombre (`name`) — requerido
- Descripción (`description`) — `<textarea>`, opcional
- Ubicación (`location`) — input texto, opcional
- Recurrencia (`recurrence`) — radio buttons en línea: `Semanal` (default) | `Sesión única`

## Sección 2: Programación

- Duración (`duration_minutes`) — input number, requerido, sufijo "minutos"
- Fecha de inicio (`start_date`) — date picker, **opcional** (no defaultear a hoy — déjalo vacío y muestra placeholder "Elige una fecha")
- Fecha de fin (`end_date`) — date picker, opcional
- **Horarios** (`schedules[]`) — repeater:
  - Si `recurrence=weekly`: permite múltiples filas. Cada una: `<select>` de día + `<input type="time">`. Botón "+ Agregar horario".
  - Si `recurrence=one_time`: una sola fila, sin botón agregar. El input de día se reemplaza por la fecha (que ya está en `start_date`).
  - Validación: al menos 1 horario es requerido si la clase es `weekly`.

## Sección 3: Capacidad y costo

- Cupo máximo (`max_students`) — input number, opcional, hint: "Dejar vacío para cupo ilimitado"
- Costo individual (`individual_cost`) — input number con `step="0.01"`, opcional, prefijo con símbolo de la moneda de la academia.
  - **El backend almacena el monto como entero en CENTAVOS.** El input muestra el valor en unidades decimales (ej. `1499.99`); convertir a centavos con `toCents()` antes de mandar al API y desde centavos con `fromCents()` al pre-llenar en edición. Ver sección "Moneda" para los helpers.

## Sección 4: Instructores

`instructor_links[]` — repeater. Una fila por instructor/asistente. Botón "+ Agregar instructor".

Cada fila tiene 3 campos en línea:

1. **Instructor** (`instructor_id`) — input con autocomplete:
   - Al escribir, llama `listUsers({ role: 'instructor', search: query })` con debounce 250ms.
   - Muestra dropdown con `first_name + last_name`. Click selecciona.
   - Una vez seleccionado, muestra el nombre como pill con botón "×" para cambiar.
   - No permitir agregar el mismo instructor dos veces en la misma clase.

2. **Tipo** (`type`) — `<select>`:
   - Opciones: "Instructor" (`instructor`, default) | "Asistente" (`assistant`)
   - **Comportamiento default:** al agregar una fila nueva, el tipo se selecciona automáticamente como `instructor`.

3. **Tarifa por hora** (`hourly_rate`) — input number con `step="0.01"`, opcional, prefijo con símbolo de moneda:
   - **El campo se almacena en CENTAVOS en el backend.** El input muestra el valor en unidades decimales (ej. `250.00`); usar `toCents()` al enviar y `fromCents()` al pre-llenar/comparar con defaults. Ver sección "Moneda".
   - **Comportamiento default por academia:**
     - Si la academia tiene `default_instructor_hourly_rate` (en `/me`, viene en centavos), pre-llena el campo cuando el tipo es `instructor` y el campo está vacío o el usuario aún no lo ha tocado manualmente. La pre-carga convierte de centavos a decimales para mostrar en el input.
     - Lo mismo con `default_assistant_hourly_rate` cuando el tipo es `assistant`.
     - Si el usuario cambia el tipo (de instructor a asistente o viceversa) y NO ha tocado el campo manualmente, recalcula al nuevo default.
     - Si el usuario lo ha tocado (escrito o borrado), respeta lo que él puso — no lo sobrescribas.
   - Hint debajo: "Tarifa por defecto: $X/h" si hay default (formatear con `formatMoney`). Si no hay default, sin hint.
   - Para tracking del estado "tocado": guarda un flag `userEditedRate` por fila.

Validación final del form:
- `name`, `duration_minutes` requeridos.
- Al menos 1 horario si `recurrence=weekly`.
- Cada fila de instructor requiere un `instructor_id` seleccionado.

## Submit

El FE manda siempre `status: "active"` en el payload (default acordado). El BE lo acepta tal cual.

```ts
const payload: CourseCreate = {
  name, description, status: "active", recurrence,
  duration_minutes, max_students, individual_cost, location,
  start_date, end_date,
  schedules: [...],            // ScheduleCreate[] sin course_id
  instructor_links: [...]      // CourseInstructorLinkCreate[] sin course_id ni academy_id
};
```

Antes de enviar, ejecutar la **validación de conflictos** (ver sección "Warnings de conflicto"). Si hay conflictos, mostrar warnings ámbar pero NO bloquear el envío. El botón principal cambia su label a "Crear de todas formas" y aparece un secundario "Revisar" que enfoca el primer conflicto.

Respuesta 201: `CourseRead` — cierra el panel, mostrar toast `.alert--success` "Clase creada", agrega el curso a la lista local sin recargar.
Error 422: mostrar `err.fieldErrors[campo]` debajo de cada campo correspondiente.
Otros errores: mostrar `err.message` en `.alert` arriba del formulario.

---

# Panel lateral: Editar Clase

Endpoint: `PATCH /courses/{id}` — body `CourseUpdate` (mismo shape que Create).

> **Importante — comportamiento de PATCH para arrays embebidos:** El backend reemplaza completamente los arrays `schedules` e `instructor_links` con lo que recibe. NO hace diff/merge. El FE debe **mandar la lista completa** de horarios e instructores cada vez, incluso si solo cambió uno. Esto simplifica el FE: trabajar con copia local del array y mandar al PATCH tal cual.

Mismo formulario que Crear, con un campo adicional al final:

## Sección 5: Estado (solo en edición)

- **Estado** (`status`) — `<select>`:
  - "Activa" (`active`)
  - "Borrador" (`draft`)
  - "Archivada" (`archived`)

Pre-llenar todos los campos con el `CourseRead` actual. Para `instructor_links`, mapear de `CourseInstructorLinkRead` (con `instructor` embebido) a las filas del repeater (manteniendo el nombre para mostrar) y al enviar, transformar a `CourseInstructorLinkCreate[]` (solo `instructor_id`, `type`, `hourly_rate`).

Respuesta 200: `CourseRead` — actualiza la fila en la lista sin recargar, refresca el calendario.

---

# Panel lateral: Ver Detalles

Endpoint: `GET /courses/{id}` y `GET /enrollments?course_id={id}` (ambos en paralelo al abrir).

Vista read-only con todos los campos en `.detail-list > .detail-item`. Botones en footer:

- **Editar** → cierra este panel, abre el de Editar
- **Eliminar** → modal de confirmación

Secciones del detalle:

1. **Información general** — nombre, descripción, ubicación, recurrencia, status (badge)
2. **Programación** — duración, fechas, horarios (lista visual con días + horas)
3. **Capacidad y costo** — `X / max_students` inscritos, costo individual formateado con moneda
4. **Instructores** — lista con avatar (iniciales), nombre, tipo (badge "Instructor" / "Asistente"), tarifa por hora si está definida

## Sección de inscripciones (en el mismo panel)

`<section class="enrollment-list">`:

### Inscritos activos

Header: "Inscritos · X" + botón `<PlusIcon>` "Inscribir alumno".

Lista de `EnrollmentRead` con `status="active"` para este curso:
- Avatar (iniciales del estudiante)
- Nombre completo (`student.first_name + student.last_name`)
- Botón `<TrashIcon>` "Quitar" (con `<ConfirmModal>` antes de ejecutar)

Si está vacío: "Sin alumnos inscritos."

Si `course.max_students` está definido y `inscritos.length >= max_students`, mostrar chip "Cupo lleno — los nuevos pasan a lista de espera" sobre el botón.

### Lista de espera

Header: "En espera · X" (solo visible si hay enrollments con `status="waiting"`).

Lista ordenada por `waiting_position` ascendente:
- Chip `.waitlist-position` con el número de posición
- Avatar + nombre
- Botón `<TrashIcon>` "Quitar"

> No hay botón "promover" — el backend lo hace automáticamente cuando se cancela un activo.

## Inscribir alumno

Al hacer click en "Inscribir alumno", abrir un sub-panel (o modal pequeño) con:
- Input de búsqueda de alumno: `listUsers({ role: 'student', search: query })` con debounce 250ms.
- Dropdown de resultados; click selecciona.
- Antes de enviar, ejecutar **warning de conflicto del alumno** (ver sección de warnings).
- POST `/enrollments` con `{ course_id, student_id }`. El BE decide si va a `active` o `waiting` según el cupo.
- Refrescar la sección de inscripciones.

## Quitar inscripción

DELETE `/enrollments/{course_id}/{student_id}`. Confirmar con `<ConfirmModal danger>` — "¿Quitar a {nombre} de la clase?". Si era `status="active"` y había waitlist, el BE promueve automáticamente al primero — refresca la sección al recibir la respuesta.

---

# Eliminar Clase

Endpoint: `DELETE /courses/{id}` — `Authorization: Bearer <token>`

Antes de ejecutar, mostrar `<ConfirmModal danger title="Eliminar clase" message="¿Eliminar la clase '{nombre}'? Esta acción no se puede deshacer y eliminará también todas las inscripciones." confirmLabel="Eliminar" />`.

Respuesta 200: elimina la fila de la lista local, refresca el calendario, muestra toast `.alert--success` "Clase eliminada".

---

# Warnings de conflicto (no bloqueantes)

Tres tipos. Todos se computan **client-side** sobre la lista de cursos activos ya cargada (no hagas llamadas extra).

## 1. Conflicto de instructor (al crear/editar clase)

Para cada instructor en `instructor_links` del form:
- Recorrer todos los cursos activos cargados (excluyendo el que se edita).
- Para cada curso donde ese instructor también está asignado, comparar sus `schedules` con los del form actual.
- Detectar solape: mismo `schedule_day` y los rangos `[time, time + duration]` se intersectan.

Mensaje: "{Nombre Instructor} ya imparte '{Otra Clase}' los {día} de {HH:mm} a {HH:mm}."

## 2. Conflicto de ubicación (al crear/editar clase)

Si el form tiene `location` no vacía:
- Recorrer cursos activos (excluyendo el actual) con la misma `location` (comparación case-insensitive y trim).
- Detectar solape de schedules igual que arriba.

Mensaje: "La ubicación '{Location}' ya tiene clase '{Otra Clase}' los {día} de {HH:mm} a {HH:mm}."

## 3. Conflicto de horario del alumno (al inscribir)

Antes de hacer POST `/enrollments`:
- Llamar `listEnrollments({ student_id, status: 'active' })` para obtener inscripciones activas del alumno.
- Para cada inscripción, buscar el curso correspondiente en la lista local de cursos activos.
- Detectar solape de schedules con el curso al que se está inscribiendo.

Mensaje: "{Nombre Alumno} ya está inscrito en '{Otra Clase}' los {día} de {HH:mm} a {HH:mm}."

## Renderizado de warnings

- Aparecen como `.alert.alert--warning` (variante ámbar) arriba del formulario o el botón de inscribir, antes del submit.
- Contenido: icono `<WarningIcon>` + lista de mensajes.
- **No bloquean.** El botón principal cambia su label a "{acción} de todas formas" (ej. "Crear de todas formas", "Inscribir de todas formas") y aparece un botón secundario "Revisar".
- Al hacer click en "Revisar", el formulario hace scroll/foco al primer campo conflictivo (ej. el repeater de horarios).
- Si el usuario corrige y los warnings desaparecen, el botón vuelve a su label normal.

---

# Tarifas por defecto de la academia

Leer de `me.academy.default_instructor_hourly_rate` y `me.academy.default_assistant_hourly_rate` (ambos `number | null`, **enteros en centavos**). Estos vienen de `GET /me`. Convertir con `fromCents()` antes de pre-llenar el input del repeater.

Aplicación en el repeater de instructores del formulario:
- Al **agregar** una fila nueva: pre-llenar `hourly_rate` con el default de `instructor` (si existe), marcar `userEditedRate = false`.
- Al **cambiar el tipo** de una fila existente y `userEditedRate === false`: recalcular `hourly_rate` al default del nuevo tipo.
- Al **escribir o borrar** el `hourly_rate` manualmente: marcar `userEditedRate = true`. A partir de ese momento, no sobrescribir.

Debajo del input mostrar hint:
- Si hay default y `userEditedRate === false`: "Tarifa por defecto de {tipo}: {$X/h}. Cámbiala si esta clase usa otra."
- Si hay default y `userEditedRate === true`: "Tarifa por defecto de {tipo}: {$X/h}." (sin la segunda frase)
- Si no hay default: sin hint.

---

# Moneda

Leer `me.academy.currency` (string ISO 4217, default `"USD"` del backend).

## Convención de almacenamiento

**Todos los campos monetarios del backend están en CENTAVOS (entero).** Esto aplica a:
- `individual_cost` en `Course*`
- `hourly_rate` en `CourseInstructorLink*`
- `default_instructor_hourly_rate` y `default_assistant_hourly_rate` en `AcademyMe`
- (a futuro: cualquier `amount` de transacciones, etc.)

Ejemplo: $1,499.99 se almacena como `149999`. Esto evita errores de redondeo flotante y unifica el manejo de moneda en toda la app.

## Helpers obligatorios (crear en `src/utils/money.ts`)

```ts
/** Convierte centavos a unidades decimales para mostrar/editar en inputs. */
export function fromCents(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

/** Convierte unidades decimales (de un input) a centavos enteros para enviar al API. */
export function toCents(amount: number | string | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

/** Formatea un monto en CENTAVOS como string de moneda localizado. */
export function formatMoney(cents: number | null | undefined, currency: string | null): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format(cents / 100);
}
```

## Reglas de uso

- **Display de cualquier monto:** `formatMoney(course.individual_cost, academy.currency)` → `"$1,499.99"`
- **Pre-llenar inputs en edición:** `fromCents(course.individual_cost)` → muestra `1499.99` en el `<input type="number" step="0.01">`
- **Submit de formularios:** `toCents(formValue)` antes de incluir el campo en el payload del POST/PATCH
- **Comparaciones y cálculos:** trabajar siempre en centavos enteros, nunca en decimales

---

# Referencia de API — resumen

Todas las rutas requieren `Authorization: Bearer <access_token>` y `Content-Type: application/json`. El token se lee de `localStorage` bajo la clave `access_token` (ver `getToken()` en [src/api.ts](src/api.ts)).

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| GET    | `/courses` | — | `CourseRead[]` |
| POST   | `/courses` | `CourseCreate` | `CourseRead` (201) |
| GET    | `/courses/{id}` | — | `CourseRead` |
| PATCH  | `/courses/{id}` | `CourseUpdate` | `CourseRead` |
| DELETE | `/courses/{id}` | — | `CourseRead` |
| GET    | `/enrollments` | — | `EnrollmentRead[]` |
| POST   | `/enrollments` | `EnrollmentCreate` | `EnrollmentRead` (201) |
| GET    | `/enrollments/{course_id}/{student_id}` | — | `EnrollmentRead` |
| PATCH  | `/enrollments/{course_id}/{student_id}` | `EnrollmentUpdate` | `EnrollmentRead` |
| DELETE | `/enrollments/{course_id}/{student_id}` | — | `EnrollmentRead` |

**Query params de `GET /courses`:**

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `status` | `CourseStatus` | — | Filtra por status. Omitir para "Todas". |
| `instructor` | string | — | Búsqueda parcial por nombre del instructor (server-side). |
| `search` | string | `""` | Busca en nombre de la clase. |
| `active` | boolean | `true` | Filtro general de activo. |
| `skip`, `limit` | int | `0`, `100` | Paginación. |

**Query params de `GET /enrollments`:**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `course_id` | int | Filtra por curso. |
| `student_id` | int | Filtra por alumno. |
| `status` | `EnrollmentStatus` | Filtra por estado de inscripción. |
| `skip`, `limit` | int | Paginación. |

**Comportamiento que asume el FE (implementado en backend):**
- `POST /enrollments`: si `course.max_students` está definido y los activos ≥ max, el BE crea la inscripción en `status="waiting"` con el siguiente `waiting_position` automáticamente. El FE solo manda `course_id` + `student_id`.
- `DELETE /enrollments/{course_id}/{student_id}`: si la inscripción borrada era `status="active"`, el BE promueve automáticamente al primero de la lista de espera.

---

# Configuración

```env
VITE_API_URL=http://127.0.0.1:8000/
```

Ya está configurado. No hardcodear URLs.

---

# Reglas de implementación

1. **Sigue [STYLE_GUIDE.md](STYLE_GUIDE.md)** estrictamente — clases CSS centralizadas en [src/styles.css](src/styles.css), iconos en [src/brand.tsx](src/brand.tsx), tokens CSS para colores.
2. **No instalar dependencias nuevas.** React + React Router + el CSS nativo bastan. Si necesitas un date picker, usa `<input type="date">`.
3. **Estados de UI completos** — loading, error, vacío en cada lista y cada llamada al API.
4. **Validación client-side** antes de cada submit.
5. **Accesibilidad** — labels asociados a inputs, foco visible, roles ARIA, navegación por teclado en el calendario (flechas para mover semana, Enter para abrir evento).
6. **Manejo de errores** — usa el patrón existente:
   ```ts
   try { ... } catch (err) {
     if (err instanceof ApiError) { setPanelApiError(err); setPanelError(err.message); }
     else { setPanelError('Mensaje genérico en español.'); }
   }
   ```
7. **Toasts de éxito** con `.alert.alert--success` con auto-dismiss 4s (ver `showToast` en [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx)).
8. **Confirmaciones destructivas** con `<ConfirmModal danger>`.
9. **Persistencia del toggle de vista** en `localStorage` con clave `classes_view`.
10. **No crees CSS por componente.** Si un patrón se repite, agrégalo a [src/styles.css](src/styles.css).
11. **Sin emojis en la UI.** Sin hex hardcodeados para primary/secondary/accent.
12. **Token** — usa `getToken()` de [src/api.ts](src/api.ts).

---

# Entregables esperados

- [ ] [src/types.ts](src/types.ts) actualizado con `AcademyMe` (campos nuevos), `CoursePublic`, `AcademyPublic`, `ScheduleCreate`, `CourseInstructorLinkCreate`, `CourseInstructorLinkRead`, `CourseRead`, `CourseCreate`, `CourseUpdate`, `ListCoursesParams`, `EnrollmentCreate`, `EnrollmentUpdate`, `EnrollmentRead`, `ListEnrollmentsParams`. `UserRead.academy` corregido a `AcademyPublic`.
- [ ] [src/api.ts](src/api.ts) extendido con `listCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`, `listEnrollments`, `createEnrollment`, `updateEnrollment`, `deleteEnrollment`.
- [ ] [src/brand.tsx](src/brand.tsx) extendido con `CalendarIcon`, `ListIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `MapPinIcon`, `ClockIcon`, `WarningIcon`.
- [ ] [src/styles.css](src/styles.css) extendido con clases para calendario, repeater, enrollment-list, alert--warning, badges nuevos.
- [ ] [src/components/Layout.tsx](src/components/Layout.tsx) con link "Clases" en el sidebar.
- [ ] [src/App.tsx](src/App.tsx) con ruta `/classes`.
- [ ] [src/components/CourseStatusBadge.tsx](src/components/CourseStatusBadge.tsx) y [src/components/EnrollmentStatusBadge.tsx](src/components/EnrollmentStatusBadge.tsx).
- [ ] [src/pages/Classes.tsx](src/pages/Classes.tsx) — página principal con toggle calendario/lista, KPIs, filtros, tabla y calendario.
- [ ] Componentes de soporte (split en archivos según convenga):
  - `<CalendarView>` — vista calendario con la grilla y eventos.
  - `<DayList>` — panel lateral del calendario con clases del día.
  - `<CourseListView>` — vista de tabla.
  - `<CourseFormPanel>` — panel de Crear/Editar (parametrizable por modo).
  - `<CourseDetailPanel>` — panel de Ver detalles con sección de inscripciones.
  - `<InstructorRepeater>` — repeater de instructores con autocomplete y default de tarifa.
  - `<ScheduleRepeater>` — repeater de horarios.
  - `<EnrollmentSection>` — sección de inscripciones dentro del detalle.
- [ ] Lógica de detección de conflictos (puede vivir en `src/utils/conflicts.ts` o similar) — funciones puras testeables.
- [ ] Helpers de fecha/hora para el calendario en `src/utils/calendar.ts` (semana actual, navegación, formato de horas, intersección de rangos).
- [ ] Helpers de moneda en `src/utils/money.ts` con `fromCents`, `toCents` y `formatMoney`. Usarlos consistentemente en TODA la app a partir de ahora — no solo en este módulo.

---

# Notas finales para el desarrollador

- **El backend ya está al 100% para este módulo** — todos los endpoints, schemas y comportamientos descritos aquí están implementados y verificados contra [openapi.json](openapi.json). Si algo no funciona como dice este documento, repórtalo antes de hacer workarounds.
- **El módulo de Clases NO sigue el patrón `UsersModule`** — es un módulo nuevo. Pero sí reusa `<Layout>`, `<SidePanel>`, `<ConfirmModal>`, las clases CSS y los iconos del brand.
- **Prioridad de entrega:** primero la vista lista (más simple, valida el CRUD completo), después el calendario, después las inscripciones. Si te quedas sin tiempo, mejor entregar lista + CRUD + inscripciones bien hechos que calendario a medias.
- Cuando termines, prueba el flujo completo en el navegador: crear una clase con varios horarios + 2 instructores + 1 asistente, editar para mover horario y disparar warning, inscribir alumnos hasta llenar el cupo y ver waitlist, cancelar un activo y ver promoción automática del primero de la espera.
