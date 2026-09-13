/**
 * LAS MIGRACIONES DEL DESPLIEGUE.
 *
 * Corre `prisma migrate deploy` —el comando de producción— y sólo en
 * producción. Es el guardián entre el repositorio y el schema de la base.
 *
 * ============================================================
 * LAS TRES REGLAS QUE ESTE ARCHIVO HACE CUMPLIR
 * ============================================================
 *
 * 1. UNA PREVIEW NO TOCA PRODUCCION. Vercel construye cada rama y cada pull
 *    request, y por defecto les da las mismas variables de entorno que a
 *    producción. Sin este corte, abrir un pull request con un cambio de schema
 *    lo aplicaría a la base de producción antes de que nadie lo revise, y
 *    borrar una columna en una preview borraría los datos de verdad.
 *
 *    El corte es `VERCEL_ENV`, que Vercel pone: `production`, `preview` o
 *    `development`. Sólo el primero migra.
 *
 * 2. SI LA MIGRACION FALLA, NO SE DESPLIEGA. Este script devuelve un código
 *    distinto de cero y el build de Vercel se corta ahí: nunca queda una
 *    versión de la aplicación esperando un schema que la base no tiene. Es la
 *    mitad del problema que más duele, porque la aplicación arranca igual y
 *    falla recién cuando alguien juega.
 *
 * 3. NADA DE COMANDOS DE DESARROLLO. `prisma migrate dev` genera migraciones,
 *    pide confirmación y puede RESETEAR la base; `prisma db push` aplica el
 *    schema sin dejar migración. Ninguno de los dos va contra producción.
 *    Acá se usa `migrate deploy`, que sólo aplica las migraciones pendientes
 *    que están commiteadas y no improvisa nada.
 *
 * ============================================================
 * COMO SE GENERA UNA MIGRACION NUEVA
 * ============================================================
 *
 * No acá. En una máquina de desarrollo, contra una base de desarrollo:
 *
 *     npm run db:migrate -- --name lo_que_cambio
 *
 * Eso escribe el SQL en `prisma/migrations/`, que se commitea y se revisa como
 * cualquier otro código. Este script sólo aplica lo que ya está commiteado.
 */

import { spawnSync } from 'node:child_process';

const env = process.env['VERCEL_ENV'] ?? 'local';
const isProduction = env === 'production';
const hasDatabase = (process.env['DATABASE_URL'] ?? '').length > 0;
const hasDirect = (process.env['DIRECT_URL'] ?? '').length > 0;

function done(message: string): never {
  console.log(`[migraciones] ${message}`);
  process.exit(0);
}

function fail(message: string): never {
  console.error(`[migraciones] ${message}`);
  process.exit(1);
}

if (!isProduction) {
  // Una preview NO migra. Construye y despliega contra lo que haya.
  //
  // Si más adelante se implementa una base por rama (Neon Branching), el lugar
  // para engancharla es acá: se le pasaría la URL de la rama y se migraría
  // ESA. Mientras eso no exista, no migrar es lo correcto y lo seguro.
  done(
    `entorno "${env}": no se migra. Sólo producción aplica migraciones, ` +
      'para que ninguna preview toque el schema ni los datos de producción.',
  );
}

// De acá para abajo: producción.

if (!hasDatabase) {
  // Una producción sin base es una configuración incompleta, no un caso
  // válido: la aplicación arrancaría guardando en el disco efímero de una
  // función serverless y perdería cada partida en el siguiente despliegue, sin
  // un solo error a la vista. Mejor no desplegar.
  fail(
    'falta DATABASE_URL en producción. Configurala en Vercel (Settings → ' +
      'Environment Variables) con el endpoint CON POOL de Neon. Sin base, las ' +
      'partidas se perderían en cada despliegue.',
  );
}

if (!hasDirect) {
  // `migrate deploy` necesita el endpoint directo: contra el pooler puede
  // fallar o quedar a medio aplicar, que es peor que fallar.
  fail(
    'falta DIRECT_URL en producción. Es el endpoint DIRECTO de Neon (sin ' +
      '`-pooler`), y las migraciones tienen que ir por ahí: un pooler en modo ' +
      'transacción no sostiene los bloqueos que `migrate deploy` necesita.',
  );
}

console.log('[migraciones] producción: aplicando las migraciones pendientes…');

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  fail(`no se pudo ejecutar prisma migrate deploy: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(
    `prisma migrate deploy terminó con código ${result.status}. ` +
      'El despliegue se corta acá a propósito: desplegar la aplicación contra ' +
      'un schema que no se pudo migrar deja una versión que espera una base ' +
      'distinta de la que hay.',
  );
}

done('migraciones aplicadas.');
