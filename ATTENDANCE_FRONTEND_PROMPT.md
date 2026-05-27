# Prompt — Funcionalidad de asistencia

## 1. Contexto del proyecto

Vamos a implementar la funcionalidad de **asistencia** en Cantera. No es un módulo nuevo con ruta propia: se integra como sección/tab dentro de tres módulos existentes (Clases, Estudiantes, Instructores).

La asistencia se registra **por sesión** (instancia concreta de un schedule de un curso en una fecha específica) y **por persona** (estudiante, instructor o asistente). Cada persona presente en una sesión es una fila en la tabla `attendance` del backend. No existe tabla de sesiones: la sesión es implícita en `(course_id, scheduled_datetime)`.

**Antes de tocar código, lee:**
- [STYLE_GUIDE.md](STYLE_GUIDE.md) — tokens, clases CSS, componentes.
- [openapi.json](openapi.json) — fuente de verdad de la API (los endpoints de attendance ya existen).
- [src/api.ts](src/api.ts), [src/types.ts](src/types.ts) — pueden estar atrás del OpenAPI.
- [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx) y [src/pages/Classes.tsx](src/pages/Classes.tsx) — referencias de patrón.
- [src/components/CourseDetails.tsx](src/components/CourseDetails.tsx) y [src/components/UserDetails.tsx](src/components/UserDetails.tsx) — aquí se agregan las secciones nuevas.

## 2. Identidad visual

Se respeta [STYLE_GUIDE.md](STYLE_GUIDE.md). Lo único nuevo en `styles.css` son utilidades para la **vista de pasar lista** (lista compacta de personas con toggles de status). Sugeridas:

- `.attendance-list` — contenedor vertical con `gap: 8px`.
- `.attendance-row` — fila flex (avatar + nombre + grupo de botones a la derecha), border-bottom 1px var(--color-border).
- `.attendance-row__name` — flex 1, font-weight 600.
- `.attendance-row__hint` — fontsize 12, color var(--color-text-muted) (debajo del nombre, ej. "Suplente" o "Recién agregado").
- `.status-toggle-group` — grupo de 3 botones (Presente / Ausente / Justificado) con estilo de `.tab-group__item` pero más compacto y con color semántico por estado.
- `.status-toggle-group__item--present.is-active` — fondo verde tenue + texto verde.
- `.status-toggle-group__item--absent.is-active` — fondo `--color-danger-bg` + texto `--color-danger`.
- `.status-toggle-group__item--excused.is-active` — fondo amarillo tenue + texto amarillo oscuro.

Para el resto (KPIs de % asistencia, listas de sesiones, tabla de horas) reusar `.summary-card`, `.detail-list`, `.users-table`, `.form-section`.

**Ícono**: usar `CalendarIcon` de [src/brand.tsx](src/brand.tsx) para "Sesiones" y "Asistencia". `ClockIcon` para "Horas y pago". No agregar íconos nuevos.

## 3. Enums

Los enums viven en el backend (ya están en openapi.json). Labels en español:

### `AttendanceStatus`

| Valor | Label |
|---|---|
| `present` | "Presente" |
| `absent` | "Ausente" |
| `excused` | "Justificado" |

### `AttendanceRole`

| Valor | Label |
|---|---|
| `student` | "Estudiante" |
| `instructor` | "Instructor" |
| `assistant` | "Asistente" |

Centralizar estos labels en `src/utils/attendanceLabels.ts` (nuevo) con `labelAttendanceStatus(s)` y `labelAttendanceRole(r)`, siguiendo el patrón de `src/utils/salesLabels.ts`.

## 4. Sincronización de tipos y API service

### 4.1 `src/types.ts`

Agregar:

```ts
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type AttendanceRole = 'student' | 'instructor' | 'assistant';

export interface AttendanceCreate {
  scheduled_datetime: string; // ISO datetime
  course_id: number;
  user_id: number;
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
}

export interface AttendanceUpdate {
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
}

export interface AttendanceRead {
  scheduled_datetime: string;
  course_id: number;
  user_id: number;
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
  user: UserPublic;
  course: CoursePublic;
  created_at: string;
  created_by: UserPublic;
  updated_at: string;
}

export interface SessionCreate {
  scheduled_datetime: string;
  course_id: number;
}

export interface ListAttendanceParams {
  course_id?: number;
  user_id?: number;
  from_date?: string;
  to_date?: string;
  attendance_role?: AttendanceRole;
  status?: AttendanceStatus;
  skip?: number;
  limit?: number;
}

export interface CoursePmtRead {
  course_id: number;
  course_name: string;
  attendance_role: AttendanceRole;
  sessions: number;
  minutes: number;
  hours: number;
  hourly_rate: number;       // en cents
  payment: number;            // en cents
}

export interface InstructorPmtRead {
  total_minutes: number;
  total_hours: number;
  total_payment: number;      // en cents
  by_course: CoursePmtRead[];
}

export interface InstructorPmtParams {
  from_date?: string;
  to_date?: string;
}
```

### 4.2 `src/api.ts`

Agregar:

```ts
// attendance
listAttendance(params: ListAttendanceParams = {}): Promise<AttendanceRead[]>
createAttendance(payload: AttendanceCreate): Promise<AttendanceRead>
updateAttendance(course_id, user_id, scheduled_datetime, payload: AttendanceUpdate): Promise<AttendanceRead>
deleteAttendance(course_id, user_id, scheduled_datetime): Promise<void>
openAttendanceSession(payload: SessionCreate): Promise<AttendanceRead[]>

// instructor pay
getInstructorPmt(user_id: number, params: InstructorPmtParams = {}): Promise<InstructorPmtRead>
```

Detalle de paths:
- `GET /attendance` → `listAttendance` (todos los filtros van en query string).
- `POST /attendance` → `createAttendance`.
- `POST /attendance/sessions` → `openAttendanceSession`. **Idempotente**: si la sesión ya existe devuelve las filas existentes; si llegó un enrollment nuevo lo agrega.
- `PATCH /attendance/{course_id}/{user_id}/{datetime}` → `updateAttendance`. El path-param `datetime` es el ISO completo del `scheduled_datetime`. **Hay que URI-encode**.
- `DELETE /attendance/{course_id}/{user_id}/{datetime}` → `deleteAttendance`.
- `GET /users/{id}/instructor-pmt?from_date=&to_date=` → `getInstructorPmt`.

Todos lanzan `ApiError` siguiendo el patrón existente.

## 5. Modelo de datos / reglas de negocio

**IMPORTANTE**: el backend en esta etapa **no valida** estas reglas. Todas se enforcean en el FE. Si una se rompe, el backend acepta el POST y queda data inconsistente. Sé estricto en la UI.

### 5.1 Construcción de `scheduled_datetime`

Un curso tiene `schedules: ScheduleCreate[]` con `schedule_day` (lunes-domingo) y `schedule_time` (HH:MM o HH:MM:SS).

Para una fecha elegida por el usuario:

1. Mapear el día de la semana de la fecha a un `ScheduleDay`.
2. Filtrar los schedules del curso que coincidan con ese día. Si hay 2+ (curso con dos horarios el mismo día), permitir elegir.
3. Construir `scheduled_datetime = ISO(fecha + schedule_time)` en zona horaria local del navegador, formato `YYYY-MM-DDTHH:mm:ss`.
4. La fecha debe estar dentro de `[course.start_date, course.end_date]` (si ambas existen).
5. Para `recurrence='one_time'`, solo la fecha igual a `course.start_date` es válida.

### 5.2 Generación de fechas válidas en un rango

Para listar "sesiones del último mes" o "próximas sesiones":

- Iterar día a día en el rango.
- Para cada día, encontrar los schedules del curso que coincidan con el día de la semana.
- Cada coincidencia es una sesión candidata `(course_id, scheduled_datetime)`.
- Filtrar por `[start_date, end_date]` y `course.status='active'`.

### 5.3 Estado derivado por sesión

Para una sesión candidata, se cruzan las filas de `GET /attendance?course_id&from_date&to_date` y se determina:

- **Abierta**: existe al menos una fila para esa `scheduled_datetime`.
- **Cerrada/no tomada**: no existen filas.
- **% presentes**: (filas con `status='present'` y `attendance_role='student'`) / (filas con `attendance_role='student'`).

### 5.4 Ventana temporal

Antes de llamar a `openAttendanceSession` o `createAttendance`:

- **Manual** (desde módulo Clases): `now() >= scheduled_datetime - 1h`. Sin cap superior. Sí permitido para sesiones pasadas.
- Si el usuario intenta abrir una sesión que aún no está en ventana, mostrar mensaje "Aún no puedes registrar esta sesión. Disponible desde HH:mm." y deshabilitar el botón.

### 5.5 Reglas al pasar lista

- Solo aparecen estudiantes con `enrollment.status='active'` en el curso (obtener vía `listEnrollments({ course_id, status: 'active' })`).
- Staff inicial = todas las `instructor_links` del curso (cada uno con su `type` como `attendance_role`).
- Default status para staff y estudiantes = `absent`.
- Si después del default aparece un nuevo enrollment activo, al re-abrir la sesión (`openAttendanceSession`) el backend agrega su fila. El FE debe refrescar.

### 5.6 Suplentes

- Botón "+ Agregar staff" en la vista de pasar lista.
- Abre un selector de usuario (autocomplete) limitado a `role IN ('instructor', 'admin')` (usar `listUsers({ role: 'instructor' })` + opcionalmente `listUsers({ role: 'admin' })`).
- Pedir `attendance_role` (`instructor` o `assistant`).
- Llamar `createAttendance` con `status='present'` (suplente que aparece se asume presente).
- En la fila resultante mostrar hint "Suplente" debajo del nombre.

### 5.7 Coherencia de instructor en la sesión

El backend permite que diferentes filas de la misma sesión tengan diferentes instructores. El FE **no debe romper esto**, pero sí mostrar visualmente quién está marcado como instructor presente (es relevante para entender el cálculo de pago). No bloquear cambios.

### 5.8 Cálculo de % asistencia

Para un estudiante en un curso (o globalmente):

- Numerador: filas `status='present'` con `attendance_role='student'` en el rango.
- Denominador: filas con `attendance_role='student'` en el rango (excluye `excused` para no inflar; o incluye según preferencia — **mi default: excluir excused del denominador**, es decir, "% de las sesiones donde se esperaba que asistiera, ¿asistió?". Documentar esta elección como tooltip).

### 5.9 Errores del backend

Como el BE no tiene validaciones puristas, los `422` que devuelva pueden ser ambiguos. Patrón:

```ts
try { ... } catch (err) {
  if (err instanceof ApiError) {
    setError(err.fieldErrors[campo] ?? err.message);
  } else {
    setError('No se pudo guardar la asistencia.');
  }
}
```

## 6. UI / flujos

### 6.1 Vista "Pasar lista" (componente nuevo)

`src/components/AttendanceSheet.tsx` — componente reutilizable, recibe `{ courseId, scheduledDatetime, onClose, onSaved }`.

Se monta en un `<SidePanel>` con título "Pasar lista — {course.name}" y subtítulo "{día, fecha} · {HH:mm}".

**Layout interno**:

```
┌──────────────────────────────────────────────┐
│ Staff                                        │
│  [Avatar] Ana López         [P][A][E]        │
│           Instructor                         │
│  [Avatar] Beto Ruiz         [P][A][E]        │
│           Asistente                          │
│  + Agregar staff                             │
│                                              │
│ Estudiantes                          (12)    │
│  [Avatar] Carla Mtz         [P][A][E]        │
│  [Avatar] Diego Ramírez     [P][A][E]        │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- Los toggles cambian status con `updateAttendance` (debounced o on-click directo).
- Estado optimista: cambiar visualmente al instante; revertir en error.
- Trash icon a la derecha de cada fila para eliminar (con `ConfirmModal`).
- Botón "+ Agregar staff" abre un mini-form inline para agregar suplente.
- Estado loading inicial mientras llega `openAttendanceSession` (que crea defaults + devuelve todo).
- Estado error si la apertura falla.

**Onboarding del componente**:

```ts
useEffect(() => {
  openAttendanceSession({ course_id, scheduled_datetime })
    .then(setRows)
    .catch(...);
}, [course_id, scheduled_datetime]);
```

### 6.2 Módulo Clases — sección "Sesiones" en `CourseDetails`

Agregar al final de `src/components/CourseDetails.tsx`, después de "Instructores".

```
┌─ Sesiones ──────────────────────────────────┐
│ [Tabs: Próximas | Últimas 30 días | Todas]  │
│                                              │
│ ┌───────────────────────────────────────────┐│
│ │ Lun 23 may 2026 · 07:00      [Tomar]      ││
│ │ Vie 20 may 2026 · 07:00      Tomada · 8/10││
│ │ Lun 16 may 2026 · 07:00      Tomada · 9/10││
│ │ ...                                       ││
│ └───────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- Calcular sesiones candidatas según 5.2 para el rango seleccionado.
- Llamar `listAttendance({ course_id, from_date, to_date })` una vez y agrupar por `scheduled_datetime`.
- Por cada sesión candidata: si tiene filas → mostrar "Tomada · presentes/total estudiantes" + botón "Editar"; si no → mostrar "Sin tomar" + botón "Tomar".
- Click en "Tomar" o "Editar" abre `<AttendanceSheet>` en SidePanel anidado (mismo patrón que ConfirmModal sobre SidePanel).
- Default tab: "Próximas" (siguientes 14 días). "Últimas 30 días" = pasadas. "Todas" = `start_date..end_date` (cap a 200 filas para no reventar).
- Estados loading/empty/error para la lista.

### 6.3 Módulo Estudiantes — sección "Asistencia" en `UserDetails`

Solo cuando `role === 'student'`. Agregar después de "Historial y deudas".

```
┌─ Asistencia ────────────────────────────────┐
│ Resumen últimos 30 días                     │
│ [Card: 87% asistencia] [Card: 23 sesiones]  │
│                                              │
│ [Filtro: Todos los cursos | <select>]       │
│                                              │
│ Vie 20 may · Yoga Vinyasa   [Presente]      │
│ Mié 18 may · Yoga Vinyasa   [Ausente]       │
│ Lun 16 may · Pilates        [Justificado]   │
│ ...                                          │
└──────────────────────────────────────────────┘
```

- Llamar `listAttendance({ user_id: student.id, attendance_role: 'student', from_date, to_date })`.
- Default rango: últimos 30 días (calculado en cliente).
- KPI principal: % asistencia (según 5.8) + sesiones totales.
- Lista descendente por `scheduled_datetime`.
- Filtro opcional por curso (dropdown poblado de los cursos presentes en las filas).
- Solo lectura desde aquí (no editar — para editar el usuario va a Clases).

### 6.4 Módulo Instructores — sección "Horas y pago" en `UserDetails`

Solo cuando `role === 'instructor'`. Agregar al final del componente (después de los campos generales).

```
┌─ Horas y pago ──────────────────────────────┐
│ Rango: [Mes en curso ▼] [from] [to]         │
│                                              │
│ [Card: 42 horas] [Card: $8,400 MXN]         │
│                                              │
│ Curso                  Rol      Sesiones Horas  Tarifa   Pago
│ Yoga Vinyasa           Instr.   8        8.0    $300/h   $2,400
│ Pilates                Asist.   4        4.0    $250/h   $1,000
│ ...                                                       Total: $8,400
└──────────────────────────────────────────────┘
```

- Llamar `getInstructorPmt(user.id, { from_date, to_date })`.
- Default rango: mes en curso (día 1 al último día del mes calendario local).
- Selector de rango: dropdown con presets ("Mes en curso", "Mes pasado", "Últimos 30 días", "Personalizado"). Personalizado activa dos inputs date.
- KPIs: `total_hours` y `formatMoney(total_payment, currency)`.
- Tabla con `by_course[]`: `course_name`, label de `attendance_role`, `sessions`, `hours`, `formatMoney(hourly_rate, currency) + '/h'`, `formatMoney(payment, currency)`.
- Estados loading/empty/error.
- Si `by_course` está vacío, mensaje "Sin sesiones registradas en este rango."

## 7. Ruta y navegación

**Sin rutas nuevas**. Sin cambios en [src/App.tsx](src/App.tsx) ni en el sidebar de [Layout.tsx](src/components/Layout.tsx).

La asistencia se accede así:
- **Pasar lista** → módulo Clases → ver detalle del curso → sección Sesiones → click en una sesión.
- **Ver asistencia de un estudiante** → módulo Estudiantes → ver detalle → sección Asistencia.
- **Ver horas/pago de un instructor** → módulo Instructores → ver detalle → sección Horas y pago.

## 8. Reglas y restricciones

- Todo en español.
- CSS nuevo SOLO en [src/styles.css](src/styles.css). Sin estilos inline excepto en casos puntuales (ya hay precedente en `UserDetails.tsx`).
- No instalar dependencias. Sin chart libs, sin date libs externas — usar `Intl` y `Date` nativos.
- Sin emojis en UI.
- Dinero siempre en cents en API; usar `formatMoney(cents, currency)` de [src/utils/money.ts](src/utils/money.ts) para display.
- Construcción de `scheduled_datetime`: respetar zona horaria local del navegador (el backend acepta ISO sin TZ y asume local; no convertir a UTC).
- URI-encode los path params del PATCH/DELETE de attendance (el `:` y otros caracteres del datetime requieren encoding).
- Errores: patrón `try/catch` con `ApiError` y fallback genérico en español.
- Estados loading/empty/error en TODAS las listas.
- Acciones destructivas (eliminar fila) pasan por `<ConfirmModal danger>`.

## 9. Definition of Done

- [ ] [src/types.ts](src/types.ts) tiene todos los tipos de la sección 4.1.
- [ ] [src/api.ts](src/api.ts) tiene `listAttendance`, `createAttendance`, `updateAttendance`, `deleteAttendance`, `openAttendanceSession`, `getInstructorPmt`.
- [ ] `src/utils/attendanceLabels.ts` con labels de status y role.
- [ ] `src/components/AttendanceSheet.tsx` (vista de pasar lista) reutilizable, monta en SidePanel.
- [ ] [src/components/CourseDetails.tsx](src/components/CourseDetails.tsx) tiene sección "Sesiones" con tabs y lista de sesiones candidatas, abre `AttendanceSheet`.
- [ ] [src/components/UserDetails.tsx](src/components/UserDetails.tsx) tiene sección "Asistencia" cuando `role==='student'`.
- [ ] [src/components/UserDetails.tsx](src/components/UserDetails.tsx) tiene sección "Horas y pago" cuando `role==='instructor'`.
- [ ] Clases CSS nuevas en [src/styles.css](src/styles.css) para `.attendance-list`, `.attendance-row*`, `.status-toggle-group*`.
- [ ] Validaciones del cliente: ventana temporal, fecha coincide con schedule, estudiantes activos, suplentes solo con role instructor/admin.
- [ ] `npm run typecheck` sin warnings.
- [ ] Estados loading/empty/error en las 3 secciones.
- [ ] Errores manejados con `ApiError` + fallback en español.

---

## Apéndice — Asunciones y cosas a confirmar en BE

| Asunción | Riesgo |
|---|---|
| `hourly_rate` y `payment` en `CoursePmtRead` están en **cents** | Si están en unidades base, los montos se mostrarían 100x. Confirmar con BE antes de QA. |
| `scheduled_datetime` se envía y devuelve sin offset de zona horaria (string ISO local) | Si el BE asume UTC, las sesiones se moverían de día. Probar con una sesión a las 23:00. |
| `POST /attendance/sessions` es idempotente y agrega nuevos enrollments en re-llamadas | Verificar en QA: crear sesión → inscribir nuevo estudiante → reabrir → debería agregarse fila absent. |
| El BE no impone que `attendance_role='student'` requiera enrollment activo | El FE debe filtrar; si se cuela un user_id inválido, el POST igual pasa. |
| No hay validación de ventana temporal en BE | El FE bloquea, pero un cliente malicioso podría hacer POST con datos arbitrarios. Aceptable en esta etapa. |
