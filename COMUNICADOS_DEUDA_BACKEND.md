# Solicitud backend — Recordatorio de deuda personalizado

## 1. Contexto y objetivo

Sobre el módulo de Comunicados ya existente (`Announcement*`), queremos un flujo para
**recordatorios de deuda personalizados**: enviar a un alumno (o a todos los que tienen
deuda) un correo con **su saldo real, el desglose de adeudos y su fecha de vencimiento**,
calculados por el backend al momento de enviar.

Puntos de entrada en el front:
- **Por-estudiante**: botón "Enviar recordatorio de deuda" en la ficha del alumno
  (módulo Estudiantes), para un alumno con deuda.
- **Masivo**: desde Comunicados, reutilizando el filtro `audience.with_debt = true`.

En ambos casos se crea un `Announcement` normal (se lista y audita en Comunicados) y se
usa el ciclo de vida actual `draft → sending → sent/failed` con polling.

### Principio de diseño (lo que condiciona todo)

Hoy el `body` es **un texto plano único compartido** por todos los destinatarios. Un
recordatorio de deuda es **por-persona**. Por eso separamos el correo en dos capas:

| Capa | La define | ¿Editable por el admin? |
|------|-----------|--------------------------|
| **Prosa** (asunto, saludo, nota, cierre) | El admin (el backend la sugiere pre-llenada) | Sí — es el `body`/`subject` |
| **Bloque de datos de deuda** (saldo, desglose, vencimiento) | El backend, por destinatario, al enviar | No — son datos duros |

Regla: **los números los pone el sistema, la prosa la pone el admin.** El admin nunca
teclea un monto; así el correo jamás se desincroniza del estado de cuenta.

---

## 2. Resumen de cambios (TL;DR)

1. **Nuevo campo `template`** en `AnnouncementCreate/Update/Read`
   (`'plain' | 'debt_reminder'`, default `'plain'`). Es el disparador de la
   personalización de deuda. No cambia nada del comportamiento actual (`plain`).
2. **Plantilla de correo dedicada** para `debt_reminder`, que renderiza el bloque de
   deuda por destinatario alrededor de la prosa del admin.
3. **Snapshot de deuda por destinatario** al enviar, guardado en el recipient y
   expuesto en `AnnouncementRecipientRead.context` (histórico fiel).
4. **Endpoint nuevo** `POST /announcements/debt-reminder/suggest`: devuelve un borrador
   sugerido (asunto + prosa + audiencia) para pre-llenar el compositor.
5. **Extensión de los dos previews** (`/preview` y `/audience/preview`) para que acepten
   `template` y rendericen/cuenten con datos de deuda reales.
6. **Cambio de permisos**: admin **y recepcionista** pueden enviar/reenviar recordatorios
   de deuda (el resto de envíos sigue siendo solo-admin).
7. **Regla de envío**: al enviar un `debt_reminder`, se **excluyen** los destinatarios sin
   deuda vigente (se recalcula al momento del envío).

Todo lo demás del módulo (paths, estados, polling, listado) queda igual.

---

## 3. Modelo de datos

### 3.1 `Announcement`: nuevo campo `template`

Nuevo enum:

```
AnnouncementTemplate = 'plain' | 'debt_reminder'
```

Agregarlo a:
- `AnnouncementCreate.template` — opcional, default `'plain'`.
- `AnnouncementUpdate.template` — opcional, nullable.
- `AnnouncementRead.template` — requerido (default `'plain'` para los existentes).

Semántica: si `template === 'debt_reminder'`, el envío usa la plantilla dedicada e
inyecta el bloque de deuda por destinatario. `category` sigue siendo taxonomía/etiqueta
(seguiremos usando `category: 'debt_reminder'` para el badge, pero **el disparador de
comportamiento es `template`**, no `category`).

> Alternativa más ligera si prefieren no agregar campo: usar `category === 'debt_reminder'`
> como disparador. Lo desaconsejamos porque acopla presentación con taxonomía y bloquea
> tener, p. ej., un aviso de deuda en texto plano. Pero es viable si les simplifica.

### 3.2 `AnnouncementRecipient`: snapshot de deuda

Al enviar, guardar en cada recipient los números usados, y exponerlos read-only:

```
AnnouncementRecipientRead.context: DebtSnapshot | null
```

```
DebtSnapshot {
  amount: int              // saldo total adeudado, en cents (snapshot al enviar)
  currency: string         // moneda de la academia
  next_due_date: string | null   // ISO date
  items: DebtItem[]        // desglose de adeudos incluidos
}

DebtItem {
  description: string
  category: TransactionCategory
  amount: int              // cents
  period_start: string | null
  period_end: string | null
  overdue: boolean         // vencida según payment_grace_days
}
```

Con esto el front puede mostrar en el detalle del destinatario "se le recordó $X" aunque
la deuda cambie después. Para `template = 'plain'`, `context` es `null`.

---

## 4. Plantilla de correo dedicada (`debt_reminder`)

HTML server-side (como el template actual), con esta estructura:

```
[ Encabezado / marca de la academia ]
[ Saludo personalizado: "Hola {recipient_name}," ]
[ PROSA del admin  ← body del Announcement (texto plano, respeta saltos de línea) ]
[ BLOQUE DE DEUDA:
    - Saldo total: {formatMoney(amount, currency)}
    - Tabla de adeudos: concepto | periodo | monto | (Vencido) por cada item
    - Próximo vencimiento: {next_due_date} (+ días de gracia)
]
[ Pie / instrucciones de pago ]
```

- La **prosa** (`body`) es opcional y **compartida**; el bloque de deuda es
  **por-destinatario**.
- Si `body` viene vacío, se omite esa sección y el correo es 100% plantilla.
- Localización en español; montos con la moneda de la academia.

---

## 5. Resolución del bloque de deuda (qué datos, cómo)

**Reutilizar exactamente la misma lógica** que ya alimenta `UserRead.debt_amount`,
`UserRead.pending_transactions` y `UserRead.next_due_date/next_due_amount`. No inventar un
cálculo nuevo: el correo debe coincidir con lo que el admin ve en la tabla de Estudiantes.

- `amount` = `debt_amount` del alumno (cents).
- `items` = sus `pending_transactions` (concepto, categoría, monto, periodo), marcando
  `overdue` según `payment_grace_days` de la academia.
- `next_due_date` / próximo vencimiento = los mismos campos que ya expone el usuario.
- `contact_type` = `'self'` (correo al alumno). `channel` = `'email'`.

---

## 6. Endpoints

### 6.1 Sugerir borrador — NUEVO

```
POST /announcements/debt-reminder/suggest
body: { user_id?: number | null }   // presente = 1 alumno; ausente = masivo (con deuda)
resp 200: AnnouncementCreate (sugerido)
```

Devuelve un borrador **pre-llenado** que el front abre en el compositor:

```jsonc
{
  "subject": "Recordatorio de pago",
  "body": "Te compartimos el estado de tu cuenta...",   // PROSA genérica, sin números
  "category": "debt_reminder",
  "template": "debt_reminder",
  "channels": ["email"],
  "audience": {                     // user_id → { user_ids:[id] }; sin user_id → { with_debt:true }
    "everyone": false,
    "user_ids": [123],
    "contact_types": ["self"]
  }
}
```

- La **prosa sugerida vive en el backend** (consistencia y localización sin re-deploy del
  front). No incluye montos (esos van en el bloque de datos).
- El front **no crea nada** con esta llamada; solo pre-llena. El alta ocurre con el
  `POST /announcements` actual cuando el admin guarda o envía.

### 6.2 Preview del correo — EXTENSIÓN

Extender `AnnouncementPreviewRequest`:

```
AnnouncementPreviewRequest {
  subject?: string | null
  body: string
  channel?: AnnouncementChannel        // ya existe
  template?: AnnouncementTemplate      // NUEVO, default 'plain'
  user_id?: number | null              // NUEVO: destinatario para renderizar el bloque
}
```

Comportamiento cuando `template = 'debt_reminder'`:
- Con `user_id`: renderiza el bloque con la **deuda real** de ese alumno (caso
  por-estudiante → preview WYSIWYG del correo final).
- Sin `user_id`: renderiza con valores de **ejemplo/placeholder** (caso masivo). El front
  puede tomar un `user_id` de muestra desde `audience/preview.sample`.

Respuesta sin cambios (`{ subject, content }`).

### 6.3 Envío — CAMBIO DE COMPORTAMIENTO

En `POST /announcements/{id}/send`, cuando `template = 'debt_reminder'`:
1. Re-resolver la audiencia al momento del envío.
2. **Excluir a quien no tenga deuda vigente** (no crear recipient ni contarlo en
   `total_recipients`) — cubre la carrera "pagó entre redactar y enviar".
3. Por cada destinatario con deuda: calcular snapshot, renderizar el correo personalizado,
   guardar `context`.
4. Si tras filtrar **nadie tiene deuda**: responder 200 con `status: 'sent'` y
   `total_recipients: 0` (no es error). El front ya bloquea el envío cuando el preview da 0,
   pero el backend debe resolverlo con gracia.

`/audience/preview` — extensión opcional recomendada: aceptar `template` en
`AudiencePreviewRequest` y, si es `debt_reminder`, **contar solo a los deudores**, para que
el "Le llegará a N personas" del front sea exacto en el caso masivo.

```
AudiencePreviewRequest {
  channels?: AnnouncementChannel[]
  audience: AnnouncementAudience
  template?: AnnouncementTemplate      // NUEVO, default 'plain'
}
```

---

## 7. Permisos

Regla objetivo (el front la refleja ocultando botones, pero el backend debe **hacerla
cumplir**):

| Acción | admin | receptionist |
|--------|:-----:|:------------:|
| Crear/editar/borrar borrador `debt_reminder` | ✅ | ✅ |
| Enviar `POST /{id}/send` de un `debt_reminder` | ✅ | ✅ |
| Reenviar `POST /{id}/recipients/{rid}/resend` de un `debt_reminder` | ✅ | ✅ |
| Enviar/reenviar cualquier otro comunicado (`plain`) | ✅ | ❌ (sigue solo-admin) |

Es decir: **el envío de recordatorios de deuda es la única excepción** a la regla actual
"enviar = solo admin".

---

## 8. Reglas de negocio y casos borde

- **Snapshot al enviar**: pagos posteriores no alteran el registro ni el `context`.
- **Definición de deuda**: idéntica a la que ya usa `UserRead.debt_amount` /
  `pending_transactions`. Confirmar qué categorías cuentan (tuition, enrollment_fee, etc.)
  reutilizando esa misma definición.
- **Montos en cents** (int), como el resto de la API. Moneda desde la academia.
- **Sin destinatario/sin email**: si el alumno no tiene correo, marcar el recipient como
  `failed` con `error` legible (igual que hoy).
- **Canal y contacto**: `email` + `self`. Padre/madre y SMS/WhatsApp quedan fuera de alcance.
- **Reenvíos**: enviar dos veces genera dos `Announcement` distintos (cada envío es su
  propio registro); es el comportamiento esperado.

---

## 9. Delta de contrato (OpenAPI) que el front espera

- Nuevo enum `AnnouncementTemplate = 'plain' | 'debt_reminder'`.
- `AnnouncementCreate.template?`, `AnnouncementUpdate.template?`,
  `AnnouncementRead.template` (requerido, default `plain`).
- `AnnouncementRecipientRead.context: DebtSnapshot | null` (+ schemas `DebtSnapshot`,
  `DebtItem`).
- `AnnouncementPreviewRequest.template?`, `AnnouncementPreviewRequest.user_id?`.
- `AudiencePreviewRequest.template?`.
- Nuevo path `POST /announcements/debt-reminder/suggest`.
- Autorización actualizada en `send` y `resend` para `debt_reminder`.

Contrato TypeScript resultante que consumirá el front (referencia):

```ts
export type AnnouncementTemplate = 'plain' | 'debt_reminder';

export interface DebtItem {
  description: string;
  category: TransactionCategory;
  amount: number;                 // cents
  period_start: string | null;
  period_end: string | null;
  overdue: boolean;
}
export interface DebtSnapshot {
  amount: number;                 // cents
  currency: string;
  next_due_date: string | null;
  items: DebtItem[];
}

// + template en Announcement*, + context en AnnouncementRecipientRead,
// + template/user_id en AnnouncementPreviewRequest, + template en AudiencePreviewRequest,
// + suggestDebtReminder(user_id?) → AnnouncementCreate
```

---

## 10. Fuera de alcance (futuro)

- SMS / WhatsApp (multicanal) y contactos padre/madre.
- Programación (`scheduled_at`) con auto-envío.
- Link/portal de pago dentro del correo.
- Instrucciones de pago configurables a nivel academia (hoy irían fijas en el pie del
  template).
- Otras plantillas dedicadas (bienvenida, recibo, etc.) — el campo `template` ya deja la
  puerta abierta.
