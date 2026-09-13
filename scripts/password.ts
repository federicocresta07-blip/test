/**
 * UNA CONTRASEÑA NUEVA.
 *
 *     npm run password -- lhs237
 *
 * Imprime la contraseña UNA VEZ y el bloque para pegar en
 * `src/server/users.ts`. La contraseña no queda guardada en ningún lado: si se
 * pierde, se genera otra.
 *
 * Sin nombre, imprime uno para un usuario nuevo, listo para `USUARIOS_EXTRA`.
 *
 * NO ESCRIBE NADA SOLO. Podría editar `users.ts` por su cuenta, y a propósito
 * no lo hace: cambiar quién puede entrar a la aplicación es un cambio que se
 * revisa en un diff, no un efecto secundario de correr un script.
 */

import { randomBytes } from 'node:crypto';
import { derive, randomPassword, fixedUsernames, SCRYPT } from '../src/server/users.ts';

const nombre = process.argv[2];

const password = randomPassword();
const salt = randomBytes(16).toString('hex');
const hash = (await derive(password, salt)).toString('hex');

console.log('');
console.log('  CONTRASEÑA (se muestra una sola vez):');
console.log(`      ${password}`);
console.log('');

if (nombre !== undefined && fixedUsernames().includes(nombre)) {
  console.log(`  Reemplazá el bloque de "${nombre}" en src/server/users.ts por:`);
  console.log('');
  console.log('  {');
  console.log(`    username: '${nombre}',`);
  console.log(`    displayName: '<como se llama>',`);
  console.log(`    salt: '${salt}',`);
  console.log(`    hash: '${hash}',`);
  console.log('  },');
} else {
  const username = nombre ?? 'usuario';
  console.log(`  Para sumar a "${username}" sin desplegar, poné esta variable de entorno:`);
  console.log('');
  console.log(
    `  USUARIOS_EXTRA=${JSON.stringify([
      { username, displayName: '<como se llama>', salt, hash },
    ])}`,
  );
}

console.log('');
console.log(`  (scrypt N=${SCRYPT.N} r=${SCRYPT.r} p=${SCRYPT.p})`);
console.log('');
