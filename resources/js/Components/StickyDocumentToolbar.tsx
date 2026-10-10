import { cn } from '@/lib/utils';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ToolbarPosition = { top: number; left: number; width: number; height: number };

export default function StickyDocumentToolbar({
    children,
    enabled = true,
    scopeRef,
    className,
    propertiesPanel = false,
}: {
    children: ReactNode;
    enabled?: boolean;
    scopeRef: RefObject<HTMLDivElement | null>;
    className?: string;
    propertiesPanel?: boolean;
}) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<ToolbarPosition | null>(null);

    useEffect(() => {
        if (!enabled) {
            setPosition(null);
            return;
        }

        const anchor = anchorRef.current;
        const scope = scopeRef.current;
        if (!anchor || !scope) return;

        const main = anchor.closest('main');
        const nav = document.querySelector('nav.sticky');
        let title = document.querySelector('[data-sticky-page-title]');
        let pinnedToolbar: Element | null = null;
        let frame = 0;
        const update = () => {
            frame = 0;
            const content = contentRef.current;
            if (!content) return;
            const currentTitle = document.querySelector('[data-sticky-page-title]');
            if (currentTitle !== title) {
                if (title) observer.unobserve(title);
                title = currentTitle;
                if (title) observer.observe(title);
            }
            const rect = anchor.getBoundingClientRect();
            const mainRect = main?.getBoundingClientRect();
            const currentToolbar = propertiesPanel
                ? document.querySelector('[data-document-toolbar][data-pinned="true"]')
                : null;
            if (currentToolbar !== pinnedToolbar) {
                if (pinnedToolbar) observer.unobserve(pinnedToolbar);
                pinnedToolbar = currentToolbar;
                if (pinnedToolbar) observer.observe(pinnedToolbar);
            }
            const top = Math.max(
                0,
                nav?.getBoundingClientRect().bottom ?? 0,
                title?.getBoundingClientRect().bottom ?? 0,
                pinnedToolbar?.getBoundingClientRect().bottom ?? 0,
            ) + (propertiesPanel ? 8 : 0);
            const left = Math.max(rect.left, mainRect?.left ?? 0, 8);
            const right = Math.min(rect.right, mainRect?.right ?? window.innerWidth, window.innerWidth - 8);
            const height = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
            const scopeBottom = scope.getBoundingClientRect().bottom;
            const visibleHeight = propertiesPanel ? Math.min(height, Math.max(0, window.innerHeight - top - 24)) : height;
            const wideEnough = !propertiesPanel || window.matchMedia('(min-width: 1280px)').matches;
            const next = wideEnough && rect.top < top && scopeBottom > top + visibleHeight && right > left
                ? { top, left, width: right - left, height }
                : null;

            setPosition((current) =>
                current?.top === next?.top && current?.left === next?.left &&
                current?.width === next?.width && current?.height === next?.height
                    ? current : next,
            );
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        const observer = new ResizeObserver(schedule);
        [anchor, scope, main, nav, title, contentRef.current].forEach((element) => {
            if (element) observer.observe(element);
        });
        const titleObserver = new MutationObserver(schedule);
        if (main?.parentElement) titleObserver.observe(main.parentElement, { childList: true });
        if (propertiesPanel) titleObserver.observe(document.body, { childList: true });
        update();
        window.addEventListener('scroll', schedule, { passive: true, capture: true });
        window.addEventListener('resize', schedule);
        return () => {
            observer.disconnect();
            titleObserver.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
        };
    }, [enabled, scopeRef, propertiesPanel, Boolean(position)]);

    const toolbar = (
        <div
            ref={contentRef}
            data-document-toolbar={propertiesPanel ? undefined : true}
            data-document-properties={propertiesPanel ? true : undefined}
            data-pinned={Boolean(position)}
            className={cn(
                'bg-background',
                position && 'fixed z-[29] overflow-y-auto rounded-b-md shadow-md',
                className,
            )}
            style={position ? {
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: `calc(100vh - ${position.top}px - 24px)`,
            } : undefined}
        >
            {children}
        </div>
    );

    return (
        <div ref={anchorRef} style={position ? { height: position.height } : undefined}>
            {position ? createPortal(toolbar, document.body) : toolbar}
        </div>
    );
}
