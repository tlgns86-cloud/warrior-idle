import { defineConfig } from 'vite';

// base: './' → 추후 Capacitor(Android/iOS) 패키징 시 상대 경로로 동작
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
