import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return;
                    }

                    if (id.includes('@inertiajs')) {
                        return 'vendor-inertia';
                    }

                    if (id.includes('@tiptap') || id.includes('prosemirror')) {
                        return 'vendor-tiptap';
                    }

                    if (id.includes('@headlessui')) {
                        return 'vendor-headlessui';
                    }

                    if (id.includes('i18next')) {
                        return 'vendor-i18n';
                    }

                    if (id.includes('radix-ui') || id.includes('@radix-ui')) {
                        return 'vendor-radix';
                    }

                    if (id.includes('lucide-react')) {
                        return 'vendor-lucide';
                    }

                    if (
                        id.includes('zod') ||
                        id.includes('react-hook-form') ||
                        id.includes('@hookform')
                    ) {
                        return 'vendor-forms';
                    }

                    if (
                        id.includes('react-dom') ||
                        id.includes('use-sync-external-store') ||
                        id.includes('/scheduler/') ||
                        id.includes('\\scheduler\\') ||
                        /[/\\]react[/\\]/.test(id)
                    ) {
                        return 'vendor-react';
                    }
                },
            },
        },
    },
});
