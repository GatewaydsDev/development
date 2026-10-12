import { router } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type LoadingVisit = {
    method: string;
    url: string | URL;
    prefetch?: boolean;
    only?: string[];
    except?: string[];
    showProgress?: boolean;
};

const CONTENT_SELECTOR = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'li', 'td', 'th', 'dt', 'dd', 'label', 'button', 'a', 'span',
    'small', 'strong', 'em', 'figcaption', 'blockquote', 'div',
    'input', 'textarea', 'select', 'img', 'svg',
].join(',');

const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,button,a,label,figcaption,blockquote';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let pending = 0;
const listeners = new Set<() => void>();
const trackedVisits = new WeakSet<object>();
const restores: Array<() => void> = [];

const notify = () => {
    listeners.forEach((listener) => listener());
};

const shouldShowSkeleton = (visit: LoadingVisit) => {
    if (visit.prefetch || visit.showProgress === false) {
        return false;
    }

    if ((visit.only && visit.only.length > 0) || (visit.except && visit.except.length > 0)) {
        return false;
    }

    return visit.method.toLowerCase() === 'get';
};

const hasText = (element: HTMLElement) => (element.innerText ?? element.textContent ?? '').trim().length > 0;

const isContentLeaf = (element: HTMLElement) => {
    if (element.closest('svg')) {
        return false;
    }

    return ![...element.children].some((child) => {
        if (!(child instanceof HTMLElement)) {
            return false;
        }

        return child.matches(CONTENT_SELECTOR) && (hasText(child) || child.matches('img, svg, input, textarea, select'));
    });
};

const SHIMMER = 'linear-gradient(100deg, color-mix(in oklch, var(--foreground) 16%, var(--background)) 0%, color-mix(in oklch, var(--foreground) 16%, var(--background)) 32%, color-mix(in oklch, var(--foreground) 42%, var(--background)) 50%, color-mix(in oklch, var(--foreground) 16%, var(--background)) 68%, color-mix(in oklch, var(--foreground) 16%, var(--background)) 100%)';

const paintBlock = (element: HTMLElement, media = false) => {
    element.classList.add(media ? 'page-skeleton-media' : 'page-skeleton-block');
    element.style.setProperty('color', 'transparent', 'important');
    element.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
    element.style.setProperty('background-image', SHIMMER, 'important');
    element.style.setProperty('background-size', '240% 100%', 'important');
    element.style.setProperty('background-repeat', 'no-repeat', 'important');
    element.style.setProperty('background-clip', 'border-box', 'important');
    element.style.setProperty('-webkit-background-clip', 'border-box', 'important');
    element.style.setProperty('animation', 'page-skeleton-shimmer 1.05s linear infinite', 'important');
    element.style.setProperty('border-radius', '0.4rem', 'important');
    element.style.setProperty('text-shadow', 'none', 'important');
    element.style.setProperty('box-shadow', 'none', 'important');

    element.querySelectorAll<HTMLElement>('*').forEach((child) => {
        remember(child, () => {
            child.style.setProperty('color', 'transparent', 'important');
            child.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
            child.style.setProperty('background-image', 'none', 'important');
            child.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');

            if (child instanceof SVGElement) {
                child.style.setProperty('opacity', '0', 'important');
            }
        });
    });
};

const remember = (element: HTMLElement, apply: () => void) => {
    const previousClass = element.getAttribute('class');
    const style = element.getAttribute('style');
    const src = element instanceof HTMLImageElement ? element.getAttribute('src') : null;
    const alt = element instanceof HTMLImageElement ? element.getAttribute('alt') : null;

    apply();

    restores.push(() => {
        if (!element.isConnected) {
            return;
        }

        if (previousClass === null) {
            element.removeAttribute('class');
        } else {
            element.setAttribute('class', previousClass);
        }

        if (style === null) {
            element.removeAttribute('style');
        } else {
            element.setAttribute('style', style);
        }

        if (element instanceof HTMLImageElement) {
            if (src === null) {
                element.removeAttribute('src');
            } else {
                element.setAttribute('src', src);
            }

            if (alt === null) {
                element.removeAttribute('alt');
            } else {
                element.setAttribute('alt', alt);
            }
        }
    });
};

const skeletonizePage = () => {
    const main = document.querySelector('main');

    if (!main || main.getAttribute('aria-busy') === 'true') {
        return;
    }

    document.documentElement.setAttribute('data-page-skeleton', 'true');
    main.setAttribute('aria-busy', 'true');
    const previousPointer = main.style.pointerEvents;
    main.style.pointerEvents = 'none';
    restores.push(() => {
        document.documentElement.removeAttribute('data-page-skeleton');

        if (!main.isConnected) {
            return;
        }

        main.removeAttribute('aria-busy');
        main.style.pointerEvents = previousPointer;
    });

    main.querySelectorAll<HTMLElement>(CONTENT_SELECTOR).forEach((element) => {
        if (element.closest('.page-skeleton-block, .page-skeleton-media')) {
            return;
        }

        if (element instanceof SVGElement || element instanceof HTMLImageElement) {
            if (element.closest(BLOCK_SELECTOR)) {
                return;
            }

            const box = element.getBoundingClientRect();

            if (box.width < 8 || box.height < 8) {
                return;
            }

            if (element instanceof SVGElement && box.width < 36 && box.height < 36) {
                remember(element, () => element.classList.add('page-skeleton-icon'));

                return;
            }

            remember(element, () => {
                paintBlock(element, true);

                if (element instanceof HTMLImageElement) {
                    element.alt = '';
                    element.style.width = `${box.width}px`;
                    element.style.height = `${box.height}px`;
                    element.src = TRANSPARENT_PIXEL;
                }
            });

            return;
        }

        if (element.parentElement?.closest('.page-skeleton-block, .page-skeleton-media')) {
            return;
        }

        const insideBlock = Boolean(element.parentElement?.closest(BLOCK_SELECTOR));

        if (element.matches(BLOCK_SELECTOR)) {
            if (insideBlock || !hasText(element)) {
                return;
            }

            remember(element, () => paintBlock(element));

            return;
        }

        if (insideBlock || !isContentLeaf(element)) {
            return;
        }

        if (!hasText(element) && !element.matches('input, textarea, select')) {
            return;
        }

        remember(element, () => paintBlock(element));
    });
};

const clearPageSkeleton = () => {
    while (restores.length > 0) {
        restores.pop()?.();
    }
};

export default function PageSkeleton() {
    const [pendingLoads, setPendingLoads] = useState(pending);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const sync = () => setPendingLoads(pending);
        listeners.add(sync);
        const stopStart = router.on('start', (event) => {
            const visit = event.detail.visit as LoadingVisit;

            if (!shouldShowSkeleton(visit) || trackedVisits.has(visit)) {
                return;
            }

            trackedVisits.add(visit);
            pending += 1;
            notify();
        });
        const stopFinish = router.on('finish', (event) => {
            if (!trackedVisits.has(event.detail.visit)) {
                return;
            }

            pending = Math.max(0, pending - 1);
            notify();
        });

        return () => {
            listeners.delete(sync);
            stopStart();
            stopFinish();
            clearPageSkeleton();
        };
    }, []);

    useEffect(() => {
        if (pendingLoads === 0) {
            setVisible(false);

            return;
        }

        const timer = window.setTimeout(() => setVisible(true), 160);

        return () => window.clearTimeout(timer);
    }, [pendingLoads]);

    useEffect(() => {
        if (!visible) {
            clearPageSkeleton();

            return;
        }

        skeletonizePage();

        return () => clearPageSkeleton();
    }, [visible]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className="pointer-events-none fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 text-sm font-medium text-foreground shadow-lg"
            role="status"
            aria-live="polite"
        >
            <LoaderCircleIcon className="size-4 animate-spin text-emerald-700" />
            Loading page
        </div>
    );
}
