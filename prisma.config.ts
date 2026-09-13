/**
 * CONFIGURACION DE PRISMA (fase de persistencia).
 *
 * En Prisma 7 las cadenas de conexión salieron del schema y viven acá. El
 * schema declara sólo el `provider`; este archivo dice contra qué base corren
 * las migraciones.
 *
 * ============================================================
 * DOS URLS, Y NO ES REDUNDANCIA
 * ============================================================
 *
 * Neon da dos endpoints para la misma base:
 *
 *   DATABASE_URL   el endpoint CON POOL (`...-pooler.neon.tech...`).
 *                  Lo usa la aplicación. Cada invocación serverless abre su
 *                  propia conexión, y sin un pool adelante el límite de
 *                  conexiones de la base se agota con poco tráfico.
 *
 *   DIRECT_URL     el endpoint DIRECTO. Lo usan las migraciones, y sólo ellas.
 *                  `prisma migrate` necesita sesiones largas y sentencias
 *                  (bloqueos de aviso, `CREATE`/`ALTER` transaccionales) que un
 *                  pooler en modo transacción no puede sostener: corrido
 *                  contra el pooler, falla o —peor— deja la migración a medio
 *                  aplicar.
 *
 * NINGUNA DE LAS DOS SE COMMITEA. Van en variables de entorno: en Vercel, en
 * la configuración del proyecto; en local, en un `.env` que está ignorado por
 * git. `.env.example` documenta la forma sin los secretos.
 */

import { defineConfig } from 'prisma/config';

/**
 * La URL para las migraciones, si hay alguna configurada.
 *
 * Se lee de `process.env` y no del `env()` de Prisma a propósito: `env()`
 * LANZA cuando la variable no existe, así que un `env('DIRECT_URL') ||
 * env('DATABASE_URL')` nunca llega al segundo término y rompe todo comando de
 * Prisma en una máquina sin configurar. Con `process.env` el fallback
 * funciona y, cuando no hay ninguna de las dos, `datasource` queda sin
 * definir: `prisma validate` y `prisma generate` no necesitan base y siguen
 * andando, y `prisma migrate` falla con un mensaje claro en lugar de
 * arrastrar una URL vacía.
 *
 * Prisma carga el `.env` del proyecto antes de leer esto, así que en local
 * alcanza con tener el archivo (ignorado por git).
 */
const migrationUrl = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];

/**
 * La base SOMBRA, opcional.
 *
 * Es una base vacía y descartable donde Prisma REPLAYA las migraciones para
 * calcular qué schema producen. Sólo la necesitan dos operaciones de
 * desarrollo: `prisma migrate dev` (generar una migración nueva) y
 * `prisma migrate diff --from-migrations` (comprobar que las migraciones
 * commiteadas y el schema describen la misma base, que es lo que hace
 * `tests/persistence-live.test.ts`).
 *
 * `prisma migrate deploy` —el único comando que corre en producción— NO la
 * usa: aplica el SQL commiteado y nada más. Por eso esto no se configura en
 * Vercel, y por eso está bien que falte.
 *
 * En Neon una base sombra es otra base del mismo proyecto (o una rama), nunca
 * la de producción: Prisma la deja vacía al terminar.
 */
const shadowUrl = process.env['SHADOW_DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',

  // Las migraciones van SIEMPRE por el endpoint directo. Contra el pooler
  // pueden fallar o, peor, quedar a medio aplicar.
  ...(migrationUrl
    ? {
        datasource: {
          url: migrationUrl,
          ...(shadowUrl ? { shadowDatabaseUrl: shadowUrl } : {}),
        },
      }
    : {}),

  migrations: {
    // Las migraciones son parte del repositorio: la base se tiene que poder
    // recrear desde cero con lo que está commiteado acá.
    path: 'prisma/migrations',
  },
});
