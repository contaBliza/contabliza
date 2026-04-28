# ContaBliza

Aplicacion web estatica para registrar ingresos, gastos, comprobantes, reportes y recordatorios financieros.

## Estructura

- `index.html`: login de demo.
- `pages/`: pantallas internas de la aplicacion.
- `js/storage.js`: persistencia local con `localStorage`.
- `js/app.js`: sesion, navegacion y notificaciones.
- `js/reportes.js`: filtros, graficos y exportaciones.
- `css/`: estilos base, componentes y paginas.

## Demo

Usuario: `admin`
Clave: `1234`

## Supabase

La conexion base esta en `js/supabaseClient.js`.

Antes de conectar login y datos reales:

1. Abrir Supabase Dashboard.
2. Ir a SQL Editor.
3. Ejecutar `supabase/schema.sql`.
4. Verificar que existan las tablas `profiles`, `settings`, `movimientos`, `metas`, `calendario_eventos` y `adjuntos`.
5. Verificar que exista el bucket privado `comprobantes`.

La app todavia mantiene `localStorage` como respaldo local. La integracion con Supabase se debe hacer por etapas: Auth, movimientos, metas, configuracion/calendario y migracion de datos locales.
