import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.test.{js,jsx,ts,tsx}', 'api/**/*.test.{js,jsx,ts,tsx}'],
        coverage: {
            reporter: ['text', 'lcov'],
            include: ['src/utils/**', 'src/context/**', 'src/components/**'],
        },
    },
});
