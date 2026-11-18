# Camba v2

Reconstrucción de Camba como una tienda simple de administrar, con un catálogo limitado a categorías y marcas, una experiencia visual nueva y pagos confiables.

## Estado

La tienda SSR, el admin y la [API Laravel](api/README.md) ya se pueden ejecutar juntos en un [entorno aislado](docs/DEVELOPMENT.md). Playwright cubre recorridos reales de catálogo, importación, pedidos y compra; [PROGRESS.md](docs/PROGRESS.md) separa lo probado localmente de las validaciones aún pendientes. Los flujos de CI/CD están preparados; eso no significa que se haya desplegado en producción.

## Empezar con Codex local

Abrir este repositorio en el equipo que tiene los plugins de diseño y dar esta instrucción:

> Leé AGENTS.md, docs/IMPLEMENTATION_BRIEF.md, docs/REFERENCES.md y docs/PROGRESS.md. Localizá y revisá las copias locales de Komorebi, GAM, Voltio y Camba anterior. Implementá Camba v2 completa siguiendo el encargo, usando los plugins y skills disponibles en esta sesión local. Avanzá por entregas verificables sin quedarte solamente en un plan ni pedirme confirmación por decisiones rutinarias. Empezá por el relevamiento de referencias y del entorno, y continuá con la implementación. Mantené actualizado PROGRESS.md con evidencia real, pendientes y el siguiente paso para poder retomar. Los despliegues de producción deben realizarse por CI/CD; no alteres la instalación actual desde el entorno de desarrollo.

## Documentos

- [Instrucciones permanentes para agentes](AGENTS.md).
- [Encargo de implementación y criterios de aceptación](docs/IMPLEMENTATION_BRIEF.md).
- [Referencias verificadas y qué aprender de cada proyecto](docs/REFERENCES.md).
- [Avance, evidencia y pendientes](docs/PROGRESS.md).
- [Rendimiento móvil en laboratorio](docs/LOCAL_PERFORMANCE.md) y [ensayo local de recuperación](docs/LOCAL_RECOVERY.md).

El alcance definitivo es el del encargo. Sustituye las propuestas más amplias de la auditoría inicial: no habrá descuentos, cupones, tags, departamentos del catálogo ni subcategorías.
