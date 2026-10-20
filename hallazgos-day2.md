# Hallazgos de discovery — Día 2

Todos los elementos son candidatos para revisión humana. No se modificó código ni se crearon issues.

### Token de sesión accesible desde JavaScript del navegador
- Estado: CANDIDATO
- Evidencia: `src/app/services/session.service.ts:28-29` guarda el token en `sessionStorage`; las líneas 51-52 lo leen desde ese almacenamiento.
- Impacto: Código JavaScript ejecutado en el origen de la aplicación podría leer el token. El impacto depende de la presencia y alcance de una vulnerabilidad de ejecución de scripts.
- Prioridad propuesta: P2; confirmar el modelo de amenazas y el alcance del laboratorio antes de priorizar para producción.
- Contrato potencialmente afectado: Persistencia de sesión del frontend y encabezado de autorización enviado al consumir servicios protegidos.
- Cómo validarlo: Revisar el modelo de amenazas y comprobar, mediante pruebas de seguridad del frontend, que código no confiable no pueda ejecutarse en el origen ni acceder a la sesión.

## Revisión humana

Confirmar el modelo de amenazas y si el uso de almacenamiento web es aceptable para el entorno previsto.
