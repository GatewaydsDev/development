import { Button } from '@/Components/ui/button';
import {
    AppWindowIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    DoorOpenIcon,
    MousePointer2Icon,
    RotateCwIcon,
    ScanSearchIcon,
    Trash2Icon,
    UploadIcon,
    ZoomInIcon,
    ZoomOutIcon,
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PageViewport, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { arrangePinLabels, calloutBox, clampCallout, countMark, type PinAnchor } from '../pinLabels';
import type { TakeoffDocument, TakeoffOpening } from '../types';

GlobalWorkerOptions.workerSrc = worker;

type Point = { documentId: number; page: number; x: number; y: number };
type Placement = Point & { labelX: number | null; labelY: number | null };
type PinPosition = { anchorLeft: number; anchorTop: number; left: number; top: number; width: number; height: number };
type CountTool = 'door' | 'window' | 'select' | 'remove';

const drawingToolsKey = 'gateway.takeoff-drawing-tools';

type SavedDrawingTools = {
    zoom: number;
    tool: CountTool;
    byDocument: Record<string, { page: number; rotation: number }>;
};

function readDrawingTools(): SavedDrawingTools {
    const empty: SavedDrawingTools = { zoom: 1, tool: 'door', byDocument: {} };

    try {
        const parsed = JSON.parse(localStorage.getItem(drawingToolsKey) ?? '') as Partial<SavedDrawingTools>;
        const zoom = Number(parsed?.zoom);
        const tool = parsed?.tool;

        return {
            zoom: Number.isFinite(zoom) && zoom >= 0.5 && zoom <= 3 ? zoom : 1,
            tool: tool === 'window' || tool === 'select' || tool === 'remove' || tool === 'door' ? tool : 'door',
            byDocument: parsed?.byDocument && typeof parsed.byDocument === 'object' ? parsed.byDocument : {},
        };
    } catch {
        return empty;
    }
}

function writeDrawingTools(tools: SavedDrawingTools) {
    try {
        localStorage.setItem(drawingToolsKey, JSON.stringify(tools));
    } catch {
        // Private browsing can reject storage. The tools still work for this visit.
    }
}

type Props = {
    documents: TakeoffDocument[];
    openings: TakeoffOpening[];
    selectedDocumentId: number | null;
    selectedOpeningId: number | null;
    selectedMarkerId: number | null;
    canEdit: boolean;
    onSelectDocument: (id: number) => void;
    onSelectOpening: (id: number) => void;
    onCount: (point: Point, tool: 'door' | 'window') => void;
    onPlace: (markerId: number, placement: Placement) => void;
    onRename: (openingId: number, callout: string | null) => void;
    onRemove: (markerId: number) => void;
    onDelete: (openingId: number) => void;
    onUpload?: (file: File) => void;
    onScan?: () => void;
    uploading?: boolean;
    uploadError?: string | null;
};

export default function PdfWorkspace({
    documents,
    openings,
    selectedDocumentId,
    selectedOpeningId,
    selectedMarkerId,
    canEdit,
    onSelectDocument,
    onSelectOpening,
    onCount,
    onPlace,
    onRename,
    onRemove,
    onDelete,
    onUpload,
    onScan,
    uploading = false,
    uploadError = null,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const viewportRef = useRef<PageViewport | null>(null);
    const pageSizeRef = useRef({ width: 1, height: 1 });
    const savedTools = useRef(readDrawingTools());
    const skipToolWrite = useRef(true);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [zoom, setZoom] = useState(savedTools.current.zoom);
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [tool, setTool] = useState<CountTool>(savedTools.current.tool);
    const [positions, setPositions] = useState<Record<number, PinPosition>>({});
    const positionsRef = useRef(positions);
    const draggingRef = useRef(false);
    const skipRename = useRef(false);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const document = documents.find((item) => item.id === selectedDocumentId) ?? documents[0] ?? null;

    useEffect(() => {
        if (!document?.id) {
            return;
        }

        const saved = readDrawingTools().byDocument[String(document.id)];
        const nextPage = saved?.page && saved.page >= 1 ? saved.page : 1;
        const nextRotation = saved && [0, 90, 180, 270].includes(saved.rotation) ? saved.rotation : 0;
        skipToolWrite.current = true;
        setPage(nextPage);
        setRotation(nextRotation);
    }, [document?.id]);

    useEffect(() => {
        if (skipToolWrite.current) {
            skipToolWrite.current = false;

            return;
        }

        const current = readDrawingTools();
        const byDocument = { ...current.byDocument };

        if (document?.id) {
            byDocument[String(document.id)] = { page, rotation };
        }

        writeDrawingTools({ zoom, tool, byDocument });
    }, [document?.id, page, rotation, tool, zoom]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || !document?.download_url) {
            return;
        }

        let cancelled = false;
        let pdf: PDFDocumentProxy | null = null;
        let task: { cancel: () => void; promise: Promise<void> } | null = null;

        (async () => {
            try {
                setError(null);
                const response = await fetch(document.download_url as string, { credentials: 'same-origin' });

                if (!response.ok) {
                    if (!cancelled) {
                        setError('The drawing could not be opened.');
                    }

                    return;
                }

                const data = new Uint8Array(await response.arrayBuffer());
                pdf = await getDocument({ data }).promise;

                if (cancelled) {
                    return;
                }

                setPageCount(pdf.numPages);

                if (page > pdf.numPages) {
                    setPage(pdf.numPages);
                }
                const pdfPage: PDFPageProxy = await pdf.getPage(Math.min(page, pdf.numPages));
                const unrotated = pdfPage.getViewport({ scale: 1, rotation: 0 });
                const viewport = pdfPage.getViewport({ scale: zoom, rotation });
                pageSizeRef.current = { width: unrotated.width, height: unrotated.height };
                viewportRef.current = viewport;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                task = pdfPage.render({ canvas, viewport });
                await task.promise;

                if (cancelled) {
                    return;
                }

                const anchors: PinAnchor[] = [];
                const savedLabels = new Map<number, { left: number; top: number }>();
                const lineByOpening = new Map(openings.map((opening, index) => [opening.id, index + 1]));

                openings.forEach((opening) => {
                    opening.markers.filter((marker) => marker.document_id === document.id && marker.page === page).forEach((marker) => {
                        const [left, top] = viewport.convertToViewportPoint(Number(marker.x) * unrotated.width, (1 - Number(marker.y)) * unrotated.height);
                        const line = lineByOpening.get(opening.id) ?? 1;
                        const box = calloutBox(countMark(opening.callout, line));
                        anchors.push({
                            id: marker.id,
                            left,
                            top,
                            width: box.width,
                            height: box.height,
                        });

                        if (marker.label_x != null && marker.label_x !== '' && marker.label_y != null && marker.label_y !== '') {
                            const [labelLeft, labelTop] = viewport.convertToViewportPoint(Number(marker.label_x) * unrotated.width, (1 - Number(marker.label_y)) * unrotated.height);
                            savedLabels.set(marker.id, { left: labelLeft, top: labelTop });
                        }
                    });
                });

                const pageBounds = { width: viewport.width, height: viewport.height };
                const occupied = anchors.flatMap((anchor) => {
                    const saved = savedLabels.get(anchor.id);

                    return saved ? [{ ...anchor, ...clampCallout({ ...anchor, left: saved.left, top: saved.top }, pageBounds) }] : [];
                });
                const labels = new Map(arrangePinLabels(anchors.filter((anchor) => !savedLabels.has(anchor.id)), occupied, pageBounds).map((pin) => [pin.id, pin]));
                const next: Record<number, PinPosition> = {};

                anchors.forEach((anchor) => {
                    const saved = savedLabels.get(anchor.id);
                    const raw = saved ?? labels.get(anchor.id) ?? anchor;
                    const label = clampCallout({ ...anchor, left: raw.left, top: raw.top }, pageBounds);
                    next[anchor.id] = {
                        anchorLeft: anchor.left,
                        anchorTop: anchor.top,
                        left: label.left,
                        top: label.top,
                        width: anchor.width,
                        height: anchor.height,
                    };
                });

                if (!draggingRef.current) {
                    positionsRef.current = next;
                    setPositions(next);
                }
            } catch (caught) {
                if (!cancelled) {
                    setError(caught instanceof Error ? caught.message : 'The drawing could not be opened.');
                }
            }
        })();

        return () => {
            cancelled = true;
            task?.cancel();
            void pdf?.destroy();
        };
    }, [document?.id, document?.download_url, page, zoom, rotation, openings]);

    const pointFromEvent = (event: { clientX: number; clientY: number }): Point | null => {
        const canvas = canvasRef.current;
        const viewport = viewportRef.current;

        if (!canvas || !viewport || !document) {
            return null;
        }

        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
        const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
        const normalizedX = Math.min(1, Math.max(0, pdfX / pageSizeRef.current.width));
        const normalizedY = Math.min(1, Math.max(0, 1 - pdfY / pageSizeRef.current.height));

        return { documentId: document.id, page, x: normalizedX, y: normalizedY };
    };

    const normalizedFromViewport = (left: number, top: number): { x: number; y: number } | null => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return null;
        }

        const [pdfX, pdfY] = viewport.convertToPdfPoint(left, top);

        return {
            x: Math.min(1, Math.max(0, pdfX / pageSizeRef.current.width)),
            y: Math.min(1, Math.max(0, 1 - pdfY / pageSizeRef.current.height)),
        };
    };

    const beginDrag = (event: ReactPointerEvent<HTMLElement>, markerId: number, part: 'label' | 'point') => {
        if (!canEdit || tool === 'remove' || !document) {
            return;
        }

        event.stopPropagation();
        const target = event.currentTarget;
        delete target.dataset.moved;
        target.setPointerCapture(event.pointerId);
        draggingRef.current = true;

        const move = (moveEvent: PointerEvent) => {
            const canvas = canvasRef.current;

            if (!canvas || !positionsRef.current[markerId]) {
                return;
            }

            target.dataset.moved = '1';
            const rect = canvas.getBoundingClientRect();
            const left = ((moveEvent.clientX - rect.left) / rect.width) * canvas.width;
            const top = ((moveEvent.clientY - rect.top) / rect.height) * canvas.height;
            const current = positionsRef.current[markerId];
            positionsRef.current = {
                ...positionsRef.current,
                [markerId]: part === 'label'
                    ? { ...current, left, top }
                    : { ...current, anchorLeft: left, anchorTop: top },
            };
            setPositions(positionsRef.current);
        };
        const up = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            draggingRef.current = false;
            const current = positionsRef.current[markerId];

            if (target.dataset.moved !== '1' || !current || !document) {
                return;
            }

            const tip = normalizedFromViewport(current.anchorLeft, current.anchorTop);
            const label = normalizedFromViewport(current.left, current.top);

            if (!tip || !label) {
                return;
            }

            onPlace(markerId, {
                documentId: document.id,
                page,
                x: tip.x,
                y: tip.y,
                labelX: label.x,
                labelY: label.y,
            });
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
    };

    const commitRename = (openingId: number, line: number) => {
        const next = renameDraft.trim();
        const stored = next === '' || next === String(line) ? null : next;
        const current = openings.find((opening) => opening.id === openingId)?.callout?.trim() || null;
        setRenamingId(null);

        if (stored !== current) {
            onRename(openingId, stored);
        }
    };

    const lineByOpening = new Map(openings.map((opening, index) => [opening.id, index + 1]));
    const markers = openings.flatMap((opening) => opening.markers
        .filter((marker) => document && marker.document_id === document.id && marker.page === page)
        .map((marker) => ({ marker, opening })));

    const choosePdf = () => fileRef.current?.click();

    const controlClass = 'h-10 min-w-0 shrink gap-1.5 whitespace-normal px-2 text-center sm:h-7';
    const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-[#0a2540]';
    const toolTone = (active: boolean, solid: string, soft: string) => (active ? `${solid} text-white hover:text-white` : soft);

    return (
        <div className="flex h-full min-h-[28rem] min-w-0 flex-col gap-3">
            <div className="z-20 flex min-w-0 flex-col gap-3 rounded-xl border border-[#c5d0dc] bg-[#eef3f8] p-2 text-[#111827] shadow-sm sm:p-3 md:sticky md:top-[4.75rem] lg:top-[14.75rem]">
                <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-end">
                    {canEdit && onUpload ? (
                        <div className="grid min-w-0 grid-cols-2 gap-2 xl:flex xl:shrink-0">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';

                                    if (file) {
                                        onUpload(file);
                                    }
                                }}
                            />
                            <Button type="button" size="sm" className={`${controlClass} w-full border-sky-800 bg-sky-700 text-white hover:bg-sky-800 hover:text-white xl:w-auto ${onScan && document ? '' : 'col-span-2'}`} disabled={uploading} onClick={choosePdf}>
                                <UploadIcon data-icon="inline-start" />
                                {uploading ? 'Scanning…' : 'Upload PDF'}
                            </Button>
                            {onScan && document ? (
                                <Button type="button" size="sm" variant="outline" className={`${controlClass} w-full border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white xl:w-auto`} disabled={uploading} onClick={onScan}>
                                    <ScanSearchIcon data-icon="inline-start" />
                                    Scan drawing
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className={labelClass}>Drawing</span>
                        <select
                            aria-label="Drawing"
                            className="h-12 w-full min-w-0 rounded-md border border-[#c5ced8] bg-white px-2 py-2 text-sm leading-6 text-[#111827] shadow-sm"
                            style={{ color: '#111827', WebkitTextFillColor: '#111827', backgroundColor: '#ffffff' }}
                            value={document?.id ?? ''}
                            onChange={(event) => onSelectDocument(Number(event.target.value))}
                        >
                            {documents.length === 0 ? <option value="">No drawings</option> : null}
                            {documents.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.sheet_number ? `${item.sheet_number} — ` : ''}{item.original_filename}{item.revision_label ? ` (${item.revision_label})` : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className={labelClass}>Page</span>
                        <div className="flex min-w-0 items-center gap-1">
                            <Button type="button" variant="outline" size="sm" className={`${controlClass} flex-1 border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white`} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                                <ChevronLeftIcon data-icon="inline-start" />
                                Previous
                            </Button>
                            <span className="shrink-0 px-1 text-center text-sm font-medium tabular-nums text-[#111827]">Page {page} / {pageCount}</span>
                            <Button type="button" variant="outline" size="sm" className={`${controlClass} flex-1 border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white`} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>
                                Next
                                <ChevronRightIcon data-icon="inline-end" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className={labelClass}>View</span>
                        <div className="flex min-w-0 items-center gap-1">
                            <Button type="button" variant="outline" size="sm" className={`${controlClass} w-10 shrink-0 border-teal-700 bg-teal-600 px-0 text-white hover:bg-teal-700 hover:text-white sm:w-8`} aria-label="Zoom out" onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))}>
                                <ZoomOutIcon />
                            </Button>
                            <span className="min-w-0 flex-1 text-center text-sm font-medium tabular-nums text-[#111827]">{Math.round(zoom * 100)}%</span>
                            <Button type="button" variant="outline" size="sm" className={`${controlClass} w-10 shrink-0 border-teal-700 bg-teal-600 px-0 text-white hover:bg-teal-700 hover:text-white sm:w-8`} aria-label="Zoom in" onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}>
                                <ZoomInIcon />
                            </Button>
                            <Button type="button" variant="outline" size="sm" className={`${controlClass} min-w-0 flex-1 border-violet-700 bg-violet-600 text-white hover:bg-violet-700 hover:text-white`} onClick={() => setRotation((current) => (current + 90) % 360)}>
                                <RotateCwIcon data-icon="inline-start" />
                                Rotate
                            </Button>
                        </div>
                    </div>
                </div>
                {canEdit ? (
                    <div className="flex min-w-0 flex-col gap-1">
                        <span className={labelClass}>Tool</span>
                        <div role="group" aria-label="Drawing tools" className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                            <Button type="button" size="sm" className={`${controlClass} w-full ${toolTone(tool === 'door', 'border-emerald-700 bg-emerald-600 hover:bg-emerald-700', 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950')}`} variant="outline" aria-pressed={tool === 'door'} onClick={() => setTool('door')}>
                                <DoorOpenIcon data-icon="inline-start" />
                                Count door
                            </Button>
                            <Button type="button" size="sm" className={`${controlClass} w-full ${toolTone(tool === 'window', 'border-sky-700 bg-sky-600 hover:bg-sky-700', 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 hover:text-sky-950')}`} variant="outline" aria-pressed={tool === 'window'} onClick={() => setTool('window')}>
                                <AppWindowIcon data-icon="inline-start" />
                                Count window
                            </Button>
                            <Button type="button" size="sm" className={`${controlClass} w-full ${toolTone(tool === 'select', 'border-amber-700 bg-amber-600 hover:bg-amber-700', 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:text-amber-950')}`} variant="outline" aria-pressed={tool === 'select'} onClick={() => setTool('select')}>
                                <MousePointer2Icon data-icon="inline-start" />
                                Select
                            </Button>
                            <Button type="button" size="sm" className={`${controlClass} w-full ${toolTone(tool === 'remove', 'border-rose-700 bg-rose-600 hover:bg-rose-700', 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 hover:text-rose-950')}`} variant="outline" aria-pressed={tool === 'remove'} onClick={() => setTool('remove')}>
                                <Trash2Icon data-icon="inline-start" />
                                Remove
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
                Count door or Count window, then click the opening. The first number is 1, and removing a count closes the gap. Double-click a number to type a different one. Drag the number to stretch the arrow, or drag the point to move where it lands.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
            {!document ? (
                <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
                    <p className="text-sm text-muted-foreground">Upload the drawing, then click each door or window on the sheet to build the scope.</p>
                    {canEdit && onUpload ? (
                        <Button type="button" disabled={uploading} onClick={choosePdf}>
                            {uploading ? 'Uploading…' : 'Upload PDF'}
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <div className="relative overflow-auto rounded-md border bg-[#F3F4F6]">
                <div className="relative inline-block">
                    <canvas
                        ref={canvasRef}
                        className={`max-w-none ${canEdit && (tool === 'door' || tool === 'window') ? 'cursor-crosshair' : ''}`}
                        onClick={(event) => {
                            if (!canEdit || tool === 'select' || tool === 'remove') {
                                return;
                            }

                            const point = pointFromEvent(event);

                            if (point) {
                                onCount(point, tool);
                            }
                        }}
                    />
                    <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible">
                        <defs>
                            <marker id="takeoff-count-arrow" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                                <path d="M0 0 L10 5 L0 10 Z" fill="#111827" />
                            </marker>
                        </defs>
                        {markers.map(({ marker }) => {
                            const position = positions[marker.id];

                            if (!position) {
                                return null;
                            }

                            const shiftX = position.anchorLeft - position.left;
                            const shiftY = position.anchorTop - position.top;
                            const length = Math.hypot(shiftX, shiftY);

                            if (length < 1) {
                                return null;
                            }

                            const ux = shiftX / length;
                            const uy = shiftY / length;
                            const radius = 1 / Math.sqrt((ux * ux) / ((position.width / 2) ** 2) + (uy * uy) / ((position.height / 2) ** 2));
                            const startX = position.left + (shiftX / length) * radius;
                            const startY = position.top + (shiftY / length) * radius;
                            const head = 8;
                            const baseX = position.anchorLeft - (shiftX / length) * head;
                            const baseY = position.anchorTop - (shiftY / length) * head;

                            return (
                                <g key={`leader-${marker.id}`} data-leader={marker.id}>
                                    <line x1={startX} y1={startY} x2={baseX} y2={baseY} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
                                    <line x1={startX} y1={startY} x2={position.anchorLeft} y2={position.anchorTop} stroke="#111827" strokeWidth="1.5" markerEnd="url(#takeoff-count-arrow)" />
                                </g>
                            );
                        })}
                    </svg>
                    {markers.map(({ marker, opening }) => {
                        const position = positions[marker.id];

                        if (!position) {
                            return null;
                        }

                        const selected = marker.id === selectedMarkerId || opening.id === selectedOpeningId;
                        const line = lineByOpening.get(opening.id) ?? 1;
                        const mark = countMark(opening.callout, line);
                        const door = opening.opening_type !== 'window';
                        const renaming = renamingId === opening.id;
                        const forget = () => {
                            if (opening.markers.length === 1) {
                                onDelete(opening.id);

                                return;
                            }

                            onRemove(marker.id);
                        };

                        return (
                            <div
                                key={marker.id}
                                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${canEdit && tool !== 'remove' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                style={{ left: position.left, top: position.top }}
                                onPointerDown={(event) => {
                                    if (renaming || (event.target as HTMLElement).closest('[data-remove-mark], [data-callout-input]')) {
                                        return;
                                    }

                                    beginDrag(event, marker.id, 'label');
                                }}
                                onClick={(event) => {
                                    event.stopPropagation();

                                    if (tool === 'remove' || event.currentTarget.dataset.moved === '1') {
                                        return;
                                    }

                                    onSelectOpening(opening.id);
                                }}
                            >
                            {renaming ? (
                                <input
                                    data-callout-input
                                    autoFocus
                                    aria-label={`Number for ${opening.tag || opening.label}`}
                                    value={renameDraft}
                                    maxLength={12}
                                    style={{ width: Math.max(position.width, 44), height: position.height }}
                                    className="rounded-full border border-[#111827] bg-white px-1 text-center text-xs font-semibold text-[#111827] outline-none"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => setRenameDraft(event.target.value)}
                                    onBlur={() => {
                                        if (skipRename.current) {
                                            skipRename.current = false;

                                            return;
                                        }

                                        commitRename(opening.id, line);
                                    }}
                                    onKeyDown={(event) => {
                                        event.stopPropagation();

                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            event.currentTarget.blur();
                                        }

                                        if (event.key === 'Escape') {
                                            skipRename.current = true;
                                            setRenamingId(null);
                                        }
                                    }}
                                />
                            ) : (
                            <button
                                type="button"
                                title={`${mark}. ${opening.tag || opening.label}. Double-click to change this number.`}
                                style={{ width: position.width, height: position.height }}
                                className={`flex items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${tool === 'remove' ? 'cursor-pointer' : ''} ${selected ? 'bg-[#3FCF8E] text-[#111827] ring-2 ring-[#111827]' : door ? 'bg-emerald-700 text-white' : 'bg-sky-700 text-white'}`}
                                onClick={(event) => {
                                    event.stopPropagation();

                                    if (tool === 'remove') {
                                        forget();

                                        return;
                                    }

                                    onSelectOpening(opening.id);
                                }}
                                onDoubleClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (!canEdit || tool === 'remove') {
                                        return;
                                    }

                                    setRenameDraft(mark);
                                    setRenamingId(opening.id);
                                }}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (canEdit) {
                                        forget();
                                    }
                                }}
                            >
                                {mark}
                            </button>
                            )}
                            {canEdit ? (
                                <button
                                    type="button"
                                    data-remove-mark
                                    aria-label={`Remove ${opening.tag || opening.label}`}
                                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] leading-none text-white"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        forget();
                                    }}
                                >
                                    ×
                                </button>
                            ) : null}
                            </div>
                        );
                    })}
                    {markers.map(({ marker }) => {
                        const position = positions[marker.id];

                        if (!position) {
                            return null;
                        }

                        return (
                            <div
                                key={`point-${marker.id}`}
                                title="Arrow point. Drag to set where this count lands."
                                className={`absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#111827] shadow ${canEdit && tool !== 'remove' ? 'cursor-move' : 'pointer-events-none'}`}
                                style={{ left: position.anchorLeft, top: position.anchorTop }}
                                onPointerDown={(event) => beginDrag(event, marker.id, 'point')}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export type { Point as PdfPoint };
