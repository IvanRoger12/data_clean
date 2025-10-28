import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { splitVendorChunkPlugin } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    splitVendorChunkPlugin(), // Sépare les vendors (react, date-fns)
  ],
  build: {
    outDir: 'dist',
    sourcemap: command === 'serve', // Pas de sourcemaps en prod
    target: 'esnext', // Cible navigateurs modernes
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Crée des chunks séparés pour les grosses dépendances
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'xlsx';
          }
          if (id.includes('node_modules/libphonenumber-js')) {
            return 'libphonenumber';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true, // Ouvre le navigateur au démarrage
    host: true, // Permet l'accès depuis le réseau local
  },
}));
