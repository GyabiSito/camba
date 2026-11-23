# Camba Admin · design guide

The Admin is a workspace for managing merchandise and orders, not an extension of the editorial storefront. Use the original Camba mark, warm surfaces and burgundy for actions, focus and the active section. Keep the application readable first: use ruled lists, predictable controls and Manrope with tabular numerals for amounts, quantities and references.

| Role | Token | Value |
| --- | --- | --- |
| Workspace, navigation, form surface | `--paper`, `--rail`, `--surface` | `#f8f4ee`, `#f0e7df`, `#fffdf9` |
| Primary and secondary text | `--ink`, `--muted` | `#2d2424`, `#665956` |
| Rules and control boundaries | `--line`, `--control` | `#e2d6ce`, `#98867e` |
| Primary, hover, selection | `--action`, `--action-hover`, `--accent` | `#772334`, `#5d1728`, `#f2dde1` |
| Error | `--danger` | `#962b3a` |
| Success and warning | `--success-ink/bg`, `--warning-ink/bg` | `#2e5039` / `#e4ede3`, `#73490d` / `#f7e9d0` |

Use the sidebar for Productos, Pedidos and Configuración. The same navigation collapses to a keyboard-operable disclosure on small screens. Keep labels and active states visible without relying on color. Prefer inline feedback and existing native disclosure over modals. On mobile keep the row’s identity, status and action together; resort to a named, keyboard-scrollable region only for genuinely tabular detail that cannot linearize.

Keep saving distinct from publishing, previewing distinct from confirming, and payment distinct from fulfillment. Start a skeleton only while a real request is pending. Use clear Spanish labels and preserve entered data on recoverable errors. The Admin owns these styles; do not move the brand accent or workspace layout into storefront or shared CSS.

`public/brand/camba.svg` is an unchanged copy of the existing Camba brand vector from the storefront, published locally so the Admin does not depend on the storefront to render its identity.
