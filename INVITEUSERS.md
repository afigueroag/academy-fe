# Contexto del Proyecto
Eres un programador frontend colaborando con un backend developer para construir un SaaS llamado **AcademiaPro** para gestionar academias: deportes, artes marciales, artes, música, escuelas pequeñas, kinders y guarderías.

Tu misión es construir los módulos **"Estudiantes"** e **"Instructores"**. Estos módulos permiten al administrador invitar usuarios (por email), crearlos directamente, listarlos, editarlos y eliminarlos.

---

# Identidad Visual

**Paleta base** (CSS custom properties):
```css
--color-primary:   #6366F1;
--color-secondary: #8B5CF6;
--color-accent:    #06B6D4;
```
Estas variables deben poder cambiarse desde un archivo de configuración o tema. Los colores de la academia (obtenidos al hacer login) reemplazan los defaults.

**Estilo visual:** Refinado y moderno. Tipografía display llamativa (no Inter, no Roboto) combinada con una fuente de cuerpo legible. Solo SVG inline minimalistas. Sin librerías de iconos externas.

---

# Enums (valores exactos del backend)

```ts
type UserStatus      = "pending" | "active" | "inactive";
type PaymentMethod   = "credit_card" | "debit_card" | "paypal" | "bank_transfer" | "cash" | "other";
type UserRole        = "admin" | "receptionist" | "instructor" | "student";
```

---

# Layout General

**Menú lateral izquierdo** (persistente en toda la app):
- Estudiantes → `/students`
- Instructores → `/instructors`
- (Más módulos se agregarán progresivamente)
- Nombre del usuario logueado al fondo del menú

**Cabecera:** nombre del módulo activo.

Ambos módulos comparten estructura idéntica. Solo cambia el `role` con que se filtra y se crean usuarios.

---

# Módulo de Estudiantes (`/students`)

## Vista principal

**Tarjeta de resumen:**
- "Estudiantes activos" → count de `GET /users?role=student&status=active`

**Botones (arriba a la derecha):**
- **"Invitar Estudiante"** → abre panel lateral derecho con formulario de invitación
- **"Crear Estudiante"** → abre panel lateral derecho con formulario de creación completo

**Barra de filtros:**
- Campo de búsqueda (llama a `?search=`) — busca en nombre y apellido
- Selector de estado: Activos (default) | Pendientes | Inactivos | Todos

**Lista de estudiantes:**
Llama a `GET /users?role=student&status=active` (default al cargar).
Al cambiar filtros, actualiza los query params y vuelve a llamar.

Columnas: Nombre completo | Email | Estado | Acciones

**Badge de estado:**
- `pending`  → "Pendiente"  (amarillo)
- `active`   → "Activo"     (verde)
- `inactive` → "Inactivo"   (gris)

**Acciones por fila:** botón **"Editar"** | botón **"Ver detalles"**

---

## Panel lateral: Invitar Estudiante

Endpoint: `POST /users/invite` — `Authorization: Bearer <token>`

```json
{
  "first_name": "string",   // requerido
  "last_name":  "string",   // requerido
  "email":      "string",   // requerido — validar formato email
  "role":       "student"   // fijo, no visible
}
```

Respuesta 201: `{ invite_token, token_type }` — el sistema envía el email al invitado automáticamente. El FE no necesita usar el token.

**Estados:** loading durante el envío → éxito con mensaje "Invitación enviada a {email}" → cierra el panel y actualiza la lista.

---

## Panel lateral: Crear Estudiante

Endpoint: `POST /users` — `Authorization: Bearer <token>`

```json
{
  "first_name":          "string",            // requerido
  "last_name":           "string",            // requerido
  "role":                "student",           // fijo, no visible
  "email":               "string | null",     // opcional — validar formato si se llena
  "phone":               "string | null",     // opcional
  "address":             "string | null",     // opcional
  "date_of_birth":       "YYYY-MM-DD | null", // opcional — date picker
  "start_date":          "YYYY-MM-DD | null", // opcional — date picker
  "payment_method":      "PaymentMethod | null", // opcional — select
  "special_conditions":  "string | null"      // opcional — textarea
}
```

**Campo `payment_method`** — renderizar como `<select>` con estas opciones:
| Valor            | Label                  |
|------------------|------------------------|
| `credit_card`    | Tarjeta de crédito     |
| `debit_card`     | Tarjeta de débito      |
| `paypal`         | PayPal                 |
| `bank_transfer`  | Transferencia bancaria |
| `cash`           | Efectivo               |
| `other`          | Otro                   |

Respuesta 201: `UserRead` — cierra el panel, agrega el usuario a la lista.

---

## Panel lateral: Editar Usuario

Endpoint: `PATCH /users/{id}` — `Authorization: Bearer <token>`

Mismos campos que "Crear Estudiante", excepto `role` y `email` (no editables).

Campo adicional visible solo en edición:
- **Estado** (`status`) — select: `active` → "Activo" | `inactive` → "Inactivo"
  > No ofrecer `pending` como opción seleccionable manualmente.

```json
{
  "first_name":         "string",             // requerido
  "last_name":          "string",             // requerido
  "phone":              "string | null",
  "address":            "string | null",
  "date_of_birth":      "YYYY-MM-DD | null",
  "start_date":         "YYYY-MM-DD | null",
  "payment_method":     "PaymentMethod | null",
  "special_conditions": "string | null",
  "status":             "active | inactive | null"
}
```

Respuesta 200: `UserRead` — actualiza la fila en la lista sin recargar.

---

## Panel lateral: Ver Detalles

Endpoint: `GET /users/{id}` — `Authorization: Bearer <token>`

Muestra todos los campos de `UserRead` en modo lectura. Incluye botón "Editar" que abre el panel de edición.

---

## Eliminar Usuario

Endpoint: `DELETE /users/{id}` — `Authorization: Bearer <token>`

- Mostrar modal de confirmación antes de ejecutar: "¿Eliminar a {nombre}? Esta acción no se puede deshacer."
- Respuesta 200: elimina la fila de la lista.

---

# Módulo de Instructores (`/instructors`)

Idéntico al módulo de Estudiantes. Diferencias:

| Elemento            | Estudiantes                | Instructores                |
|---------------------|----------------------------|-----------------------------|
| Filtro API          | `?role=student`            | `?role=instructor`          |
| Tarjeta resumen     | "Estudiantes activos"      | "Instructores activos"      |
| Botones             | Invitar / Crear Estudiante | Invitar / Crear Instructor  |
| Campo `role` oculto | `"student"`                | `"instructor"`              |

Los formularios de Invitar, Crear, Editar y Ver Detalles son los mismos en estructura.

---

# Ruta: Aceptar Invitación (`/invite`)

Cuando el usuario invitado hace clic en el enlace de su email llega a:
```
/invite?token=<invite_token>
```

**Al cargar la página** — usa el token del query string como Bearer:
```
GET /invites
Authorization: Bearer <token_del_query_string>
```
Respuesta 200: `{ first_name, last_name, id }` — muestra el nombre pre-cargado ("Hola, {first_name}").
Respuesta 401: token inválido o expirado → mostrar mensaje de error.

**Formulario que llena el invitado:**
- Email (`email`) — requerido — validar formato
- Contraseña (`password`) — requerido — mínimo 8 caracteres

```
POST /invites
Authorization: Bearer <token_del_query_string>
Content-Type: application/json
{ "email": "...", "password": "..." }
```

Respuesta 200: cuenta activada → redirige a `/login` con mensaje de éxito.
Respuesta 401: email no coincide con el invitado → mostrar error inline.

---

# Referencia de API — Resumen

Todas las rutas autenticadas requieren:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

El `access_token` se obtiene del `localStorage` bajo la clave `access_token`.

| Método | Ruta          | Body schema  | Respuesta         |
|--------|---------------|--------------|-------------------|
| GET    | /users        | —            | UserRead[]        |
| POST   | /users        | UserCreate   | UserRead (201)    |
| POST   | /users/invite | UserInvite   | InviteToken (201) |
| GET    | /users/{id}   | —            | UserRead          |
| PATCH  | /users/{id}   | UserUpdate   | UserRead          |
| DELETE | /users/{id}   | —            | UserPublic        |
| GET    | /invites      | —            | UserPublic        |
| POST   | /invites      | UserPassword | UserPublic        |

**Query params de `GET /users`:**

| Param    | Tipo    | Default    | Descripción                           |
|----------|---------|------------|---------------------------------------|
| `role`   | string  | —          | `"student"` o `"instructor"`          |
| `status` | string  | `"active"` | `"pending"`, `"active"`, `"inactive"` |
| `search` | string  | `""`       | Busca en `first_name` y `last_name`   |
| `skip`   | integer | `0`        | Paginación — offset                   |
| `limit`  | integer | `100`      | Paginación — tamaño de página         |

**Schema `UserRead`:**
```ts
{
  id:                 number
  first_name:         string
  last_name:          string
  email:              string | null
  phone:              string | null
  address:            string | null
  date_of_birth:      string | null   // "YYYY-MM-DD"
  start_date:         string | null   // "YYYY-MM-DD"
  payment_method:     PaymentMethod | null
  special_conditions: string | null
  status:             UserStatus      // "pending" | "active" | "inactive"
  is_active:          boolean
  academy:            { name: string, type: string }
}
```

---

# Configuración Técnica

```env
VITE_API_URL=http://127.0.0.1:8000/
```

Todas las llamadas al API usan esta variable. No hardcodear URLs.

---

# Reglas de Implementación

1. **Iconos:** Solo SVG inline minimalistas. Sin Font Awesome, Heroicons ni librerías externas.
2. **Colores:** CSS custom properties desde el inicio.
3. **Validación:** Client-side antes de enviar — campos requeridos, formato email, fechas válidas.
4. **Estados de UI:** Loading, error y éxito en cada llamada al API.
5. **Accesibilidad:** Labels asociados a inputs, foco visible, roles ARIA básicos.
6. **Sin dependencias innecesarias:** CSS y JS nativo cuando sea suficiente.
7. **Estructura clara:** Separa componentes, servicios API, tipos y estilos desde el inicio.
8. **Token:** Leer `access_token` de `localStorage`. Incluirlo en todas las llamadas autenticadas.

---

# Entregables Esperados

- [ ] Layout con menú lateral (reutilizable entre módulos)
- [ ] Página `/students` — lista, filtros, tarjeta de resumen
- [ ] Página `/instructors` — idéntica a `/students` con role distinto
- [ ] Panel lateral: Invitar usuario (compartido, parametrizable por role)
- [ ] Panel lateral: Crear usuario (compartido, parametrizable por role)
- [ ] Panel lateral: Editar usuario
- [ ] Panel lateral: Ver detalles
- [ ] Página `/invite` — flujo de aceptar invitación
- [ ] Servicio de API (`api.ts` o equivalente) con todas las llamadas necesarias
- [ ] Tipos TypeScript derivados del OpenAPI (`types.ts`)
