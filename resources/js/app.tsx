import '../css/app.css';
import './i18n';

import { ThemeProvider } from '@/Components/ThemeProvider';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const protectedPathPrefixes = [
    '/dashboard',
    '/profile',
    '/verify-email',
    '/confirm-password',
];

const isProtectedPath = (pathname: string) =>
    protectedPathPrefixes.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

let isCheckingProtectedSession = false;

const checkProtectedSession = () => {
    if (!isProtectedPath(window.location.pathname)) {
        return;
    }

    if (isCheckingProtectedSession) {
        return;
    }

    isCheckingProtectedSession = true;

    router.reload({
        only: ['auth'],
        onError: () => {
            window.location.replace('/login');
        },
        onFinish: () => {
            isCheckingProtectedSession = false;
        },
        onSuccess: (page) => {
            const props = page.props as {
                auth?: {
                    user?: unknown;
                };
            };

            if (!props.auth?.user) {
                window.location.replace('/login');
            }
        },
    });
};

window.addEventListener('pageshow', (event) => {
    const navigationEntry = performance.getEntriesByType(
        'navigation',
    )[0] as PerformanceNavigationTiming | undefined;

    if (event.persisted || navigationEntry?.type === 'back_forward') {
        checkProtectedSession();
    }
});

window.addEventListener('popstate', () => {
    window.setTimeout(() => {
        checkProtectedSession();
    }, 0);
});

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkProtectedSession();
    }
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeProvider>
                <App {...props} />
            </ThemeProvider>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
