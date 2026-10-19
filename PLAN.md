# Plan de corrección del backlog pendiente

## Selección, límites y aprobación

Se seleccionan los únicos tres items con estado **Pendiente** de
[HALLAZGOS.md](./HALLAZGOS.md): **H-09, H-10 y H-11**, todos de severidad
**media**. Se conserva su orden en la matriz para desempatar; no se reabren
hallazgos resueltos ni H-08, marcado como «No encontrado».

Esta entrega modifica únicamente este plan. La aprobación histórica de LT,
registrada el 2026-10-19 para H-01 a H-07 en la versión anterior, **no aprueba
H-09 a H-11**. Este nuevo alcance queda pendiente de aprobación humana antes
de implementar. El historial anterior permanece en Git.

**Aprobación del alcance actual:** el usuario confirmó en la conversación del
2026-10-19 que este plan fue revisado y aprobado, y solicitó implementar
H-09, H-10 y H-11 en ese orden. Esta confirmación sustituye el estado pendiente
anterior; no amplía el alcance.

Referencias: [ENDPOINTS.md](./docs/ENDPOINTS.md),
[GOOD_PRACTICES.md](./docs/GOOD_PRACTICES.md) y
[REGLAS.md](./REGLAS.md). Se mantendrán:

- POST `/auth/login`, URLs del ambiente, body `username/password/client`,
  timeout de 5000 ms, validación de respuestas y mensajes HTTP existentes.
- GET `/api/tasks?owner=<username codificado>`, header Bearer, respuesta como
  lista, filtrado, etiquetas y orden actuales. No se agrega timeout al GET.
- Sesión centralizada en SessionService con las mismas claves de
  `sessionStorage`; preferencias en `localStorage`. No se añaden dependencias,
  secretos, cookies, revocación remota ni endpoints.
- Componentes sin HTTP ni acceso directo al almacenamiento; errores tipados
  desde `unknown`, mensajes seguros e interpolación, sin silencios ni falsos
  éxitos. Reutilizar helpers existentes y evitar duplicación.

Los tres items piden corregir comportamientos defectuosos que el contrato
actual describe explícitamente. Solo se propone cambiar esas reacciones
locales: lectura fallida, logout fallido y escritura parcial. Tras implementar
cada item se actualizará su fila específica en la sección de errores de
[ENDPOINTS.md](./docs/ENDPOINTS.md), sin alterar los contratos HTTP ni otros
comportamientos. Hasta entonces ese documento continúa describiendo el código
actual.

## Item: H-09 — Lectura de sesión fuera del manejo de errores del dashboard

**Origen y prioridad:** H-09, Bug, severidad media, Pendiente en
[HALLAZGOS.md](./HALLAZGOS.md).

**Problema confirmado:** en
[dashboard.component.ts](./src/app/dashboard/dashboard.component.ts), línea 48,
`getSession()` se ejecuta antes del `try`. Las lecturas de
[session.service.ts](./src/app/services/session.service.ts), líneas 31–32,
pueden lanzar `SecurityError`. La promesa de inicialización rechaza, no hay
mensaje controlado y `loading` puede quedar activo.

**Cambio propuesto y alcance propio:**

- Incluir la obtención de sesión y la redirección sin sesión dentro del
  manejo de errores de inicialización. Un fallo de almacenamiento no se
  convertirá silenciosamente en «sesión ausente».
- Ante excepción, terminar la carga y mostrar mediante la ruta de error
  existente el mensaje seguro «No se pudieron cargar las tareas. Inténtalo
  de nuevo.», con actualización de vista dentro de NgZone. No hacer GET si
  falló obtener la sesión ni forzar una navegación como si la sesión estuviera
  vacía.
- Mantener redirección a `/login` sin GET cuando realmente no hay sesión o
  esta es inválida; terminar el estado de carga también al salir por esa
  rama. Un rechazo del router en esa rama recibirá el mismo manejo seguro.
- Conservar HTTP 401/403 y demás errores de carga con sus mensajes actuales.
  No cambiar logout ni la escritura de sesión: pertenecen a H-10 y H-11.

**Archivos a tocar en la implementación posterior:**

- [dashboard.component.ts](./src/app/dashboard/dashboard.component.ts).
- [dashboard.component.spec.ts](./src/app/dashboard/dashboard.component.spec.ts).
- [login-tasks.flow.spec.ts](./src/app/login/login-tasks.flow.spec.ts), solo
  casos H-09 y regresiones de inicialización.
- [ENDPOINTS.md](./docs/ENDPOINTS.md), fila de fallo al obtener sesión.
- [TESTING.md](./docs/TESTING.md), resultados y pendiente H-09.
- [HALLAZGOS.md](./HALLAZGOS.md), únicamente estado/nota de H-09 al verificar.

**Prueba antes de tocar implementación:**

1. Ejecutar la reproducción existente de H-09 para registrar el rechazo
   actual; no presentarla como prueba de corrección.
2. Implementar el `it.todo` de H-09 como regresión que primero debe fallar:
   simular `SecurityError` al leer cada clave, exigir que `ngOnInit()` termine
   sin rechazo, `loading=false`, mensaje seguro, actualización de vista y
   ninguna llamada GET ni navegación por el fallo de almacenamiento.
3. Cubrir además fallo al limpiar una sesión inválida y rechazo al navegar
   por sesión ausente dentro de esta inicialización.
4. Preservar regresiones de sesión ausente/inválida con almacenamiento
   disponible, carga exitosa y errores HTTP existentes.

## Item: H-10 — Logout propaga errores de limpieza o navegación

**Origen y prioridad:** H-10, Bug, severidad media, Pendiente en
[HALLAZGOS.md](./HALLAZGOS.md).

**Problema confirmado:**
[dashboard.component.ts](./src/app/dashboard/dashboard.component.ts), líneas
72–75, espera limpieza y navegación sin capturar errores. Las eliminaciones de
[session.service.ts](./src/app/services/session.service.ts), líneas 53–54,
pueden impedir llegar al router; este también puede rechazar.

**Cambio propuesto y alcance propio:**

- Capturar errores de `clearSession()` y navegación en `logout()`. Mostrar en
  el estado `error` ya renderizado «No se pudo cerrar sesión. Inténtalo de
  nuevo.» mediante interpolación; actualizar la vista de forma coherente con
  el componente y no propagar una promesa rechazada sin respuesta de UI.
- Si la limpieza falla, no navegar ni afirmar que se cerró la sesión. No
  ocultar que alguna clave pudo haberse eliminado antes del fallo; permitir
  que el usuario reintente con el botón existente.
- Si se limpia la sesión y el router rechaza o resuelve `false`, mostrar el
  mismo error seguro. No restaurar credenciales ya eliminadas ni presentar la
  navegación cancelada como éxito.
- En éxito, conservar borrado de token/usuario, preferencias intactas y
  navegación a `/login`, sin endpoint de logout.
- Mantener el almacenamiento encapsulado y el orden limpieza → navegación.
  No rediseñar `clearSession()`, autenticación, carga de tareas ni rollback.
  El mensaje es local a logout; no cambiar la clasificación HTTP compartida.

**Archivos a tocar en la implementación posterior:**

- [dashboard.component.ts](./src/app/dashboard/dashboard.component.ts).
- [dashboard.component.spec.ts](./src/app/dashboard/dashboard.component.spec.ts).
- [login-tasks.flow.spec.ts](./src/app/login/login-tasks.flow.spec.ts), solo
  casos H-10 y camino feliz de logout.
- [ENDPOINTS.md](./docs/ENDPOINTS.md), fila de fallo de logout.
- [TESTING.md](./docs/TESTING.md), resultados y pendiente H-10.
- [HALLAZGOS.md](./HALLAZGOS.md), únicamente estado/nota de H-10 al verificar.

**Prueba antes de tocar implementación:**

1. Ejecutar las dos reproducciones actuales de H-10; conservar evidencia del
   rechazo previo a la corrección.
2. Implementar primero regresiones rojas para fallo de cada `removeItem`:
   `logout()` debe resolver de forma controlada, mostrar el mensaje dedicado,
   actualizar la vista y no invocar navegación.
3. Cubrir limpieza exitosa seguida de router rechazado y de resolución
   `false`: mensaje seguro, sin restaurar sesión ni promesa no capturada.
4. Probar un reintento exitoso y conservar el camino feliz: claves borradas,
   preferencias intactas y navegación a `/login`. No adaptar expectativas
   para dar por cerrado un logout que falló.

## Item: H-11 — Escritura de sesión no atómica

**Origen y prioridad:** H-11, Bug, severidad media, Pendiente en
[HALLAZGOS.md](./HALLAZGOS.md).

**Problema confirmado:**
[session.service.ts](./src/app/services/session.service.ts), líneas 25–27,
guarda primero token y después usuario. Si la segunda escritura falla queda
el token sin su usuario nuevo; el login muestra error, pero no revierte las
escrituras. La reproducción H-11 confirma ese token residual.

**Cambio propuesto y alcance propio:**

- Serializar el usuario antes de escribir para que un fallo de serialización
  no deje una primera escritura.
- Encapsular ambas escrituras y su recuperación en `saveSession()`. Si falla
  alguna escritura, intentar invalidar las dos claves de autenticación,
  sin borrar preferencias y sin restaurar una sesión anterior potencialmente
  mezclada con la nueva. Esta política de invalidación, también si había una
  sesión previa, debe quedar explícita al aprobar el item.
- Intentar retirar cada clave aunque falle retirar la otra. Si la limpieza
  tiene éxito, propagar el fallo original para que el login conserve su
  mensaje genérico, `busy=false` y ausencia de navegación.
- Si también falla la recuperación, propagar un error tipado que conserve
  el fallo original y los de limpieza (por ejemplo, `AggregateError`, ya
  disponible en ES2022). No ignorarlos ni prometer atomicidad garantizada:
  Web Storage no ofrece transacciones y puede impedir el rollback. No incluir
  token, usuario o credenciales en mensajes ni logs.
- No ampliar el rollback a preferencias o navegación fallidas tras una
  sesión ya guardada; esos comportamientos quedan fuera de H-11. No migrar
  las claves a otro esquema ni modificar `clearSession()` de logout.

**Archivos a tocar en la implementación posterior:**

- [session.service.ts](./src/app/services/session.service.ts), escrituras y
  recuperación privada de `saveSession()`.
- [session.service.spec.ts](./src/app/services/session.service.spec.ts).
- [auth.service.spec.ts](./src/app/services/auth.service.spec.ts), propagación
  del fallo de persistencia sin cambios al POST.
- [login-tasks.flow.spec.ts](./src/app/login/login-tasks.flow.spec.ts), solo
  casos H-11 y regresiones de login afectadas.
- [ENDPOINTS.md](./docs/ENDPOINTS.md), fila de fallo al guardar sesión y límite
  explícito si el navegador impide limpiarla.
- [TESTING.md](./docs/TESTING.md), resultados y pendiente H-11.
- [HALLAZGOS.md](./HALLAZGOS.md), únicamente estado/nota de H-11 al verificar.

**Prueba antes de tocar implementación:**

1. Ejecutar la reproducción de token residual existente y convertir el
   `it.todo` de H-11 en una regresión roja: fallo de escritura del usuario
   debe dejar ambas claves ausentes si las eliminaciones están disponibles.
2. Repetir con fallo en la primera escritura, almacenamiento inicialmente
   vacío y sesión previa; verificar invalidación y preferencias intactas.
3. Probar error de serialización antes de cualquier escritura: no se modifica
   la sesión previa. Probar rollback denegado en cada eliminación y en ambas:
   se intentan las dos, se conservan las causas y se rechaza explícitamente,
   sin afirmar limpieza completa.
4. Integrar el fallo con login: mensaje genérico, `busy=false`, sin
   navegación ni detalles internos. Mantener login válido, sesión completa
   legible y request HTTP idéntico.

## Verificación posterior y cierre por item

Primero pruebas rojas de corrección, luego cambio acotado, luego pruebas
verdes. Las observaciones que afirman el defecto no pueden mantenerse como
criterio de éxito tras corregirlo: se sustituirán por regresiones del
comportamiento aprobado, conservando en la documentación su evidencia previa.
Actualizar cada hallazgo solo después de verificarlo; este plan no cambia
ningún estado de la matriz.

Aunque compartan archivos, los tres items mantienen apartados, pruebas y
diffs conceptuales separados. No introducir una abstracción común salvo que
sea necesaria para evitar duplicación real de estos cambios.

Ejecutar desde la raíz de este repositorio independiente:

```powershell
npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\services\session.service.spec.ts src\app\services\auth.service.spec.ts src\app\login\login-tasks.flow.spec.ts
npm run test:coverage -- --reporter=dot --coverage.thresholds.lines=85 --coverage.thresholds.statements=85 --coverage.thresholds.branches=85 --coverage.thresholds.functions=85
npx tsc --noEmit --types node,vitest/globals --skipLibCheck
npm run build
git --no-pager diff --check
```

Verificar además cobertura de líneas de cada archivo productivo modificado
igual o superior a 85%, no solo el promedio global. Registrar comandos, códigos
de salida y resultados reales en [TESTING.md](./docs/TESTING.md), sin contar
`todo` como pruebas aprobadas. Estos comandos son **propuestos para la futura
implementación**; no se ejecutan ni se atribuyen resultados nuevos en esta
entrega documental.
