# Prompt — Módulo de Comunicados

## 1. Contexto del proyecto

Cantera (SaaS de gestión de academias). Construir el **módulo de Comunicados**: el admin (y recepcionista) redactan y envían mensajes por **email** a un subconjunto de miembros de la academia — recordatorios de deuda, descuentos, eventos, asuetos o avisos generales. El alumno tiene una **bandeja de entrada** de solo lectura con los comunicados que recibió.

Este módulo **NO** es un CRUD tipo Students/Instructors: no parametrices `UsersModule.tsx`. Sigue la "Receta para un módulo CRUD nuevo" de STYLE_GUIDE.md y usa `Classes.tsx` / `Sales.tsx` como referencia de estructura (lista + `SidePanel`).

**Antes de tocar código, lee**: [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts).

Comportamiento del backend que **no** está en el schema:
- Ciclo de vida: `draft → sending → sent/failed`. Se crea siempre en `draft`. `PATCH`/`DELETE` solo funcionan en `draft` (si no, 409).
- **Envío asíncrono**: `POST /{id}/send` responde al instante con `status: "sending"` y contadores en 0. El envío real corre en background → hay que hacer **polling** a `GET /{id}` hasta que `status` sea `sent` o `failed`, leyendo `total_recipients`, `sent_count`, `failed_count`.
- **Solo email hoy** (sms/whatsapp fallan): `channels` siempre `["email"]`; `audience.contact_types` siempre `["self"]`. Ninguno de los dos se expone en la UI, pero se modelan como constante para el futuro multicanal.
- **Programación no disponible**: `scheduled_at` se guarda pero no auto-envía. NO construir UI de calendario/programación. Flujo real = crear borrador + enviar.

## 2. Identidad visual

Seguir tokens y clases de STYLE_GUIDE.md tal cual. No hex hardcoded. Badges de estado con el patrón de `Badges.tsx`. Si necesitas clases nuevas (p. ej. para el preview del correo o la barra de progreso de envío), van en [src/styles.css](src/styles.css), agrupadas con un comentario `/* Comunicados */`.

## 3. Enums

Todos existen ya en `openapi.json`. Labels en español:

```ts
type AnnouncementStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
type AnnouncementCategory = 'debt_reminder' | 'discount' | 'event' | 'holiday' | 'general';
type AnnouncementChannel = 'email' | 'sms' | 'whatsapp';
type AnnouncementContactType = 'self' | 'father' | 'mother' | 'external';
type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
```

| Enum | Valor | Label |
|------|-------|-------|
| `AnnouncementStatus` | `draft` | "Borrador" |
| | `scheduled` | "Programado" |
| | `sending` | "Enviando" |
| | `sent` | "Enviado" |
| | `failed` | "Fallido" |
| `AnnouncementCategory` | `debt_reminder` | "Recordatorio de deuda" |
| | `discount` | "Descuento" |
| | `event` | "Evento" |
| | `holiday` | "Asueto" |
| | `general` | "General" |
| `DeliveryStatus` | `pending` | "Pendiente" |
| | `sent` | "Enviado" |
| | `delivered` | "Entregado" |
| | `failed` | "Fallido" |
| | `read` | "Leído" |

`AnnouncementChannel` y `AnnouncementContactType` NO se muestran (constantes fijas: `['email']` y `['self']`).

## 4. Sincronización de tipos y API service

`src/types.ts` y `src/api.ts` **no tienen nada** de comunicados todavía. Agregar todo.

### 4.1 `src/types.ts`

Agregar (derivados de los schemas `Announcement*` / `Audience*` / `DeliveryStatus` del OpenAPI):

```ts
export type AnnouncementStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type AnnouncementCategory = 'debt_reminder' | 'discount' | 'event' | 'holiday' | 'general';
export type AnnouncementChannel = 'email' | 'sms' | 'whatsapp';
export type AnnouncementContactType = 'self' | 'father' | 'mother' | 'external';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface AnnouncementAudience {
  everyone?: boolean;            // default false
  roles?: UserRole[] | null;
  group_ids?: number[] | null;
  course_ids?: number[] | null;
  user_ids?: number[] | null;
  with_debt?: boolean | null;    // true=solo con deuda, false=solo sin, omitido=no filtra
  contact_types?: AnnouncementContactType[]; // default ['self'] — fijo, no exponer
}

export interface AnnouncementCreate {
  subject?: string | null;
  body: string;                              // texto plano; respeta saltos de línea, NO HTML
  category?: AnnouncementCategory;           // default 'general'
  channels?: AnnouncementChannel[];          // default ['email'] — fijo
  audience: AnnouncementAudience;
  scheduled_at?: string | null;             // se guarda pero no auto-envía; no exponer
}

export interface AnnouncementUpdate {
  subject?: string | null;
  body?: string | null;
  category?: AnnouncementCategory | null;
  channels?: AnnouncementChannel[] | null;
  audience?: AnnouncementAudience | null;
  scheduled_at?: string | null;
}

export interface AnnouncementRead {
  id: number;
  subject: string | null;
  body: string;
  category: AnnouncementCategory;
  channels: AnnouncementChannel[];
  audience: AnnouncementAudience | null;
  status: AnnouncementStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by_id: number | null;
  created_at: string | null;
}

export interface AnnouncementRecipientRead {
  id: number;
  user_id: number | null;
  contact_type: AnnouncementContactType;
  channel: AnnouncementChannel;
  destination: string;
  recipient_name: string | null;
  status: DeliveryStatus;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  user: UserPublic | null;
}

export interface AnnouncementPreviewRequest {
  subject?: string | null;
  body: string;
  channel?: AnnouncementChannel; // default 'email'
}

export interface AnnouncementPreviewResponse {
  subject: string | null;
  content: string;               // HTML final del correo
}

export interface AudiencePreviewItem {
  user_id: number | null;
  recipient_name: string | null;
  contact_type: AnnouncementContactType;
  channel: AnnouncementChannel;
  destination: string;
}

export interface AudiencePreviewRequest {
  channels?: AnnouncementChannel[]; // default ['email']
  audience: AnnouncementAudience;
}

export interface AudiencePreviewResponse {
  total: number;
  sample: AudiencePreviewItem[];
}

export interface ListAnnouncementsParams {
  status?: AnnouncementStatus;
  category?: AnnouncementCategory;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ListRecipientsParams {
  status?: DeliveryStatus;
  skip?: number;
  limit?: number;
}
```

### 4.2 `src/api.ts`

Agregar (mismo estilo que las demás: `authFetch`, `parseError`, lanzan `ApiError`). Sección con comentario `// ---------- Comunicados ----------`:

- `listAnnouncements(params: ListAnnouncementsParams = {}): Promise<AnnouncementRead[]>` → `GET /announcements` (querystring opcional: status, category, search, skip, limit).
- `getAnnouncement(id: number): Promise<AnnouncementRead>` → `GET /announcements/{id}`.
- `createAnnouncement(payload: AnnouncementCreate): Promise<AnnouncementRead>` → `POST /announcements`.
- `updateAnnouncement(id: number, payload: AnnouncementUpdate): Promise<AnnouncementRead>` → `PATCH /announcements/{id}`.
- `deleteAnnouncement(id: number): Promise<void>` → `DELETE /announcements/{id}`.
- `sendAnnouncement(id: number): Promise<AnnouncementRead>` → `POST /announcements/{id}/send`.
- `previewAnnouncement(payload: AnnouncementPreviewRequest): Promise<AnnouncementPreviewResponse>` → `POST /announcements/preview`.
- `previewAudience(payload: AudiencePreviewRequest): Promise<AudiencePreviewResponse>` → `POST /announcements/audience/preview`.
- `listRecipients(id: number, params: ListRecipientsParams = {}): Promise<AnnouncementRecipientRead[]>` → `GET /announcements/{id}/recipients`.
- `resendRecipient(id: number, recipientId: number): Promise<AnnouncementRecipientRead>` → `POST /announcements/{id}/recipients/{recipient_id}/resend`.
- `listMyAnnouncements(params?: { skip?: number; limit?: number }): Promise<AnnouncementRead[]>` → `GET /me/announcements`.

## 5. Modelo de datos / reglas de negocio

- **Estado y edición**: solo un comunicado en `draft` es editable/borrable. En cualquier otro estado, la UI muestra los datos en **solo lectura** y no ofrece editar/borrar (evita el 409 del backend). Si aun así llega un 409, mostrar el `ApiError.message`.
- **Audiencia (OR + dedup)**: `everyone: true` (o sin selectores) → todos los activos. `roles` / `group_ids` / `course_ids` / `user_ids` se **unen** y deduplican. `with_debt`: `true` solo con deuda, `false` solo sin deuda, **omitido** (no enviar la clave) = no filtra.
- **Construcción del payload de audiencia**: enviar solo las claves con valor. Si el usuario elige "Todos", mandar `{ everyone: true }`. Si elige selectores, mandar `everyone: false` + los arrays no vacíos. Siempre `contact_types: ['self']` y a nivel comunicado `channels: ['email']` (constantes, no inputs).
- **`body` es texto plano**: el textarea captura texto; respeta saltos de línea. NO insertar HTML. El HTML del correo lo genera el backend (`POST /preview` → `content`).
- **Preview de audiencia**: antes de enviar (y al cambiar los criterios) llamar `previewAudience` para mostrar "Le llegará a **N** personas" + una muestra (`sample`). Si `total === 0`, bloquear el envío.
- **Envío = irreversible** → siempre pasa por `ConfirmModal danger` ("Enviar comunicado", "Se enviará a N personas y no se puede deshacer.").
- **Polling tras enviar**: al recibir `status: "sending"`, hacer `getAnnouncement(id)` en intervalo (~2500 ms) hasta `status ∈ {sent, failed}`. Limpiar el intervalo al desmontar o al cerrar el panel. Mostrar progreso `sent_count + failed_count` / `total_recipients`. Al terminar: `sent` → éxito con contadores; `failed` → aviso con `failed_count` y CTA para ver destinatarios.
- **Reintentos**: en el detalle de destinatarios, cada fila con `status: 'failed'` puede reenviarse (`resendRecipient`). Refrescar esa fila tras el reintento.

## 6. UI / flujos

### 6.1 Lista de comunicados (`src/pages/Announcements.tsx`, admin/recepcionista)
- `Layout` con título "Comunicados" y acción "Nuevo comunicado" (abre `SidePanel` de composición).
- Filtros: `status`, `category`, `search`.
- Tabla — **1 comunicado = 1 renglón**: asunto (o primeras palabras del body si no hay asunto), categoría (badge), estado (badge), `sent_count/total_recipients`, fecha (`sent_at` o `created_at`). Acción por fila: ver detalle. En `draft`: editar / borrar (borrar vía `ConfirmModal danger`).
- Tres estados obligatorios: **cargando**, **vacío**, **error**, en español.

### 6.2 Composición / edición (`SidePanel`)
- Campos: `category` (`select`), `subject` (opcional), `body` (`textarea`, texto plano).
- **Audiencia**: toggle "Todos los activos" vs "Segmentar". Al segmentar:
  - `roles` (multi-check con los labels de rol),
  - `group_ids` → reutilizar `GroupPicker`,
  - `course_ids` → selector de cursos (usar `listCourses`),
  - `user_ids` → `UserAutocomplete` (limitado a alumnos; nota: busca por un rol),
  - `with_debt` → tri-estado: "No filtrar" / "Solo con deuda" / "Solo sin deuda".
- Debajo, en vivo: "Le llegará a **N** personas" (`previewAudience`, con debounce al cambiar criterios) + muestra opcional.
- Botones: **Previsualizar correo** (`previewAnnouncement` → modal con el `content` HTML renderizado, claramente marcado como vista previa), **Guardar borrador** (`createAnnouncement`/`updateAnnouncement`), y **Enviar** (solo admin; `ConfirmModal danger` → `sendAnnouncement` → polling).
- Validaciones: `body` no vacío; audiencia con al menos un criterio o "Todos"; `total > 0` para habilitar Enviar.

### 6.3 Detalle de destinatarios (bajo demanda)
- Desde el detalle de un comunicado enviado, sección/panel que llama `listRecipients` (filtro por `DeliveryStatus`).
- 1 fila por persona: `recipient_name`/`destination`, estado (badge), `error` si falló. Fila fallida → botón "Reenviar" (`resendRecipient`, solo admin).

### 6.4 Bandeja del alumno (`src/pages/StudentAnnouncements.tsx`)
- Lista de solo lectura (`listMyAnnouncements`). Aunque el backend devuelve `AnnouncementRead` completo, **renderizar solo** `subject`, `body`, `category` (badge) y `sent_at`. Ignorar `audience`, contadores y demás campos administrativos.
- Tres estados (cargando/vacío/error).

## 7. Ruta y navegación

- Rutas en [src/App.tsx](src/App.tsx):
  - `/comunicados` → `RoleRoute allow={['admin', 'receptionist']}` → `<Announcements />`.
  - Bandeja del alumno: `/mis-comunicados` (o dentro del shell de autoservicio) → `RoleRoute allow={['student', 'instructor', 'instructor_student']}` → `<StudentAnnouncements />`.
- Nav en [src/components/Layout.tsx](src/components/Layout.tsx):
  - Bloque admin/recepcionista (`else`): link "Comunicados" a `/comunicados` con `MailIcon` (ya existe en `brand.tsx`).
  - Bloque `student` y bloque `instructor/instructor_student`: link "Comunicados" a `/mis-comunicados` con `MailIcon`.

## 8. Reglas y restricciones

- Todo en español. Sin emojis en UI.
- CSS solo en [src/styles.css](src/styles.css). Sin libs nuevas (ni UI ni íconos).
- **Gating dentro de la UI**: `RoleRoute` deja entrar a recepcionista al módulo, pero **Enviar** y **Reenviar** son **solo admin** → ocultar/deshabilitar esos botones cuando `me?.role !== 'admin'`.
- No construir UI de programación (`scheduled_at`). No exponer `channels` ni `contact_types`.
- Acciones destructivas (borrar borrador, enviar) por `ConfirmModal danger`.
- El HTML del preview del correo viene del backend; renderizarlo aislado y marcado como "Vista previa" (no confundir con la UI de la app).

## 9. Definition of Done

- [ ] `src/types.ts` con todos los tipos `Announcement*` / `Audience*` / `DeliveryStatus` / params.
- [ ] `src/api.ts` con las 11 funciones (`listAnnouncements`, `getAnnouncement`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `sendAnnouncement`, `previewAnnouncement`, `previewAudience`, `listRecipients`, `resendRecipient`, `listMyAnnouncements`).
- [ ] `src/pages/Announcements.tsx`: lista con filtros, tabla (1 comunicado/renglón), estados loading/empty/error, panel de composición/edición con audiencia + preview de audiencia + preview de correo, borrar borrador.
- [ ] Envío con `ConfirmModal danger` + **polling** de estado hasta `sent`/`failed` con progreso; intervalo limpiado al desmontar.
- [ ] Detalle de destinatarios bajo demanda con filtro por estado y reenvío de fallidos (solo admin).
- [ ] `src/pages/StudentAnnouncements.tsx`: bandeja de solo lectura (subject/body/category/sent_at).
- [ ] Rutas en `App.tsx` y links en el sidebar (admin/recepcionista y autoservicio).
- [ ] Enviar/Reenviar ocultos para no-admin.
- [ ] `npm run typecheck` pasa sin warnings.
- [ ] Estados loading/empty/error visibles y en español en todas las listas.
