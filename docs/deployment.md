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

## 3. Quién entra: los usuarios y la sesión

Cuatro usuarios fijos, con la contraseña guardada como **hash de scrypt** en
`src/server/users.ts`:

| Usuario | Se llama |
|---|---|
| `lhs237` | Lucas |
| `Tomy` | Tomás |
| `Kezman` | Agustín |
| `fercha07` | fede |

El nombre de usuario **no distingue mayúsculas** —nadie se acuerda de cómo
escribió el suyo— pero la partida es una sola: `Tomy` y `tomy` son la misma
carrera.

**Los usuarios están en el código y no en la base** porque el login tiene que
funcionar sin base de datos: el HTML autocontenido no tiene servidor y
`npm run serve` sin `DATABASE_URL` guarda en archivos. Con los usuarios en
Postgres no se podría entrar a un servidor de archivos. Son cuatro personas
conocidas, no un registro abierto: no hay alta, ni baja, ni "olvidé mi
contraseña".

**Se pueden commitear esos hashes** porque las contraseñas se generaron al azar
con 80 bits de entropía (cuatro grupos de cuatro sobre un alfabeto de 32), así
que no hay diccionario que las saque de un scrypt. El hash de una contraseña
*elegida por una persona* no se podría commitear con el mismo argumento.

### Cambiar una contraseña, o sumar un jugador

```bash
npm run password -- Tomy     # reemplaza la de Tomy: imprime el bloque a pegar
npm run password -- pepe     # un usuario nuevo: imprime el JSON de USUARIOS_EXTRA
```

La contraseña se muestra **una sola vez** y no queda guardada en ningún lado.
Si se pierde, se genera otra.

`USUARIOS_EXTRA` es una variable de entorno con usuarios además de los cuatro:
lleva hashes, nunca contraseñas, y sirve para sumar a alguien sin tocar el
código. Un nombre que ya existe en `users.ts` se ignora, así que la variable no
puede apropiarse de la cuenta de otro.

### La sesión

Una cookie firmada con HMAC-SHA256, `HttpOnly`, `SameSite=Lax`, `Secure` sobre
HTTPS, válida 30 días. Lleva `usuario.vencimiento.firma` y **no lleva la
contraseña ni su hash**: si se filtra, se filtró una sesión con fecha de
vencimiento.

No hay tabla de sesiones: en serverless eso sería una consulta a la base en
cada petición. Lo que se pierde es poder revocar una sesión desde el servidor;
cambiar `SESSION_SECRET` invalida todas, y con cuatro personas eso alcanza como
botón de pánico.

### EL CAMBIO QUE IMPORTA: la partida sale de la sesión

Antes el servidor sacaba el nombre de la partida del header `x-partida` o de
una cookie **sin firmar** — las dos cosas que el cliente elige. Quien supiera o
adivinara el nombre de una carrera la abría y la jugaba. Alcanzaba mientras el
servidor fuera local; expuesto a internet no alcanza.

Ahora la partida de `Tomy` **es** `Tomy`, y el nombre se deduce de la cookie
firmada. Mandar `x-partida: lhs237` con una sesión de `Tomy` devuelve la de
`Tomy`, y hay un test que lo comprueba.

`requireLogin: false` existe para los tests que prueban el juego y no la
entrada. El valor por defecto es **con** login, así que un servidor de verdad
no queda abierto por un olvido.

## 4. Cada uno elige su club

La primera vez que alguien entra, elige uno de los **veinte** clubes del
Apertura 1998. Se elige una vez y es para toda la carrera: cambiarlo dejaría la
tabla, la caja y el estadio describiendo a otro equipo.

Los veinte planteles son los **reales del archivo** (462 jugadores), así que
quien elige Boca dirige a Riquelme y a Palermo. Con el club cambian el plantel,
el estadio y su aforo, la reputación, el ingreso, los sueldos, el presupuesto
de fichajes, los diecinueve rivales y el mercado.

El club vive en su **propia clave** del guardado (`manager:club:v1`), no dentro
de la temporada. Es una distinción que se paga: con el club adentro de la
temporada, `resetSeason` lo borraba y quien dirigía Vélez volvía siendo River
sin un solo aviso. Estaba escrito y probado así antes de encontrarlo.

**La caja inicial es la misma para los veinte**, y es a propósito: está medido
y explicado en `src/ui/data/club-development.ts`. El club chico ya es mucho más
difícil porque su ingreso sale de sus socios reales mientras los sueldos salen
de su plantel real (River −11M/mes, Platense −43M/mes); repartir la caja
proporcional a los socios dejaría a cuatro clubes insolventes en dos semanas.

### CUATRO CARRERAS, NO UNA LIGA COMPARTIDA

Cada usuario dirige **su propio torneo**, con sus diecinueve rivales. Si Lucas
elige River y Tomás elige Boca, no juegan uno contra el otro: juegan dos
campeonatos paralelos que nunca se cruzan.

La razón es del motor, no del servidor: `playRound` resuelve los diez partidos
de la fecha de una vez, así que no hay dónde esperar la alineación de otro
humano. Una liga compartida pide que la fecha espere a todos los clubes
humanos, y eso es una fase entera, no un parámetro.

## 5. PONERLO ONLINE, PASO A PASO

Esta es la receta completa, desde una cuenta de Neon recién creada hasta la
URL funcionando. Son unos diez minutos y no hace falta instalar nada: todo se
hace desde el navegador.

### PARTE 1 — Neon: la base de datos (3 minutos)

**1.1** En [console.neon.tech](https://console.neon.tech), creá un proyecto.

- **Name**: lo que quieras (`argentina-manager`).
- **Postgres version**: la que venga por defecto.
- **Region**: la más cercana. Para Argentina, *AWS South America (São Paulo)*
  `sa-east-1`. La región importa porque cada consulta viaja: con la base en
  Virginia y el jugador en Buenos Aires se pierden ~120 ms por consulta.

**1.2** Copiá **DOS** cadenas de conexión, no una. Neon muestra un panel
*Connection string* (o un botón **Connect**) con un selector de *branch*,
*database* y *role*, y un interruptor de **connection pooling**.

- Con el pooling **ACTIVADO** → esa es `DATABASE_URL`.
- Con el pooling **DESACTIVADO** → esa es `DIRECT_URL`.

**Cómo saber cuál es cuál sin depender de dónde esté el botón:** mirá el host.
La que lleva `-pooler` en el nombre del host es la del pool.

```
DATABASE_URL   postgresql://USER:PASS@ep-algo-123-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
                                              ^^^^^^^ con pooler
DIRECT_URL     postgresql://USER:PASS@ep-algo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require
                                              sin pooler
```

Son el MISMO host con y sin `-pooler`: si tenés una, la otra sale de sacarle o
agregarle esa palabra. Dejá el `?sslmode=require` en las dos.

Si la cadena muestra la contraseña como `****`, usá el botón de mostrar u
*Reset password* en el role. Sin la contraseña real la cadena no sirve.

### PARTE 2 — Vercel: el despliegue (5 minutos)

**2.1** En [vercel.com](https://vercel.com) → **Sign Up** → **Continue with
GitHub**, con la misma cuenta de GitHub que tiene el repositorio.

**2.2** **Add New…** → **Project**. Buscá `test` (el repositorio
`federicocresta07-blip/test`) y tocá **Import**.

> Si el repositorio no aparece en la lista, es permiso de GitHub, no un error:
> **Adjust GitHub App Permissions** → dale acceso a ese repositorio → volvé.

**2.3** **NO toques el Framework Preset ni el Build Command.** El repositorio
trae `vercel.json`, que ya define el build (`npm run vercel-build`), la carpeta
de salida (`dist`) y la función (`api/index.mjs`). Aunque Vercel detecte "Vite"
solo, lo de `vercel.json` manda. *Root Directory* se deja en la raíz.

**2.4** Abrí **Environment Variables** y agregá **TRES**. Los nombres van
exactos, respetando mayúsculas:

| Name | Value |
|---|---|
| `DATABASE_URL` | la cadena **con** `-pooler` |
| `DIRECT_URL` | la cadena **sin** `-pooler` |
| `SESSION_SECRET` | una cadena al azar, mínimo 16 caracteres |

Para generar el secreto, cualquiera de las dos:

```bash
# con el repositorio a mano
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```js
// o en la consola del navegador (F12 → Console), sin instalar nada
crypto.getRandomValues(new Uint8Array(32)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'')
```

Ese secreto **no se commitea y no se comparte**: con él se pueden firmar
sesiones de cualquiera de los cuatro usuarios. Cambiarlo cierra todas las
sesiones abiertas, que es justamente el botón de pánico.

**2.5** **Deploy**. El build hace, en este orden: validar el schema, generar el
cliente, **aplicar las migraciones**, construir la interfaz y empaquetar la
función. Si falta alguna de las tres variables **corta ahí** en lugar de
desplegar algo roto.

**2.6** Cuando termina, Vercel da la URL: `https://<proyecto>.vercel.app`.

El repositorio tiene UNA sola rama y es la rama por defecto, así que Vercel la
trata como producción: cada `git push` vuelve a desplegar solo.

### PARTE 3 — Probar que quedó bien (2 minutos)

1. Abrí la URL. Tiene que aparecer la **pantalla de entrada**, no el juego.
2. Entrá con un usuario y su contraseña. Tiene que pedir **elegir club** (los
   veinte del Apertura 98).
3. Elegí uno y jugá una fecha.
4. **La prueba que vale**: cerrá el navegador, abrí la URL desde el celular,
   entrá con el mismo usuario. La carrera tiene que estar donde la dejaste.
   Eso es lo que la base de datos vino a hacer; sin ella, el paso 4 falla.

### Si algo falla

Los errores que corta el build dicen exactamente qué falta. En el log de Vercel
(**Deployments** → el último → **Building**):

| Lo que dice el log | Qué pasa | Cómo se arregla |
|---|---|---|
| `[migraciones] falta DATABASE_URL en producción` | no cargaste la variable, o está vacía | Settings → Environment Variables |
| `[migraciones] falta DIRECT_URL en producción` | idem, o le pusiste la del pooler a las dos | revisá el `-pooler` |
| `[migraciones] falta SESSION_SECRET en producción (mínimo 16 caracteres)` | falta, o es más corta que 16 | generá una nueva |
| `P1001: Can't reach database server` | el host está mal escrito, o falta `?sslmode=require` | volvé a copiar la cadena de Neon |
| `P1000: Authentication failed` | la contraseña de la cadena no es la real | *Reset password* en el role de Neon |
| el juego carga pero al jugar da **503** | la base no responde en tiempo de ejecución | revisá que `DATABASE_URL` sea la del **pooler** |

Después de cambiar una variable hay que **volver a desplegar** para que la tome:
**Deployments** → el último → **⋯** → **Redeploy**.

## 6. Neon: dos URLs, y no es redundancia

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

## 7. Las migraciones

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

## 8. Vercel

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
| `SESSION_SECRET` | **obligatoria** (≥16 caracteres) | conviene, o las sesiones se caen | opcional |
| `SHADOW_DATABASE_URL` | no | no | sólo para generar migraciones |
| `USUARIOS_EXTRA` | opcional | opcional | opcional |
| `VERCEL_ENV` | la pone Vercel | la pone Vercel | la pone Vercel |

`SESSION_SECRET` es obligatoria en producción y **el build se corta sin ella**.
Sin secreto configurado, `auth.ts` inventa uno al azar por proceso: en un
servidor de una pieza alcanza, pero en serverless cada arranque en frío
inventaría otro y a los cuatro les pediría entrar de nuevo cada tantos minutos,
sin un error a la vista. El síntoma sin la causa es lo peor que puede pasar en
producción, así que se comprueba antes de desplegar.

**`VERCEL_ENV` no se configura a mano.** Ponerla en Preview con el valor
`production` haría que una preview migre la base de producción, que es
exactamente lo que el gate existe para impedir.

## 9. Qué está comprobado, y con qué

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

`tests/auth.test.ts` — 15 tests de la entrada: que los cuatro usuarios existan
con su nombre, que ninguna contraseña esté en el repositorio, que un usuario
inexistente y una contraseña incorrecta digan **lo mismo**, que sin sesión no
se juegue, que **la partida sea la del usuario y no la que pida el cliente**,
que dos usuarios no se vean, que una cookie retocada (usuario, vencimiento,
firma) no sirva, y que demasiados intentos frenen.

`tests/team-choice.test.ts` — 10 tests de la elección: que los veinte clubes
tengan su plantel real (462 jugadores en total), que elegir cambie **todo** y no
sólo el escudo, que los rivales sean los otros diecinueve, que el mercado no
ofrezca a los propios, que no se pueda cambiar de club, y que el club sobreviva
a reiniciar la temporada.

Los 26 tests de navegador (`npm run test:ui`): 22 prueban las pantallas del
juego con el almacén de archivos y sin login, a propósito —son herméticos— y 4
(`login.test.ts`) recorren la entrada de verdad en Chromium: la pantalla, el
rechazo, entrar, elegir club y que el plantel que se ve sea el de ese club.

Ahí aparecieron los dos bugs que el compilador no podía ver: un `null` que
viajaba como `undefined` y mandaba al usuario a dirigir River sin preguntarle,
y una pantalla de entrada mostrada contra un servidor sin login.

El camino UI → API → Postgres se verificó a mano, con los cuatro usuarios
entrando, eligiendo cuatro clubes distintos y jugando fechas sin pisarse.

## 10. Los secretos

En `.gitignore`: `.env`, `.env.*` (menos `.env.example`), `src/generated/`,
`api/index.mjs`, `api/index.mjs.map`, `api/assets/`, `.vercel`.

`schema.prisma` no declara ninguna `url` —en Prisma 7 viven en
`prisma.config.ts`, que las lee de `process.env`— y hay un test que lo
verifica: un `url` en el schema se commitea.

Lo que se imprime en consola lleva **host, no URL**: una `DATABASE_URL`
completa lleva la contraseña adentro y las consolas terminan en logs.
