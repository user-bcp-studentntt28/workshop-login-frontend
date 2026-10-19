# Plan de corrección

## Alcance y selección

Se incluyen H-01 a H-07 porque son todos los hallazgos que `HALLAZGOS.md`
marca `Pendiente`. H-01 a H-04 tienen severidad media y cubren sesión,
responsabilidades, pruebas y tipado; H-05 a H-07 tienen severidad baja y
abordan renderizado del mensaje, revisión de dependencias y anidamiento. H-08
se excluye porque su estado es `No encontrado`.

Antes de modificar cada archivo de implementación se escribirá y ejecutará la
prueba de caracterización correspondiente. Los cambios se harán en pasos
pequeños, sin agregar dependencias salvo que una necesidad de pruebas se
justifique y se apruebe expresamente.

## Contratos funcionales que se preservan

No se cambiarán las rutas, métodos, cuerpos, parámetros ni encabezados HTTP
documentados en `docs/ENDPOINTS.md`:

- Login: `POST http://localhost:8080/auth/login`, cuerpo con `username`,
  `password` y `client: "angular-workshop"`, timeout de 5 segundos; el cliente
  continúa consumiendo `token` y `user`.
- Tareas: `GET http://localhost:8000/api/tasks?owner=<username>`, con la
  autenticación conforme al contrato documentado. Se conserva la respuesta
  como lista y su presentación: excluir `ARCHIVED`, formar etiqueta con
  prioridad y propietario, ordenar por prioridad descendente y conservar las
  etiquetas de estado existentes.
- H-01 propone `sessionStorage` para token y usuario, manteniendo las mismas
  claves; esto no cambia el contrato HTTP, pero sí el comportamiento de
  persistencia. Mantiene la sesión al recargar la pestaña, la elimina al
  cerrarla y normalmente la aísla de otras pestañas; algunos navegadores pueden
  copiar el estado inicial al abrir una pestaña con `opener`. Las preferencias
  siguen en `localStorage`. `sessionStorage` sigue siendo accesible a
  JavaScript del mismo origen y no protege contra XSS. Solicitar aprobación
  del cambio de persistencia antes de implementarlo; no presentarlo como
  mitigación contra ejecución de script.

## H-01 — Token de sesión en `localStorage`

- **Hallazgo:** H-01, `Vulnerabilidad`, severidad media.
- **Problema:** el token persiste en `localStorage` y está disponible para
  JavaScript del mismo origen. No hay evidencia aquí de otro defecto
  explotable; el riesgo documentado es la exposición potencial si ocurriera
  ejecución de script en el origen.
- **Cambio propuesto:** centralizar lectura, escritura y limpieza del token y
  usuario en `SessionService`. Como alternativa acotada compatible con el
  backend actual, usar `sessionStorage` para token y usuario; conservar
  `workshop_preferences` en `localStorage`. No se modifica autenticación,
  encabezados ni endpoints. Dejar explícitas las limitaciones de seguridad y
  los efectos de cierre/aislamiento de pestaña antes de aprobar esta opción.
- **Archivos a tocar:** `src/app/services/session.service.ts` (nuevo);
  `src/app/login/login.component.ts`;
  `src/app/dashboard/dashboard.component.ts`;
  `src/app/login/login.component.spec.ts` (nuevo);
  `src/app/dashboard/dashboard.component.spec.ts` (nuevo).
- **Prueba de caracterización antes de tocar implementación:** cubrir login
  exitoso (token y usuario disponibles para dashboard), carga de dashboard
  tras recarga de la misma pestaña, redirección sin token y logout (limpia
  sesión y navega a login). Primero registrar la persistencia actual y después
  probar el comportamiento objetivo de `sessionStorage`: persistencia durante
  recarga, limpieza al cerrar pestaña y aislamiento entre pestañas, teniendo
  en cuenta el caso `opener`. Mantener las preferencias tras logout. Marcar
  como cambio funcional aprobado antes de modificar el almacenamiento.

## H-02 — Responsabilidades mezcladas en componentes

- **Hallazgo:** H-02, `Refactor`, severidad media.
- **Problema:** login conoce HTTP, persistencia de sesión y navegación;
  dashboard conoce sesión, HTTP, transformación de tareas, detección de
  cambios y navegación.
- **Cambio propuesto:** separar `AuthService` (login HTTP y coordinación con
  `SessionService`) y `TasksService` (consulta y transformación de tareas). Los
  componentes manejan solo estado de vista y navegación; no llaman HTTP ni
  acceden directamente al almacenamiento. Centralizar las URLs en
  `environment.ts` y el mapeo de errores en una utilidad compartida: usar los
  campos de error documentados (`message` en login, `detail` en tareas) solo
  para clasificación y mostrar mensajes seguros y consistentes, sin exponer
  detalles internos del backend. Evitar duplicar formato, filtrado, orden o
  reglas de estado. No cambiar método, URL, cuerpo, timeout ni encabezado.
- **Archivos a tocar:** `src/app/services/auth.service.ts` (nuevo);
  `src/app/services/tasks.service.ts` (nuevo);
  `src/app/services/session.service.ts` (nuevo, compartido con H-01);
  `src/app/utils/api-error.ts` (nuevo);
  `src/environments/environment.ts` (nuevo);
  `src/app/login/login.component.ts`;
  `src/app/dashboard/dashboard.component.ts`;
  `src/app/utils/legacy-format.ts`;
  `src/app/login/login.component.spec.ts` (nuevo);
  `src/app/dashboard/dashboard.component.spec.ts` (nuevo);
  `src/app/services/auth.service.spec.ts`,
  `src/app/services/tasks.service.spec.ts` y
  `src/app/utils/api-error.spec.ts` (nuevos).
- **Prueba de caracterización antes de tocar implementación:** describir los
  flujos actuales con mocks de HTTP y navegación: petición de login con cuerpo
  y timeout exactos, persistencia de sesión y navegación al dashboard solo con
  token; consulta de tareas con username y bearer token, filtrado de
  `ARCHIVED`, formato, orden y estados; errores de login/carga, `busy` y
  logout. Capturar el comportamiento actual de error antes del cambio y luego
  afirmar que el mensaje mostrado es consistente y no contiene texto interno
  del backend. Usar el runner Vitest existente y comprobar cómo probar clases
  Angular con la configuración actual, sin añadir paquetes por defecto.

## H-03 — Cobertura de pruebas limitada

- **Hallazgo:** H-03, `Refactor`, severidad media.
- **Problema:** la única especificación localizada prueba el formateador; no
  hay cobertura de caracterización localizada para login, sesión o tareas.
- **Cambio propuesto:** ampliar primero las pruebas de flujo y luego conservarlas
  durante H-01/H-02. Cubrir éxito, validación, estado de carga, navegación,
  logout y errores con mensajes seguros. Medir cobertura del código modificado
  y cumplir la meta de REGLAS.md de 85% o superior; no reducir quality gates.
- **Archivos a tocar:** `src/app/login/login.component.spec.ts` (nuevo);
  `src/app/dashboard/dashboard.component.spec.ts` (nuevo);
  `src/app/services/auth.service.spec.ts` y
  `src/app/services/tasks.service.spec.ts` (nuevos);
  posiblemente `vitest.config.ts` solo si se requiere una configuración
  mínima compatible con el runner ya instalado.
- **Prueba de caracterización antes de tocar implementación:** primero añadir y
  ejecutar pruebas de los comportamientos actuales enumerados en H-02 y los
  límites de validación de usuario/contraseña y respuestas sin token. Registrar
  el resultado base de `npm test` y `npm run test:coverage`; ampliar casos
  hasta cubrir el comportamiento afectado, incluidos errores backend y mensajes
  actualmente presentados. El runner está configurado en entorno Node; revisar
  sus capacidades de prueba Angular/DOM antes de escribir pruebas de plantilla.
  No ocultar fallos preexistentes ni agregar dependencias sin justificar.

## H-04 — Uso de `any`

- **Hallazgo:** H-04, `Refactor`, severidad media.
- **Problema:** `any` en credenciales, respuestas HTTP, usuario y tareas
  desactiva comprobaciones estáticas y deja que formas inesperadas de respuesta
  lleguen a la lógica de vista.
- **Cambio propuesto:** sustituir `any` por interfaces propias de request y
  response para login y tareas, tipos de sesión/tarea, y tipos explícitos para
  estado de vista y errores. Tratar los datos de red como `unknown` hasta
  validarlos en el límite del servicio. Tipar errores Axios de forma segura y
  mapearlos a mensajes genéricos consistentes mediante la utilidad compartida,
  sin mostrar detalles internos ni inventar campos de respuesta.
- **Archivos a tocar:** `src/app/models/auth.models.ts` (nuevo);
  `src/app/models/task.models.ts` (nuevo);
  `src/app/services/auth.service.ts`;
  `src/app/services/tasks.service.ts`;
  `src/app/services/session.service.ts`;
  `src/app/utils/api-error.ts` y su prueba;
  `src/app/login/login.component.ts`;
  `src/app/dashboard/dashboard.component.ts`;
  `src/app/utils/legacy-format.ts`;
  pruebas de servicios/componentes afectadas.
- **Prueba de caracterización antes de tocar implementación:** probar payload
  de login y forma de respuesta consumida, lista de tareas con los campos
  documentados, `ARCHIVED`, prioridades/propietarios vacíos y estados
  reconocidos. Añadir casos de respuesta malformada que conduzcan a un error
  controlado y errores de transporte/backend que produzcan un mensaje seguro
  consistente, sin cambiar método, URL, cuerpo, timeout ni encabezados HTTP.

## H-05 — Mensaje dinámico mediante `[innerHTML]`

- **Hallazgo:** H-05, `Sugerencia`, severidad baja; el uso de HTML está
  confirmado, pero no se ha confirmado un bypass de la sanitización Angular ni
  una vulnerabilidad XSS explotable.
- **Problema:** el template interpreta como HTML el mensaje construido con el
  usuario y texto de error externo, aunque Angular sanitiza el binding actual.
- **Cambio propuesto:** representar mensajes con interpolación de texto,
  separar el contenido de presentación y usar mensajes seguros y consistentes
  (coordinado con H-02/H-04). No usar `DomSanitizer` salvo que un requisito real
  necesite HTML; el login no requiere HTML, así que mostrar como texto cualquier
  entrada derivada del username o error. No filtrar información interna del
  backend.
- **Archivos a tocar:** `src/app/login/login.component.html`;
  `src/app/login/login.component.ts`;
  `src/app/login/login.component.spec.ts` (nuevo).
- **Prueba de caracterización antes de tocar implementación:** cubrir mensajes
  visibles para campos vacíos, respuesta sin token y error de autenticación.
  Probar username y error con texto parecido a etiquetas, verificando que se
  presenta como texto y no como marcado, y que errores backend no revelan
  detalles internos. `vitest.config.ts` usa entorno Node: antes de elegir prueba
  DOM, comprobar las capacidades ya disponibles. Si se requiere infraestructura
  adicional, justificarla y aprobarla antes de agregar dependencias.

## H-06 — Versiones de `axios` y `lodash` señaladas en el reto

- **Hallazgo:** H-06, `Sugerencia`, severidad baja. Las versiones declaradas
  están confirmadas; no se ha verificado que tengan CVE aplicable.
- **Problema:** hasta contrastar el árbol instalado con avisos aplicables no
  se puede determinar si hay riesgo de dependencia. Afirmar una CVE solo a
  partir de la versión sería especulativo.
- **Cambio propuesto:** ejecutar el script existente `npm run audit:workshop`,
  revisar advisories y aplicabilidad, y registrar evidencia antes de decidir.
  Si se confirma una vulnerabilidad, actualizar únicamente la dependencia
  afectada a una versión corregida compatible; considerar utilidades nativas
  solo donde reemplacen una dependencia sin ampliar alcance. No agregar
  dependencias nuevas ni ocultar alertas. Si no se confirma CVE aplicable,
  cerrar el hallazgo con el resultado de auditoría y no hacer cambios de
  versión preventivos sin evidencia.
- **Archivos a tocar:** inicialmente ninguno. Solo si la auditoría confirma
  necesidad: `package.json` y `package-lock.json`; y, si se elimina o cambia
  una dependencia usada, el import/uso correspondiente (`src/app/login/login.component.ts`
  o utilidades relacionadas).
- **Prueba de caracterización antes de tocar implementación:** guardar el
  resultado base de `npm run audit:workshop` y `npm ls axios lodash`, sin
  alterar el árbol. Si se modifica una dependencia, ejecutar de nuevo auditoría,
  `npm test` y `npm run build`; comprobar que los flujos HTTP y el formateo
  siguen iguales. No tratar la auditoría como confirmada hasta examinar su
  salida y advisories.

## H-07 — Validaciones anidadas en login

- **Hallazgo:** H-07, `Refactor`, severidad baja.
- **Problema:** la validación de contraseña y el flujo HTTP están dentro de
  ramas anidadas, dificultando leer y mantener el camino de salida.
- **Cambio propuesto:** convertir `login()` a validaciones con retorno
  anticipado y una sola rama de petición; conservar validaciones,
  `busy`/finalización, timeout, mensajes funcionales y navegación. Mantener las
  reglas de usuario y contraseña centralizadas y sin repetir lógica.
- **Archivos a tocar:** `src/app/login/login.component.ts`;
  `src/app/login/login.component.spec.ts` (nuevo).
- **Prueba de caracterización antes de tocar implementación:** probar usuario
  vacío (sin petición), contraseña vacía (sin petición), login válido (una
  petición con el payload/timeout documentado), respuesta sin token, error y
  restablecimiento de `busy` en éxito y error. Confirmar que la navegación solo
  ocurre tras login exitoso.

## Aprobación
Aprobado por: LT
Fecha: 2026-10-19
Alcance: H-01 a H-07, según las propuestas y límites descritos en este plan.