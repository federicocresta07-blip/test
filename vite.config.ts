import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * La app web vive en la raiz del proyecto y comparte el arbol `src/` con el
 * motor de simulacion: la UI importa el motor real (`src/index.ts`), no una
 * copia ni datos inventados. El motor sigue sin dependencias propias.
 */
export default defineConfig({
  // Rutas relativas: asi el build funciona servido desde cualquier subruta,
  // no solo desde la raiz del dominio.
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
