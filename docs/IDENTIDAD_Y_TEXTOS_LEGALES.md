# Identidad y textos legales de Camba v2

Los textos están adaptados a la operación de v2. Falta que José complete `CAMBA_FISCAL_NAME` en el entorno de la API. Mientras falte o la API no pueda informar el dato, Términos y Privacidad muestran «Borrador» y `noindex`.

## Configuración

1. Completar `CAMBA_FISCAL_NAME` con la denominación fiscal confirmada. `.env.example` queda vacío.
2. Renovar la configuración cacheada mediante el procedimiento existente de despliegue. No se incorpora el dato al bundle de Tienda.
3. Comprobar `/api/v1/store-info`: el único dato nuevo publicado es `data.fiscalName`, recortado o `null`. No se publica el entorno ni la configuración completa.
4. Recargar Términos y Privacidad. Con un nombre válido desaparece el aviso de identidad incompleta. Esto no constituye una certificación jurídica ni confirma los pendientes externos.

Compose recibe la variable por su `env_file` existente. No se agrega infraestructura ni un endpoint. El dato no es editable desde Configuración del Admin. Se rechazan valores vacíos, controles, tipos distintos de texto o más de 200 caracteres.

## Datos públicos utilizados

| Dato | Valor |
| --- | --- |
| Nombre comercial | Camba |
| RUT | 170245740012 |
| Domicilio | Colón 650, San José de Mayo, Uruguay |
| Teléfonos | 4344 2183 y +598 99 387 986 |
| Atención | contacto@camba.com.uy |
| Contacto de privacidad | María Valeria Hernández |

Fuentes públicas consultadas por el responsable de esta entrega: [Términos](https://www.camba.com.uy/terms-conditions), [Privacidad](https://www.camba.com.uy/privacy-policy), [Contacto](https://www.camba.com.uy/contact). No se copian promesas de pagos, plazos de entrega ni funcionalidades del sitio anterior.

## Versiones y operación

La versión vigente pasa a `2026-11-27-v2`. El archivo `api/resources/legal/purchase-terms-2026-11-27.php` se conserva sin cambios; sus enlaces y las instantáneas ya guardadas en compras siguen disponibles. La nueva versión informa impuestos incluidos, envío desglosado y constancia neutral del trámite. El acceso público al formulario de arrepentimiento se ofrece desde Inicio, sin exigir sesión; los textos legales explican esa ubicación sin duplicar el botón.

Se mantienen cinco días hábiles de retracto en 2026 y diez días corridos desde el 1 de enero de 2027, y la distinción entre cambios voluntarios, retracto y productos defectuosos. Fuentes: [Ley 17.250, art. 16](https://www.impo.com.uy/bases/leyes/17250-2000/16), [Ley 20.531, art. 108](https://www.impo.com.uy/bases/leyes/20531-2026/108). Los derechos sobre datos personales informan cinco días hábiles según [art. 14](https://www.impo.com.uy/bases/leyes/18331-2008/14) y [art. 15](https://www.impo.com.uy/bases/leyes/18331-2008/15).

## Pendientes externos

- Denominación fiscal confirmada: José debe completar la variable. No se agregó un valor de ejemplo que pueda confundirse con el real.
- Confirmar conservación específica y obligaciones aplicables por tipo de registro, alojamiento/subencargados efectivos, destinos y fundamento de transferencias internacionales, y situación registral de bases ante la URCDP cuando corresponda. No se afirman registros ni localización exclusivamente uruguaya sin evidencia.
- La aceptación del proveedor y la llegada de correos externos no forman parte de las pruebas locales; se usa correo simulado.

## Verificación reproducible

Laravel: `php -d extension=pdo_sqlite vendor/phpunit/phpunit/phpunit --filter 'StoreSettingsTest|PurchaseTermsVersionTest' --do-not-cache-result`, desde `api`, con `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `DB_URL=` y un `APP_CONFIG_CACHE` inexistente fuera del repositorio. No usar la base compartida.

Navegador aislado: `npm exec -- playwright test e2e/store-legal-identity.spec.ts --project=store`, desde `web`. El runner usa SQLite descartable y correo en memoria. El caso de identidad válida intercepta solamente StoreInfo en el navegador; no afirma haber configurado una denominación fiscal real en el servidor.
