# Endpoints consumidos por el frontend

Contrato inferido del código de `src/app/login/login.component.ts` y
`src/app/dashboard/dashboard.component.ts`. Los formatos de respuesta indicados
son los campos que el frontend lee; no sustituyen la especificación de los
servicios backend.

## Autenticación

`POST http://localhost:8080/auth/login`

- Timeout del cliente: 5 segundos.
- No envía encabezado de autorización.
- Cuerpo JSON:

  ```json
  {
    "username": "student",
    "password": "Workshop123!",
    "client": "angular-workshop"
  }
  ```

- El frontend espera una respuesta JSON con `token` y `user`. Guarda el token
  y el usuario en `sessionStorage` como `workshop_token` y `workshop_user`;
  la sesión termina al cerrar la pestaña. Las preferencias permanecen en
  `localStorage`. El almacenamiento de sesión sigue siendo accesible a
  JavaScript del mismo origen y no evita por sí solo XSS.
- Si falta `token`, muestra un mensaje de respuesta inválida. En errores, lee
  `response.data.message` si está disponible.

## Tareas del usuario

`GET http://localhost:8000/api/tasks?owner=<username>`

- El valor de `owner` se obtiene de `user.username`, guardado por el flujo de
  autenticación.
- Encabezado requerido por el frontend:

  ```http
  Authorization: Bearer <token>
  ```

- El frontend espera que el cuerpo de la respuesta sea una lista de tareas.
  Cada tarea usa `status`, `priority`, `owner`, `title` y `description`.
- Oculta las tareas cuyo `status` sea `ARCHIVED`, crea una etiqueta a partir
  de `priority` y `owner`, y ordena las visibles por prioridad descendente.
- Los estados reconocidos para presentación son `TODO`, `IN_PROGRESS`, `DONE`,
  `RESUELTO` y `COMPLETED`.
- En errores, muestra `response.data.detail` si está disponible.

## Límites del contrato conocido

El frontend no valida esquemas ni documenta códigos HTTP, otros campos de
respuesta o reglas de autorización del backend. Confirma esos detalles en la
implementación o documentación de los servicios antes de cambiar el contrato.
