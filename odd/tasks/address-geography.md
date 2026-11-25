# Normalize Camba v2 address geography
Branch `feat/camba-v2`; local work units only, `ask-on-risk`. Baseline `c663557af324ed84e852bd9b9ba60eea6e6f0201` plus inherited worktree changes.
Verification: Laravel on isolated SQLite/PostgreSQL, Angular build, Playwright against local Docker, and read-only reference review.

## Specs
- S1 — “Abrí KomorebiStore y KomorebiApi desde el checkout local de Komorebi. Localizá el selector de direcciones, el contrato que envía y cómo se guardan los IDs. Revisá también billing.component.ts, UyDepartmentSeeder y las migraciones uy_departments y uy_towns de Camba anterior. Registrá qué patrón encontraste en cada repo y adaptalo a Camba v2.”
- S2 — “Creá tablas de departamentos y localidades. Cada localidad tiene un ID propio, una FK al departamento y el ID original del JSON. Asegurá la unicidad de (departamento, ID original de localidad). Los IDs de origen se repiten entre departamentos.” “Hacé un seed repetible que preserve los nombres y los IDs del catálogo de origen. El JSON debe estar disponible para Laravel en Docker aunque la tienda esté apagada. Mantené una sola fuente del dataset. PostgreSQL queda como fuente de las opciones que usa la aplicación.”
- S3 — “Para guardar una dirección, recibí department_id y locality_id y validá que pertenezcan al mismo par. Persistí locality_id como FK y obtené el departamento por su relación. Devolvé ambos IDs y sus nombres para mostrar y editar direcciones. Actualizá los contratos y tipos usados por direcciones, cotización y checkout.”
- S4 — “Hacé una migración aditiva. Vinculá las direcciones existentes por departamento y localidad cuando haya una coincidencia inequívoca. Tolerá diferencias de mayúsculas, tildes y espacios para comparar. Preservá el texto original de los casos sin coincidencia y pedí elegir una localidad válida antes de usar esa dirección en un nuevo envío. Conservá los datos históricos de los pedidos ya emitidos.”
- S5 — “Usá el mismo componente al crear o editar una dirección en Mi cuenta y al cargar una dirección de envío en checkout, también como invitado. Mostrá primero Departamento y habilitá Localidad después de elegirlo. Consultá a la API las localidades del departamento seleccionado.” “Ambos selectores deben admitir búsqueda sin distinguir tildes, teclado y uso cómodo en móvil. Al cambiar el departamento, limpiá la localidad. Al editar o elegir una dirección guardada, precargá el par correcto. Mantené el diseño actual y la opción de retiro.”
- S6 — “Ejecutá el seed dos veces y comprobá que conserva IDs y conteos. Probá dos localidades de departamentos distintos con el mismo ID original y confirmá que quedan como registros independientes. Probá que Laravel rechaza un par incoherente. Verificá en Playwright crear, editar y recargar una dirección, cambiar de departamento, usar una dirección guardada y cotizar un envío como invitado. Incluí una dirección anterior que no tenga coincidencia automática.” “Documentá en el README el comando exacto del seed y dejá el flujo funcionando en la tienda local.”

## Tasks
- [x] T1 · S2,S4,S6 · delegated: independently testable PostgreSQL geography catalog, directory endpoints, safe additive backfill · RED → GREEN (SQLite 3/48, PostgreSQL suite and live migration) · Risk: item 1 (stored data and migration).
- [x] T2 · S3,S4,S6 · inline: account and quote/checkout request/response contracts, immutable order snapshots and API tests · RED → GREEN (isolated PostgreSQL and real/isolated Playwright) · Risk: item 3 (explicit address input contract replacement).
- [x] T3 · S3,S4,S5,S6 · delegated: independently testable shared storefront selector and form integration on the typed HTTP seam · RED → GREEN (3 mocked browser checks and real Docker).
- [x] T4 · S1,S6 · inline: local reference evidence, Docker acceptance and README · verified locally.

## Log
L1 · User request (verbatim):

> Implementá direcciones geográficas normalizadas en Camba v2. Reemplazá
> los campos manuales de Departamento y Localidad por dos selectores
> dependientes, ambos con buscador. Usá el countries.json completo que
> ya está en public/json del proyecto store como fuente del seed inicial.
>
> 1. Revisá las referencias locales
>
> Abrí KomorebiStore y KomorebiApi desde el checkout local de Komorebi.
> Localizá el selector de direcciones, el contrato que envía y cómo se
> guardan los IDs. Revisá también billing.component.ts, UyDepartmentSeeder
> y las migraciones uy_departments y uy_towns de Camba anterior.
> Registrá qué patrón encontraste en cada repo y adaptalo a Camba v2.
>
> 2. Normalizá el directorio geográfico en PostgreSQL
>
> Creá tablas de departamentos y localidades. Cada localidad tiene un
> ID propio, una FK al departamento y el ID original del JSON. Asegurá
> la unicidad de (departamento, ID original de localidad). Los IDs de
> origen se repiten entre departamentos.
>
> Hacé un seed repetible que preserve los nombres y los IDs del catálogo
> de origen. El JSON debe estar disponible para Laravel en Docker aunque
> la tienda esté apagada. Mantené una sola fuente del dataset. PostgreSQL
> queda como fuente de las opciones que usa la aplicación.
>
> Para guardar una dirección, recibí department_id y locality_id y
> validá que pertenezcan al mismo par. Persistí locality_id como FK y
> obtené el departamento por su relación. Devolvé ambos IDs y sus nombres
> para mostrar y editar direcciones. Actualizá los contratos y tipos usados
> por direcciones, cotización y checkout.
>
> 3. Conservá las direcciones y los pedidos anteriores
>
> Hacé una migración aditiva. Vinculá las direcciones existentes por
> departamento y localidad cuando haya una coincidencia inequívoca.
> Tolerá diferencias de mayúsculas, tildes y espacios para comparar.
> Preservá el texto original de los casos sin coincidencia y pedí elegir
> una localidad válida antes de usar esa dirección en un nuevo envío.
> Conservá los datos históricos de los pedidos ya emitidos.
>
> 4. Reutilizá el selector en Mi cuenta y checkout
>
> Usá el mismo componente al crear o editar una dirección en Mi cuenta
> y al cargar una dirección de envío en checkout, también como invitado.
> Mostrá primero Departamento y habilitá Localidad después de elegirlo.
> Consultá a la API las localidades del departamento seleccionado.
>
> Ambos selectores deben admitir búsqueda sin distinguir tildes, teclado
> y uso cómodo en móvil. Al cambiar el departamento, limpiá la localidad.
> Al editar o elegir una dirección guardada, precargá el par correcto.
> Mantené el diseño actual y la opción de retiro.
>
> 5. Verificá en Docker
>
> Ejecutá el seed dos veces y comprobá que conserva IDs y conteos.
> Probá dos localidades de departamentos distintos con el mismo ID
> original y confirmá que quedan como registros independientes.
> Probá que Laravel rechaza un par incoherente. Verificá en Playwright
> crear, editar y recargar una dirección, cambiar de departamento,
> usar una dirección guardada y cotizar un envío como invitado.
> Incluí una dirección anterior que no tenga coincidencia automática.
>
> Documentá en el README el comando exacto del seed y dejá el flujo
> funcionando en la tienda local.

L2 · Adopt a narrow seam. `GET /api/v1/geography/departments` and `GET /api/v1/geography/departments/{department}/localities` both return `{data: [{id: number, name: string}]}`. New address/checkout input carries numeric `department_id`, `locality_id`; saved addresses also return current relation names, or original text with both IDs null. Quote accepts an optional `address: {department_id, locality_id}` pair, validates it, and retains existing tariff/quote token behavior. New order snapshots keep names and include IDs; historical snapshots are never rewritten. Keep the canonical JSON under the API build context, moving the original bytes rather than generating a second copy. Catalog/backfill and storefront UI can progress in parallel on the fixed seam, each with its own checks. Forecast >400 authored lines excluding the original dataset; no remote publication authorized.

L3 · Local reference inspection, read-only: KomorebiStore `fa774fa`, `src/app/features/account/ui/pages/addresses/addresses.ts:110–147,217–229,257–274` and `addresses.html:180–210`: use dependent numeric controls, clear city on department change, repopulate on edit. KomorebiApi `8f2cb69`, `app/Http/Requests/Komorebi/Account/AccountAddressRequest.php:27–59`, `app/Actions/Komorebi/Account/UpdateOrCreateAccountAddressAction.php:23–37`: validate both IDs and pair; load city–department and denormalize display labels. Earlier Camba frontend `e231d30`, `src/app/pages/auth-view/checkout/components/billing/billing.component.ts:41–71,75–84,137–144`: AJAX JSON lookup nested by department, dependent clear and numeric payload. Earlier Camba API `1c6e800`, `database/seeders/UyDepartmentSeeder.php:13–33`, `database/migrations/40-create_uy_departments_table.php:14–16` and `41-create_uy_towns_table.php:16–28`: explicit upstream department IDs and composite town key. Adopt the hierarchy/pair validation rather than the previous aliases or duplicate persisted department ID. Catalog T1 and storefront T3 agents have disjoint edit surfaces; parent owns T2.

L4 · RED: the missing directory returned 404; account validated text-only fields and quote returned 200 with an incoherent pair; storefront lacked the combobox and never sent a pair-scoped quote. GREEN: T1 isolated SQLite 3/48; Docker PostgreSQL geography/account/orders/cart/payments 50/847 plus demo seed 3/51; 5 focused Playwright cases, of which 2 used the isolated real API; Docker store and opt-in offline Angular builds passed (incumbent CSS budget warning only on production). Independent persistence and async verification found no source blockers. Native review assessment could not freeze the inherited mixed working tree with untracked paths; no receipt or commit is claimed.

L5 · Docker acceptance at 4200: stopped only the store, applied migration `0001_01_01_000017_normalize_address_geography`; ran the dedicated geography seed twice with the storefront stopped. Both runs kept 19 departments and 1,884 exact rows/IDs; source ID 1 is internal locality 1 in Artigas and 61 in Canelones. Linked 2 of 3 saved addresses; preserved old text and all 9 historical order address snapshots byte-for-byte. Recreated and waited for the storefront to become healthy. Live Playwright `node e2e/store-address-geography-docker.mjs` verified account create/edit/reload, dependent clearing, saved pair preload and blocking of the unlinked address, guest quote using numeric IDs, keyboard/touch and 390/320 px. Removed only the new test address. Captures: `web/dist/artifacts/address-geography/`.
