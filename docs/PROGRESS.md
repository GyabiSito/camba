# Progreso de Camba v2

## Estado inicial

18/11/2026: se prepararon las instrucciones para Codex local después de revisar referencias remotas de GAM y Voltio. Se confirmó que el repositorio nuevo estaba vacío. Komorebi todavía requiere lectura de su checkout local.

No hay aplicación implementada, dependencias instaladas, contenedores de Camba v2 ejecutados, pruebas de aplicación aprobadas ni despliegue de producción realizado por este arranque.

## Etapas

| Etapa | Estado | Evidencia |
| --- | --- | --- |
| Encargo e instrucciones | Preparado | AGENTS.md, IMPLEMENTATION_BRIEF.md, REFERENCES.md |
| P0 — referencias locales, plugins y decisiones | Pendiente | — |
| P1 — monorepo, Docker dev, CI base y acceso | Pendiente | — |
| P2 — catálogo/admin/carga masiva | Pendiente | — |
| P3 — pedidos/pagos/webhook/conciliación | Pendiente | — |
| P4 — notificaciones/recordatorios | Pendiente | — |
| P5 — tienda y diseño completo | Pendiente | — |
| P6 — rendimiento/seguridad/integración | Pendiente | — |
| P7 — imágenes y despliegue selectivo CI/CD | Pendiente | — |
| P8 — ensayo de migración y entrega | Pendiente | — |

## Próximo paso

En Codex local, abrir este repositorio, leer las instrucciones y localizar Komorebi, GAM, Voltio y Camba anterior. Registrar rutas/commits, plugins disponibles y versiones resueltas. Empezar la implementación sin esperar una confirmación rutinaria de la planificación.

## Registro de ejecución

Por cada entrega agregar: commit, funcionalidad, comandos ejecutados, resultado, entorno, evidencia de UI cuando corresponda, límites conocidos y siguiente paso. Marcar por separado pruebas con proveedor simulado y con cuenta de prueba real.

## Dependencias externas que deben resolverse para una entrega productiva

- Acceso local a la referencia Komorebi.
- Credenciales de prueba/producción de Mercado Pago y correo, sin incluir valores aquí.
- VPS, dominios y reglas concretas del proxy de Camba.
- Registro de imágenes y secretos/entorno de GitHub Actions.
- Copia de catálogo y fotografías para ensayar migración.

Estas dependencias no bloquean construir y probar las partes independientes en un entorno aislado. No dar por realizado el despliegue ni el cobro de prueba mientras falte evidencia.
