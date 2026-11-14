import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (
                element: HTMLElement,
                options: Record<string, unknown>,
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
        };
    }
}

const SCRIPT_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function TurnstileWidget({
    siteKey,
    resetKey = 0,
    onToken,
}: {
    siteKey: string;
    resetKey?: number;
    onToken: (token: string) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string>();
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useEffect(() => {
        let cancelled = false;

        const mount = () => {
            if (cancelled || !container.current || !window.turnstile) {
                return;
            }

            widgetId.current = window.turnstile.render(container.current, {
                sitekey: siteKey,
                callback: (token: string) => onTokenRef.current(token),
                'expired-callback': () => onTokenRef.current(''),
                'error-callback': () => onTokenRef.current(''),
            });
        };

        if (window.turnstile) {
            mount();
        } else {
            let script = document.querySelector<HTMLScriptElement>(
                `script[src="${SCRIPT_SRC}"]`,
            );

            if (!script) {
                script = document.createElement('script');
                script.src = SCRIPT_SRC;
                script.async = true;
                document.head.appendChild(script);
            }

            script.addEventListener('load', mount);
        }

        return () => {
            cancelled = true;

            if (widgetId.current && window.turnstile) {
                window.turnstile.remove(widgetId.current);
            }
        };
    }, [siteKey]);

    useEffect(() => {
        if (resetKey > 0 && widgetId.current && window.turnstile) {
            onTokenRef.current('');
            window.turnstile.reset(widgetId.current);
        }
    }, [resetKey]);

    return <div ref={container} />;
}
