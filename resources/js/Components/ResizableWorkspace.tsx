import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/Components/ui/resizable';
import { cn } from '@/lib/utils';
import { Children, type ReactNode, useEffect, useState } from 'react';
import { useDefaultLayout } from 'react-resizable-panels';

const DESKTOP_QUERY = '(min-width: 1280px)';

function useDesktop() {
    const [desktop, setDesktop] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
    );

    useEffect(() => {
        const media = window.matchMedia(DESKTOP_QUERY);
        const sync = () => setDesktop(media.matches);
        sync();
        media.addEventListener('change', sync);

        return () => media.removeEventListener('change', sync);
    }, []);

    return desktop;
}

/**
 * Main work area + Object Inspector side by side, with a drag handle between
 * them on desktop (>= 1280px). Each user's widths are remembered per page in
 * localStorage. Phones and tablets keep the stacked layout.
 */
export default function ResizableWorkspace({
    id,
    children,
    sideDefault,
    sideMin = 320,
    sideMax = '55%',
    mainMin = 420,
    className,
    stackedClassName = 'grid gap-4',
    sideFirstWhenStacked = false,
    sideLabel = 'Resize the Object Inspector',
}: {
    /** Unique per page; used as the localStorage key. */
    id: string;
    /** Exactly two children: the main work area, then the side panel. */
    children: ReactNode;
    /** Starting inspector width in pixels. */
    sideDefault: number;
    sideMin?: number | string;
    sideMax?: number | string;
    mainMin?: number | string;
    className?: string;
    stackedClassName?: string;
    /** On phones and tablets, show the side panel above the main area. */
    sideFirstWhenStacked?: boolean;
    sideLabel?: string;
}) {
    const [main, side] = Children.toArray(children);
    const desktop = useDesktop();
    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: `gateway-workspace:${id}`,
        panelIds: ['main', 'side'],
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        onlySaveAfterUserInteractions: true,
    });

    if (!desktop) {
        return (
            <div className={cn(stackedClassName, className)}>
                {sideFirstWhenStacked ? side : main}
                {sideFirstWhenStacked ? main : side}
            </div>
        );
    }

    return (
        <ResizablePanelGroup
            id={`gateway-workspace:${id}`}
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
            className={cn('items-start', className)}
            // Let sticky headers, pinned toolbars and menus escape the panels.
            style={{ overflow: 'visible', height: 'auto' }}
        >
            <ResizablePanel id="main" minSize={mainMin} style={{ overflow: 'visible' }}>
                {main}
            </ResizablePanel>
            <ResizableHandle
                withHandle
                aria-label={sideLabel}
                title={sideLabel}
                className="mx-2 w-1.5 self-stretch rounded-full bg-transparent transition-colors hover:bg-border focus-visible:bg-border data-[separator=active]:bg-primary/40"
            />
            <ResizablePanel
                id="side"
                defaultSize={sideDefault}
                minSize={sideMin}
                maxSize={sideMax}
                groupResizeBehavior="preserve-pixel-size"
                style={{ overflow: 'visible' }}
            >
                {side}
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
