# Persistencia y despliegue

Cómo se guarda una partida y cómo esto llega a producción. El juego **funciona
sin nada de esto**: la base de datos y Vercel son para que una carrera
sobreviva a cerrar el navegador y a cambiar de máquina.

---

## 1. Tres formas de guardar, una sola interfaz

El juego siempre guardó a través de `KeyValueStore` (`src/ui/services/storage.ts`):
tres claves, valores de texto, accesores sincrónicos. Esa frontera ya existía
antes de que hubiera base de datos, y es la única cosa que Postgres tuvo que
implementar.

| Dónde corre | Almacén | Archivo | Sobrevive a |
|---|---|---|---|
| HTML autocontenido | `localStorage` | `storage.ts` | cerrar la pestaña |
| `npm run serve` sin `DATABASE_URL` | archivos JSON | `src/server/file-store.ts` | reiniciar el servidor |
| Vercel, o `serve` con `DATABASE_URL` | PostgreSQL | `src/server/prisma-store.ts` | cambiar de máquina |

Quién gana lo decide `src/server/store-factory.ts`, **una sola vez al
arrancar**. Que no sea por petición es deliberado: si la base estuviera caída
en la primera petición y el servidor cayera a archivos, las partidas quedarían
partidas en dos lugares sin que nadie se enterara. Una vez elegido Postgres, un
fallo de la base es un **503**, no un cambio silencioso de almacenamiento.

## 2. El schema NO modela el fútbol

Es la decisión central, y la más fácil de deshacer sin darse cuenta.
`prisma/schema.prisma` tiene **dos modelos**, y ninguno es de fútbol:

```
Game            una partida (id, cuándo se creó, cuándo se tocó)
GameStateEntry  (gameId, key) → value    el guardado, tal cual
```

No hay `Player`, `Team`, `Attribute`, `Season` ni `Stadium`. **No es una
simplificación provisoria.** El repositorio ya tiene una fuente de verdad para
los jugadores —el archivo extraído del juego original, commiteado como código
generado— y deriva casi todo lo demás: valuaciones, tabla de posiciones,
reputación, química. Tablas de jugadores y atributos serían un **segundo
origen de verdad para los mismos 462 jugadores**, romperían el determinismo que
los tests del motor afirman, y desharían borrados que están documentados.

`tests/persistence.test.ts` tiene un test que **falla si alguien agrega un
modelo de fútbol**, con la lista de nombres prohibidos. Si de verdad hace falta
uno, hay que borrar ese test a mano y explicar por qué.

## 3. Neon: dos URLs, y no es redundancia

Neon da dos endpoints para la misma base. Hacen falta los dos:

| Variable | Endpoint | Quién la usa | Por qué |
|---|---|---|---|
| `DATABASE_URL` | **con pool** (host con `-pooler`) | la aplicación | cada invocación serverless abre su conexión; sin pool adelante, el límite de la base se agota con poco tráfico |
| `DIRECT_URL` | **directo** (sin `-pooler`) | sólo las migraciones | `prisma migrate` necesita sesiones largas y bloqueos de aviso que un pooler en modo transacción no sostiene: contra el pooler falla o —peor— deja la migración a medio aplicar |

Hay una tercera, **opcional y sólo para desarrollo**: `SHADOW_DATABASE_URL`,
una base vacía y descartable donde Prisma replaya las migraciones para calcular
qué schema producen. La necesitan `prisma migrate dev` (generar una migración)
y el test de deriva. **`migrate deploy` no la usa**, así que en Vercel no se
configura.

**Ninguna se commitea.** Van en variables de entorno; `.env.example` documenta
la forma sin valores.

### Poner Neon

1. Crear un proyecto en [neon.tech](https://neon.tech) (región: la más cercana
   a la de la función de Vercel).
2. En el dashboard, *Connection string*: copiar la **pooled** y la **direct**.
3. En Vercel → Settings → Environment Variables, cargarlas **por entorno** (§5).
4. El primer despliegue a producción aplica las migraciones solo.

### No hace falta Neon para desarrollar

El adaptador se elige por el host de la URL (`src/server/database.ts`):
`*.neon.tech` usa `PrismaNeon` (pool sobre WebSocket, que es producción), y
cualquier otro host usa `PrismaPg` (TCP común). Un Postgres en Docker sirve:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=x -e POSTGRES_DB=juego postgres:16
export DATABASE_URL='postgresql://postgres:x@127.0.0.1:5432/juego'
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy    # crear las tablas
npm run serve
```

El driver de Neon **no habla con un Postgres común**: usa el protocolo del
proxy WebSocket de Neon y contra cualquier otra base falla con `Received
network error or non-101 status code`, que no dice que el problema es el
adaptador. De ahí la elección por host.

## 4. Las migraciones

Todo cambio de estructura es un archivo en `prisma/migrations/`, commiteado y
revisado como cualquier código. **Nunca a mano contra producción.**

```bash
npm run db:migrate -- --name lo_que_cambio   # generar (desarrollo)
npm run db:deploy                            # aplicar (el gate de producción)
npm run db:status                             # ver qué está aplicado
```

`prisma/migrations/migration_lock.toml` fija el motor. Sin ese archivo
`migrate deploy` corta con *"Could not determine the connector from the
migrations directory"*: la base no se puede recrear. No se edita a mano.

### El gate: `scripts/migrate-deploy.ts`

Es lo que corre en el build de Vercel, y hace cumplir tres reglas:

1. **Una preview no toca producción.** Vercel construye cada rama y cada pull
   request, y por defecto les da las mismas variables que a producción. El
   corte es `VERCEL_ENV`: **sólo `production` migra**. Sin esto, abrir un pull
   request con un cambio de schema lo aplicaría a la base de producción antes
   de que nadie lo revise.
2. **Si la migración falla, no se despliega.** Devuelve distinto de cero y el
   build se corta ahí. Es la mitad que más duele: la aplicación arrancaría
   igual y fallaría recién cuando alguien juega.
3. **Nada de comandos de desarrollo.** `migrate dev` puede **resetear** la base
   y `db push` no deja migración. Contra producción va sólo `migrate deploy`,
   que aplica lo commiteado y no improvisa.

En producción sin `DATABASE_URL` o sin `DIRECT_URL`, **falla a propósito**: una
producción sin base guardaría en el disco efímero de una función serverless y
perdería cada partida en el siguiente despliegue, sin un solo error a la vista.

### Previews

Una preview **no migra y comparte la base de producción** si le diste las
mismas variables. Para aislarla de verdad, cargá en Vercel un `DATABASE_URL`
distinto **para el entorno Preview** (una rama de Neon sirve: son copias
instantáneas).

El lugar donde engancharía una base por rama automática (Neon Branching) está
marcado en `scripts/migrate-deploy.ts`, en la rama del `if (!isProduction)`:
habría que pasarle la URL de la rama y migrar **esa**. Mientras eso no exista,
no migrar es lo correcto y lo seguro.

## 5. Vercel

`vercel.json` define un sitio estático más **una** función:

- `dist/` — la interfaz compilada, servida como archivos.
- `api/index.mjs` — la función serverless. `/api/(.*)` reescribe a ella.
- Cache: `no-store` en `/api/*` y en `/index.html`; `immutable` un año en
  `/assets/*` (llevan hash en el nombre).

El build es `npm run vercel-build`, y el orden importa:

```
db:validate → db:generate → db:deploy → build → build:api
  schema ok   cliente       MIGRACIONES  interfaz  función
              de Prisma     (o se corta)
```

Las migraciones van **antes** de construir: si fallan, no llega a existir un
despliegue que espere un schema distinto del que tiene la base.

`api/index.ts` se empaqueta a `api/index.mjs` con `vite.config.api.ts`, porque
el proyecto importa con extensión explícita (`from './api.ts'`, que Node 22
exige) y depender de que Vercel resuelva esos especificadores es apostar a un
detalle de la plataforma. El runtime de Prisma y los drivers quedan externos
—Vercel los instala—; el cliente generado sí entra, en `api/assets/`.

La función **cachea la promesa** del almacén, no el almacén: dos invocaciones
frías simultáneas no abren dos pools.

### Variables por entorno

| Variable | Production | Preview | Development |
|---|---|---|---|
| `DATABASE_URL` | **obligatoria** (pooled) | opcional, mejor una rama propia | no hace falta |
| `DIRECT_URL` | **obligatoria** (directa) | no la usa (no migra) | no hace falta |
| `SHADOW_DATABASE_URL` | no | no | sólo para generar migraciones |
| `VERCEL_ENV` | la pone Vercel | la pone Vercel | la pone Vercel |

**`VERCEL_ENV` no se configura a mano.** Ponerla en Preview con el valor
`production` haría que una preview migre la base de producción, que es
exactamente lo que el gate existe para impedir.

## 6. Qué está comprobado, y con qué

`tests/persistence.test.ts` — 9 tests, **sin base de datos**, dentro de
`npm test`. Contrato del almacén contra un doble que registra las consultas
(una lectura y una escritura por petición, todo en una transacción, sin cambios
no toca la base), el schema sin modelos de fútbol y sin credenciales, y que la
migración commiteada reconstruye el schema.

`tests/persistence-live.test.ts` — 9 tests **contra un Postgres de verdad**, se
saltean solos sin `DATABASE_URL`. Viaje completo, que sobrescribir no duplique
la fila, que un guardado de 400 kB entre (el tipo es `TEXT`), que `removeItem`
borre la fila, la **cascada** al borrar una partida, y que dos partidas no se
vean entre ellas.

```bash
DATABASE_URL=… DIRECT_URL=… npm test                        # + los 9 vivos
SHADOW_DATABASE_URL=… DATABASE_URL=… DIRECT_URL=… npm test  # + el de deriva
```

**Deriva** es que el schema y las migraciones dejen de describir la misma base:
alguien cambia `schema.prisma`, se olvida de generar la migración, y
`migrate deploy` deja la base en la forma vieja con una aplicación que espera
la nueva. Nada falla en el despliegue; falla cuando alguien juega. Los dos
tests lo detectan, y se comprobó que **fallan** cuando se les mete una columna
de más.

Los 22 tests de navegador (`npm run test:ui`) usan siempre el almacén de
archivos, a propósito: son herméticos y no dependen de que haya una base.
El camino UI → API → Postgres se verificó a mano, jugando una fecha contra
Postgres y releyéndola después de reiniciar el servidor.

## 7. Los secretos

En `.gitignore`: `.env`, `.env.*` (menos `.env.example`), `src/generated/`,
`api/index.mjs`, `api/index.mjs.map`, `api/assets/`, `.vercel`.

`schema.prisma` no declara ninguna `url` —en Prisma 7 viven en
`prisma.config.ts`, que las lee de `process.env`— y hay un test que lo
verifica: un `url` en el schema se commitea.

Lo que se imprime en consola lleva **host, no URL**: una `DATABASE_URL`
completa lleva la contraseña adentro y las consolas terminan en logs.
