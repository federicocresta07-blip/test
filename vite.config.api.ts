import { defineConfig } from 'vite';

/**
 * EMPAQUETADO DE LA FUNCION SERVERLESS.
 *
 * Toma `api/index.ts` y produce `api/index.mjs`: un solo archivo sin imports
 * relativos, que es lo que Vercel ejecuta.
 *
 * POR QUE EMPAQUETAR EN LUGAR DE DEJAR QUE VERCEL COMPILE. El proyecto importa
 * con extensión explícita (`from './api.ts'`), porque Node 22 corre TypeScript
 * por type-stripping y lo exige. Vercel tiene su propio manejo de TypeScript en
 * las funciones, y depender de que resuelva esos especificadores es apostar a
 * un detalle de la plataforma que no controlo. Empaquetando acá, el resultado
 * es un `.mjs` común que cualquier Node 22 ejecuta, y se puede leer.
 *
 * QUE QUEDA AFUERA DEL PAQUETE. Los paquetes de Prisma y los drivers
 * (`@prisma/client/runtime`, `@prisma/adapter-neon`, `@prisma/adapter-pg`,
 * `@neondatabase/serverless`): son dependencias de producción que Vercel
 * instala, y meter el runtime de Prisma dentro de un bundle rompe la
 * resolución de su motor de consultas.
 *
 * QUE SI ENTRA. El cliente GENERADO (`src/generated/prisma`) sí se empaqueta,
 * en un chunk aparte —`api/assets/client-*.js`— porque se importa con una ruta
 * relativa. Eso está bien y está comprobado: ese chunk es código común que
 * importa el runtime de Prisma, que sigue siendo externo. Se verificó
 * levantando `api/index.mjs` contra un Postgres de verdad y escribiendo una
 * partida.
 */
export default defineConfig({
  // NADA DE `public/`. Vite copia esa carpeta al `outDir` de todo build, y acá
  // el `outDir` es `api/`, que ES CODIGO FUENTE: sin esto el build dejaba los
  // 19 escudos y el favicon dentro de `api/`, listos para commitearse como
  // basura junto a `api/index.ts`. Los assets los sirve el build de la
  // interfaz desde `dist/`; la función serverless no sirve archivos.
  publicDir: false,

  build: {
    ssr: 'api/index.ts',
    outDir: 'api',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    // Sourcemap: cuando una función serverless falla, el stack sobre código
    // empaquetado sin mapa no dice nada útil.
    sourcemap: true,
    rollupOptions: {
      output: { entryFileNames: 'index.mjs', format: 'esm' },
      // Prisma, su motor y el driver de Neon se resuelven en tiempo de
      // ejecución. `node:*` también: son módulos de la plataforma.
      external: [
        /^node:/,
        /^@prisma\//,
        /^@neondatabase\//,
        /^\.prisma\//,
        'prisma',
      ],
    },
  },
  // El cliente generado de Prisma se importa de forma dinámica y con una ruta
  // relativa; se deja fuera del paquete para que Vercel lo resuelva contra el
  // que `prisma generate` produjo en el build.
  ssr: { external: ['@prisma/client', '@prisma/adapter-neon', '@neondatabase/serverless'] },
});
