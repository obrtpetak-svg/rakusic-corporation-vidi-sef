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
                manualChunks(id) {
                    // React core — cached separately
                    if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
                        return 'react-vendor';
                    }
                    // Firebase Firestore (largest ~400kB)
                    if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) {
                        return 'firebase-firestore';
                    }
                    // Firebase Auth (~100kB)
                    if (id.includes('firebase/auth') || id.includes('@firebase/auth')) {
                        return 'firebase-auth';
                    }
                    // Firebase core + app
                    if (id.includes('firebase/') || id.includes('@firebase/')) {
                        return 'firebase-core';
                    }
                    // XLSX (heavy, only used in export)
                    if (id.includes('node_modules/xlsx')) {
                        return 'xlsx-vendor';
                    }
                },
            },
        },
    },
})
