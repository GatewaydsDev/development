import { Button } from '@/Components/ui/button';
import { markupInks, type CountTool } from '@/Pages/Admin/Takeoffs/Partials/PdfWorkspace';
import { cn } from '@/lib/utils';
import {
    AppWindowIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ContrastIcon,
    DoorOpenIcon,
    GripVerticalIcon,
    HandIcon,
    Maximize2Icon,
    Minimize2Icon,
    MousePointer2Icon,
    PenLineIcon,
    RotateCwIcon,
    SquareDashedIcon,
    ScanSearchIcon,
    SunIcon,
    Trash2Icon,
    Undo2Icon,
    UploadIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

export type MarkDraft = {
    number: string;
    type: 'door' | 'window';
    width: string;
    height: string;
    notes: string;
};

type DocumentOption = { id: number; label: string };

type Props = {
    canEdit: boolean;
    tool: CountTool;
    onToolChange: (tool: CountTool) => void;
    ink: string;
    onInk: (color: string) => void;
    boxKind: 'door' | 'window';
    onBoxKind: (kind: 'door' | 'window') => void;
    page: number;
    pageCount: number;
    onPage: (page: number) => void;
    zoom: number;
    onZoomBy: (factor: number) => void;
    onFit: (mode: 'page' | 'width' | 'actual') => void;
    onRotate: () => void;
    straighten: number;
    onStraighten: (value: number) => void;
    brightness: number;
    contrast: number;
    dim: number;
    onBrightness: (value: number) => void;
    onContrast: (value: number) => void;
    onDim: (value: number) => void;
    focus: boolean;
    onToggleFocus: () => void;
    doorCount: number;
    windowCount: number;
    nextMark: string;
    documents: DocumentOption[];
    documentId: number | null;
    onDocument: (id: number) => void;
    onUpload?: () => void;
    onScan?: () => void;
    uploading?: boolean;
    onUndo?: () => void;
    canUndo?: boolean;
    split: boolean;
    onToggleSplit: () => void;
    minimap: boolean;
    onToggleMinimap: () => void;
    mark: MarkDraft | null;
    onMarkChange: (patch: Partial<MarkDraft>) => void;
    onMarkSave: () => void;
    view: 'drawing' | 'inspector';
    onView: (view: 'drawing' | 'inspector') => void;
    inspector?: ReactNode;
};

const paletteKey = 'gateway.takeoff-palette';

type PalettePlace = { x: number; y: number; collapsed: boolean };

function readPlace(): PalettePlace {
    const fallback = { x: 12, y: 12, collapsed: false };

    try {
        const parsed = JSON.parse(localStorage.getItem(paletteKey) ?? '') as Partial<PalettePlace>;
        const x = Number(parsed.x);
        const y = Number(parsed.y);

        return {
            x: Number.isFinite(x) ? x : fallback.x,
            y: Number.isFinite(y) ? y : fallback.y,
            collapsed: Boolean(parsed.collapsed),
        };
    } catch {
        return fallback;
    }
}

const tools: { id: CountTool; label: string; key: string; icon: typeof DoorOpenIcon }[] = [
    { id: 'door', label: 'Door', key: 'D', icon: DoorOpenIcon },
    { id: 'window', label: 'Window', key: 'W', icon: AppWindowIcon },
    { id: 'select', label: 'Select', key: 'V', icon: MousePointer2Icon },
    { id: 'hand', label: 'Hand', key: 'H', icon: HandIcon },
    { id: 'remove', label: 'Remove', key: 'X', icon: Trash2Icon },
];

const outlineTools: { id: CountTool; label: string; key: string; icon: typeof DoorOpenIcon }[] = [
    { id: 'pen', label: 'Pen', key: 'P', icon: PenLineIcon },
    { id: 'box', label: 'Box', key: 'B', icon: SquareDashedIcon },
];

export default function DrawingPalette(props: Props) {
    const frameRef = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<PalettePlace>(() => readPlace());
    const [pageDraft, setPageDraft] = useState(String(props.page));
    const [sheetOpen, setSheetOpen] = useState(false);
    const [cardHeight, setCardHeight] = useState<number | null>(null);

    useEffect(() => {
        setPageDraft(String(props.page));
    }, [props.page]);

    useEffect(() => {
        if (props.view === 'inspector') {
            setPlace((current) => (current.collapsed || current.y !== 8 ? { ...current, collapsed: false, y: 8 } : current));
        }
    }, [props.view]);

    useEffect(() => {
        const measure = () => {
            const parent = frameRef.current?.parentElement;

            if (!parent) {
                return;
            }

            const rect = parent.getBoundingClientRect();
            const cardTop = rect.top + place.y;
            const limit = Math.min(rect.bottom, window.innerHeight) - 8;
            setCardHeight(Math.max(0, limit - cardTop));
        };

        measure();
        const parent = frameRef.current?.parentElement;
        const observer = parent ? new ResizeObserver(measure) : null;
        observer?.observe(parent as Element);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [place.y, props.view]);

    useEffect(() => {
        try {
            localStorage.setItem(paletteKey, JSON.stringify(place));
        } catch {
            // The palette still stays where it was dropped for this visit.
        }
    }, [place]);

    const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const bounds = frameRef.current?.parentElement?.getBoundingClientRect();

        if (!bounds) {
            return;
        }

        event.preventDefault();
        const originX = event.clientX;
        const originY = event.clientY;
        const start = place;
        const width = frameRef.current?.offsetWidth ?? 280;
        const height = frameRef.current?.offsetHeight ?? 48;

        const move = (moveEvent: PointerEvent) => {
            const x = Math.min(bounds.width - width - 8, Math.max(8, start.x + moveEvent.clientX - originX));
            const y = Math.min(bounds.height - 48, Math.max(8, start.y + moveEvent.clientY - originY));
            setPlace((current) => ({ ...current, x, y }));
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };

        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        void height;
    };

    const commitPage = () => {
        const next = Number(pageDraft);

        if (!Number.isFinite(next)) {
            setPageDraft(String(props.page));

            return;
        }

        props.onPage(Math.min(props.pageCount, Math.max(1, Math.round(next))));
    };

    const toolHint = props.tool === 'door' || props.tool === 'window'
        ? `Click the sheet to place ${props.nextMark}`
        : props.tool === 'pen'
            ? 'Drag around a door or window. The colored line stays on the sheet.'
            : props.tool === 'box'
                ? `Drag a box around a ${props.boxKind}. It is counted as number ${props.nextMark || 'the next mark'}.`
                : props.tool === 'hand'
                    ? 'Drag the sheet. Hold Space for the hand from any tool.'
                    : props.tool === 'remove'
                        ? 'Click a mark or an outline to remove it.'
                        : 'Click a mark to edit it. Drag the number or the point.';

    return (
        <div
            ref={frameRef}
            className={cn('absolute z-30 max-w-[calc(100%-1rem)]', props.view === 'inspector' ? 'w-[26rem]' : 'w-[20rem]')}
            style={{ left: place.x, top: place.y }}
            onPointerDown={(event) => event.stopPropagation()}
        >
            {place.collapsed ? (
                <button
                    type="button"
                    className="flex size-11 items-center justify-center rounded-full border border-white/70 bg-white text-[#16324F] shadow-lg"
                    aria-label="Open drawing tools"
                    onClick={() => setPlace((current) => ({ ...current, collapsed: false }))}
                >
                    <DoorOpenIcon className="size-5" />
                </button>
            ) : (
                <div
                    className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#d5deea] bg-white/95 text-[#16324F] shadow-xl backdrop-blur"
                    style={{
                        maxHeight: cardHeight ?? undefined,
                        height: props.view === 'inspector' ? cardHeight ?? undefined : undefined,
                    }}
                >
                    <div className="flex shrink-0 items-center gap-1 border-b border-[#e6edf5] px-2 py-1.5">
                        <button
                            type="button"
                            className="flex size-8 cursor-grab items-center justify-center rounded-md text-[#5c6b7a] active:cursor-grabbing"
                            aria-label="Drag drawing tools"
                            onPointerDown={beginDrag}
                        >
                            <GripVerticalIcon className="size-4" />
                        </button>
                        <div className="flex min-w-0 flex-1 gap-1" role="tablist" aria-label="Drawing card">
                            {(['drawing', 'inspector'] as const).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    role="tab"
                                    aria-selected={props.view === item}
                                    className={cn(
                                        'min-w-0 flex-1 truncate rounded-md px-2 py-1 text-xs font-semibold',
                                        props.view === item ? 'bg-[#16324F] text-white' : 'text-[#16324F] hover:bg-[#eef3f8]',
                                    )}
                                    onClick={() => props.onView(item)}
                                >
                                    {item === 'drawing' ? 'Drawing' : 'Object inspector'}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded-md hover:bg-[#eef3f8]"
                            aria-label={props.focus ? 'Leave full screen' : 'Full screen drawing'}
                            title={props.focus ? 'Leave full screen (Esc)' : 'Full screen (F)'}
                            onClick={props.onToggleFocus}
                        >
                            {props.focus ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
                        </button>
                        <button
                            type="button"
                            className="flex size-8 items-center justify-center rounded-md hover:bg-[#eef3f8]"
                            aria-label="Collapse drawing tools"
                            onClick={() => setPlace((current) => ({ ...current, collapsed: true }))}
                        >
                            <Minimize2Icon className="size-4 rotate-45" />
                        </button>
                    </div>
                    <div
                        className={cn('p-2', props.view === 'inspector' ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-y-auto')}
                        style={props.view === 'inspector' ? undefined : { maxHeight: cardHeight ? Math.max(0, cardHeight - 52) : undefined }}
                    >
                    {props.view === 'inspector' ? (
                        props.inspector
                    ) : (
                        <>
                    {props.canEdit ? (
                        <>
                            <div className="mt-1 grid grid-cols-5 gap-1" role="group" aria-label="Drawing tools">
                                {tools.map((item) => {
                                    const Icon = item.icon;
                                    const active = props.tool === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            title={`${item.label} (${item.key})`}
                                            aria-label={item.label}
                                            aria-pressed={active}
                                            className={cn(
                                                'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-[10px] font-semibold',
                                                active
                                                    ? 'border-[#16324F] bg-[#16324F] text-white'
                                                    : 'border-[#d5deea] bg-white text-[#16324F] hover:bg-[#eef3f8]',
                                            )}
                                            onClick={() => props.onToolChange(item.id)}
                                        >
                                            <Icon className="size-4" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-1" role="group" aria-label="Outline tools">
                                {outlineTools.map((item) => {
                                    const Icon = item.icon;
                                    const active = props.tool === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            title={`${item.label} (${item.key})`}
                                            aria-label={item.label}
                                            aria-pressed={active}
                                            className={cn(
                                                'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold',
                                                active
                                                    ? 'border-[#16324F] bg-[#16324F] text-white'
                                                    : 'border-[#d5deea] bg-white text-[#16324F] hover:bg-[#eef3f8]',
                                            )}
                                            onClick={() => props.onToolChange(item.id)}
                                        >
                                            <Icon className="size-4" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {props.tool === 'box' ? (
                                <div className="mt-2 grid grid-cols-2 gap-1" role="group" aria-label="Box counts as">
                                    {(['door', 'window'] as const).map((kind) => (
                                        <button
                                            key={kind}
                                            type="button"
                                            aria-pressed={props.boxKind === kind}
                                            className={cn(
                                                'h-8 rounded-lg border text-xs font-semibold capitalize',
                                                props.boxKind === kind
                                                    ? 'border-[#16324F] bg-[#16324F] text-white'
                                                    : 'border-[#d5deea] bg-white text-[#16324F] hover:bg-[#eef3f8]',
                                            )}
                                            onClick={() => props.onBoxKind(kind)}
                                        >
                                            {kind}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {props.tool === 'pen' ? (
                                <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Outline color">
                                    {markupInks.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            aria-label={`Outline color ${color}`}
                                            aria-pressed={props.ink.toUpperCase() === color}
                                            className={cn(
                                                'size-6 rounded-full border-2',
                                                props.ink.toUpperCase() === color ? 'border-[#16324F]' : 'border-white shadow',
                                            )}
                                            style={{ backgroundColor: color }}
                                            onClick={() => props.onInk(color)}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </>
                    ) : null}

                    <p className="mt-2 text-xs leading-5 text-[#3d4d5c]">{toolHint}</p>
                    <p className="text-xs font-semibold tabular-nums text-[#16324F]">
                        Doors {props.doorCount} · Windows {props.windowCount}
                        {props.nextMark ? ` · Next ${props.nextMark}` : ''}
                    </p>

                    <div className="mt-2 flex items-center gap-1">
                        <Button type="button" size="sm" variant="outline" className="size-8 px-0" aria-label="Zoom out" onClick={() => props.onZoomBy(1 / 1.15)}>
                            <ZoomOutIcon />
                        </Button>
                        <span className="min-w-0 flex-1 text-center text-xs font-semibold tabular-nums">{Math.round(props.zoom * 100)}%</span>
                        <Button type="button" size="sm" variant="outline" className="size-8 px-0" aria-label="Zoom in" onClick={() => props.onZoomBy(1.15)}>
                            <ZoomInIcon />
                        </Button>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                        <Button type="button" size="sm" variant="outline" className="h-8 px-1 text-xs" onClick={() => props.onFit('page')}>Fit</Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 px-1 text-xs" onClick={() => props.onFit('width')}>Width</Button>
                        <Button type="button" size="sm" variant="outline" className="h-8 px-1 text-xs" onClick={() => props.onFit('actual')}>100%</Button>
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                        <Button type="button" size="sm" variant="outline" className="size-8 px-0" aria-label="Previous page" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>
                            <ChevronLeftIcon />
                        </Button>
                        <label className="flex min-w-0 flex-1 items-center justify-center gap-1 text-xs font-semibold tabular-nums">
                            <span className="sr-only">Page</span>
                            <input
                                aria-label="Page number"
                                inputMode="numeric"
                                value={pageDraft}
                                className="h-8 w-12 rounded-md border border-[#d5deea] text-center"
                                onChange={(event) => setPageDraft(event.target.value)}
                                onBlur={commitPage}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.currentTarget.blur();
                                    }
                                }}
                            />
                            <span>/ {props.pageCount}</span>
                        </label>
                        <Button type="button" size="sm" variant="outline" className="size-8 px-0" aria-label="Next page" disabled={props.page >= props.pageCount} onClick={() => props.onPage(props.page + 1)}>
                            <ChevronRightIcon />
                        </Button>
                        {props.onUndo ? (
                            <Button type="button" size="sm" variant="outline" className="size-8 px-0" aria-label="Undo last count" title="Undo last count" disabled={!props.canUndo} onClick={props.onUndo}>
                                <Undo2Icon />
                            </Button>
                        ) : null}
                    </div>
                    <Button type="button" size="sm" variant="outline" className="mt-2 h-8 w-full text-xs" aria-label="Rotate 90 degrees and save" title="Rotate 90 degrees and save (R)" onClick={props.onRotate}>
                        <RotateCwIcon data-icon="inline-start" />
                        Rotate and save
                    </Button>

                    <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                        Drawing
                        <select
                            aria-label="Drawing"
                            className="mt-1 h-9 w-full rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal text-[#16324F]"
                            value={props.documentId ?? ''}
                            onChange={(event) => props.onDocument(Number(event.target.value))}
                        >
                            {props.documents.length === 0 ? <option value="">No drawings</option> : null}
                            {props.documents.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                        </select>
                    </label>

                    {props.canEdit && (props.onUpload || props.onScan) ? (
                        <div className="mt-2 grid grid-cols-2 gap-1">
                            {props.onUpload ? (
                                <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={props.uploading} onClick={props.onUpload}>
                                    <UploadIcon data-icon="inline-start" />
                                    {props.uploading ? 'Scanning…' : 'Upload'}
                                </Button>
                            ) : null}
                            {props.onScan ? (
                                <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={props.uploading} onClick={props.onScan}>
                                    <ScanSearchIcon data-icon="inline-start" />
                                    Scan
                                </Button>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="mt-2 grid grid-cols-2 gap-1">
                        <Button type="button" size="sm" variant="outline" className={`h-8 px-2 text-xs ${props.minimap ? 'border-[#16324F] bg-[#16324F] text-white hover:bg-[#16324F] hover:text-white' : ''}`} aria-pressed={props.minimap} onClick={props.onToggleMinimap}>
                            Map
                        </Button>
                        <Button type="button" size="sm" variant="outline" className={`h-8 px-2 text-xs ${props.split ? 'border-[#16324F] bg-[#16324F] text-white hover:bg-[#16324F] hover:text-white' : ''}`} aria-pressed={props.split} onClick={props.onToggleSplit}>
                            Two pages
                        </Button>
                    </div>

                    <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]"
                        aria-expanded={sheetOpen}
                        onClick={() => setSheetOpen((open) => !open)}
                    >
                        Sheet appearance
                        <ContrastIcon className="size-3.5" />
                    </button>
                    {sheetOpen ? (
                        <div className="grid gap-2 px-1 pb-1">
                            <Slider icon={RotateCwIcon} label="Straighten" min={-15} max={15} step={0.5} value={props.straighten} onChange={props.onStraighten} />
                            <Slider icon={SunIcon} label="Brightness" min={0.6} max={1.6} step={0.05} value={props.brightness} onChange={props.onBrightness} />
                            <Slider icon={ContrastIcon} label="Contrast" min={0.6} max={1.8} step={0.05} value={props.contrast} onChange={props.onContrast} />
                            <Slider icon={SunIcon} label="Dim" min={0} max={0.55} step={0.05} value={props.dim} onChange={props.onDim} />
                        </div>
                    ) : null}

                    {props.mark && props.canEdit ? (
                        <form
                            className="mt-2 grid gap-2 rounded-xl border border-[#d5deea] bg-[#f7fafc] p-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                props.onMarkSave();
                            }}
                        >
                            <p className="text-xs font-semibold">Selected mark</p>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                                Number
                                <input
                                    aria-label="Mark number"
                                    value={props.mark.number}
                                    maxLength={12}
                                    className="h-8 rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal"
                                    onChange={(event) => props.onMarkChange({ number: event.target.value })}
                                />
                            </label>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                                Type
                                <select
                                    aria-label="Opening type"
                                    value={props.mark.type}
                                    className="h-8 rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal"
                                    onChange={(event) => props.onMarkChange({ type: event.target.value === 'window' ? 'window' : 'door' })}
                                >
                                    <option value="door">Door</option>
                                    <option value="window">Window</option>
                                </select>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                                    Width
                                    <input
                                        aria-label="Width"
                                        value={props.mark.width}
                                        className="h-8 rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal"
                                        onChange={(event) => props.onMarkChange({ width: event.target.value })}
                                    />
                                </label>
                                <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                                    Height
                                    <input
                                        aria-label="Height"
                                        value={props.mark.height}
                                        className="h-8 rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal"
                                        onChange={(event) => props.onMarkChange({ height: event.target.value })}
                                    />
                                </label>
                            </div>
                            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#5c6b7a]">
                                Note
                                <input
                                    aria-label="Note"
                                    value={props.mark.notes}
                                    className="h-8 rounded-md border border-[#d5deea] bg-white px-2 text-sm font-medium normal-case tracking-normal"
                                    onChange={(event) => props.onMarkChange({ notes: event.target.value })}
                                />
                            </label>
                            <Button type="submit" size="sm" className="h-8">Save mark</Button>
                        </form>
                    ) : null}
                        </>
                    )}
                    </div>
                </div>
            )}
        </div>
    );
}

function Slider({
    icon: Icon,
    label,
    min,
    max,
    step,
    value,
    onChange,
}: {
    icon: typeof SunIcon;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-[11px] font-medium text-[#3d4d5c]">
            <span className="inline-flex items-center gap-1">
                <Icon className="size-3.5" />
                {label}
            </span>
            <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </label>
    );
}
