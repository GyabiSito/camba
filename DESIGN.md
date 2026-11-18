# Camba interface direction

The selected `.impeccable/mocks/mesa-catalogo.png` is the visual reference. Preserve its chalk surface, forest action color, dark type, quietly ruled inventory and selected-product side panel. Shop and admin share materials and interaction language, not the same page composition. This document records decisions; it does not certify the Impeccable hero.

| Token | Use |
| --- | --- |
| `--paper` | Warm backdrop, `#f6f5f1` |
| `--surface` | Near-white panel, `#fdfcf9` |
| `--ink` / `--muted` | Text, `#272b23` / `#5d6156` |
| `--forest` / `--accent` | Primary action and quiet tint, `#204936` / `#e4ebe0` |
| `--line` | Subtle separators, `#d9d9cf` |
| `--danger` | Text explanation for failures, `#932d21` |

Use a clear sans, close-packed headings and tabular numerals for stock and money. Give the shop larger product photography and more breathing room. Use only actual catalog data in normal operation; synthetic merchandise is allowed in isolated tests. No invented stock, claims, discounts, urgency or fake links.

In admin keep Productos, Pedidos and Configuración at the top level. Catalog search/filtering precedes inventory; selection shows useful product detail without hiding the table. Imports, history and notices are contextual. Use native details/disclosure and keyboard-operable controls; don't put ordinary tasks in modals. On narrow screens, linearize without hiding actions or using color as the only status cue.

Use written labels and field errors in Uruguayan Spanish, clear focus, high contrast, and reduced-motion-safe transitions. Retain form values on failure. Only show loading for real asynchronous work. Use a 320 px layout and a capture at the comp's 1586×992 size when the browser runner can produce evidence.
