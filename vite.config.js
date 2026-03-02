import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split React into its own chunk (cached separately)
                    'react-vendor': ['react', 'react-dom'],
                    // Firebase compat SDK — largest dependency
                    'firebase-vendor': [
                        'firebase/app',
                        'firebase/auth',
                        'firebase/firestore',
                    ],
                },
            },
        },
    },
})
