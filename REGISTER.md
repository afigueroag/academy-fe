# Contexto del Proyecto
Eres un programador frontend colaborando con un backend developer para construir un SaaS llamado **AcademiaPro** para gestionar academias: deportes, artes marciales, artes, música, escuelas pequeñas, kinders y guarderías.

Tu misión: construir el frontend de **registro** e **inicio de sesión**.

---

# Identidad Visual

Genera un **nombre de marca** y un **logo SVG minimalista** coherentes con la gestión de academias diversas. El nombre debe sonar profesional pero accesible.

**Paleta base** (CSS custom properties):
```css
--color-primary:   #6366F1;
--color-secondary: #8B5CF6;
--color-accent:    #06B6D4;
```
Estas variables deben poder cambiarse desde un archivo de configuración o tema. Los colores de la academia reemplazan los defaults al hacer login (ver sección Login).

Los colores vienen del API **sin `#`** (ej: `"6366F1"`). Al leerlos, agrégalo antes de asignarlos a las CSS variables: `"#" + color`.
Al enviarlos, quita el `#`: `color.replace('#', '')`.

**Estilo visual:** Refinado y moderno. Tipografía display llamativa (no Inter, no Roboto) + fuente de cuerpo legible. Solo SVG inline minimalistas. Sin librerías de iconos externas.

---

# Enums

```ts
type AcademyType =
  | "school"
  | "dance_academy"
  | "music_academy"
  | "martial_arts_academy"
  | "sports_academy"
  | "art_academy"
  | "holistic_center_yoga"
  | "other";

type AcademyPlan = "starter" | "professional";
```

Labels para el select de `academy_type`:
| Valor                   | Label                  |
|-------------------------|------------------------|
| `school`                | Escuela                |
| `dance_academy`         | Academia de danza      |
| `music_academy`         | Academia de música     |
| `martial_arts_academy`  | Academia de artes marciales |
| `sports_academy`        | Academia deportiva     |
| `art_academy`           | Academia de arte       |
| `holistic_center_yoga`  | Centro holístico / Yoga|
| `other`                 | Otro                   |

---

# Pantalla 1 — Registro (`/register`)

Formulario en **3 pasos (stepper)**. Un solo `POST /register` al final con todos los campos.

## Paso 1: Información de la Academia

- Nombre de la academia (`academy_name`) — requerido
- Tipo de academia (`academy_type`) — `<select>` con AcademyType enum — requerido
- Color primario (`academy_primary_color`) — color picker — opcional
- Color secundario (`academy_secondary_color`) — color picker — opcional
- Color de acento (`academy_accent_color`) — color picker — opcional

> Muestra un preview en tiempo real de los colores seleccionados aplicándolos
> como CSS custom properties en la propia pantalla de registro.
> Enviar al API sin `#` (ej: `"6366F1"`).

## Paso 2: Información del Owner

- Nombre (`first_name`) — requerido
- Apellido (`last_name`) — requerido
- Email (`email`) — requerido — validar formato
- Contraseña (`password`) — requerido — mínimo 8 caracteres
- Teléfono (`phone`) — opcional

## Paso 3: Plan

- Selector visual (`academy_plan`): `starter` | `professional`
- Mostrar descripción y diferencias entre planes
- Default: `starter`

## CTA: "Crear mi academia"

Endpoint: `POST /register` — `Content-Type: application/json`

```json
{
  "academy_name":             "string",        // requerido
  "academy_type":             "AcademyType",   // requerido
  "first_name":               "string",        // requerido
  "last_name":                "string",        // requerido
  "email":                    "string",        // requerido
  "password":                 "string",        // requerido
  "phone":                    "string | null",
  "academy_primary_color":    "string | null", // sin #
  "academy_secondary_color":  "string | null", // sin #
  "academy_accent_color":     "string | null", // sin #
  "academy_plan":             "starter | professional | null"
}
```

- HTTP 201 → redirige a `/login`
- HTTP 422 → muestra el mensaje de error inline junto al campo correspondiente

---

# Pantalla 2 — Login (`/login`)

## Formulario

- Email (label visible: "Email" — se envía como `username`)
- Contraseña (`password`)
- Botón "Iniciar sesión"

## Llamada al API

> ⚠️ Este endpoint usa OAuth2 Password Flow.
> El `Content-Type` es `application/x-www-form-urlencoded`, NO JSON.
> El campo email se envía bajo la clave `username`.

```
POST /login
Content-Type: application/x-www-form-urlencoded

username=<email>&password=<contraseña>
```

Respuesta 200: `{ access_token: string, token_type: string }`

## Al autenticarse con éxito

**1. Guardar el token:**
```ts
localStorage.setItem('access_token', data.access_token);
```
> Se usa `localStorage` para que la sesión persista entre pestañas y recargas.
> Evaluar migrar a cookie `httpOnly` en producción para mayor seguridad.

**2. Obtener datos del usuario y academia:**

Inmediatamente después del login, llama a:
```
GET /me
Authorization: Bearer <access_token>
```
> ⚠️ Este endpoint está **pendiente de implementación en el backend**.
> Debe devolver como mínimo:
> ```ts
> {
>   id: number
>   first_name: string
>   last_name: string
>   academy: {
>     name: string
>     plan: "starter" | "professional"
>     primary_color: string    // sin #
>     secondary_color: string  // sin #
>     accent_color: string     // sin #
>   }
> }
> ```

**3. Aplicar colores al tema:**
```ts
document.documentElement.style.setProperty('--color-primary',   '#' + me.academy.primary_color);
document.documentElement.style.setProperty('--color-secondary', '#' + me.academy.secondary_color);
document.documentElement.style.setProperty('--color-accent',    '#' + me.academy.accent_color);
```

**4. Guardar en estado global (context/store):**
- `user.id`, `user.first_name`, `user.last_name`
- `academy.name`, `academy.plan`
- `academy.primary_color`, `academy.secondary_color`, `academy.accent_color`

**5. Redirigir a `/students`** (módulo principal post-login)

## Manejo de errores

- HTTP 401 → "Email o contraseña incorrectos" — mensaje inline bajo el formulario
- Error de red → "No se pudo conectar al servidor. Intenta de nuevo."
- Si `GET /me` falla → redirigir a `/login` y limpiar el token

---

# Configuración Técnica

```env
VITE_API_URL=http://127.0.0.1:8000/
```

Todas las llamadas al API usan esta variable. No hardcodear URLs.

---

# Reglas de Implementación

1. **Iconos:** Solo SVG inline minimalistas. Sin Font Awesome, Heroicons ni librerías externas.
2. **Colores:** CSS custom properties desde el inicio. Los colores llegan del API sin `#`.
3. **Validación:** Client-side antes de enviar — campos requeridos, formato email, contraseña mínimo 8 caracteres.
4. **Estados de UI:** Loading, error y éxito en cada llamada al API.
5. **Accesibilidad:** Labels asociados a inputs, foco visible, roles ARIA básicos.
6. **Sin dependencias innecesarias:** CSS y JS nativo cuando sea suficiente.
7. **Estructura clara:** Separa componentes, servicios API, tipos y estilos desde el inicio.
8. **Token:** Guardado en `localStorage` bajo la clave `access_token`. Todas las rutas protegidas lo leen de ahí.

---

# Entregables Esperados

- [ ] Página `/register` con stepper de 3 pasos y preview de colores en tiempo real
- [ ] Página `/login` con flujo completo (token + GET /me + aplicar tema)
- [ ] Servicio de API (`api.ts` o equivalente): `register()`, `login()`, `getMe()`
- [ ] Tipos TypeScript derivados del OpenAPI (`types.ts`)
- [ ] Configuración de variables de entorno (`.env.example`)
- [ ] Logo SVG + nombre de marca propuesto
