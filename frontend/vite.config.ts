import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: {"/api": "http://localhost:8010" } },
  // css.include: Vitest blanks CSS imports (even ?raw) unless processing is on;
  // the palette test reads index.css to check every color has both shades.
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: { include: [/index\.css/] } },
});
