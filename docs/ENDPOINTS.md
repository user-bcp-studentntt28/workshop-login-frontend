# Endpoints externos consumidos por el frontend

Este documento describe el cliente actual, no una especificación del backend.
Las URLs proceden de [environment.ts](../src/environments/environment.ts).
Los ejemplos reproducen valores de pruebas y credenciales del laboratorio; no
son capturas de peticiones reales ni tokens válidos emitidos por un servidor.
La búsqueda en `src/` identifica dos llamadas HTTP externas: login y tareas.

## Autenticación — POST http://localhost:8080/auth/login

### 1. Quién lo llama

[LoginComponent](../src/app/login/login.component.ts) ejecuta `login()` al
pulsar «Ingresar» y delega en
[AuthService.authenticate](../src/app/services/auth.service.ts).
El servicio realiza el POST con Axios, valida la respuesta y guarda la sesión
mediante [SessionService](../src/app/services/session.service.ts).

### 2. Qué envía

No hay parámetros de ruta ni query. Se envía un objeto serializado como JSON.

| Ubicación | Nombre | Valor / regla |
|---|---|---|
| Header | `Accept` | `application/json, text/plain, */*`, valor por defecto de Axios. |
| Header | `Content-Type` | `application/json`, establecido por Axios al serializar el objeto. |
| Header | `Authorization` | La llamada de login no lo configura ni envía un token de sesión. |
| Body | `username` | String del campo de usuario. Se rechaza si `trim()` queda vacío, pero se envía el valor original, sin recortarlo. |
| Body | `password` | String del campo de contraseña. Misma validación de vacío; se envía sin recortar. |
| Body | `client` | String fijo `angular-workshop`, tomado del ambiente. |
| Configuración del cliente | `timeout` | 5000 ms; no es un campo del body ni un header. |

Ejemplo usado en
[auth.service.spec.ts](../src/app/services/auth.service.spec.ts):

```http
POST http://localhost:8080/auth/login
Accept: application/json, text/plain, */*
Content-Type: application/json

{
  "username": "student",
  "password": "Workshop123!",
  "client": "angular-workshop"
}
```

Los headers automáticos del navegador no forman parte de la configuración de
esta aplicación. No se configura `withCredentials` ni autenticación por cookies.

### 3. Qué espera recibir en éxito

**Estado HTTP aceptado:** cualquier 2xx (200 a 299), por el `validateStatus`
por defecto de Axios. El servicio no exige específicamente 200. Un estado 2xx
no basta: el body debe superar `parseLoginResponse`.
**Pregunta abierta:** ¿qué código de éxito devuelve realmente el backend?
Las pruebas simulan `data`, no verifican un código emitido por el servidor.

| Campo | Tipo aceptado | Obligatorio / validación | Uso |
|---|---|---|---|
| Body raíz | Objeto no nulo, no array | Obligatorio | Contiene `token` y `user`. |
| `token` | String no vacío | Obligatorio; no se recorta ni se valida como JWT | Se guarda y se usa para autorizar la consulta de tareas. |
| `user` | Objeto no nulo, no array | Obligatorio | Se conserva como datos del usuario. |
| `user.username` | String | Obligatorio; el validador permite el string vacío | Se envía como `owner` al consultar tareas y sirve de nombre alternativo en el saludo. |
| `user.displayName` | String o `null` | Opcional | El saludo lo prefiere cuando es un string no vacío. |
| Otros campos de `user` | Cualquier valor | Opcionales, sin validación adicional | Se conservan al serializar el usuario; la UI actual no los consume. |
| Otros campos de la raíz | Cualquier valor | Opcionales | El parser los ignora. |

Ejemplo de body exitoso del fixture de autenticación:

```json
{
  "token": "token",
  "user": {
    "username": "student"
  }
}
```

Tras validarlo, el servicio guarda token y usuario en `sessionStorage` bajo
`workshop_token` y `workshop_user`. El componente guarda las preferencias en
`localStorage` (`workshop_preferences`) y solicita navegar a `/dashboard`.
Durante el intento el botón está deshabilitado y muestra «Ingresando...» con
spinner; `finally` restablece `busy` incluso si ocurre un error.

### 4. Cómo reacciona ante errores

La traducción de errores está en
[toUserFacingError](../src/app/utils/api-error.ts).
No se lee ni se muestra `response.data.message`; el detalle del backend no es
necesario para producir el mensaje de UI.

| Situación | Reacción actual de la UI y del cliente |
|---|---|
| Usuario vacío o solo espacios | No se hace POST. Muestra «Ingrese un usuario.». |
| Contraseña vacía o solo espacios, con usuario válido | No se hace POST. Muestra «Ingrese una contraseña.». |
| HTTP 401 (error Axios) | Muestra «Usuario o contraseña incorrectos.», restablece el botón y no solicita navegar al dashboard. |
| HTTP 403, 400, 422, 5xx u otro estado rechazado por Axios | Muestra «No se pudo iniciar sesión. Inténtalo de nuevo.». No distingue esos estados ni expone el body del error. |
| Timeout del POST a los 5000 ms | Mismo mensaje genérico de login; `busy` vuelve a `false`. No hay reintento automático. |
| Fallo de red, bloqueo CORS o cancelación que rechace la promesa | Mismo mensaje genérico; se vuelve a habilitar el botón. No existe tratamiento específico para cada causa. |
| HTTP 2xx con body ausente, no JSON utilizable, raíz inválida, token ausente/vacío/no string o usuario inválido | El parser lanza `InvalidLoginResponseError`. Muestra «El backend respondió sin token.», incluso cuando el defecto es `user`; no guarda una sesión nueva ni solicita navegar. |
| Falla la escritura en `sessionStorage` o la de preferencias en `localStorage` | La excepción llega al `catch` del login, muestra el mensaje genérico, termina `busy` y no solicita navegar. Antes de escribir la sesión se serializa el usuario: si falla serializar, no se modifica el almacenamiento previo. Si falla escribir token o usuario, se intenta eliminar ambas claves, incluso si había sesión previa, sin restaurarla ni borrar preferencias. Se propaga el error original si se logra limpiar; si también falla la recuperación, un `AggregateError` conserva las causas y puede quedar información residual: Web Storage no garantiza rollback. Si lo que falla es guardar preferencias tras guardar una sesión completa, esta no se revierte. |
| La promesa de navegación rechaza | Muestra el mensaje genérico y termina `busy`. La sesión y preferencias ya guardadas no se borran. Si el router resuelve `false`, no se muestra un error específico. |

Un fallo de validación, HTTP o respuesta inválida no limpia una sesión previa.
La excepción es una escritura de sesión fallida: intenta invalidar ambas claves,
como se detalla arriba. No hay refresco ni reintento de autenticación.

**Preguntas abiertas:** ¿qué estados usa el backend para credenciales inválidas
y fallos internos? ¿Cuál es la estructura y vigencia real del token? El cliente
solo permite confirmar las reacciones anteriores, no esas decisiones del servidor.

### 5. Notas de seguridad

- El mensaje se muestra por interpolación `{{ message }}` en
  [login.component.html](../src/app/login/login.component.html), no mediante
  `[innerHTML]`. Los errores backend no se interpolan como HTML ni se muestran
  literalmente.
- `SessionService` centraliza la sesión. Al construirse intenta eliminar las
  claves antiguas de token/usuario de `localStorage`; si falla, emite
  `console.warn`. No borra las preferencias.
- La sesión vive en `sessionStorage`, no en cookies HttpOnly. Es accesible a
  JavaScript del mismo origen; este almacenamiento no evita XSS. Normalmente
  dura la sesión de la pestaña y sobrevive a recargas; restauración de sesión
  y copias iniciales mediante `opener` dependen del navegador, no de lógica
  adicional de esta app.
- Las credenciales anteriores son exclusivamente de laboratorio. La URL actual
  usa HTTP local, no HTTPS; no implica protección de transporte para un despliegue.

## Tareas — GET http://localhost:8000/api/tasks

### 1. Quién lo llama

[DashboardComponent.ngOnInit](../src/app/dashboard/dashboard.component.ts)
obtiene la sesión de `SessionService`. Si existe, delega en
[TasksService.getTasks](../src/app/services/tasks.service.ts) con
`session.user.username` y `session.token`. El servicio hace el GET y prepara
la lista visible; el componente actualiza la vista dentro de `NgZone` y
llama a `detectChanges`.

### 2. Qué envía

No hay body ni parámetros de ruta.

| Ubicación | Nombre | Valor / regla |
|---|---|---|
| Query | `owner` | `session.user.username`, codificado con `encodeURIComponent`. Se incluye incluso si el username es vacío. |
| Header | `Authorization` | Esquema `Bearer`, un espacio y el token de la sesión. |
| Header | `Accept` | `application/json, text/plain, */*`, valor por defecto de Axios. |
| Header | `Content-Type` | No se configura para este GET sin body. |
| Configuración del cliente | `timeout` | No se establece. Axios tiene por defecto 0: no hay límite temporal propio de la aplicación para esta llamada. |

Ejemplo del fixture con username `student` y token simulado `token`:

```http
GET http://localhost:8000/api/tasks?owner=student
Accept: application/json, text/plain, */*
Authorization: Bearer token
```

La prueba de codificación usa `student+trainer`, que produce
`http://localhost:8000/api/tasks?owner=student%2Btrainer`.
No se configura `withCredentials`; el mecanismo explícito es el token.

### 3. Qué espera recibir en éxito

**Estado HTTP aceptado:** cualquier 2xx por los valores por defecto de Axios.
El body debe ser un array JSON y **todos** sus elementos deben superar
`isTaskRecord`; un solo elemento inválido hace fallar toda la respuesta.
Un array vacío es válido; una raíz `{ "tasks": [] }` o una respuesta sin body
no lo son. **Pregunta abierta:** ¿el backend responde siempre 200 con lista,
incluido cuando no hay tareas? No hay evidencia de su código de estado en los
fixtures.

| Campo por elemento | Tipo aceptado | Obligatorio / validación | Uso |
|---|---|---|---|
| Elemento raíz | Objeto no nulo, no array | Obligatorio para cada elemento | Representa una tarea; incluso `{}` supera el validador actual. |
| `status` | String o `null` | Opcional; sin enum restringido | Filtrado de archivadas y etiqueta visual del estado. |
| `priority` | String, número o `null` | Opcional | Orden de tareas y etiqueta de metadatos. |
| `owner` | String, número o `null` | Opcional | Etiqueta de metadatos; no se compara con el usuario autenticado. |
| `title` | String o `null` | Opcional | Encabezado de la tarjeta. |
| `description` | String o `null` | Opcional | Texto de la tarjeta. |
| Otros campos | Cualquier valor | Opcionales; no se validan | Se conservan, pero la UI no los consume. `label` se recalcula para cada tarea visible aunque venga del servidor. |

Ejemplo exacto del fixture de tareas:

```json
[
  {
    "title": "Low",
    "description": "low",
    "status": "TODO",
    "priority": "LOW",
    "owner": "student"
  },
  {
    "title": "Old",
    "description": "old",
    "status": "ARCHIVED",
    "priority": "URGENT",
    "owner": "student"
  },
  {
    "title": "High",
    "description": "high",
    "status": "DONE",
    "priority": "HIGH",
    "owner": "student"
  }
]
```

La UI no muestra `Old` porque solo excluye el string exacto `ARCHIVED`
(sensible a mayúsculas). Conserva todas las tareas en `tasks` y muestra
`visibleTasks` con estas reglas:

- La etiqueta se construye como prioridad en mayúsculas, ` · ` y propietario
  en mayúsculas. Valores falsy (`""`, `0`, `null` o ausentes) dan `NORMAL` y
  `SIN-ASIGNAR`, respectivamente.
- Ordena de forma descendente usando el operador JavaScript `>` sobre la
  prioridad original; `null` o ausente se sustituyen por `""`. No hay ranking
  de negocio `HIGH > LOW`: en el ejemplo queda `Low` antes de `High`, por la
  comparación de strings. Prioridades numéricas se comparan numéricamente;
  valores mixtos siguen las conversiones de JavaScript. Iguales conservan
  su orden relativo.
- Estados presentados: `TODO` → «Por hacer», `IN_PROGRESS` → «En progreso»,
  `DONE` y `COMPLETED` → «Completado», `RESUELTO` → «Resuelto». La búsqueda
  de etiqueta no distingue mayúsculas; un string desconocido se muestra tal
  cual y un estado ausente, vacío o `null` se muestra vacío.
- Al terminar, `loading` pasa a `false` y desaparecen los indicadores de carga.
  Si no hay tareas visibles, muestra «No hay tareas para mostrar todavía.».
  El saludo usa `user.displayName || user.username`.

### 4. Cómo reacciona ante errores

| Situación | Reacción actual de la UI y del cliente |
|---|---|
| No hay token o usuario serializado en `sessionStorage` | Limpia las claves parciales y solicita navegar a `/login`; no hace GET. |
| El usuario guardado no es JSON válido o no cumple el validador | Limpia la sesión y solicita navegar a `/login`; no hace GET. |
| Token presente pero inválido, expirado o rechazado por el servidor con HTTP 401/403 | Muestra «Tu sesión no es válida. Inicia sesión de nuevo.». Detiene la carga y oculta la grilla. No borra la sesión ni navega automáticamente; el usuario puede pulsar «Cerrar sesión». La expiración no se comprueba localmente. |
| Otro HTTP rechazado, por ejemplo 400, 404, 422 o 5xx | Muestra «No se pudieron cargar las tareas. Inténtalo de nuevo.». Detiene la carga y oculta la grilla; no reintenta ni navega. |
| HTTP 2xx con raíz no array, texto no JSON utilizable, body vacío o una tarea con tipos inválidos | Lanza `InvalidTasksResponseError`; el componente presenta el mismo mensaje genérico de tareas, detiene la carga y no muestra una lista parcial. |
| Fallo de red, CORS, cancelación u otro rechazo sin estado 401/403 | Mismo mensaje genérico; `loading` pasa a `false`. No se muestra `response.data.detail` ni el mensaje interno de la excepción. |
| La petición nunca responde | No hay timeout configurado ni cancelación propia: permanece el estado de carga mientras no se resuelva o rechace la promesa. Si el navegador/transporte acaba rechazándola sin 401/403, se aplica el error genérico. |
| Falla el acceso a `sessionStorage` al obtener la sesión o limpiarla por inválida | La inicialización captura la excepción, termina `loading` y muestra «No se pudieron cargar las tareas. Inténtalo de nuevo.». No hace GET ni navega como si la sesión estuviera ausente. Si no hay sesión y el almacenamiento funciona, navega a `/login` y termina la carga; si esa navegación rechaza, muestra el mismo error seguro. |
| Falla la limpieza de sesión o la navegación al pulsar «Cerrar sesión» | `logout()` captura excepciones y navegación resuelta con `false`. Muestra «No se pudo cerrar sesión. Inténtalo de nuevo.» y actualiza la vista; no propaga el rechazo. Si falla limpiar, no navega y alguna clave puede haber sido borrada. Si la limpieza terminó pero falla navegar, no restaura credenciales. El botón permite reintentar; en un nuevo intento se limpia el mensaje anterior. |

El botón «Cerrar sesión» limpia token y usuario de `sessionStorage`, conserva
las preferencias y solicita navegar a `/login`. No hay endpoint de logout,
revocación remota ni refresh consumido por el frontend.

**Preguntas abiertas:** ¿qué estados usa la API para token inválido o expirado,
y cómo valida la autorización de `owner`? ¿Cuáles son los campos obligatorios
y prioridades de negocio del servidor? El cliente admite los tipos anteriores,
pero no permite confirmar esas reglas backend.

### 5. Notas de seguridad

- El token se obtiene exclusivamente mediante `SessionService` y se adjunta a
  esta llamada. Ni su estructura ni su firma se verifican localmente; no hay
  garantía de validez por el solo hecho de existir en el almacenamiento.
- El parámetro `owner` se codifica para la URL. Esto no demuestra autorización
  por propietario: el cliente no filtra tareas por identidad ni verifica
  permisos. Esa protección debe confirmarse en el servidor, sin asumirla aquí.
- Títulos, descripciones, metadatos y errores se presentan mediante
  interpolación Angular en
  [dashboard.component.html](../src/app/dashboard/dashboard.component.html);
  no se insertan como HTML dinámico. Los detalles backend se sustituyen por
  mensajes fijos de `toUserFacingError`.
- La URL configurada es HTTP local. No se configura TLS, refresh de token,
  invalidación remota ni un timeout para tareas desde estos servicios.

## Documentos y código consultados

- [Versión previa de este documento](./ENDPOINTS.md): contraste con el flujo legacy.
- [README.md](../README.md): ejecución local y credenciales de laboratorio;
  sus hallazgos sembrados no se usan como evidencia del estado actual.
- [GOOD_PRACTICES.md](./GOOD_PRACTICES.md): convenciones de la refactorización.
- [environment.ts](../src/environments/environment.ts): URLs, cliente y timeout.
- [auth.service.ts](../src/app/services/auth.service.ts),
  [tasks.service.ts](../src/app/services/tasks.service.ts) y
  [session.service.ts](../src/app/services/session.service.ts): llamadas,
  validación, transformación y almacenamiento.
- [auth.models.ts](../src/app/models/auth.models.ts) y
  [task.models.ts](../src/app/models/task.models.ts): tipos y validadores reales.
- [login.component.ts](../src/app/login/login.component.ts),
  [login.component.html](../src/app/login/login.component.html),
  [dashboard.component.ts](../src/app/dashboard/dashboard.component.ts) y
  [dashboard.component.html](../src/app/dashboard/dashboard.component.html):
  interacción, navegación y presentación de errores/éxito.
- [api-error.ts](../src/app/utils/api-error.ts) y
  [legacy-format.ts](../src/app/utils/legacy-format.ts): mensajes y etiquetas.
- [auth.service.spec.ts](../src/app/services/auth.service.spec.ts),
  [tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts) y
  [api-error.spec.ts](../src/app/utils/api-error.spec.ts): ejemplos y casos
  documentados; no se ejecutaron pruebas para esta actualización documental.
- Código de Axios instalado dentro del repositorio:
  `node_modules/axios/lib/defaults/index.js`,
  `node_modules/axios/lib/defaults/transitional.js` y
  `node_modules/axios/lib/adapters/xhr.js`: headers automáticos, criterio 2xx,
  serialización JSON y timeout por defecto. Se inspeccionó únicamente la
  dependencia local, sin consultar componentes externos del workspace.
