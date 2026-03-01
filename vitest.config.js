import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.{js,jsx}'],
        coverage: {
            reporter: ['text', 'lcov'],
            include: ['src/utils/**', 'src/context/**'],
        },
    },
});
