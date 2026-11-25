# Camba public home — fashion editorial
Branch: feat/camba-v2 · Baseline: 69a33303d95b2dfaabaae9103e5809ac7b5b3540 + existing dirty worktree (preserve)
Delivery: ask-on-risk, local only; >400 authored lines forecast · Runner: npm build + Playwright Chromium

## Specs

### S1

1. Alcance y punto de partida

Implementá el home en el frontend existente. api/ queda en solo lectura, incluidos Laravel, OpenAPI, migraciones, datos, autenticación y pagos. Conservá contratos, SSR, hidratación, clientes existentes y modo real. Usá el modo mock y los usuarios de prueba que ya tiene el proyecto para validar localmente. Las imágenes editoriales y sus asociaciones pueden ser configuración local del frontend. El catálogo sigue siendo la fuente de nombre, slug, precio y disponibilidad.

Preservá tienda, categorías, ficha, cuenta, carrito, checkout y admin. Verificá sus rutas existentes cuando sean destino de enlaces. Si hay que tocar cabecera o pie compartidos, limitá el estilo especial a la portada y probá los demás consumidores. La entrega no incluye cambios de CI/CD, despliegue ni publicación.

Antes de editar, leé AGENTS.md, PRODUCT.md, DESIGN.md si existe, implementación actual de /, rutas y servicios de catálogo, mocks, herramientas de imágenes y pruebas. Guardá capturas antes de mover el home. Compará al final con el estado de inicio para preservar cambios ajenos, incluso si el árbol ya estaba modificado.

Conservá categorías planas y marca opcional. Quedan fuera ofertas, cupones, precios tachados, departamentos, subcategorías, tags, favoritos, carruseles promocionales, reseñas inventadas y urgencia artificial. Mantené la compra fácil de entender para alguien que llega por primera vez.

Usá $impeccable si está disponible para composición y revisión del render. Prepará una dirección completa y ejecutala de corrido. Si un plugin opcional falla, usá las capturas y las herramientas disponibles del navegador. Resolvé decisiones visuales rutinarias sin interrumpir el trabajo.

### S2

2. Qué estudiar de cada referencia

Abrí las demos y recorré comienzo, transición al catálogo y cierre. Contrastá las dos primeras capturas adjuntas de Camba con las cuatro de Kokoro. Dejá constancia de la decisión que tomó Camba de cada referencia. Usá fotos, texto, componentes y marca propios o autorizados.

Referencia

Qué mirar

Qué construir en Camba

Kokoro · inicio y capturas adjuntas

Apertura fotográfica a todo el ancho, ropa puesta en un lugar reconocible, texto integrado en un área tranquila de la foto. Al bajar, grandes superficies fotográficas de categorías, otra historia visual y un cierre de ayuda.

Una campaña Camba con luz y espacio propios, fotografía que conecta secciones, un look con acceso a fichas y un cierre útil.

Kokoro · Vestidos

Lectura comercial de una familia de prendas y uso de primera y segunda vista de producto cuando hay galería.

Un puente entre la foto de campaña y productos navegables, y segunda imagen del mismo artículo cuando exista. El enlace «Vestidos» sirve para estudiar la colección. La campaña y los paneles a sangre se ven en el home y las capturas de referencia.

ThemeForest · Kumo · Home Index 1 · Home Index 2

Escala de destinos de categoría, limpieza de la grilla de moda y ritmo al alternar campaña y catálogo.

Tres destinos grandes del surtido de Camba y una vitrina con cambios de categoría que se entiendan al tacto y con teclado.

ThemeForest · Cartzio · Home Modern · Fashion Two

Jerarquía de acción en la campaña, nombres y precios alineados en retratos uniformes, posición del acceso al catálogo completo y cambios de composición al bajar.

Una vitrina fácil de escanear, un CTA principal claro y una segunda escena de compra con productos concretos.

Si Envato muestra el marco del marketplace, entrá a la demo del autor. Si alguna demo falla, usá la otra URL o las referencias disponibles y seguí. Usá la inspiración visual sin traer el HTML/CSS de las demos, sus fotos, sus anuncios, sus categorías propias, su wordmark ni sus políticas.

### S3

3. Dirección de arte de Camba

Armá la campaña con una idea concreta «Vestite distinto.». Como dirección fotográfica, pensá en una persona con camisa clara y pantalón arena junto a un ventanal alto de un taller urbano, luz lateral marcada, una pared de ladrillo pintado y un gesto natural. Reservá un plano más oscuro y tranquilo en el lado del copy. Probá otra escena si los recursos de Camba ofrecen una mejor, con igual intención y coherencia. El recorte móvil debe estar dirigido por separado. La campaña, las categorías y el look necesitan encuadres distintos aunque pertenezcan a la misma sesión visual.

Token de color

Valor

Papel en el home

Rojo ladrillo

#911D1D

Superficie editorial amplia y firma histórica.

Bordó

#821F40

Acciones, estado seleccionado y planos de contraste.

Rojo del lazo

#720F12

Logo, cabecera si se usa variante invertida autorizada y pie.

Crema histórico

#F5F5DC

Títulos o detalles sobre rojo profundo, con contraste comprobado.

Blanco

#FFFFFF

Acciones sobre imagen y fondos donde se necesite más luz.

Papel cálido

#FCFAF6

Secciones de catálogo y ayuda.

Tinta

#24201E

Cuerpo, títulos comerciales y precio.

El lazo y wordmark existentes identifican la tienda. Usalos con su proporción y una variante local apropiada para cada fondo. Hacé visible el bordó desde la cabecera o la primera acción, retomalo en el look o la historia y cerrá con rojo profundo. Dejá que la fotografía aporte los tonos de piel, tela y arquitectura. El verde de pruebas previas queda fuera del esquema visual.

Usá una serif expresiva para lema y títulos de campaña. Podés probar Cormorant Garamond o Instrument Serif, y una sans clara como Instrument Sans o la sans local vigente para navegación, precios, estados y ayuda. Dos familias como máximo. H1 orientativo 68–96 px en escritorio y 44–58 px en móvil, con clamp(), sin cortar texto ni forzar dos líneas si cabe con buena composición. Cuerpo alrededor de 15–17 px y nombres/precios legibles a la primera, incluso con títulos largos.

Alterná bloques a todo el ancho con interiores alineados de 1.240–1.360 px. Definí márgenes adaptativos, por ejemplo 32–48 px en desktop y 16–20 px en móvil. Usá separadores finos, superficies de color deliberadas y radios pequeños donde sirvan. La imagen puede tocar el borde. Los controles deben conservar tamaño, contraste y foco.

Escribí en español uruguayo. Usá voseo, nombres de la tienda y texto breve con función. Las fotos de campaña pueden dar carácter sin texto incrustado. Priorizá la prenda en uso, tela con volumen, movimiento natural y luz realista. Los packshots tienen lugar en la parte comercial. Evitá convertirlos en la materia prima de toda la portada.

Reuní las imágenes antes de ajustar encuadres. Preferí fotos propias, con derechos o assets existentes. Si hay generación de imagen local, podés usarla para armar una campaña original en modo demo, con ubicación y proporción reales. Una foto conceptual puede enlazar a una categoría si la representa. Para vincular una imagen a una ficha o etiquetar una prenda en «Armá el look», la prenda de esa imagen debe corresponder al artículo, incluida silueta, color y características visibles. No uses logos ni fotos de las referencias como material del home. Documentá qué se debe reemplazar o aprobar antes de publicar.

### S4

4. Composición que tenés que implementar

A. Cabecera de tienda y acceso a categorías

Usá una cabecera distintiva de aproximadamente 68–76 px en desktop. En un fondo claro, componé el lazo con wordmark en eje central, navegación a la izquierda y Buscar, Mi cuenta y Carrito a la derecha. Conservá su navegación real y el contador si ya existe. Alineá los grupos con el contenedor interior y resolvé el espacio con grid para que el logo quede centrado de verdad. En «Tienda» ofrecé catálogo completo y categorías existentes desde un desplegable con clic y teclado si la navegación actual lo permite. Un enlace directo a Tienda sigue disponible. El dropdown no depende de hover ni oculta a la persona en un callejón sin salida. En móvil, usá menú y marca claros, conservá acceso inmediato a búsqueda y carrito, y poné cuenta donde resulte más fácil de encontrar. Todos los accesos deben tener nombre visible o accesible. Una cabecera fija tiene que dejar leer anclas y focos. Reservá la franja superior para una función real si existe contenido verificado que la merezca.

B. Campaña principal a todo el ancho

El primer pantallazo es una campaña de moda. Foto original panorámica de persona vestida, desde el borde bajo la cabecera. H1 «Vestite distinto.» dentro de la imagen y ubicado sobre el área tranquila, en el tercio inferior izquierdo o centrado verticalmente en el lado sin sujeto. No cortes la cara ni la parte de la prenda relevante con copy. CTA principal «Ver tienda» a la ruta existente. Puede acompañarlo un enlace más discreto «Explorá por categoría» a la sección de la misma página, si se lee claro junto a la acción principal. Copy opcional, por ejemplo «Ropa para combinar a tu manera.», si aporta junto a foto y H1. Aplicá degradado localizado o superficie de apoyo para garantizar contraste y calibrá la luz para que la foto siga teniendo detalle.

En 1440×900, apuntá a 540–640 px de alto para que se vea una porción del capítulo siguiente. A 390×844, usá otra dirección de recorte, con 420–520 px como punto de partida, prenda visible y CTA completo. Usá picture o la estrategia de imágenes que ya tenga el proyecto. El recorte puede mover sujeto, espacio negativo y punto focal. El hero es una única escena fija y visible en el HTML inicial, sin autoplay o espera por una animación.

C. Categorías como paneles de campaña

Después de la apertura, poné un H2 «Explorá por categoría» y tres paneles verticales grandes, con un pequeño encabezado interior y un grupo fotográfico de ancho generoso por fuera de la grilla de productos. Buscá un grupo de unos 380–470 px de alto en 1440 si las fotos lo favorecen. Probá una franja de tres proporciones cercanas a 4:5, con juntas finas o aire mínimo. Dotá a cada uno de un encuadre diferente. Ejemplo con los mocks de las capturas:

Remeras. Silueta de cuerpo medio en movimiento con luz de ventana.

Camisas. Manga, puño y cuello de una camisa puesta, con otra distancia y fondo.

Pantalones. Plano en movimiento que muestra caída y calce. Priorizá ropa en uso si hay recursos.

Anclá cada nombre y flecha cerca del pie con zona de contraste y hacé de todo el panel un solo enlace semántico con foco visible. Las categorías salen del catálogo. Si el surtido ya cambió, elegí las reales con buen material. Si hay menos, componé un grupo de uno o dos con el ancho que merecen. Evitá paneles de relleno. En móvil, primer panel ancho y dos secundarios verticales si caben con lectura cómoda, o apilados cuando la foto necesite espacio. La navegación se entiende sin deslizar horizontalmente. Asegurá que los tres destinos sean alcanzables también a 320 px.

D. Vitrina «Selección de Camba»

Pasá del capítulo fotográfico a una superficie crema clara con contenedor interior. Componé una fila tipográfica con título, «Ver todo el catálogo», y debajo un selector sencillo Todo / Remeras / Camisas / Pantalones si los grupos tienen suficiente inventario. Usá las categorías representadas en la selección o la información ya disponible del catálogo. Si las filas se consultan por categoría, reutilizá cliente y consultas actuales, con un único resultado visible y un enlace al catálogo filtrado cuando sea útil. Si el filtro actúa solo sobre la selección, que se entienda a qué productos aplica. Botones con estado accesible y foco estable son suficientes. Mostrá qué se seleccionó también con forma, subrayado o texto. Cuando cambie el resultado, mantené el foco en el botón y anunciá un estado breve si hace falta. En móvil resolvé la fila con envoltura, manteniendo blancos táctiles claros.

Cuatro productos en la vista inicial cuando haya suficientes. En desktop, cuatro columnas y fotos 4:5. En móvil, dos columnas con separación y nombre libre de envolver. Diseñá cómo se leen 1, 2 o 3 resultados en filtros sin estirar un packshot a todo el ancho. Repartí las prendas restantes en el look o la historia si encajan. Así la selección mantiene buena proporción con el surtido actual.

Tarjeta con imagen de tamaño reservado, nombre, precio en UYU con el formateador vigente y disponibilidad real. Categoría o marca solo si aclaran. El estado «Sin stock» figura cuando corresponde y la ficha sigue accesible. Los precios de referencia de captura sirven para revisar formateo y lectura. Leé cifras vigentes del mock o de la API a través del cliente existente.

Cuando exista segunda foto válida del mismo producto, agregá cambio de vista al hover fino o una interacción explícita si es útil y ya tenés patrón compatible. El toque normal y el teclado siguen llevando a la ficha. Una sola foto válida también produce una tarjeta pulida. No agregues talles, puntos de colores ni un quick-add decorativo. Hacé que foto, título y acción perceptible formen una navegación clara sin enlaces anidados.

Diseñá estados de selección vacía, foto ausente y error real de datos. Asegurá que cambiar rápido de categoría no pinte una respuesta anterior. Ante un error de catálogo real, mostrale a la persona qué pasó y un siguiente paso válido. No mezcles automáticamente catálogo demo y real.

E. «Armá el look», una escena de compra

Construí un módulo ancho con una foto de cuerpo medio o entero que muestre cómo se combinan las prendas, y una columna de compra de color bordó o papel con detalle bordó. Usá proporción aproximada 7/5 de izquierda a derecha. Invertí el orden respecto de la alineación del copy del hero si la foto lo pide. A la derecha, título, texto de una frase y dos o tres piezas de la escena. Cada pieza tiene un recorte propio, nombre, precio, estado cuando corresponde y un enlace real a su ficha. Ejemplo si las fotos y el inventario coinciden, Camisa liviana blanca y Pantalón con pinzas arena. La escena tiene que mostrar una combinación reconocible y el CTA debe llevar a descubrirla. En móvil, imagen primero y prendas debajo, dentro del mismo bloque. Usá pocas piezas y lectura inmediata.

Definí las asociaciones usando identificadores o slugs existentes y la disponibilidad actual. Si una prenda desaparece, ajustá el módulo con los datos restantes. Si aún no hay fotos fieles a las prendas exactas, mantené la composición editorial y usá enlaces honestos a las categorías representadas, como «Ver camisas» y «Ver pantalones». El modo demo puede mostrar una asociación fiel creada para sus propios productos. En el modo real el contenido depende del surtido y las imágenes habilitadas para publicación.

F. «Texturas y detalles», otro momento visual

Diseñá una segunda historia que se lea como una página de editorial, después del look. Usá una imagen contextual apaisada y dos detalles, uno de tela y otro de corte o terminación, en un díptico o tríptico asimétrico. Podés hacer que el bloque atraviese la página con una superficie ladrillo detrás y una caja interior clara para fotos y titular, o componer una foto ancha con dos acercamientos en una columna. Evitá copiar la geometría del look. Si salen de la misma sesión, buscá diferentes distancias y sujetos. Agregá un solo enlace significativo a una ficha o categoría cuando las fotos correspondan. Si no hay suficiente material auténtico, trabajá con una imagen contextual y su crop de detalle, con una composición cuidada. Usá texto que describa lo que se puede ver. Esta sección retoma el ritmo de la galería de Kokoro con contenido editorial de Camba.

G. Ayuda para comprar y pie completo

Sobre papel claro, armá un cierre con ayuda fácil de leer. Mostrá dos o tres preguntas frecuentes con respuestas existentes y comprobables si las hay. Usá acordeón nativo o accesible, con etiquetas claras. Si faltan políticas confirmadas, poné los accesos reales que ayuden, por ejemplo «Mis pedidos», «Mi cuenta» o «Contacto» si hay destino y canal válidos. No publiques tarifas, horarios, redes, promesas de entrega, medios de cobro o un WhatsApp que el negocio no haya confirmado. Cerrá con un pie rojo profundo con marca y grupos de enlaces existentes, separados visualmente y adaptados a móvil. Las rutas clave tienen un último acceso claro. Conservá información legal publicada si existe.

### S5

5. Movimiento, CSS y ejecución Angular

Usá Anime.js en interacciones visibles y precisas. Prepará dos intervenciones principales, comprobables en el navegador.

Momento

Tratamiento

Comportamiento esperado

Selectores de la vitrina

Desplazamiento o expansión de 160–220 ms de un indicador decorativo. Los productos del resultado siempre se pueden leer. Si hacés transición de nuevas cartas, que sea ligera, solo por acción explícita y cancelable.

Clic, teclado y toque producen el mismo estado final. El indicador se actualiza bien aunque cambie el ancho o se pulse varias veces.

Paneles de categoría y look

Desplazá flecha o línea 4–8 px cuando se enfoca o apunta. En el look se puede animar una línea decorativa una vez al entrar en visión.

La imagen, los enlaces, el H1 y los precios están visibles desde el inicio. En pantallas táctiles, las acciones se entienden sin hover.

Respetá prefers-reduced-motion, incluso en la geometría final del indicador, y verificá el recorrido en ese modo. Nada de scroll impuesto, velo de carga, títulos ocultos, movimientos que sigan el puntero o bucles. Preferí transform y opacity para lo animado. CSS para estados simples, y dejá Anime.js reservado a los dos momentos coordinados.

Identificá la versión de Anime.js y usá su API correspondiente. Si usás v4, inicializá un scope por componente activo cuando el DOM de navegador esté listo, con selectores limitados a ese componente. Hacé revert() al destruirlo, desconectá observadores y limpiá listeners. Si usás afterNextRender, validá la disponibilidad de nodos y el momento de hidratación antes de animar estilos. Evitá cambiar la estructura hidratada. La página tiene que servir el contenido inicial aun si fallara el módulo de animación. Anime.js Scope · Limpieza con revert · Angular afterNextRender.

Usá Tailwind CSS donde facilite el layout, si ya existe o si su incorporación localizada es útil y compatible con el proyecto. Usá CSS/SCSS propio para composición editorial, container queries o media queries, ratios, object-position, degradados, tipografía y movimiento. Revisá el alcance de cualquier reset nuevo. Elegí un enfoque mantenible para este home, con tokens CSS y componentes por responsabilidad, reusando tarjeta, precios, iconos, router y servicios útiles. Evitá sumar una librería de UI o importar Bootstrap por venir de una demo. Tailwind Preflight.

Entregá imagen principal responsiva con dimensiones conocidas y prioridad razonable para el LCP. Confirmá que el navegador carga la variante adecuada y que no se pide dos veces el hero. Cargá el material fuera del primer viewport de forma diferida, con srcset, sizes y alt según su función. Reservá el espacio de fotos y recursos. Si se agregan fuentes, usá recursos pequeños y verificá el cambio de métricas al render. Conservá SSR, una jerarquía semántica, enlaces navegables y contenido público útil con JS ausente para el HTML inicial.

### S6

6. Criterios de cierre

Capturá el antes y el después con mismos datos, viewport y entorno comparable a 1440×900 y 390×844. Entregá la página completa y un recorte del primer pantallazo. Abrí las capturas producidas y corregí los problemas que se vean. En desktop deberían distinguirse claramente campaña, paneles, vitrina, look e historia. En móvil la foto de portada debe tener un punto focal claro, las categorías mantenerse marcadas como destinos y el módulo de compra del look ser fácil de leer.

Verificá 320, 390, 768, 1024 y 1440 px, enlaces multilinea, aumento de texto, foco visible y ausencia de scroll horizontal de la página. Revisá recorte de imágenes, contraste sobre foto, etiqueta de iconos, áreas de toque, orden de tabulación, apertura y cierre de menú, Escape donde corresponda y movimiento reducido. Probá estado vacío, error y «Sin stock» con las fixtures que existan. Comprobá que una sola categoría o pocos productos conservan una maqueta cuidada.

Probá en Playwright Inicio → panel de categoría → listado con ese filtro → ficha → volver. Cubrí Ver tienda, el selector de la vitrina, enlace a una pieza del look, búsqueda, cuenta y carrito. Confirmá que links y precios corresponden a los mocks vigentes y que el menú sigue funcionando en el resto de la tienda si es compartido. Probá por teclado y táctil o emulación. Usá los scripts del repo y agregá cobertura enfocada donde cambió el flujo.

Corré build y arranque SSR del storefront, inspeccioná HTML inicial, hidratación, consola y solicitudes. Medí rendimiento en build, con las mismas condiciones del antes cuando sea viable. Conservá el objetivo local de LCP móvil cercano o inferior a 2,5 s como referencia y reportá cifras medidas y configuración. Si no podés reproducir la medición, reportá el límite y completá las demás verificaciones. Verificá que el diff respecto de tu punto de partida no cambió api/ ni contratos.

Entregá capturas, archivos tocados, rutas probadas, resultados y recursos pendientes de reemplazo. Describí en pocas líneas qué decisión salió de Kokoro, qué decisión salió de Kumo y cuál de Cartzio. Identificá qué partes se validaron en modo mock. Una vez auditado el render, corregí los defectos que puedas reproducir antes de cerrar.

El resultado tiene que sostenerse en una captura de página completa. Arriba, la foto hace reconocible a Camba. Al bajar, cada tramo ofrece una forma distinta de comprar o entender la ropa, y la composición cambia al pasar de una escena a la siguiente.

## Tasks

- T1 · S1–S3, S6 · inline after delegated map · proof observed · baseline SSR compiled; before captures and LCP recorded.
- T2 · S3–S5 · inline; one interdependent surface on a dirty tree · proof observed · old home RED; updated demo SSR and 3 focused Chromium tests GREEN.
- T3 · S1–S6 · inline with independent visual review · local proof observed · 3 demo + 1 normal SSR fixture + 1 role probe, final zoom verdict resolved, no release approval.

## Log

L1 — Original request (verbatim):

Prompt para Codex local · Camba como tienda de moda editorial

Actuá como director de arte de moda, diseñador de e-commerce y desarrollador Angular senior. Rediseñá e implementá todo el home público de Camba, ruta /, desde la cabecera hasta el pie. Trabajá sobre el código y el catálogo de prueba que ya están en el checkout local. Tomá el lenguaje fotográfico de Kokoro como referencia principal, y estudiá Kumo y Cartzio de ThemeForest para darle al home la profundidad comercial de una tienda profesional.

La portada actual abre con «Vestite distinto.» fuera de la foto, tres tarjetas contenidas en un bloque angosto, siete packshots sobre el mismo gris y un banner «De cerca» con una remera recortada. El contenido ya permite navegar. La nueva portada debe cambiar la experiencia desde el primer pantallazo y seguir teniendo momentos visuales distintos a lo largo de toda la página. Construí una campaña, un recorrido de descubrimiento por categorías, una vitrina útil, un look para comprar y una segunda historia fotográfica. Usá composición, escala, contraste entre escenas y detalle en las interacciones. La tienda tiene que sentirse viva aunque el catálogo de prueba sea chico.

1. Alcance y punto de partida

Implementá el home en el frontend existente. api/ queda en solo lectura, incluidos Laravel, OpenAPI, migraciones, datos, autenticación y pagos. Conservá contratos, SSR, hidratación, clientes existentes y modo real. Usá el modo mock y los usuarios de prueba que ya tiene el proyecto para validar localmente. Las imágenes editoriales y sus asociaciones pueden ser configuración local del frontend. El catálogo sigue siendo la fuente de nombre, slug, precio y disponibilidad.

Preservá tienda, categorías, ficha, cuenta, carrito, checkout y admin. Verificá sus rutas existentes cuando sean destino de enlaces. Si hay que tocar cabecera o pie compartidos, limitá el estilo especial a la portada y probá los demás consumidores. La entrega no incluye cambios de CI/CD, despliegue ni publicación.

Antes de editar, leé AGENTS.md, PRODUCT.md, DESIGN.md si existe, implementación actual de /, rutas y servicios de catálogo, mocks, herramientas de imágenes y pruebas. Guardá capturas antes de mover el home. Compará al final con el estado de inicio para preservar cambios ajenos, incluso si el árbol ya estaba modificado.

Conservá categorías planas y marca opcional. Quedan fuera ofertas, cupones, precios tachados, departamentos, subcategorías, tags, favoritos, carruseles promocionales, reseñas inventadas y urgencia artificial. Mantené la compra fácil de entender para alguien que llega por primera vez.

Usá $impeccable si está disponible para composición y revisión del render. Prepará una dirección completa y ejecutala de corrido. Si un plugin opcional falla, usá las capturas y las herramientas disponibles del navegador. Resolvé decisiones visuales rutinarias sin interrumpir el trabajo.

2. Qué estudiar de cada referencia

Abrí las demos y recorré comienzo, transición al catálogo y cierre. Contrastá las dos primeras capturas adjuntas de Camba con las cuatro de Kokoro. Dejá constancia de la decisión que tomó Camba de cada referencia. Usá fotos, texto, componentes y marca propios o autorizados.

Referencia

Qué mirar

Qué construir en Camba

Kokoro · inicio y capturas adjuntas

Apertura fotográfica a todo el ancho, ropa puesta en un lugar reconocible, texto integrado en un área tranquila de la foto. Al bajar, grandes superficies fotográficas de categorías, otra historia visual y un cierre de ayuda.

Una campaña Camba con luz y espacio propios, fotografía que conecta secciones, un look con acceso a fichas y un cierre útil.

Kokoro · Vestidos

Lectura comercial de una familia de prendas y uso de primera y segunda vista de producto cuando hay galería.

Un puente entre la foto de campaña y productos navegables, y segunda imagen del mismo artículo cuando exista. El enlace «Vestidos» sirve para estudiar la colección. La campaña y los paneles a sangre se ven en el home y las capturas de referencia.

ThemeForest · Kumo · Home Index 1 · Home Index 2

Escala de destinos de categoría, limpieza de la grilla de moda y ritmo al alternar campaña y catálogo.

Tres destinos grandes del surtido de Camba y una vitrina con cambios de categoría que se entiendan al tacto y con teclado.

ThemeForest · Cartzio · Home Modern · Fashion Two

Jerarquía de acción en la campaña, nombres y precios alineados en retratos uniformes, posición del acceso al catálogo completo y cambios de composición al bajar.

Una vitrina fácil de escanear, un CTA principal claro y una segunda escena de compra con productos concretos.

Si Envato muestra el marco del marketplace, entrá a la demo del autor. Si alguna demo falla, usá la otra URL o las referencias disponibles y seguí. Usá la inspiración visual sin traer el HTML/CSS de las demos, sus fotos, sus anuncios, sus categorías propias, su wordmark ni sus políticas.

3. Dirección de arte de Camba

Armá la campaña con una idea concreta «Vestite distinto.». Como dirección fotográfica, pensá en una persona con camisa clara y pantalón arena junto a un ventanal alto de un taller urbano, luz lateral marcada, una pared de ladrillo pintado y un gesto natural. Reservá un plano más oscuro y tranquilo en el lado del copy. Probá otra escena si los recursos de Camba ofrecen una mejor, con igual intención y coherencia. El recorte móvil debe estar dirigido por separado. La campaña, las categorías y el look necesitan encuadres distintos aunque pertenezcan a la misma sesión visual.

Token de color

Valor

Papel en el home

Rojo ladrillo

#911D1D

Superficie editorial amplia y firma histórica.

Bordó

#821F40

Acciones, estado seleccionado y planos de contraste.

Rojo del lazo

#720F12

Logo, cabecera si se usa variante invertida autorizada y pie.

Crema histórico

#F5F5DC

Títulos o detalles sobre rojo profundo, con contraste comprobado.

Blanco

#FFFFFF

Acciones sobre imagen y fondos donde se necesite más luz.

Papel cálido

#FCFAF6

Secciones de catálogo y ayuda.

Tinta

#24201E

Cuerpo, títulos comerciales y precio.

El lazo y wordmark existentes identifican la tienda. Usalos con su proporción y una variante local apropiada para cada fondo. Hacé visible el bordó desde la cabecera o la primera acción, retomalo en el look o la historia y cerrá con rojo profundo. Dejá que la fotografía aporte los tonos de piel, tela y arquitectura. El verde de pruebas previas queda fuera del esquema visual.

Usá una serif expresiva para lema y títulos de campaña. Podés probar Cormorant Garamond o Instrument Serif, y una sans clara como Instrument Sans o la sans local vigente para navegación, precios, estados y ayuda. Dos familias como máximo. H1 orientativo 68–96 px en escritorio y 44–58 px en móvil, con clamp(), sin cortar texto ni forzar dos líneas si cabe con buena composición. Cuerpo alrededor de 15–17 px y nombres/precios legibles a la primera, incluso con títulos largos.

Alterná bloques a todo el ancho con interiores alineados de 1.240–1.360 px. Definí márgenes adaptativos, por ejemplo 32–48 px en desktop y 16–20 px en móvil. Usá separadores finos, superficies de color deliberadas y radios pequeños donde sirvan. La imagen puede tocar el borde. Los controles deben conservar tamaño, contraste y foco.

Escribí en español uruguayo. Usá voseo, nombres de la tienda y texto breve con función. Las fotos de campaña pueden dar carácter sin texto incrustado. Priorizá la prenda en uso, tela con volumen, movimiento natural y luz realista. Los packshots tienen lugar en la parte comercial. Evitá convertirlos en la materia prima de toda la portada.

Reuní las imágenes antes de ajustar encuadres. Preferí fotos propias, con derechos o assets existentes. Si hay generación de imagen local, podés usarla para armar una campaña original en modo demo, con ubicación y proporción reales. Una foto conceptual puede enlazar a una categoría si la representa. Para vincular una imagen a una ficha o etiquetar una prenda en «Armá el look», la prenda de esa imagen debe corresponder al artículo, incluida silueta, color y características visibles. No uses logos ni fotos de las referencias como material del home. Documentá qué se debe reemplazar o aprobar antes de publicar.

4. Composición que tenés que implementar

A. Cabecera de tienda y acceso a categorías

Usá una cabecera distintiva de aproximadamente 68–76 px en desktop. En un fondo claro, componé el lazo con wordmark en eje central, navegación a la izquierda y Buscar, Mi cuenta y Carrito a la derecha. Conservá su navegación real y el contador si ya existe. Alineá los grupos con el contenedor interior y resolvé el espacio con grid para que el logo quede centrado de verdad. En «Tienda» ofrecé catálogo completo y categorías existentes desde un desplegable con clic y teclado si la navegación actual lo permite. Un enlace directo a Tienda sigue disponible. El dropdown no depende de hover ni oculta a la persona en un callejón sin salida. En móvil, usá menú y marca claros, conservá acceso inmediato a búsqueda y carrito, y poné cuenta donde resulte más fácil de encontrar. Todos los accesos deben tener nombre visible o accesible. Una cabecera fija tiene que dejar leer anclas y focos. Reservá la franja superior para una función real si existe contenido verificado que la merezca.

B. Campaña principal a todo el ancho

El primer pantallazo es una campaña de moda. Foto original panorámica de persona vestida, desde el borde bajo la cabecera. H1 «Vestite distinto.» dentro de la imagen y ubicado sobre el área tranquila, en el tercio inferior izquierdo o centrado verticalmente en el lado sin sujeto. No cortes la cara ni la parte de la prenda relevante con copy. CTA principal «Ver tienda» a la ruta existente. Puede acompañarlo un enlace más discreto «Explorá por categoría» a la sección de la misma página, si se lee claro junto a la acción principal. Copy opcional, por ejemplo «Ropa para combinar a tu manera.», si aporta junto a foto y H1. Aplicá degradado localizado o superficie de apoyo para garantizar contraste y calibrá la luz para que la foto siga teniendo detalle.

En 1440×900, apuntá a 540–640 px de alto para que se vea una porción del capítulo siguiente. A 390×844, usá otra dirección de recorte, con 420–520 px como punto de partida, prenda visible y CTA completo. Usá picture o la estrategia de imágenes que ya tenga el proyecto. El recorte puede mover sujeto, espacio negativo y punto focal. El hero es una única escena fija y visible en el HTML inicial, sin autoplay o espera por una animación.

C. Categorías como paneles de campaña

Después de la apertura, poné un H2 «Explorá por categoría» y tres paneles verticales grandes, con un pequeño encabezado interior y un grupo fotográfico de ancho generoso por fuera de la grilla de productos. Buscá un grupo de unos 380–470 px de alto en 1440 si las fotos lo favorecen. Probá una franja de tres proporciones cercanas a 4:5, con juntas finas o aire mínimo. Dotá a cada uno de un encuadre diferente. Ejemplo con los mocks de las capturas:

Remeras. Silueta de cuerpo medio en movimiento con luz de ventana.

Camisas. Manga, puño y cuello de una camisa puesta, con otra distancia y fondo.

Pantalones. Plano en movimiento que muestra caída y calce. Priorizá ropa en uso si hay recursos.

Anclá cada nombre y flecha cerca del pie con zona de contraste y hacé de todo el panel un solo enlace semántico con foco visible. Las categorías salen del catálogo. Si el surtido ya cambió, elegí las reales con buen material. Si hay menos, componé un grupo de uno o dos con el ancho que merecen. Evitá paneles de relleno. En móvil, primer panel ancho y dos secundarios verticales si caben con lectura cómoda, o apilados cuando la foto necesite espacio. La navegación se entiende sin deslizar horizontalmente. Asegurá que los tres destinos sean alcanzables también a 320 px.

D. Vitrina «Selección de Camba»

Pasá del capítulo fotográfico a una superficie crema clara con contenedor interior. Componé una fila tipográfica con título, «Ver todo el catálogo», y debajo un selector sencillo Todo / Remeras / Camisas / Pantalones si los grupos tienen suficiente inventario. Usá las categorías representadas en la selección o la información ya disponible del catálogo. Si las filas se consultan por categoría, reutilizá cliente y consultas actuales, con un único resultado visible y un enlace al catálogo filtrado cuando sea útil. Si el filtro actúa solo sobre la selección, que se entienda a qué productos aplica. Botones con estado accesible y foco estable son suficientes. Mostrá qué se seleccionó también con forma, subrayado o texto. Cuando cambie el resultado, mantené el foco en el botón y anunciá un estado breve si hace falta. En móvil resolvé la fila con envoltura, manteniendo blancos táctiles claros.

Cuatro productos en la vista inicial cuando haya suficientes. En desktop, cuatro columnas y fotos 4:5. En móvil, dos columnas con separación y nombre libre de envolver. Diseñá cómo se leen 1, 2 o 3 resultados en filtros sin estirar un packshot a todo el ancho. Repartí las prendas restantes en el look o la historia si encajan. Así la selección mantiene buena proporción con el surtido actual.

Tarjeta con imagen de tamaño reservado, nombre, precio en UYU con el formateador vigente y disponibilidad real. Categoría o marca solo si aclaran. El estado «Sin stock» figura cuando corresponde y la ficha sigue accesible. Los precios de referencia de captura sirven para revisar formateo y lectura. Leé cifras vigentes del mock o de la API a través del cliente existente.

Cuando exista segunda foto válida del mismo producto, agregá cambio de vista al hover fino o una interacción explícita si es útil y ya tenés patrón compatible. El toque normal y el teclado siguen llevando a la ficha. Una sola foto válida también produce una tarjeta pulida. No agregues talles, puntos de colores ni un quick-add decorativo. Hacé que foto, título y acción perceptible formen una navegación clara sin enlaces anidados.

Diseñá estados de selección vacía, foto ausente y error real de datos. Asegurá que cambiar rápido de categoría no pinte una respuesta anterior. Ante un error de catálogo real, mostrale a la persona qué pasó y un siguiente paso válido. No mezcles automáticamente catálogo demo y real.

E. «Armá el look», una escena de compra

Construí un módulo ancho con una foto de cuerpo medio o entero que muestre cómo se combinan las prendas, y una columna de compra de color bordó o papel con detalle bordó. Usá proporción aproximada 7/5 de izquierda a derecha. Invertí el orden respecto de la alineación del copy del hero si la foto lo pide. A la derecha, título, texto de una frase y dos o tres piezas de la escena. Cada pieza tiene un recorte propio, nombre, precio, estado cuando corresponde y un enlace real a su ficha. Ejemplo si las fotos y el inventario coinciden, Camisa liviana blanca y Pantalón con pinzas arena. La escena tiene que mostrar una combinación reconocible y el CTA debe llevar a descubrirla. En móvil, imagen primero y prendas debajo, dentro del mismo bloque. Usá pocas piezas y lectura inmediata.

Definí las asociaciones usando identificadores o slugs existentes y la disponibilidad actual. Si una prenda desaparece, ajustá el módulo con los datos restantes. Si aún no hay fotos fieles a las prendas exactas, mantené la composición editorial y usá enlaces honestos a las categorías representadas, como «Ver camisas» y «Ver pantalones». El modo demo puede mostrar una asociación fiel creada para sus propios productos. En el modo real el contenido depende del surtido y las imágenes habilitadas para publicación.

F. «Texturas y detalles», otro momento visual

Diseñá una segunda historia que se lea como una página de editorial, después del look. Usá una imagen contextual apaisada y dos detalles, uno de tela y otro de corte o terminación, en un díptico o tríptico asimétrico. Podés hacer que el bloque atraviese la página con una superficie ladrillo detrás y una caja interior clara para fotos y titular, o componer una foto ancha con dos acercamientos en una columna. Evitá copiar la geometría del look. Si salen de la misma sesión, buscá diferentes distancias y sujetos. Agregá un solo enlace significativo a una ficha o categoría cuando las fotos correspondan. Si no hay suficiente material auténtico, trabajá con una imagen contextual y su crop de detalle, con una composición cuidada. Usá texto que describa lo que se puede ver. Esta sección retoma el ritmo de la galería de Kokoro con contenido editorial de Camba.

G. Ayuda para comprar y pie completo

Sobre papel claro, armá un cierre con ayuda fácil de leer. Mostrá dos o tres preguntas frecuentes con respuestas existentes y comprobables si las hay. Usá acordeón nativo o accesible, con etiquetas claras. Si faltan políticas confirmadas, poné los accesos reales que ayuden, por ejemplo «Mis pedidos», «Mi cuenta» o «Contacto» si hay destino y canal válidos. No publiques tarifas, horarios, redes, promesas de entrega, medios de cobro o un WhatsApp que el negocio no haya confirmado. Cerrá con un pie rojo profundo con marca y grupos de enlaces existentes, separados visualmente y adaptados a móvil. Las rutas clave tienen un último acceso claro. Conservá información legal publicada si existe.

5. Movimiento, CSS y ejecución Angular

Usá Anime.js en interacciones visibles y precisas. Prepará dos intervenciones principales, comprobables en el navegador.

Momento

Tratamiento

Comportamiento esperado

Selectores de la vitrina

Desplazamiento o expansión de 160–220 ms de un indicador decorativo. Los productos del resultado siempre se pueden leer. Si hacés transición de nuevas cartas, que sea ligera, solo por acción explícita y cancelable.

Clic, teclado y toque producen el mismo estado final. El indicador se actualiza bien aunque cambie el ancho o se pulse varias veces.

Paneles de categoría y look

Desplazá flecha o línea 4–8 px cuando se enfoca o apunta. En el look se puede animar una línea decorativa una vez al entrar en visión.

La imagen, los enlaces, el H1 y los precios están visibles desde el inicio. En pantallas táctiles, las acciones se entienden sin hover.

Respetá prefers-reduced-motion, incluso en la geometría final del indicador, y verificá el recorrido en ese modo. Nada de scroll impuesto, velo de carga, títulos ocultos, movimientos que sigan el puntero o bucles. Preferí transform y opacity para lo animado. CSS para estados simples, y dejá Anime.js reservado a los dos momentos coordinados.

Identificá la versión de Anime.js y usá su API correspondiente. Si usás v4, inicializá un scope por componente activo cuando el DOM de navegador esté listo, con selectores limitados a ese componente. Hacé revert() al destruirlo, desconectá observadores y limpiá listeners. Si usás afterNextRender, validá la disponibilidad de nodos y el momento de hidratación antes de animar estilos. Evitá cambiar la estructura hidratada. La página tiene que servir el contenido inicial aun si fallara el módulo de animación. Anime.js Scope · Limpieza con revert · Angular afterNextRender.

Usá Tailwind CSS donde facilite el layout, si ya existe o si su incorporación localizada es útil y compatible con el proyecto. Usá CSS/SCSS propio para composición editorial, container queries o media queries, ratios, object-position, degradados, tipografía y movimiento. Revisá el alcance de cualquier reset nuevo. Elegí un enfoque mantenible para este home, con tokens CSS y componentes por responsabilidad, reusando tarjeta, precios, iconos, router y servicios útiles. Evitá sumar una librería de UI o importar Bootstrap por venir de una demo. Tailwind Preflight.

Entregá imagen principal responsiva con dimensiones conocidas y prioridad razonable para el LCP. Confirmá que el navegador carga la variante adecuada y que no se pide dos veces el hero. Cargá el material fuera del primer viewport de forma diferida, con srcset, sizes y alt según su función. Reservá el espacio de fotos y recursos. Si se agregan fuentes, usá recursos pequeños y verificá el cambio de métricas al render. Conservá SSR, una jerarquía semántica, enlaces navegables y contenido público útil con JS ausente para el HTML inicial.

6. Criterios de cierre

Capturá el antes y el después con mismos datos, viewport y entorno comparable a 1440×900 y 390×844. Entregá la página completa y un recorte del primer pantallazo. Abrí las capturas producidas y corregí los problemas que se vean. En desktop deberían distinguirse claramente campaña, paneles, vitrina, look e historia. En móvil la foto de portada debe tener un punto focal claro, las categorías mantenerse marcadas como destinos y el módulo de compra del look ser fácil de leer.

Verificá 320, 390, 768, 1024 y 1440 px, enlaces multilinea, aumento de texto, foco visible y ausencia de scroll horizontal de la página. Revisá recorte de imágenes, contraste sobre foto, etiqueta de iconos, áreas de toque, orden de tabulación, apertura y cierre de menú, Escape donde corresponda y movimiento reducido. Probá estado vacío, error y «Sin stock» con las fixtures que existan. Comprobá que una sola categoría o pocos productos conservan una maqueta cuidada.

Probá en Playwright Inicio → panel de categoría → listado con ese filtro → ficha → volver. Cubrí Ver tienda, el selector de la vitrina, enlace a una pieza del look, búsqueda, cuenta y carrito. Confirmá que links y precios corresponden a los mocks vigentes y que el menú sigue funcionando en el resto de la tienda si es compartido. Probá por teclado y táctil o emulación. Usá los scripts del repo y agregá cobertura enfocada donde cambió el flujo.

Corré build y arranque SSR del storefront, inspeccioná HTML inicial, hidratación, consola y solicitudes. Medí rendimiento en build, con las mismas condiciones del antes cuando sea viable. Conservá el objetivo local de LCP móvil cercano o inferior a 2,5 s como referencia y reportá cifras medidas y configuración. Si no podés reproducir la medición, reportá el límite y completá las demás verificaciones. Verificá que el diff respecto de tu punto de partida no cambió api/ ni contratos.

Entregá capturas, archivos tocados, rutas probadas, resultados y recursos pendientes de reemplazo. Describí en pocas líneas qué decisión salió de Kokoro, qué decisión salió de Kumo y cuál de Cartzio. Identificá qué partes se validaron en modo mock. Una vez auditado el render, corregí los defectos que puedas reproducir antes de cerrar.

El resultado tiene que sostenerse en una captura de página completa. Arriba, la foto hace reconocible a Camba. Al bajar, cada tramo ofrece una forma distinta de comprar o entender la ropa, y la composición cambia al pasar de una escena a la siguiente.

L2 — Starting checkout: branch unchanged, no API diff. Existing dirty source overlaps this feature; keep pre-existing work local and do not stage it. Baseline build was successful on the resumed unrestricted runtime. Baseline SSR evidence: web/test-results/home-editorial/.
L3 — Source changes and builds are local. Demo SSR, normal SSR and demo admin compile; optimized demo route, photo, checkout reachability, navigation and no-network checks are independent of the development demo role test. The real build uses a disposable loopback HTTP stub for unavailable, empty and sparse catalogs; the backend is not run.
L4 — First verification caught missing home disclosure categories (router active boolean alone had no transition at initial /) and a misleading text-zoom probe (:root outranked html). Subscribe to successful navigation and set root font size through DOM inline style for the actual 32px check.
L5 — Impeccable reported one material 320px/200% text overlap/contrast finding. Fixed by separating the portrait from a dark brick copy continuation at narrow relative sizes. Scoped independent verdict resolved; final browser verified CTA keyboard focus and navigation after scrolling. Provenance scan: 26/26. No horizontal scroll at 320, 390, 768, 1024 and 1440. Final LCP median 508→1308 ms in the same local CDP profile.
L6 — Final Git comparison: no changes under api/; no publication or staging of pre-existing work. No native receipt: candidate assessment returned unassessable on the inherited mixed/untracked worktree. No real order/payment validation. Confirm or replace generated photographs and associations before enabling them in normal builds.
