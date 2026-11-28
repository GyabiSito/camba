# Separate Admin and Store authentication
Branch: feat/camba-v2 · baseline bc85766 · ask-on-risk; local work-unit commits only.
Runners: isolated Laravel/Playwright, Admin and Store production builds; forecast 600–1000 authored lines.

## Specs

### S1
> Creá una tabla `admins` con su propio modelo, proveedor de autenticación y guard de Laravel. Permití como máximo una cuenta administrativa, con una restricción en la base. Usá un comando de consola para provisionarla o recuperar el acceso.

### S2
> Hacé que registro, login y recuperación de contraseña de Tienda consulten solo `users`. El login de Admin debe consultar solo `admins` y rechazar las credenciales de un comprador antes de crear sesión. Retirá el acceso administrativo basado en `users.role`.

### S3
> Dale a Admin su propia cookie y sesión. En producción, limitá la cookie al host de Admin. Protegé todas las rutas `/api/v1/admin/*` con el guard administrativo en Laravel. Tienda y Admin deben poder estar abiertos en el mismo navegador y cerrar sesión por separado.

### S4
> Prepará el traspaso de la cuenta admin existente sin perder pedidos, auditoría ni referencias históricas. Si hay varias cuentas con el rol anterior, hacé que el comando reciba explícitamente el correo de la cuenta que se va a migrar.

### S5
> Validá desde el repo con pruebas automatizadas. Comprobá que un comprador no pueda autenticarse en Admin ni acceder a sus endpoints, que el admin pueda entrar con su propia cuenta y que cerrar una sesión no cierre la otra. Corré los builds de Admin y Tienda e indicá cómo provisionar la cuenta en el primer despliegue.

## Tasks

- [x] T1 · S1, S4 · inline, same commit as T2 · singleton, exact legacy adoption, recovery and historical-row test passed on SQLite and PostgreSQL.
- [x] T2 · S2–S5 · inline, same commit as T1 · dedicated sessions; three browser scenarios, both builds and isolated PostgreSQL suite passed.
- [x] T3 · S1–S5 · independent verification · two probes passed; integrated as assertions in the work-unit commit containing this log.

## Log

### L1 — User request

Corregí la autenticación de Camba para que Admin y Tienda tengan cuentas, logins y sesiones separados. Antes de tocar código, abrí KomorebiApi y el frontend de Admin de Komorebi. Revisá su modelo de administrador, login y middleware, y adaptá ese flujo a Camba.

- Creá una tabla `admins` con su propio modelo, proveedor de autenticación y guard de Laravel. Permití como máximo una cuenta administrativa, con una restricción en la base. Usá un comando de consola para provisionarla o recuperar el acceso.
- Hacé que registro, login y recuperación de contraseña de Tienda consulten solo `users`. El login de Admin debe consultar solo `admins` y rechazar las credenciales de un comprador antes de crear sesión. Retirá el acceso administrativo basado en `users.role`.
- Dale a Admin su propia cookie y sesión. En producción, limitá la cookie al host de Admin. Protegé todas las rutas `/api/v1/admin/*` con el guard administrativo en Laravel. Tienda y Admin deben poder estar abiertos en el mismo navegador y cerrar sesión por separado.
- Prepará el traspaso de la cuenta admin existente sin perder pedidos, auditoría ni referencias históricas. Si hay varias cuentas con el rol anterior, hacé que el comando reciba explícitamente el correo de la cuenta que se va a migrar.

Validá desde el repo con pruebas automatizadas. Comprobá que un comprador no pueda autenticarse en Admin ni acceder a sus endpoints, que el admin pueda entrar con su propia cuenta y que cerrar una sesión no cierre la otra. Corré los builds de Admin y Tienda e indicá cómo provisionar la cuenta en el primer despliegue.

### L2 — Reference and routing

Komorebi `50987b3`: `KomorebiApi/app/Models/Admin/Admin.php`, `config/auth.php`, `app/Http/Controllers/Admin/Auth/AdminAuthController.php`, `app/Http/Middleware/AdminJwtMiddleware.php`; `KomorebiAdmin/src/app/components/auth/login/login.ts` and `src/app/shared/services/auth.service.ts`. Reuse identity separation, not JWT. A read-only explorer (gpt-6.2-sol authorized after unavailable exact model) found separate auth realm, cookie and persistence are all required, and identified User references in catalog, history, settings, withdrawals and queued notices. Changing permissions and adding persisted identity requires independent verification. Preserve every unrelated pre-existing diff and keep production untouched.

### L3 — Implementation and verification

- The Admin uses Laravel SessionGuard, a dedicated database session table and dedicated encrypted cookies. The admin route group excludes Sanctum's Store pipeline. Only login and CSRF bootstrap are anonymous; the production Admin host is enforced before starting its session. The Admin login process never reads the buyer table and buyer session/reset resolution excludes historical admin rows.
- Newly attributable actions write separate typed Admin foreign keys. Old records retain User pointers. The singleton binds old queued internal mail only to the exact migrated legacy ID and unchanged email. SQLite schema changes require execution outside a transaction to avoid cascades; a non-transactional regression verifies a historical order, audit row and dependent import row.
- Test-first RED: missing `camba:admin` command and 404 for dedicated login. GREEN: focused Laravel tests on SQLite and PostgreSQL (9 tests, 133 assertions each), including host-only Secure cookies, guard inventory and recovery invalidation. Three Playwright scenarios passed, including both logout directions and rejection of the buyer CSRF token by the Admin endpoint over raw HTTP. Store and Admin production builds passed (existing Store CSS budget warning).
- PostgreSQL broad run: 282 tests, 4,150 assertions, one skipped legacy import test requiring a different disposable database. Seeder suite: 3 tests, 50 assertions on its separate test database. Catalog race tests passed after selecting the authenticated actor's explicit realm in the child process. API contract and affected Node scripts parsed successfully.
- Independent verification: 2 tests, 20 assertions, covering the production host gate before auth and explicit adoption of one of multiple legacy identities without changing User rows. The same probes were incorporated into the final focused suites.
- One coordinated work unit: the Admin client cannot use the old API after cutover and the new API rejects the old login path, so the runtime, migrations, client, tests and release instructions travel together. Neither the live demo database nor production was migrated or deployed.
- Risk: items 1, 2 and 3 (schema and historical actors; credential and session isolation; cutover of Admin auth endpoints).
