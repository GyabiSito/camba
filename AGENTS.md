# Camba v2 — instrucciones para Codex local

## Continuidad obligatoria hasta completar el sistema

Leer también `docs/AUTONOMOUS_EXECUTION.md` antes de empezar o retomar. El usuario exige completar todos los casos de uso y el diseño, sin preguntas rutinarias. Una fase, commit, revisión o candidato pequeño terminado no cierra el encargo: corregir, integrar y seguir automáticamente con la siguiente tarea ejecutable. Mantener la matriz UC01–UC30 y T01–T06 con evidencia real.

El código y los registros locales actuales son la fuente de continuidad. Los snapshots anteriores del documento son históricos: no ordenan recuperar de nuevo trabajo ya integrado. Conservar cambios locales, respetar el alcance de las revisiones cerradas y resolver los fallos de herramientas mediante mecanismos soportados. Aplicar la sección 9 antes de cerrar por dependencias de staging; no confundir el final de una revisión con el final del proyecto ni fabricar aprobaciones o resultados.

## Objetivo y alcance autorizado

Implementar la reconstrucción completa descrita en `docs/IMPLEMENTATION_BRIEF.md`. El usuario quiere trabajar en **Codex local** para utilizar sus plugins de diseño. El repositorio se inició con instrucciones de arranque; al retomar, comprobar la implementación local existente y continuarla.

El objetivo principal es que la dueña pueda cargar productos y operar pedidos sin ayuda. Diseño, rendimiento, accesibilidad y facilidad de administración son requisitos de la implementación.

Antes de editar, leer el encargo, las referencias y el progreso. Si ya existe código al retomar, inspeccionar cambios y conservar el trabajo del usuario. Trabajar por entregas pequeñas, implementar y verificar; no terminar cada fase pidiendo autorización para continuar con lo ya solicitado. Mantener un punto de reanudación concreto en `docs/PROGRESS.md`.

## Navegador y continuidad del frontend

El usuario exige continuar el sistema completo. **La disponibilidad de Computer Use, Brave, Engram o el estado hero de una comp no es una condición para implementar el resto del frontend.** Aplicar la sección 8 de `docs/AUTONOMOUS_EXECUTION.md`: probar alternativas soportadas, preferir tests/capturas del proyecto con Playwright/Chromium y continuar la implementación aun si la comprobación visual sigue pendiente. Esta regla cambia el orden de trabajo del proyecto; no convierte una captura inexistente en evidencia ni aprueba una revisión automáticamente.

Conservar el avance local más nuevo de `feat/camba-v2`, consultando Git, PROGRESS.md y el log de tareas. La sección 9 recoge un checkpoint posterior al primer problema de navegador y los pendientes locales detectados. No reiniciar la implementación, repetir revisiones cerradas por defecto ni recuperar correcciones ya integradas.

## Exclusiones firmes

- Clasificación del catálogo: **solo categorías planas y marca**. Marca opcional; categorías sin jerarquía.
- Sin descuentos, ofertas, campañas, cupones, tags, departamentos del catálogo o subcategorías, incluso como módulos ocultos o código comentado.
- Sin generador de atributos/propiedades/variaciones anidadas. Preservar las unidades vendibles existentes al migrar.
- Sin copiar el dominio avícola de GAM, el dominio EV de Voltio, multitenancy, Reverb/WhatsApp ni módulos ajenos al alcance.
- Las geografías de direcciones/envíos no son departamentos del catálogo y pueden seguir existiendo como datos de checkout.

## Referencias y plugins

Revisar Komorebi primero para la operación de tienda y Mercado Pago; GAM para Actions, Form Requests, Policies y auditoría; Voltio para notificaciones, idempotencia, pruebas y despliegue. Registrar rutas y commits efectivamente revisados. No afirmar que se revisó un proyecto inaccesible ni inventar sus paquetes.

Descubrir los plugins, skills y MCP disponibles en la sesión **local** y aplicar los de diseño/optimización pertinentes. No asumir que la configuración de este entorno remoto se comparte con el equipo del usuario. No copiar configuraciones ni credenciales de otros proyectos. Si falta una referencia, continuar el trabajo independiente y solicitar solamente la ubicación imprescindible para la parte bloqueada.

## Arquitectura

Laravel 13 y Angular 22 estables. Un monorepo sin submódulos: `api/`, workspace Angular en `web/` con store y admin, `infra/`, `docs/` y `.github/workflows/`. Mantener MySQL salvo evidencia concreta que justifique una decisión diferente.

Seguir convenciones Laravel como GAM: `app/Actions/<Area>`, `app/Http/Requests/<Area>`, controladores pequeños, Resources, Policies, Enums y Models. Actions para casos de uso con `execute()`. Validación HTTP en Form Requests personalizados, autorización en Policies y garantía de invariantes en Actions reutilizables desde HTTP, imports, jobs y comandos. DTOs, Queries y contratos solo cuando aporten; contratos especialmente para servicios externos. Eloquent directo es válido. No mezclar este esquema con `app/Modules` de Voltio sin una decisión documentada.

Seleccionar paquetes mantenidos a partir de los composer.json reales y la documentación oficial. Verificar compatibilidad con Laravel/PHP, fijar lockfiles y justificar cada dependencia. El usuario autoriza agregar las dependencias necesarias de este encargo. No instalar un catálogo de paquetes solo por existir.

## Reglas de implementación

- Web propia con Sanctum, cookies seguras y CSRF; permisos verificados en servidor. Registro público solo de compradores; nunca aceptar rol administrativo del cuerpo de la petición.
- Reutilizar login/registro de las referencias mediante adaptación y pruebas, no una copia ciega de JWT, pepper o sesiones de Camba anterior.
- Importes exactos, calculados por servidor; no aceptar precio, subtotal ni estado de pago como autoridad del cliente.
- Pedido y líneas inmutables antes del pago. Webhook y conciliación consultan Mercado Pago y usan la misma Action idempotente para sincronizar.
- Recordatorios y notificaciones por cola después del commit, con deduplicación y condición de vigencia revalidada al enviar.
- Altas individuales y masivas usan las mismas reglas/Actions. Importación con vista previa, progreso, errores por fila y reintentos sin duplicados.
- No incluir secretos, archivos .env reales, claves, dumps, logs, caches generados ni datos personales en Git o imágenes públicas.
- No borrar ni reinicializar datos, volúmenes o servicios existentes. No ejecutar migraciones de la base actual durante desarrollo. No modificar otros proyectos o el proxy compartido sin el cambio concreto correspondiente.
- Producción se construye en CI y se despliega con imágenes inmutables por componente. Sin builds ni git pull en el servidor. Sin down -v ni migrate:fresh en producción.

## Verificación y entrega

Escribir pruebas útiles para negocio, integración, pagos, concurrencia y autorización. Ejecutarlas en MySQL y Redis aislados, sin pagos ni correos reales durante las suites. Añadir pruebas de interfaz y recorridos con navegador en móvil/escritorio. No cambiar pruebas o umbrales para ocultar fallos.

Registrar comandos, resultados, commit, entorno y evidencia. Distinguir siempre implementado, probado con simulación, probado con proveedor de prueba y validado en producción. No declarar completa una integración externa si faltan credenciales o su verificación; continuar el resto del trabajo y dejar el bloqueo preciso.

El trabajo no termina en scaffolding o documentación: completar todas las fases y criterios del encargo hasta el límite del entorno/credenciales disponibles, dejando el despliegue preparado para CI/CD y el estado honesto para retomar.
