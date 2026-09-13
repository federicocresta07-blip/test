/**
 * LA CONEXION A NEON.
 *
 * Un solo lugar donde se construye el cliente de Prisma, y un solo lugar donde
 * se decide si hay base de datos.
 *
 * ============================================================
 * POR QUE EL CLIENTE SE IMPORTA DE FORMA DINAMICA
 * ============================================================
 *
 * `src/generated/prisma` es código GENERADO y NO está commiteado: se produce
 * con `prisma generate`, que corre en cada instalación (`postinstall`) y en
 * cada build. Un `import` estático desde acá haría que el proyecto no compile
 * ni corra hasta haberlo generado, y eso rompería `npm test` en una máquina
 * limpia: los 369 tests del motor no necesitan base de datos y tienen que
 * poder correr sin ella.
 *
 * Con el import dinámico, un entorno sin cliente generado y sin `DATABASE_URL`
 * simplemente no tiene base, que es exactamente lo que pasa al abrir el HTML
 * autocontenido.
 *
 * ============================================================
 * POR QUE EL ADAPTADOR DE WEBSOCKET Y NO EL DE HTTP
 * ============================================================
 *
 * `@prisma/adapter-neon` trae dos: `PrismaNeon` (pool sobre WebSocket) y
 * `PrismaNeonHttp`. El de HTTP es más liviano y no soporta transacciones, y
 * este juego las necesita: una fecha jugada escribe la temporada Y el
 * desarrollo del club, y escribir una sin la otra deja la partida en un estado
 * que el juego no puede producir. Ver `prisma-store.ts`.
 *
 * ============================================================
 * DOS ADAPTADORES, ELEGIDOS POR LA URL
 * ============================================================
 *
 * El driver de Neon NO habla con un Postgres común. Habla el protocolo del
 * proxy WebSocket de Neon, y contra cualquier otro Postgres falla con
 * "Received network error or non-101 status code" —un error de red, que no
 * dice que el problema es el adaptador—. Eso se comprobó corriendo
 * `tests/persistence-live.test.ts` contra un Postgres local.
 *
 * Así que el adaptador se elige por el host:
 *
 *   *.neon.tech   → `PrismaNeon`, el pool sobre WebSocket. Es producción.
 *   cualquier otro → `PrismaPg`, el driver de Postgres de siempre (TCP).
 *
 * Sin esto, el juego sólo se puede correr contra Neon: ni un Postgres en
 * Docker para desarrollar, ni el test contra una base de verdad. La elección
 * no cambia nada de producción, donde la URL es siempre de Neon.
 */

import type { PrismaNeon } from '@prisma/adapter-neon';
import type { PrismaPg } from '@prisma/adapter-pg';
import type { WritableGameStateClient } from './prisma-store.ts';

/**
 * El cliente, creado una sola vez por proceso.
 *
 * En serverless cada invocación fría crea uno nuevo y las tibias reusan éste.
 * Crear un pool por petición agota las conexiones de la base con poco
 * tráfico, y es el error clásico de Prisma en Vercel.
 */
let client: WritableGameStateClient | null = null;
let attempted = false;

export type DatabaseStatus = 'conectada' | 'sin-configurar' | 'no-disponible';

let status: DatabaseStatus = 'sin-configurar';

export function databaseStatus(): DatabaseStatus {
  return status;
}

/** `true` cuando la URL apunta a Neon, que es el único caso que usa WebSocket. */
function isNeon(connectionString: string): boolean {
  try {
    return new URL(connectionString).hostname.endsWith('.neon.tech');
  } catch {
    // Una URL que no se puede parsear no es de Neon; que falle al conectar,
    // con el error del driver, que dice más que uno inventado acá.
    return false;
  }
}

/** El adaptador que corresponde a esta URL. Ver el encabezado del archivo. */
async function adapterFor(
  connectionString: string,
): Promise<PrismaNeon | PrismaPg> {
  if (isNeon(connectionString)) {
    const { PrismaNeon } = await import('@prisma/adapter-neon');
    return new PrismaNeon({ connectionString });
  }
  const { PrismaPg } = await import('@prisma/adapter-pg');
  return new PrismaPg({ connectionString });
}

/**
 * El cliente de Prisma, o `null` si no hay base configurada.
 *
 * Devolver `null` en lugar de lanzar es deliberado: el servidor tiene que
 * poder levantar sin base y caer al almacén de archivos. Un servidor que no
 * arranca porque falta una variable de entorno es más difícil de diagnosticar
 * que uno que dice en qué modo está.
 */
export async function database(): Promise<WritableGameStateClient | null> {
  if (attempted) return client;
  attempted = true;

  const connectionString = process.env['DATABASE_URL'];
  if (connectionString === undefined || connectionString.length === 0) {
    status = 'sin-configurar';
    return null;
  }

  try {
    const { PrismaClient } = await import('../generated/prisma/client.ts');
    const adapter = await adapterFor(connectionString);

    client = new PrismaClient({ adapter }) as unknown as WritableGameStateClient;
    status = 'conectada';
    return client;
  } catch (cause) {
    // Falta el cliente generado, falta el adaptador, o la URL no sirve. Se
    // dice y se sigue sin base: el juego funciona igual contra archivos.
    status = 'no-disponible';
    console.error(
      '[base de datos] no se pudo conectar, se sigue con el almacén de archivos:',
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}
