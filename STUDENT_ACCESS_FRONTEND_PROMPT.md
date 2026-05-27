# Prompt — Habilitar acceso de estudiantes (Inicio, Clases, Configuración)

## 1. Contexto del proyecto

Cantera (SaaS de gestión de academias). Vamos a habilitar el **acceso de estudiantes** a la app.

Esto **NO es un módulo CRUD nuevo**. Es una capa de routing + 2 pantallas nuevas + 1 pantalla de configuración personal + filtrado del shell por `role`. Los admins ya tienen sus módulos (`Students`, `Instructors`, `Classes`, `Sales`); este prompt agrega lo que ve un usuario con `role === 'student'`.

**Resumen funcional:**
- **Inicio** (`/inicio`): hub del estudiante con 4 KPIs (clases inscritas, próxima clase, deuda, asistencia), listado de pagos pendientes/próximos y listado de clases inscritas. CTA a "Explorar clases".
- **Clases** (`/clases`): catálogo de clases activas con cards; permite inscribirse y darse de baja (este último según flag de la academia).
- **Configuración** (`/configuracion`): edición de perfil propio + cambio de contraseña.

**Restricciones de seguridad del FE:**
- Bootstrap único via `GET /me`, igual que admin (ya implementado en `src/auth.tsx`).
- El sidebar se filtra por `role`. Para `student` solo se muestran Inicio · Clases · Configuración. Los módulos admin (Students/Instructors/Classes/Sales) no aparecen.
- Si un `student` navega manualmente a una ruta admin (`/students`, `/instructors`, `/classes`, `/ventas`), redirigir a `/inicio`.
- Si un `admin/receptionist/instructor` aterriza en `/inicio` o `/clases` (del estudiante), redirigir a su home admin (hoy `/students`).
- El BE valida ownership en endpoints (en progreso, fuera del scope del FE). El FE NO mete `user_id=current_user.id` defensivo en cada call — confiamos en que el BE devuelve solo lo que el usuario puede ver.

**Recordar siempre**: antes de tocar código, leer [STYLE_GUIDE.md](STYLE_GUIDE.md), [CLAUDE.md](CLAUDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts), [src/auth.tsx](src/auth.tsx), [src/App.tsx](src/App.tsx), [src/components/Layout.tsx](src/components/Layout.tsx).

---

## 2. Identidad visual

Se respetan los tokens y patrones de [STYLE_GUIDE.md](STYLE_GUIDE.md). Se reutilizan:
- `<Layout>`, `<SidePanel>`, `<ConfirmModal>`, `StatusBadge`, `CourseStatusBadge`.
- `.summary-grid` + `.summary-card` para los KPIs.
- `.tab-group` para tabs Pendientes/Próximos.
- `.detail-list` + `.detail-item` para el detalle del curso en SidePanel.
- `.alert`, `.alert--success` para errores y toasts.
- `.btn`, `.field`, `.input`, etc.

**Clases CSS nuevas en [src/styles.css](src/styles.css)** (agrégalas donde corresponda semánticamente):

- `.home-grid` — grid de 2 columnas (`grid-template-columns: 1fr 1fr; gap: 24px`) en desktop, 1 columna en mobile (`@media max-width 960px`). **Garantía: nunca debe producir scroll horizontal en desktop**.
- `.home-card` — wrapper con `background: var(--color-surface); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm)`. Título con `.home-card__title` (font-display, 18px).
- `.next-session-card` — variante del summary-card para la "próxima clase": muestra nombre del curso (truncado con ellipsis a ~28 chars), fecha (formato `dd MMM`) y hora (`HH:mm`). Si no hay sesión próxima, muestra "—".
- `.course-card` — card para vista de catálogo en `/clases`. Contiene nombre, instructores (chips o lista compacta), horarios, costo (si >0), badge "Inscrito" si aplica, y botón principal en footer. Usa `display: flex; flex-direction: column; min-height: 220px`.
- `.course-card-grid` — grid `repeat(auto-fill, minmax(280px, 1fr)); gap: 16px` para layout responsivo de cards.
- `.payment-row` — fila para items de pago en el listado, con columnas: descripción + chip categoría + monto + fecha. No tabla, usar flex.
- `.payment-row__category` — chip pequeño tipo badge, color neutro (`background: color-mix(in srgb, var(--color-text-muted) 12%, transparent)`).
- `.cta-explore` — bloque destacado con CTA "Explorar clases" para usar al final de Inicio o cuando no hay clases inscritas. Estilo invitador (gradiente sutil, padding generoso).
- `.config-section` — agrupa formularios de Configuración (perfil, password). Cada uno con `.form-section__title`.

**Iconos nuevos en [src/brand.tsx](src/brand.tsx)**:
- `HomeIcon` (para el link "Inicio" del sidebar).
- `SettingsIcon` (para "Configuración").
- Seguir el patrón existente: SVG inline 24x24, acepta `size` (default 16) y `color` (default `currentColor`).

---

## 3. Enums

Enums existentes en [openapi.json](openapi.json), con etiquetas en español:

**`TransactionCategory`** (solo categorías de ingreso son relevantes para el estudiante):
| Valor | Label |
|-------|-------|
| `tuition` | "Mensualidad" |
| `enrollment_fee` | "Cuota de inscripción" |
| `material_sale` | "Material" |
| `exam_fee` | "Examen" |
| `private_class` | "Clase privada" |
| `other_income` | "Otro" |

> Las categorías de gasto (`rent`, `utilities`, `salary`, `marketing`, `equipment`, `other_expense`) no deberían llegar al FE del estudiante porque el filtro es `kind=SALE`. Si llegan, ocultarlas con un fallback `"—"` y log a consola.

**`TransactionStatus`**:
| Valor | Label |
|-------|-------|
| `pending` | "Pendiente" |
| `scheduled` | "Próximo" |
| `paid` | "Pagado" |
| `cancelled` | "Cancelada" |
| `refunded` | "Reembolsada" |

**`EnrollmentStatus`** (lo que ve el estudiante en sus inscripciones):
| Valor | Label |
|-------|-------|
| `active` | "Inscrito" |
| `waiting` | "En lista de espera" |
| `completed` | "Completada" |
| `cancelled` | "Cancelada" |

**`UserRole`** ya tiene `student` — ya existe en `src/types.ts`.

Centraliza las traducciones en `src/utils/transactionLabels.ts` (nuevo si no existe) y `src/utils/enrollmentLabels.ts`. Sigue el patrón de `src/utils/attendanceLabels.ts`.

---

## 4. Sincronización de tipos y API service

### 4.1 `src/types.ts` — cambios

El BE actualizó los siguientes schemas. Verificar y sincronizar:

1. **`UserMe` enriquecido** (F1): ahora incluye los campos de `UserRead` (`debt_amount`, `next_due_date`, `next_due_amount`, `pending_transactions[]`). Mantener compatibilidad: el shape antes era mínimo; ahora trae todo. Confirmar contra `openapi.json` y actualizar el type.

2. **`CourseStudentRead`** (C1, nuevo): vista del curso para students. Campos:
   ```ts
   interface CourseStudentRead {
     id: number;
     name: string;
     description: string | null;
     status: CourseStatus;
     recurrence: CourseRecurrence;
     duration_minutes: number;
     individual_cost: number | null;  // en cents
     location: string | null;
     start_date: string | null;
     end_date: string | null;
     schedules: Schedule[];
     instructor_links: CourseInstructorLinkPublic[];
     has_capacity: boolean;  // BE calcula si hay cupo disponible
     // NO hay max_students, NO hay hourly_rate
   }
   ```

3. **`CourseInstructorLinkPublic`** (C1, nuevo): variante sin `hourly_rate` ni `instructor_id`:
   ```ts
   interface CourseInstructorLinkPublic {
     type: InstructorType;
     instructor: UserPublic;
   }
   ```

4. **`EnrollmentRead.course`** (F2): ahora es `CourseRead` (no `CoursePublic`) o `CourseStudentRead` según el role del que llama. Verificar contra openapi y tipar la respuesta correctamente.

5. **`MeHomeRead`** (E1, nuevo): respuesta de `GET /me/home`:
   ```ts
   interface MeHomeRead {
     user: UserRead;
     enrolled_courses: CourseStudentRead[];
     pending_transactions: TransactionRead[];   // status=pending
     scheduled_transactions: TransactionRead[]; // status=scheduled
     attendance: {
       pct_last_12: number | null;  // 0-100, null si <1 sesión
       present: number;
       absent: number;
       total: number;
     };
     next_session: {
       course: CoursePublic;
       datetime: string;  // ISO 8601 con timezone de la academia
     } | null;
   }
   ```
   > **Nota**: si el campo `next_session` aún no está disponible en `openapi.json` cuando leas, asume que sí existe con esta forma y agrégalo al type. Es lo último que está terminando el BE.

6. **`PasswordChange`** (C3, nuevo): payload para `POST /me/password`:
   ```ts
   interface PasswordChange {
     current_password: string;
     new_password: string;
   }
   ```

7. **`AcademyMe.students_can_self_unenroll`** (F3): `boolean | null` (default `false` cuando es `null`). Verificar que está en `AcademyMe`, `AcademyRead`, `AcademyUpdate`.

### 4.2 `src/api.ts` — funciones nuevas

Sigue el patrón existente (usa `authFetch`, lanza `ApiError`):

- `getMeHome(): Promise<MeHomeRead>` — `GET /me/home`.
- `changeMyPassword(payload: PasswordChange): Promise<void>` — `POST /me/password`. Respuesta 204.
- `listStudentCourses(params?: { search?: string }): Promise<CourseStudentRead[]>` — `GET /courses?active=true&status=active`. El BE devuelve `CourseStudentRead[]` cuando `role === 'student'`. Usa esta función SOLO desde la pantalla del estudiante.
- `enrollMe(course_id: number): Promise<EnrollmentRead>` — `POST /enrollments` con `{ course_id, student_id: <me.id> }`. **Nota**: el BE crea automáticamente la `TransactionCreate` SCHEDULED si `individual_cost > 0` (F4); el FE NO crea la transaction manualmente.
- `unenrollMe(course_id: number, user_id: number): Promise<EnrollmentRead>` — `DELETE /enrollments/{course_id}/{student_id}`.
- `updateMe(user_id: number, payload: UserUpdate): Promise<UserRead>` — reusa `PATCH /users/{id}` (ya existe `updateUser`); puede no requerir función nueva, solo verificar firma.

---

## 5. Modelo de datos / reglas de negocio

### 5.1 Routing por role

En `src/App.tsx`:

- Ruta default `"/"` ya no redirige siempre a `/students`. Lógica:
  ```
  si me.role === 'student' → /inicio
  si me.role en ['admin', 'receptionist', 'instructor'] → /students  (comportamiento actual)
  si !me → /login
  ```
  Implementarlo en un componente `<DefaultRedirect>` que lea `useAuth()` y haga `<Navigate>` apropiado.

- Rutas nuevas: `/inicio`, `/clases`, `/configuracion` → componentes nuevos.

- **Guards de role** (cliente, NO sustituye seguridad del BE): crear un wrapper `<RoleRoute allow={['student']}>` o similar. Si el role del usuario no coincide, redirige a su home apropiado.
  - `/inicio`, `/clases`, `/configuracion` → `allow=['student']`.
  - `/students`, `/instructors`, `/classes`, `/ventas` → `allow=['admin','receptionist','instructor']` (esto es nuevo; hoy no tienen guard, pero conviene meterlo ahora para que el student no caiga ahí).
  - Catch-all `*` se mantiene pero respeta el role: redirige a `/inicio` o `/students` según corresponda.

### 5.2 Sidebar filtrado

En `src/components/Layout.tsx`:

- Para `me.role === 'student'`: mostrar SOLO `Inicio` (HomeIcon), `Clases` (GraduationIcon), `Configuración` (SettingsIcon). Ocultar Estudiantes, Instructores, Clases (admin), Ventas.
- Para roles admin: comportamiento actual (no cambia).
- El bloque de usuario en el footer del sidebar y el logout funcionan igual para ambos.

### 5.3 Inicio — KPIs

Los 4 KPIs vienen de `GET /me/home`:

1. **Clases inscritas**: `enrolled_courses.length`. Si 0, mostrar `0` (no "—").
2. **Próxima clase**: si `next_session !== null`, tarjeta con nombre del curso (truncar a 28 chars con ellipsis), fecha (`dd MMM`, ej. `15 Jun`) y hora (`HH:mm`). Si `null`, mostrar "Sin clases próximas" en `.summary-card__value--empty` y dejarlo en gris muted.
3. **Deuda**: `formatMoney(user.debt_amount ?? 0, academy.currency)`. Si es 0, mostrar el monto en 0 con tono normal (no es problema).
4. **Asistencia**: si `attendance.pct_last_12 !== null`, mostrar `{pct}%`. Si `null` (estudiante nuevo sin sesiones), mostrar "—".

### 5.4 Inicio — listado de pagos

- Layout: dentro de `.home-card` con `.home-card__title = "Mis pagos"`.
- `.tab-group` con dos tabs:
  - **"Pendientes"** (`pending_transactions`, default activa). Si vacío, empty state `"Sin pagos pendientes"`.
  - **"Próximos"** (`scheduled_transactions`). Si vacío, empty state `"Sin pagos programados"`.
- Cada `.payment-row` muestra:
  - `description` (truncado si necesario)
  - `.payment-row__category` con label de `category` (de `src/utils/transactionLabels.ts`)
  - `transaction_date` (formato `dd MMM yyyy`)
  - `formatMoney(amount, currency)` alineado a la derecha
- No hay paginación; el BE limita a un razonable (~50) y para MVP no se pagina.

### 5.5 Inicio — listado de clases inscritas

- Layout: dentro de `.home-card` con `.home-card__title = "Mis clases inscritas"`.
- Si `enrolled_courses.length === 0`:
  - Empty state `"Aún no estás inscrito en ninguna clase"`.
  - Bloque `.cta-explore` con botón "Explorar clases" → `navigate('/clases')`.
- Si hay clases: cards compactas (nombre del curso, horarios resumidos, instructor principal) con CTA "Ver detalle" → abre `<SidePanel>` con `<StudentCourseDetail course={course} />`.

### 5.6 Inicio — bloque "Explorar clases"

CTA secundario al final de Inicio (siempre visible aunque tenga clases inscritas) que lleva a `/clases`. Usar `.cta-explore`.

### 5.7 SidePanel de detalle de curso (estudiante)

Componente nuevo `src/components/StudentCourseDetail.tsx` que recibe un `CourseStudentRead`. Reusa `.detail-list` + `.detail-item`. Muestra:

- **Información general**: Nombre, Descripción, Ubicación, Recurrencia (`Sesión única` / `Semanal`), Estado (`<CourseStatusBadge>`).
- **Programación**: Duración (`formatDuration`), Fecha de inicio, Fecha de fin (solo si `recurrence !== 'one_time'`), Horarios (lista con día + hora, usar `DAY_LABEL` del módulo existente).
- **Costo**: si `individual_cost !== null && individual_cost > 0`, mostrar `formatMoney(individual_cost, currency)`. Si es 0 o null, **no mostrar la sección** (no escribir "Gratis", no escribir "$0").
- **Instructores**: lista con nombre y tipo (`Instructor` / `Asistente`). **NO mostrar `hourly_rate`** (el BE ya no lo envía, pero por defensa, ignorar si llega).

**NO incluir**: lista de otros estudiantes, capacidad (`max_students`), asistencia global. Estos campos no deberían venir en `CourseStudentRead`, pero si llegan, ignorarlos.

### 5.8 Clases — catálogo

`src/pages/StudentClasses.tsx` en `/clases`:

- Llamar `listStudentCourses()` en mount.
- Header: search input (`.search-input` con `<SearchIcon>`) que filtra por nombre client-side.
- Grid de `.course-card-grid` con un `.course-card` por curso.
- Cada `.course-card` muestra:
  - Nombre del curso (font-display, prominente).
  - Lista compacta de instructores (`Instructor: Juan P. · Asistente: Ana G.`).
  - Horarios (`Lun 18:00 · Mié 18:00`, usa `DAY_LABEL`).
  - Costo si `individual_cost > 0`: `formatMoney(individual_cost, currency)`.
  - **Badge "Inscrito"** (clase nueva `.badge--enrolled` o reusar `.badge--active`) si el `course.id` está en `enrolledIds` (set computado desde una llamada paralela a `GET /enrollments?status=active` o desde `getMeHome().enrolled_courses`).
  - Footer con botón principal según estado (ver 5.9).
- Estados: loading (`.loading-row`), error (`.alert`), empty (`.empty-state`).

### 5.9 Clases — flujo de inscripción / baja

Para cada card, el botón depende del estado:

| Inscrito | Cupo | Costo | Botón / Acción |
|----------|------|-------|----------------|
| No | Sí (`has_capacity=true`) | 0 o null | **"Inscribirme"** primary, 1-click → `enrollMe(course.id)` → toast éxito → refrescar lista. |
| No | Sí | > 0 | **"Inscribirme"** primary → `<ConfirmModal>` con título `"Confirmar inscripción"` y mensaje `"Se generará un cobro programado de {monto}. ¿Continuar?"` → `enrollMe` → toast éxito → refrescar. |
| No | No (`has_capacity=false`) | cualquiera | **"Sin cupo"** disabled, ghost variant. |
| Sí | — | — | Si `academy.students_can_self_unenroll === true`: **"Darme de baja"** danger, ghost variant → `<ConfirmModal danger>` con `"¿Darte de baja de {curso}?"` → `unenrollMe(course.id, me.id)` → toast éxito → refrescar. Si `false`: solo mostrar badge `"Inscrito"` y deshabilitar acciones. |

**Toast**: usa el patrón `showToast` existente (`.alert.alert--success`, auto-dismiss 4s).

**Errores del BE**: capturar `ApiError`, mostrar `err.message` en un `.alert` arriba de la lista. Errores típicos: `409` (sin cupo, ya inscrito), `403` (no permitido).

### 5.10 Configuración — perfil

`src/pages/StudentConfig.tsx` en `/configuracion`:

- Form con secciones (cada una `.form-section`):

**Sección 1: "Mi información"** (campos editables, vienen de `me`/UserRead):
- `first_name` (input text, requerido)
- `last_name` (input text, requerido)
- `phone` (input tel, opcional)
- `address` (input text, opcional)
- `date_of_birth` (input date, opcional)
- `payment_method` (select con opciones del enum `PaymentMethod`, opcional)
- `special_conditions` (textarea, opcional, label `"Condiciones especiales (alergias, contacto de emergencia, etc.)"`)

Botón **"Guardar cambios"** → `updateUser(me.id, payload)` → success toast → refrescar `me` (llamar `getMe()` y `setMe()` desde `useAuth`).

**Sección 2: "Cambiar contraseña"**:
- `current_password` (input password, requerido)
- `new_password` (input password, requerido, min 8 chars con `.field__hint` `"Mínimo 8 caracteres"`)
- `new_password_confirm` (input password, requerido, validar igual a `new_password` client-side)

Botón **"Actualizar contraseña"** → `changeMyPassword({ current_password, new_password })` → success toast → limpiar form. Si el BE devuelve 401 (current_password incorrecta), mensaje genérico `"No se pudo actualizar la contraseña. Verifica tus datos."`.

**Sección 3: "Mi cuenta" (read-only)**:
- Email (mostrar `me.email`, sin editar).
- Academia (mostrar `me.academy.name`).
- Role traducido (`"Estudiante"`).

---

## 6. UI / flujos — resumen por pantalla

### 6.1 Login y redirect inicial

- Login flow no cambia. `POST /login` devuelve token, luego `AuthProvider` llama `getMe()`.
- En `src/pages/Login.tsx` (verificar archivo): después de login exitoso, redirige basado en role:
  - `student` → `/inicio`
  - resto → `/students` (comportamiento actual)
- Si ya hay sesión activa (`me !== null`) y el usuario va a `/login`, redirigir según role.

### 6.2 Layout

- `me.role === 'student'` → sidebar con: Inicio (HomeIcon) · Clases (GraduationIcon) · Configuración (SettingsIcon).
- Otros roles → sidebar actual sin cambios.
- Header (`.topbar__title`) mantiene el `title` que pase la página.

### 6.3 Página `/inicio` (StudentHome)

Ver secciones 5.3-5.6. Llamada principal: `getMeHome()`. Una sola request, sin N+1.

### 6.4 Página `/clases` (StudentClasses)

Ver sección 5.8-5.9. Llamadas: `listStudentCourses()` + obtener `enrolled_courses` (puede venir de un `getMeHome()` cacheado en estado superior, o segunda llamada explícita).

### 6.5 Página `/configuracion` (StudentConfig)

Ver sección 5.10. Llamadas: `updateUser(me.id, payload)` y `changeMyPassword(...)`.

---

## 7. Ruta y navegación

- Rutas nuevas en [src/App.tsx](src/App.tsx):
  - `/inicio` → `<StudentHome />`
  - `/clases` → `<StudentClasses />`
  - `/configuracion` → `<StudentConfig />`
- Wrap con guard `<RoleRoute allow={['student']}>`.
- Wrap rutas admin existentes con `<RoleRoute allow={['admin','receptionist','instructor']}>` para evitar que students las visiten.
- Cambiar el `<Route path="/" element={<Navigate to="/students" replace />} />` por `<Route path="/" element={<DefaultRedirect />} />`.
- Catch-all `<Route path="*">` → también usa `<DefaultRedirect />`.

- Sidebar nuevo en [src/components/Layout.tsx](src/components/Layout.tsx): renderizar el bloque de links según `me?.role`. Mantener el bloque existente para roles admin.

- Íconos nuevos en [src/brand.tsx](src/brand.tsx): `HomeIcon`, `SettingsIcon`. Si no quieres dibujar SVGs nuevos, reusa los existentes y déjalo en el comentario, pero recomendado agregarlos para claridad visual.

---

## 8. Reglas y restricciones

- Todo en español (labels, errores, toasts, placeholders).
- CSS solo en [src/styles.css](src/styles.css). Sin inline styles para nuevas clases. Si necesitas estilos muy localizados, justifica en comentario.
- Sin libs nuevas. Solo `react`, `react-dom`, `react-router-dom`.
- Sin emojis en UI.
- Dinero siempre en cents en API; usar `formatMoney`, `fromCents`, `toCents` de [src/utils/money.ts](src/utils/money.ts).
- Fechas: usar `Intl.DateTimeFormat` o `toLocaleDateString('es-MX', ...)` (mismo patrón que ya usa `CourseDetails.tsx`). NO instalar date-fns ni dayjs.
- `next_session.datetime` viene en ISO con timezone; mostrar en zona horaria de la academia (`me.academy.timezone`). Si parsearlo es complejo en mobile, usar `toLocaleString` con `timeZone` option.
- Loading/empty/error en TODA lista (los 3 estados).
- Acciones destructivas (darse de baja) pasan por `<ConfirmModal danger>`.
- El FE NO valida ownership; confía en el BE. Pero el FE SÍ filtra navegación por role (UX, no seguridad).
- Toda llamada API maneja `ApiError`: muestra `err.message` en `.alert`, fallback genérico `"Ocurrió un error, intenta de nuevo"` para errores no-ApiError.

---

## 9. Definition of Done

- [ ] [src/types.ts](src/types.ts) actualizado con: `UserMe` enriquecido, `CourseStudentRead`, `CourseInstructorLinkPublic`, `MeHomeRead`, `PasswordChange`, `AcademyMe.students_can_self_unenroll`. Verificado contra `openapi.json`.
- [ ] [src/api.ts](src/api.ts) tiene `getMeHome`, `changeMyPassword`, `listStudentCourses`, `enrollMe`, `unenrollMe`. Todas lanzan `ApiError`.
- [ ] [src/brand.tsx](src/brand.tsx) tiene `HomeIcon` y `SettingsIcon`.
- [ ] [src/utils/transactionLabels.ts](src/utils/transactionLabels.ts) y [src/utils/enrollmentLabels.ts](src/utils/enrollmentLabels.ts) creados con traducciones.
- [ ] [src/styles.css](src/styles.css) tiene `.home-grid`, `.home-card`, `.home-card__title`, `.next-session-card`, `.course-card`, `.course-card-grid`, `.payment-row`, `.payment-row__category`, `.cta-explore`, `.config-section`.
- [ ] [src/App.tsx](src/App.tsx) tiene rutas `/inicio`, `/clases`, `/configuracion`, `<DefaultRedirect>` y `<RoleRoute>` aplicados a rutas relevantes.
- [ ] [src/components/Layout.tsx](src/components/Layout.tsx) filtra sidebar por `me.role`.
- [ ] Página `src/pages/StudentHome.tsx`: 4 KPIs, 2 columnas (pagos + clases inscritas), CTA "Explorar clases", SidePanel detalle de curso.
- [ ] Página `src/pages/StudentClasses.tsx`: catálogo en cards, search, flujo inscripción (1-click si sin costo, ConfirmModal si con costo), flujo baja (si flag activo).
- [ ] Página `src/pages/StudentConfig.tsx`: form perfil + form password + sección read-only de cuenta.
- [ ] Componente `src/components/StudentCourseDetail.tsx` reutilizable para SidePanel.
- [ ] Login y catch-all redirigen por role.
- [ ] `npm run typecheck` pasa sin warnings.
- [ ] `npm run lint` pasa.
- [ ] Loading/empty/error visibles en todas las listas.
- [ ] Probado en navegador con usuario student y usuario admin: cada uno ve solo lo suyo.

---

## Apéndice: supuestos del BE asumidos en este prompt

Si alguno NO es cierto al momento de implementar, ajustar:

1. `GET /me/home` existe y devuelve `MeHomeRead` con `next_session` incluido.
2. `GET /courses` devuelve `CourseStudentRead[]` (sin `hourly_rate`, sin `max_students`, con `has_capacity`) cuando el token es de un student.
3. `POST /enrollments` con `student_id = current_user.id` (para students) crea automáticamente la transaction SCHEDULED si `course.individual_cost > 0`.
4. `DELETE /enrollments/{course_id}/{student_id}` respeta el flag `academy.students_can_self_unenroll` (403 si está deshabilitado).
5. `POST /me/password` existe y acepta `{ current_password, new_password }`.
6. `AcademyMe.students_can_self_unenroll` está disponible en el bootstrap (`getMe()`).
7. `PATCH /users/{id}` permite al student editar su propio perfil con `UserUpdate`.

Si alguno falla, reportar antes de seguir codificando — NO meter workarounds que oculten el gap.
