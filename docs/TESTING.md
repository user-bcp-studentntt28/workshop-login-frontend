# Pruebas de login y consulta de tareas

## Correcciones del plan aprobado — 2026-10-19

Esta sección actualiza los resultados históricos del informe de pruebas
original que se conserva debajo.

### H-09

- Antes: la reproducción del rechazo de lectura pasó (1 prueba, salida 0).
  Nuevas regresiones de corrección: 6 fallaron, salida 1; lectura de ambas
  claves, limpieza de sesión inválida, router rechazado y finalización de carga.
- Después: `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot`
  terminó con salida 0: **82 pasan, 2 todo**, 2 archivos.
- La vista se actualiza con mensaje seguro y `loading=false`, sin GET cuando
  falla la sesión. El camino feliz y los errores HTTP siguen verdes.
- Diff propio de implementación: [H-09.patch](./diffs/H-09.patch). Las antiguas
  expectativas de rechazo H-09 se sustituyeron por regresiones de corrección;
  ya no es un pendiente. Los resultados de observación de abajo son históricos.

### H-10

- Antes: 2 reproducciones de rechazo pasaron (salida 0); las 7 nuevas
  regresiones de corrección fallaron (salida 1): ambas eliminaciones, router
  rechazado, router `false`, actualización de vista y reintento.
- Después: `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot`
  terminó con salida 0: **87 pasan, 1 todo**, 2 archivos.
- El logout informa fallos sin rechazo no capturado ni navegación tras
  limpieza fallida. No restaura credenciales si falla navegar.
- Diff incremental de implementación: [H-10.patch](./diffs/H-10.patch),
  posterior a H-09; sustituye observaciones antiguas por regresiones verdes.

### H-11

- Antes: la reproducción de sesión parcial pasó (1 prueba, salida 0). Las
  nuevas regresiones dieron **10 fallos y 7 aprobadas**, salida 1. Las siete
  aprobadas pertenecen a H-09/H-10, incluidos por el nombre del grupo del flujo.
- Después: **106 pruebas aprobadas**, sin `todo`, salida 0 en los cuatro
  archivos afectados. Serialización previa, invalidación con/sin sesión
  anterior, fallo de cada escritura, rollback denegado en cada clave o ambas,
  propagación por AuthService y mensaje de login quedaron verificados.
- Diff propio de implementación: [H-11.patch](./diffs/H-11.patch).
  Si también se deniega limpiar, se intenta retirar ambas claves y se propaga
  `AggregateError` con el fallo de escritura y las causas de limpieza.
  No se garantiza rollback cuando el navegador lo impide. Fallos posteriores
  de preferencias/navegación no revierten una sesión completa.

### Comandos y resultados reales de las correcciones

Directorio de todos los comandos: la raíz de `workshop-login-frontend`,
`C:\Users\Usuario\Documents\T77031-gian-ortiz\reqflow-workspace\workshop-login-frontend`.
Todos se ejecutaron el 2026-10-19; no se instalaron dependencias.

| Item / fase | Comando | Salida | Resultado real |
|---|---|---|---|
| H-09 caracterización | `npm test -- src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-09'` | 0 | 1 pasa, 75 omitidas por filtro, 1 todo. Reproduce el defecto previo. |
| H-09 rojo | `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-09\|redirects to login when'` | 1 | 6 fallan, 78 omitidas. El `\|` en esta tabla representa el carácter de alternancia `|`, sin barra en el comando ejecutado. |
| H-09 verde | `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot` | 0 | 82 pasan, 2 todo. H-09 actualizado antes de empezar H-10. |
| H-10 caracterización | `npm test -- src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-10'` | 0 | 2 pasan, 75 omitidas, 1 todo. Reproducen los rechazos previos. |
| H-10 rojo | `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-10'` | 1 | 7 fallan, 81 omitidas. |
| H-10 verde | `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot` | 0 | 87 pasan, 1 todo. H-10 actualizado antes de empezar H-11. |
| H-11 caracterización | `npm test -- src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-11'` | 0 | 1 pasa, 77 omitidas, 1 todo. Reproduce token residual previo. |
| H-11 rojo | `npm test -- src\app\services\session.service.spec.ts src\app\services\auth.service.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot -t 'H-11'` | 1 | 10 fallan, 7 pasan, 80 omitidas. |
| H-11 verde y regresiones afectadas | `npm test -- src\app\dashboard\dashboard.component.spec.ts src\app\services\session.service.spec.ts src\app\services\auth.service.spec.ts src\app\login\login-tasks.flow.spec.ts --reporter=dot` | 0 | 106 pasan, 4 archivos. |
| Suite final con gates | `npm run test:coverage -- --reporter=dot --coverage.thresholds.lines=85 --coverage.thresholds.statements=85 --coverage.thresholds.branches=85 --coverage.thresholds.functions=85` | 0 | **123 pasan, 0 fallan, 0 todo**, 9 archivos, 8.19 s. |
| Tipado, incluyendo specs | `npx tsc --noEmit --types node,vitest/globals --skipLibCheck` | 0 | Sin diagnósticos. |
| Build | `npm run build` | 0 | Build Angular completado, bundle inicial 251.78 kB. |
| Diff | `git --no-pager diff --check` | 0 | Sin errores de whitespace en el diff seguido por Git. |
| Parches separados | `git apply --numstat docs\diffs\H-09.patch docs\diffs\H-10.patch docs\diffs\H-11.patch` | 0 | Los tres parches tienen sintaxis válida; inspección sin aplicarlos. |

Las pruebas de caracterización se ejecutaron antes de sustituir sus
expectativas por regresiones de corrección; no se conservaron expectativas
de bugs como criterios de éxito. Los parches enlazados contienen solo el
diff productivo de cada item (H-10 parte del estado posterior a H-09).
Las regresiones correspondientes están en
[dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts),
[session.service.spec.ts](../src/app/services/session.service.spec.ts),
[auth.service.spec.ts](../src/app/services/auth.service.spec.ts) y
[login-tasks.flow.spec.ts](../src/app/login/login-tasks.flow.spec.ts).

### Cobertura y límites actuales

| Alcance | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Total instrumentado final | 92.51% | 97.79% | 93.54% | 92.51% |
| DashboardComponent, modificado | 100% | 100% | 100% | 100% |
| SessionService, modificado | 100% | 96.96% | 100% | 100% |

Los cuatro gates globales de 85% se mantuvieron y ambos archivos modificados
superan 85% de líneas individualmente. Reportes generados:
[coverage-summary.json](../coverage/coverage-summary.json) y
[coverage/index.html](../coverage/index.html).

H-09, H-10 y H-11 están resueltos; no quedan `todo` de estos items. La suite
no es una prueba de navegador ni contra backends reales. Se mantienen las
limitaciones/propuestas del informe histórico: DOM, CORS real y ciclo de vida
de pestañas no se ejecutaron. El timeout local de login y los contratos HTTP
simulados siguen cubiertos. Una denegación de eliminación puede dejar datos
residuales aun después del intento de recuperación: se informa el fallo,
no se afirma atomicidad que Web Storage no ofrece.

## Informe histórico anterior a las correcciones H-09–H-11

Los pendientes y descripciones de defectos de las secciones siguientes
corresponden al estado anterior; los apartados de corrección superiores
prevalecen. La matriz de seguimiento vigente está en HALLAZGOS.md.

## Alcance y riesgos

Contrato de referencia: [ENDPOINTS.md](./ENDPOINTS.md). Se agregan pruebas,
no cambios en la implementación, endpoints, dependencias ni configuración.
Los riesgos considerados son navegación sin sesión, pérdida del estado de carga,
exposición de mensajes internos, aceptación de respuestas inválidas y errores de
almacenamiento. Los bugs nuevos se siguen exclusivamente en
[HALLAZGOS.md](../HALLAZGOS.md), no como resueltos en este documento.

Las pruebas nuevas están en
[login-tasks.flow.spec.ts](../src/app/login/login-tasks.flow.spec.ts).
Usan componentes, validadores y servicios reales; sustituyen almacenamiento,
router, zona y detección de cambios por dobles tipados en memoria. Normalmente
simulan únicamente `axios.post/get`. No montan las plantillas ni un navegador.

La excepción es el timeout de login: Axios usa su adaptador HTTP real contra
un servidor efímero en `127.0.0.1` que no responde. Un interceptor de prueba
comprueba URL original y `timeout: 5000`, y redirige solo ese request al puerto
local asignado. Se exige `ECONNABORTED` y el mensaje
`timeout of 5000ms exceeded`, además de la respuesta del componente.
El servidor y los interceptores se cierran en `finally`.
No se contacta a los backends del workspace ni a servicios externos.

## Matriz de casos

Los grupos parametrizados ejecutan una prueba por entrada. Los resultados
esperados de UI se verifican en el estado del componente; su representación
visual necesita las pruebas de navegador propuestas al final.

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas → logout | Credenciales válidas, respuesta con token/usuario, tareas visibles y archivadas | Camino feliz | POST con cuerpo/timeout exactos; sesión guardada; navegación a dashboard; GET con owner y Bearer; solo tareas no archivadas visibles; logout borra sesión, conserva preferencias y navega a login. |
| Login | Usuario vacío o solo espacios | Caso borde | No hay POST ni navegación; mensaje «Ingrese un usuario.»; `busy=false`. |
| Login | Contraseña vacía o solo espacios | Caso borde | No hay POST ni navegación; mensaje «Ingrese una contraseña.»; `busy=false`. |
| Login | Respuesta sin token, token vacío o de tipo incorrecto | Caso borde | «El backend respondió sin token.»; no guarda sesión ni navega; termina `busy`. |
| Login | Body ausente, null, array, texto, raíz vacía o usuario inválido | Error | Rechaza la respuesta con el mensaje seguro de respuesta inválida, sin sesión nueva. Incluye username/displayName con tipo incorrecto. |
| Login | HTTP 401 | Error | «Usuario o contraseña incorrectos.»; no navega ni reintenta. |
| Login | HTTP 400, 403, 422, 500 y 503 | Error | Mensaje genérico de login; no expone `message/detail` del backend; termina `busy`; una llamada por intento. |
| Login | Backend caído (`ECONNREFUSED`) | Error | Mensaje genérico; botón vuelve a habilitarse; no navegación ni reintento. |
| Login | Rechazo de red/CORS (`ERR_NETWORK`) o cancelación | Error | Mismo mensaje genérico; `busy=false`. Se simula el rechazo, no una política CORS real del navegador. |
| Login | Timeout real de 5000 ms | Error | Mientras espera, `busy=true`; Axios rechaza con `ECONNABORTED`; mensaje genérico y `busy=false`; sin navegación. |
| Login | Fallo al escribir token, usuario o preferencias | Error | Mensaje genérico; `busy=false`; no solicita navegar. La falta de rollback es H-11, no una corrección validada. |
| Login | Promesa de navegación rechazada | Error | Mensaje genérico y `busy=false`; no se afirma rollback de la sesión. |
| Tareas | Lista vacía o solo archivadas | Caso borde | Lista visible vacía, sin error y `loading=false`. No se afirma haber renderizado el texto de estado vacío. |
| Tareas | Campos opcionales ausentes/null y prioridades iguales | Caso borde | Acepta la lista; usa etiquetas por defecto y mantiene orden estable entre prioridades iguales. |
| Tareas | Owner con `+` | Caso borde | El test existente de TasksService verifica `owner=student%2Btrainer`. |
| Tareas | Sin token/usuario, sesión parcial, JSON inválido o usuario de tipo incorrecto | Error | Limpia las claves; navega a login; no hace GET. |
| Tareas | Token inválido/expirado representado por HTTP 401 o 403 | Error | «Tu sesión no es válida. Inicia sesión de nuevo.»; `loading=false`; sin tareas visibles ni navegación automática. No se valida criptográficamente un token. |
| Tareas | HTTP 400, 404, 422, 500 y 503 | Error | Mensaje genérico de tareas; termina la carga; sin detalles internos ni reintento. |
| Tareas | Backend caído, red/CORS o cancelación | Error | Mensaje genérico y `loading=false`; una llamada. |
| Tareas | Body ausente/vacío, raíz no array, texto o elementos inválidos | Error | Rechaza toda la lista, incluso si un elemento previo era válido; no presenta resultados parciales. |
| Tareas | Petición aún pendiente, seguida de timeout del transporte | Error | Permanece cargando mientras la promesa está pendiente; si rechaza con `ETIMEDOUT`, termina y muestra error genérico. No se inventa un timeout de aplicación para GET. |
| Tareas | Estados TODO, IN_PROGRESS, DONE, RESUELTO, COMPLETED, también en minúsculas | Caso borde | Etiquetas documentadas, sin distinción de mayúsculas. |
| Sesión/preferencias | Tipos de preferencias incorrectos o raíz inválida | Caso borde | Defaults por campo; raíz inválida genera `console.warn`. |
| Sesión | No se puede limpiar el almacenamiento legacy | Error | La construcción de SessionService registra `console.warn`. |
| Tareas | Lectura de sesión denegada | Error / observación H-09 | La prueba reproduce el rechazo no capturado y confirma que no hay GET. La UI controlada sigue pendiente. |
| Logout | Fallo de limpieza o navegación | Error / observación H-10 | Las dos pruebas reproducen el rechazo no capturado; no certifican un manejo correcto. |
| Login/sesión | Falla la segunda escritura | Error / observación H-11 | Reproduce token residual sin usuario, aunque el login muestra error; falta implementar rollback. |

## Código de las pruebas

El código completo ejecutable, incluidos setup, helpers, parametrizaciones,
timeout real, observaciones de defectos y tres `it.todo`, está en
[login-tasks.flow.spec.ts](../src/app/login/login-tasks.flow.spec.ts).
Añade **74 casos ejecutados y 3 pendientes** a los 31 casos existentes.
Los siguientes extractos son código real de ese archivo; dependen de sus imports
y su `beforeEach`, no son scripts independientes ni pruebas solo propuestas.

### Camino feliz: contrato y resultado real de servicios/componentes

```ts
const post = vi.spyOn(axios, 'post').mockResolvedValue(response(validLogin));
const get = vi.spyOn(axios, 'get').mockResolvedValue(response([
  { title: 'Visible', status: 'TODO', priority: 2, owner: 'student' },
  { title: 'Hidden', status: 'ARCHIVED', priority: 1, owner: 'student' }
]));

await login.login();
await dashboard.ngOnInit();

expect(post).toHaveBeenCalledExactlyOnceWith(
  'http://localhost:8080/auth/login',
  { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
  { timeout: 5000 }
);
expect(get).toHaveBeenCalledExactlyOnceWith(
  'http://localhost:8000/api/tasks?owner=student',
  { headers: { Authorization: 'Bearer fixture-token' } }
);
expect(navigate).toHaveBeenCalledWith(['/dashboard']);
expect(login.busy).toBe(false);
expect(dashboard.loading).toBe(false);
expect(dashboard.error).toBe('');
expect(dashboard.visibleTasks).toEqual([
  { title: 'Visible', status: 'TODO', priority: 2, owner: 'student', label: '2 · STUDENT' }
]);

await dashboard.logout();

expect(session.getSession()).toBeNull();
expect(persistentStorage.getItem('workshop_preferences')).not.toBeNull();
expect(navigate).toHaveBeenLastCalledWith(['/login']);
```

### Casos borde: vacío y solo espacios

```ts
it.each([
  ['', 'Workshop123!', 'Ingrese un usuario.'],
  ['   ', 'Workshop123!', 'Ingrese un usuario.'],
  ['student', '', 'Ingrese una contraseña.'],
  ['student', '   ', 'Ingrese una contraseña.']
])('rejects blank input username=%j password=%j', async (username, password, message) => {
  const post = vi.spyOn(axios, 'post');
  login.username = username;
  login.password = password;

  await login.login();

  expect(post).not.toHaveBeenCalled();
  expect(login.message).toBe(message);
  expect(login.busy).toBe(false);
  expect(navigate).not.toHaveBeenCalled();
});
```

### Errores: credenciales y estados HTTP

```ts
it.each([400, 401, 403, 422, 500, 503])('handles login HTTP %i without exposing details', async (status) => {
  const post = vi.spyOn(axios, 'post').mockRejectedValue(httpError(status));

  await login.login();

  expect(login.message).toBe(status === 401 ? 'Usuario o contraseña incorrectos.' : loginError);
  expect(login.busy).toBe(false);
  expect(session.getSession()).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledOnce();
});
```

`httpError` construye un `AxiosError` real con status y campos `message/detail`
simulados. Las pruebas de tareas cubren separadamente 401 y 403 con el mensaje
de sesión inválida. Los fixtures no son respuestas capturadas de un backend.
Los bodies-array parametrizados se envuelven en `{ data }` para que `it.each`
no los interprete como múltiples argumentos.

### Suite existente conservada

- [login.component.spec.ts](../src/app/login/login.component.spec.ts):
  validaciones, navegación, éxito y errores.
- [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts):
  redirección, carga, mensajes y logout.
- [auth.service.spec.ts](../src/app/services/auth.service.spec.ts):
  contrato POST y respuesta inválida.
- [tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts):
  contrato GET, owner codificado, filtrado y orden existentes.
- [session.service.spec.ts](../src/app/services/session.service.spec.ts):
  persistencia, limpieza y preferencias.
- [api-error.spec.ts](../src/app/utils/api-error.spec.ts) y
  [legacy-format.spec.ts](../src/app/utils/legacy-format.spec.ts):
  traducción segura y formato.
- [login.component.security.spec.ts](../src/app/login/login.component.security.spec.ts):
  inspección estática del template, no una prueba DOM ni una demostración de XSS.

## Ejecución real

Directorio para **todos** los comandos:

```powershell
Set-Location 'C:\Users\Usuario\Documents\T77031-gian-ortiz\reqflow-workspace\workshop-login-frontend'
```

Se utilizó Vitest 3.2.4 con entorno Node y proveedor de cobertura V8 existentes.
No se instalaron paquetes. La herramienta de tests del editor respondió
«No tests found»; eso no cuenta como una ejecución satisfactoria.
Se usó el runner npm del repositorio.

| Comando realmente ejecutado | Código de salida | Resultado observado |
|---|---|---|
| `npm test -- src\app\login\login-tasks.flow.spec.ts` | 1 | Primera corrida: 68 pasan, 2 fallan, 3 todo. Error de construcción de fixtures-array del propio test. |
| `npm test -- src\app\login\login-tasks.flow.spec.ts --reporter=dot` | 1 | Confirma los mismos dos fallos de fixtures en listas vacías/archivadas. |
| `npm run test:coverage -- --reporter=dot` | 0 | Tras corregir el envoltorio del fixture, 101 pasan y 3 todo, 9 archivos; 90% líneas. |
| `npx tsc --noEmit --types node,vitest/globals --skipLibCheck` | 0 | Comprobación TypeScript, incluidos los specs; repetida después de ampliar cuatro casos. |
| `npm run test:coverage -- --reporter=dot --coverage.thresholds.lines=85 --coverage.thresholds.statements=85 --coverage.thresholds.branches=85 --coverage.thresholds.functions=85` | 0 | **105 pasan, 3 todo, 0 fallan**, 9 archivos; primera ejecución final 8.06 s. Revalidación del 2026-10-19 a las 16:49:46: mismo resultado y cobertura, duración 17.33 s. Los cuatro umbrales globales de 85% se cumplieron en ambas ejecuciones. |
| `npm run build` | 0 | Build Angular completado, bundle inicial 251.78 kB. |

El segundo type-check y el build se ejecutaron secuencialmente: el build solo
se inició tras salida 0 de TypeScript. Los fallos iniciales no se corrigieron
cambiando expectativas ni código productivo: `it.each` estaba desestructurando
el array y enviando un body distinto al caso anunciado.

### Cobertura final

Fuente persistida: [coverage-summary.json](../coverage/coverage-summary.json).
Reporte navegable: [coverage/index.html](../coverage/index.html).
Son archivos generados por el comando, no dependencias ni documentación fuente.

| Alcance | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| Total instrumentado | 91.76% | 97.58% | 93.33% | 91.76% |
| LoginComponent | 100% | 100% | 100% | 100% |
| DashboardComponent | 100% | 100% | 100% | 100% |
| AuthService | 100% | 100% | 100% | 100% |
| TasksService | 100% | 100% | 100% | 100% |
| SessionService | 100% | 96% | 100% | 100% |
| Modelos auth/task, api-error, legacy-format y environment | 100% | 100% | 100% | 100% |

No se cambió código productivo en esta tarea; los specs no forman parte del
denominador de producción. El flujo ejercitado supera 85% también por archivo,
no solo por promedio. El total incluye bootstrap, rutas y AppComponent sin
cobertura de líneas; no se excluyeron para inflar el resultado. La cobertura no
demuestra ausencia de bugs: también se ejecutaron rutas defectuosas.

## Fallos, pendientes y propuestas

### Bugs confirmados, sin corregir

Las cuatro pruebas bajo `Defect observations, not correction proofs` reproducen
H-09 (una), H-10 (dos) y H-11 (una). Que pasen significa que la reproducción es
estable, **no** que la aplicación gestione correctamente esos casos.
Evidencias y estado `Pendiente` están en
[HALLAZGOS.md](../HALLAZGOS.md). No se cambiaron las expectativas para convertir
un defecto en comportamiento deseado ni se modificó producción para resolverlo.

### Pendientes declarados

Tres `it.todo` no tienen implementación y no cuentan entre las 105 pruebas
aprobadas:

1. H-09: respuesta controlada ante lectura de sesión denegada.
2. H-10: respuesta controlada ante fallo de logout.
3. H-11: rollback de escrituras parciales.

Su corrección requiere acordar el comportamiento y un cambio de implementación
aparte; no está acreditada por esta entrega.

### Pruebas propuestas, no ejecutadas

- Navegador: verificar DOM, botón/spinner, grilla oculta ante error, mensaje
  de lista vacía y navegación visible. Los tests actuales verifican estado,
  no renderizado.
- Backends reales: login, tareas y logout local con datos del laboratorio;
  confirmar status emitidos y autorización de owner. Requiere coordinar su
  disponibilidad sin inspeccionar ni modificar otros componentes.
- Navegador: CORS real y timeout mediante su adaptador de Axios. El timeout
  ejecutado usa HTTP de Node; los errores CORS solo se simulan.
- Recarga/restauración de pestaña: validar el ciclo de vida real de
  `sessionStorage`, no simulado por MemoryStorage.

No se exige un timeout propio para tareas porque
[ENDPOINTS.md](./ENDPOINTS.md) documenta que no existe. Tampoco se inventa un
ranking de prioridad de negocio distinto del orden legacy. Las preguntas
abiertas del contrato backend continúan abiertas.

## Documentos consultados

- [ENDPOINTS.md](./ENDPOINTS.md): peticiones, validadores, UI, errores y límites.
- [REGLAS.md](../REGLAS.md): cobertura mínima y reglas del laboratorio.
- [GOOD_PRACTICES.md](./GOOD_PRACTICES.md): tipado y manejo seguro de errores.
- [HALLAZGOS.md](../HALLAZGOS.md): matriz existente y registro único de bugs.
- [PLAN.md](../PLAN.md): alcance aprobado, orden de H-09/H-10/H-11 y pruebas
  previas requeridas para las correcciones.

También se contrastaron los componentes, servicios, modelos y specs enlazados,
[package.json](../package.json), [vitest.config.ts](../vitest.config.ts) y
[tsconfig.json](../tsconfig.json) para ejecutar las herramientas existentes.
