# Prompt — Acceso de Instructor (Inicio, Clases, Configuración)

> Antes de tocar código, lee siempre: [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts), [src/auth.tsx](src/auth.tsx), [src/routing.tsx](src/routing.tsx), [src/components/Layout.tsx](src/components/Layout.tsx), [src/pages/StudentHome.tsx](src/pages/StudentHome.tsx), [src/pages/StudentClasses.tsx](src/pages/StudentClasses.tsx), [src/pages/StudentConfig.tsx](src/pages/StudentConfig.tsx), [src/components/StudentCourseDetail.tsx](src/components/StudentCourseDetail.tsx).

---

## 1. Contexto del proyecto

Cantera es el SaaS de gestión de academias. Este módulo **habilita al rol `instructor` para tener sus propias 3 pantallas** (Inicio, Clases, Configuración), análogas a las del estudiante pero con contenido distinto: el instructor ve sus clases asignadas, sus alumnos, su pago calculado, y puede pasar lista. **No es un módulo CRUD nuevo** — no parametrices `UsersModule.tsx`. El patrón a seguir es el del estudiante: routes propias, sidebar filtrado, páginas dedicadas y componentes reusables (Layout, SidePanel, ConfirmModal).

Cambio adicional importante: hoy el instructor está dentro de `ADMIN_ROLES` y ve `/students`, `/instructors`, `/classes` (vistas de admin). Hay que **quitarlo** de ese set y darle solo sus 3 rutas.

## 2. Identidad visual

Se siguen tokens y reglas de [STYLE_GUIDE.md](STYLE_GUIDE.md). Se reusan:

- `.summary-grid` + `.summary-card` para KPIs.
- `.home-grid` (creada en el módulo de estudiante) para layout 2-col en Inicio.
- `.tab-group` para sub-navegación si hace falta.
- `.users-table`, `.table-wrapper`, `.empty-state`, `.loading-row`, `.alert` para listas.
- `.detail-list` + `.detail-item` para vistas read-only.
- `<SidePanel>`, `<ConfirmModal>`, `<StatusBadge>`.

**Clases CSS nuevas** (agregar en [src/styles.css](src/styles.css)):

- `.home-payouts-section` + `.home-payouts-section__title` + `.home-payouts-row` para los dos sub-bloques (pendiente / realizados) en la columna derecha de Inicio.
- `.home-classes-card` + `.home-classes-card__title` + `.home-classes-card__time` + `.home-classes-card__cta` para las tarjetas simples de clases en columna izquierda de Inicio.
- `.attendance-matrix-wrapper` (overflow-x permitido **solo** en esta tabla), `.attendance-matrix` (table), `.attendance-matrix__cell--present|--absent|--excused` (color tints con `color-mix` sobre `--color-primary` / `--color-danger`).
- `.config-section` (reutilizar de StudentConfig si ya existe).

**Iconos**: todos los que se necesitan ya existen en [src/brand.tsx](src/brand.tsx) (HomeIcon, GraduationIcon, SettingsIcon, CheckIcon, ArrowRightIcon, SpinnerIcon, EyeIcon, PencilIcon, etc.). No instalar libs.

**Regla dura**: en escritorio, el `.home-grid` no genera scroll horizontal. La única zona con scroll-x permitido es `.attendance-matrix-wrapper`.

## 3. Enums

Ya existen en `openapi.json`:

| Enum | Valores | Label español |
|---|---|---|
| `InstructorType` | `instructor` | "Instructor" |
| | `assistant` | "Asistente" |
| `AttendanceStatus` | `present` | "Presente" |
| | `absent` | "Ausente" |
| | `excused` | "Justificado" |
| `AttendanceRole` | `instructor` / `assistant` / `student` | (mismo que arriba) |
| `TransactionCategory` | `salary` | "Nómina" |
| `TransactionStatus` | `pending` | "Pendiente" |
| | `scheduled` | "Programado" |
| | `paid` | "Pagado" |
| | `cancelled` | "Cancelado" |

Centralizar labels en utilidades existentes ([src/utils/attendanceLabels.ts](src/utils/attendanceLabels.ts), [src/utils/transactionLabels.ts](src/utils/transactionLabels.ts)); **agregar** lo que falte (`InstructorType` → `instructorTypeLabel` en `src/utils/instructorTypeLabels.ts`).

## 4. Sincronización de tipos y API service

Asume que el BE ya implementó BE-1 a BE-5 (campo `credentials`, `PATCH /me`, `/me/home` role-aware, `/courses/{id}/attendance-matrix`, filtrado de `hourly_rate` por rol). El detalle de cada cambio BE está al final de este documento.

### 4.1 `src/types.ts`

**Modificar** los tipos existentes:

```ts
// UserMe — añadir credentials (opcional)
export interface UserMe {
  // ...campos actuales...
  credentials: string | null;
}

// UserRead — añadir credentials
export interface UserRead {
  // ...campos actuales...
  credentials: string | null;
}

// UserUpdate — añadir credentials
export interface UserUpdate {
  // ...campos actuales...
  credentials?: string | null;
}

// HomeMe — añadir campos opcionales de instructor
export interface HomeMe {
  user: UserRead;
  // existing student-only:
  enrolled_courses: CourseRead[];
  pending_transactions: TransactionRead[];
  scheduled_transactions: TransactionRead[];
  attendance_summary: AttendanceMe | null;
  next_session: NextSessionMe | null;
  // NUEVOS, null cuando role != instructor:
  instructor_kpis: HomeMeInstructorKpis | null;
  assigned_courses: AssignedCourseRead[];
  payouts: HomeMePayouts | null;
}
```

**Agregar** estos tipos nuevos:

```ts
export interface HomeMeInstructorKpis {
  active_courses: number;
  total_students: number;
  hours_this_month: number;
  pending_amount: number; // cents
}

export interface AssignedCourseRead {
  course: CoursePublic;                 // { id, name, description }
  next_session_datetime: string | null; // ISO
  has_active_session: boolean;
}

export interface HomeMePayouts {
  pending: TransactionRead[];
  scheduled: TransactionRead[];
  paid_recent: TransactionRead[];
}

export interface AttendanceCell {
  scheduled_datetime: string; // ISO
  status: AttendanceStatus;
}

export interface StudentAttendanceRow {
  id: number;
  first_name: string;
  last_name: string;
  special_conditions: string | null;
  attendance_pct: number | null;
  attendance: AttendanceCell[];
}

export interface AttendanceMatrixRead {
  course: CourseRead;                 // sin individual_cost (BE-5 lo omite por rol)
  capacity: { enrolled: number; max: number };
  sessions: string[];                 // ISO datetimes, asc
  students: StudentAttendanceRow[];
}

// Ya existen en openapi.json — exponer si no están:
export interface InstructorPmtRead {
  total_minutes: number;
  total_hours: number;
  total_payment: number; // cents
  by_course: CoursePmtRead[];
}

export interface CoursePmtRead {
  course_id: number;
  course_name: string;
  attendance_role: AttendanceRole;
  sessions: number;
  minutes: number;
  hours: number;
  hourly_rate: number; // cents/hr
  payment: number;     // cents
}
```

### 4.2 `src/api.ts`

**Agregar**:

```ts
// PATCH /me — self-update (reemplaza el patrón anterior de PATCH /users/{me.id})
export async function updateMe(patch: UserUpdate): Promise<UserMe> { /* ... */ }

// GET /courses/{id}/attendance-matrix
export async function getCourseAttendanceMatrix(
  courseId: number,
  params?: { from_date?: string; to_date?: string }
): Promise<AttendanceMatrixRead> { /* ... */ }

// GET /users/{id}/instructor-pmt — ya documentado en openapi; exponer si no está
export async function getInstructorPayment(
  userId: number,
  params?: { from_date?: string; to_date?: string }
): Promise<InstructorPmtRead> { /* ... */ }
```

`getMeHome` ya existe (devuelve `HomeMe`) — el shape ahora trae los campos extra cuando `role=instructor`, no requiere endpoint nuevo.

Todos los endpoints lanzan `ApiError` con `.message`, `.status`, `.detail`.

## 5. Modelo de datos / reglas de negocio

### 5.1 Routing y permisos por rol

En [src/App.tsx](src/App.tsx):

1. **Quitar** `'instructor'` del array `ADMIN_ROLES`. Queda `['admin', 'receptionist'] as const`. Esto remueve el acceso del instructor a `/students`, `/instructors`, `/classes`.

2. **Cambiar** las rutas `/inicio`, `/clases`, `/configuracion` para que `allow={['student', 'instructor']}` y rendericen un **dispatcher** que decide qué componente montar según `me.role`:

```tsx
function HomeDispatcher() {
  const { me } = useAuth();
  return me?.role === 'instructor' ? <InstructorHome /> : <StudentHome />;
}
function ClassesDispatcher() {
  const { me } = useAuth();
  return me?.role === 'instructor' ? <InstructorClasses /> : <StudentClasses />;
}
function ConfigDispatcher() {
  const { me } = useAuth();
  return me?.role === 'instructor' ? <InstructorConfig /> : <StudentConfig />;
}

<Route path="/inicio"        element={<RoleRoute allow={['student','instructor']}><HomeDispatcher /></RoleRoute>} />
<Route path="/clases"        element={<RoleRoute allow={['student','instructor']}><ClassesDispatcher /></RoleRoute>} />
<Route path="/configuracion" element={<RoleRoute allow={['student','instructor']}><ConfigDispatcher /></RoleRoute>} />
```

3. **Actualizar `DefaultRedirect`** en [src/routing.tsx](src/routing.tsx) para que `role=instructor` redirija a `/inicio` (igual que student). Admin/recep siguen a `/students`.

### 5.2 Sidebar (Layout.tsx)

En [src/components/Layout.tsx](src/components/Layout.tsx), la `<nav>` ya tiene una bifurcación `me?.role === 'student' ? <…> : <…>`. Convertirla en una bifurcación de **tres** ramas para que el instructor vea sus propios links:

- **student** (sin cambios): Inicio, Clases, Configuración.
- **instructor** (NUEVO): Inicio (`/inicio`, HomeIcon), Mis clases (`/clases`, GraduationIcon), Configuración (`/configuracion`, SettingsIcon).
- **admin / receptionist** (sin cambios): Estudiantes, Instructores, Clases, Ventas (Ventas solo admin/recep).

### 5.3 InstructorHome (`/inicio`) — Layout 2 columnas

Datos: una sola llamada `getMeHome()` al montar. De `HomeMe` se usan `instructor_kpis`, `assigned_courses`, `payouts`.

**KPIs (full-width arriba)** — 4 tarjetas en `.summary-grid`:

1. **Clases activas** → `instructor_kpis.active_courses`
2. **Total alumnos** → `instructor_kpis.total_students`
3. **Horas del mes** → `instructor_kpis.hours_this_month.toFixed(1)` + sufijo "h"
4. **Pago pendiente** → `formatMoney(fromCents(instructor_kpis.pending_amount))`

**Cuerpo (`.home-grid`)** — dos columnas equilibradas:

**Columna izquierda — "Mis clases"** (`section.home-classes-section`):
- Título "Mis clases".
- Lista de `.home-classes-card`, una por `assigned_courses[]`. Cada tarjeta contiene:
  - `course.name` (truncar a 30 chars con `…`)
  - `next_session_datetime` formateado como "Hoy 18:00", "Mañana 19:30", o "Vie 7 nov 18:00" según proximidad. Si es `null` → "Sin próxima sesión".
  - Botón `.btn .btn--primary .home-classes-card__cta`:
    - Si `has_active_session === true`: label "Pasar lista" + `<CheckIcon>`, habilitado, onClick → navega a `/clases?course={id}&action=attendance` (o abre directamente la pantalla de pasar lista del módulo de asistencia existente).
    - Si `false`: label "Próxima sesión", `disabled`, sin onClick.
- Si `assigned_courses` está vacío → `.empty-state` con "No tienes clases asignadas."
- Footer de la sección: `<button className="btn btn--ghost">Ver mis clases <ArrowRightIcon /></button>` → `navigate('/clases')`.

**Columna derecha — "Pagos"** (`section.home-payouts-section`):
- Dos sub-bloques separados visualmente:
  - **Pago pendiente** (`.home-payouts-section__title` "Pago pendiente"):
    - Concatenar `payouts.pending` y `payouts.scheduled`, ordenar por `transaction_date` asc.
    - Cada fila (`.home-payouts-row`): badge de estado + descripción (categoría label "Nómina" o `description` si existe) + fecha (`transaction_date`, formato corto "15 nov 2026") + monto (alineado a la derecha, `formatMoney(fromCents(...))`).
    - Si vacío → "No tienes pagos pendientes."
  - **Pagos realizados** (`.home-payouts-section__title` "Pagos realizados"):
    - `payouts.paid_recent`, ordenar por `paid_date` desc.
    - Mismo layout de fila pero con `paid_date` en lugar de `transaction_date`.
    - Si vacío → "Aún no hay pagos registrados."

**Estados**: loading inicial con `<SpinnerIcon>` + "Cargando…"; error con `.alert` y mensaje en español derivado de `ApiError.message`.

### 5.4 InstructorClasses (`/clases`)

Datos: en paralelo al montar:
1. `getMeHome()` → de ahí `assigned_courses[]` para nombres y `has_active_session`.
2. `getInstructorPayment(me.id)` (mes calendario corriente; default sin params trae todo) → `by_course[]` para sessions/hours/payment/hourly_rate/attendance_role por curso.

Unir por `course.id === by_course[].course_id`.

**UI**: 
- Sin KPIs.
- Tabla `users-table` con columnas: Curso · Horario · Rol · Sesiones (mes) · Horas (mes) · Tarifa/hr · Pago acumulado · Acción.
  - Curso: nombre del curso.
  - Horario: resumen formateado desde `course.schedules[]` (utility helper, ej. "Lun/Mié 18:00–19:30").
  - Rol: `<StatusBadge>` o badge custom con label `instructorTypeLabel(attendance_role)`.
  - Sesiones/Horas: del `CoursePmtRead`.
  - Tarifa/hr: `formatMoney(fromCents(hourly_rate))`.
  - Pago acumulado: `formatMoney(fromCents(payment))`.
  - Acción: `<button className="icon-btn"><EyeIcon /></button>` → abre `<InstructorCourseDetail>` (SidePanel) con `course_id`.
- Estados loading/empty/error.
- **Read-only**: no botón crear, no editar, no inscribir.

### 5.5 InstructorCourseDetail (SidePanel reusable)

Componente nuevo: [src/components/InstructorCourseDetail.tsx](src/components/InstructorCourseDetail.tsx).

Props: `{ courseId: number; open: boolean; onClose: () => void }`.

Al abrirse, hace `getCourseAttendanceMatrix(courseId)` (sin params → últimas 20 sesiones por default según BE-4).

**Contenido del panel** (en orden):

1. **Info del curso** (`.detail-list`):
   - Nombre, descripción, ubicación, duración (min), fechas inicio/fin, recurrencia.
   - **NO mostrar** `individual_cost`.
   - Cupo: `{capacity.enrolled} / {capacity.max}` (mostrar números exactos).
   - Horario formateado desde `course.schedules[]`.
2. **Matriz de asistencia** (`.attendance-matrix-wrapper > table.attendance-matrix`):
   - Header: primera columna sticky "Alumno" + columnas con fecha corta de cada sesión ("7 nov", "10 nov", …).
   - Última columna fija al final: "% Asistencia" (de `attendance_pct`).
   - Filas: una por estudiante (`students[]`).
     - Primera celda sticky: nombre completo. Debajo, si `special_conditions` no es null → pequeño badge con texto `"Condiciones: {special_conditions}"` (truncar a 60 chars + tooltip con el texto completo).
     - Celdas de sesión: cuadrito con clase `attendance-matrix__cell--present|--absent|--excused`; vacío con `—` si esa sesión no tiene registro para ese estudiante.
     - Última celda: porcentaje formateado.
   - Si `sessions` está vacío → estado "Aún no hay sesiones registradas en este curso."
3. **Filtro de rango** (encima de la matriz, opcional pero recomendado): dos inputs `type="date"` (Desde / Hasta) + botón "Aplicar" → re-fetch con nuevos params. Reusar clases `.field--row`.

**Estados**: loading dentro del panel (`<SpinnerIcon>`); error con `.alert`; empty manejado per-sección.

### 5.6 InstructorConfig (`/configuracion`)

Pantalla análoga a StudentConfig pero con campos distintos.

**Sección 1 — Perfil** (formulario):
- Editables: `first_name`, `last_name`, `phone`, `address`, `date_of_birth`, `credentials`.
- **No editables** (mostrar deshabilitados): `email`, `role` ("Instructor"), `academy.name`, `status`.
- **No mostrar**: `payment_method`, `special_conditions`, `hourly_rate` (este último vive por curso, no en User).
- `credentials`: `<textarea>` con label "Credenciales", hint "Ej. Cinta negra 4to dan, Conservatorio Nacional de Música, etc.", `maxLength={500}`.
- Submit → `updateMe(patch)`; muestra toast verde "Datos actualizados" (auto-dismiss 4s); refresca `me` en el AuthContext con la respuesta.

**Sección 2 — Cambiar contraseña**:
- Igual que StudentConfig: 3 campos (`current_password`, `new_password`, `confirm_password`), validación de match local, llamada `changeMyPassword()` (ya existe).
- Mensaje de error genérico (anti-enumeration).

**Sección 3 — Datos académicos** (read-only):
- Caja con `.detail-list`:
  - Email
  - Academia
  - Rol → "Instructor"
  - Fecha de alta (`start_date` si existe, formato "7 ene 2024")

## 6. UI / flujos por pantalla

| Pantalla | Endpoint(s) | Estados | Acciones |
|---|---|---|---|
| `/inicio` | `getMeHome()` | loading · empty (sin clases / sin pagos por sección) · error | Click CTA "Pasar lista" (si activa) → flujo de asistencia existente. CTA "Ver mis clases" → `/clases` |
| `/clases` | `getMeHome()` + `getInstructorPayment(me.id)` | loading · empty (sin clases asignadas) · error | Click row action "Ver detalle" → abre `<InstructorCourseDetail>` |
| `/clases` SidePanel | `getCourseAttendanceMatrix(courseId)` | loading · empty (sin sesiones) · error | Filtro rango → re-fetch. Cerrar panel con Esc / backdrop / X |
| `/configuracion` | `updateMe()` + `changeMyPassword()` | loading per submit · error per form | Submit perfil → toast verde. Submit password → toast verde + limpiar campos |

## 7. Ruta y navegación

- **Routes en [src/App.tsx](src/App.tsx)**:
  - Quitar `'instructor'` de `ADMIN_ROLES`.
  - Las rutas `/inicio`, `/clases`, `/configuracion` ahora `allow={['student', 'instructor']}` y usan dispatchers (ver §5.1).
- **`DefaultRedirect`** en [src/routing.tsx](src/routing.tsx): `instructor` → `/inicio`.
- **Sidebar** en [src/components/Layout.tsx](src/components/Layout.tsx): bifurcación de 3 ramas (student / instructor / admin-recep). Iconos: `HomeIcon`, `GraduationIcon`, `SettingsIcon` — todos ya exportados desde `brand.tsx`.

## 8. Reglas y restricciones

- **Español** en toda UI, copies y errores.
- CSS solo en [src/styles.css](src/styles.css). No CSS-in-JS, no archivos `.css` por componente.
- Sin librerías nuevas (UI ni iconos).
- Dinero en cents — usar `fromCents`/`toCents`/`formatMoney` de [src/utils/money.ts](src/utils/money.ts).
- Sin emojis en UI.
- Sin hex hardcoded para primary/secondary/accent — tokens CSS siempre.
- Listas tienen los 3 estados: loading, empty, error.
- Acciones destructivas (si hay alguna en Configuración, ej. revocar sesión) → `<ConfirmModal danger>`.
- **FE confía en BE para autorización**: no filtres defensivamente por `user_id` en queries. Si BE permite ver algo, asumimos que es lícito. Ningún endpoint del FE pasa `user_id=current_user.id` como filtro redundante.
- **El instructor no puede crear, editar ni borrar** cursos, asistencias-de-estudiantes ajenas, ni inscripciones. La pantalla `/clases` es read-only excepto por el flujo de pasar lista (que vive en el módulo de asistencia ya existente).
- **No mostrar** nunca `individual_cost` ni `hourly_rate` de otros instructores en la UI del instructor (BE-5 ya lo omite a nivel serialización; el FE simplemente no asume que vendrán).

## 9. Definition of Done

- [ ] `'instructor'` removido de `ADMIN_ROLES` en [src/App.tsx](src/App.tsx).
- [ ] Rutas `/inicio`, `/clases`, `/configuracion` aceptan `student` e `instructor` con dispatcher por rol.
- [ ] `DefaultRedirect` envía `instructor` a `/inicio`.
- [ ] Sidebar tiene 3 ramas (student / instructor / admin-recep) con icons y labels correctos.
- [ ] [src/types.ts](src/types.ts) incluye: `credentials` en UserMe/UserRead/UserUpdate; `HomeMeInstructorKpis`, `AssignedCourseRead`, `HomeMePayouts` en HomeMe; `AttendanceMatrixRead`, `StudentAttendanceRow`, `AttendanceCell`; `InstructorPmtRead`, `CoursePmtRead`.
- [ ] [src/api.ts](src/api.ts) expone: `updateMe`, `getCourseAttendanceMatrix`, `getInstructorPayment`.
- [ ] `src/utils/instructorTypeLabels.ts` con `instructorTypeLabel(type)`.
- [ ] `src/pages/InstructorHome.tsx` con KPIs + `.home-grid` 2-col (Mis clases lite + Pagos pendiente/realizados). Sin scroll horizontal en desktop.
- [ ] `src/pages/InstructorClasses.tsx` con tabla de cursos asignados (sessions, hours, hourly_rate, payment, rol) read-only + acción "Ver detalle".
- [ ] `src/components/InstructorCourseDetail.tsx` con info del curso + matriz de asistencia (filas alumnos, columnas sesiones, % final). Filtro de rango opcional. Sin `individual_cost` visible.
- [ ] `src/pages/InstructorConfig.tsx` con 3 secciones (Perfil editable + Cambiar contraseña + Datos académicos read-only). Campo `credentials` editable.
- [ ] Clases CSS nuevas agregadas en [src/styles.css](src/styles.css): `.home-payouts-section*`, `.home-payouts-row`, `.home-classes-card*`, `.attendance-matrix*`.
- [ ] `npm run typecheck` pasa sin warnings.
- [ ] Estados loading/empty/error visibles en cada lista.
- [ ] Verificado manualmente: con un usuario role=instructor, login lleva a `/inicio`; sidebar muestra solo sus 3 links; no puede navegar a `/students`, `/instructors`, `/classes` admin (redirige); no ve `individual_cost` ni `hourly_rate` ajenos en ninguna pantalla.

---

## Apéndice — Cambios BE asumidos (BE-1 a BE-6)

Construir el FE asumiendo que estos cambios están listos en el backend. Si alguno no está, el FE debería fallar limpio (con un `.alert` y `ApiError.message`), no inventar el dato.

| ID | Cambio | Necesario para |
|---|---|---|
| **BE-1** | Campo `credentials: str \| None` en `User`, expuesto en `UserMe`, `UserRead`, `UserUpdate`. | Configuración |
| **BE-2** | `PATCH /me` (request `UserUpdate`, response `UserMe`); ignora `role`/`email`/`status`/`academy_id`/`start_date`. Para instructor también ignora `payment_method`/`special_conditions`. | Configuración |
| **BE-3** | `GET /me/home` role-aware: cuando `role=instructor`, `HomeMe` incluye `instructor_kpis`, `assigned_courses[]`, `payouts{pending,scheduled,paid_recent}`. Campos student-only siguen funcionando para estudiantes. Payouts filtra `kind=expense`, `category=salary`, `user_id=me`. | Inicio |
| **BE-4** | `GET /courses/{id}/attendance-matrix?from_date=&to_date=` devolviendo `AttendanceMatrixRead`. 403 si el caller no es instructor del curso ni admin. Default: últimas 20 sesiones. Incluye `special_conditions` por estudiante solo aquí. | Detalle de Clases |
| **BE-5** | En serialización de `CourseRead` cuando `role=instructor`: omitir `individual_cost`; incluir `max_students`; en `instructor_links[]`, omitir `hourly_rate` de links donde `instructor_id != current_user.id`. | Seguridad (C1) |
| **BE-6** | Confirmado: `TransactionCategory.salary` + `user_id` como discriminador para nómina del instructor. Sin enum nuevo. | Inicio (Pagos) |
