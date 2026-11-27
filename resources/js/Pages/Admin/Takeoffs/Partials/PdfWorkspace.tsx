import { Button } from '@/Components/ui/button';
import { getDocument, GlobalWorkerOptions, type PageViewport, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { arrangePinLabels, calloutBox, clampCallout, countMark, type PinAnchor } from '../pinLabels';
import type { SheetMarkup, TakeoffDocument, TakeoffOpening, TakeoffSheetSection } from '../types';
import DrawingPalette, { type MarkDraft } from './DrawingPalette';

GlobalWorkerOptions.workerSrc = worker;

type Point = { documentId: number; page: number; x: number; y: number };
type Placement = Point & { labelX: number | null; labelY: number | null; x2?: number | null; y2?: number | null };
type CountBox = { x: number; y: number; x2: number; y2: number };
type PendingBox = CountBox & { id: number; documentId: number; page: number; kind: 'door' | 'window'; number: string };

function isCountBox(marker: { x2?: string | null; y2?: string | null }): marker is { x2: string; y2: string } {
    return marker.x2 != null && marker.x2 !== '' && marker.y2 != null && marker.y2 !== '';
}
type PinPosition = { anchorLeft: number; anchorTop: number; left: number; top: number; width: number; height: number };
type CountTool = 'door' | 'window' | 'select' | 'hand' | 'remove' | 'pen' | 'box' | 'copy' | 'openings';
type TraceKind = 'pen' | 'box' | 'copy' | 'openings';

function isAreaTrace(kind: string): kind is 'box' | 'copy' | 'openings' {
    return kind === 'box' || kind === 'copy' || kind === 'openings';
}

function openingTypeLabel(type: string): string {
    if (type === 'window') {
        return 'Window';
    }

    if (type === 'door') {
        return 'Door';
    }

    return type || 'Selection';
}

export type { CountTool };

export const markupInks = ['#F97316', '#E11D48', '#7C3AED', '#059669', '#0284C7'] as const;

function markupKey(markup: Pick<SheetMarkup, 'kind' | 'color' | 'document_id' | 'page' | 'points'>): string {
    const first = markup.points[0];
    const last = markup.points[markup.points.length - 1];

    return [
        markup.kind,
        markup.color.toUpperCase(),
        markup.document_id,
        markup.page,
        first ? first.x.toFixed(2) : '',
        first ? first.y.toFixed(2) : '',
        last ? last.x.toFixed(2) : '',
        last ? last.y.toFixed(2) : '',
        markup.points.length,
    ].join('|');
}

function tracePath(points: { x: number; y: number }[], kind: TraceKind): string {
    if (points.length === 0) {
        return '';
    }

    if (isAreaTrace(kind)) {
        const start = points[0];
        const end = points[points.length - 1];
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
    }

    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function nearestMarkup(pixel: { x: number; y: number }, paths: { id: number; kind: 'pen' | 'box'; points: { x: number; y: number }[] }[]): number | null {
    let best: { id: number; distance: number } | null = null;

    paths.forEach((path) => {
        const corners = path.kind === 'box' && path.points.length >= 2
            ? boxCorners(path.points[0], path.points[path.points.length - 1])
            : path.points;

        for (let index = 0; index < corners.length - (path.kind === 'box' ? 0 : 1); index += 1) {
            const start = corners[index];
            const end = corners[(index + 1) % corners.length];

            if (!end || (path.kind !== 'box' && index === corners.length - 1)) {
                continue;
            }

            const distance = distanceToSegment(pixel, start, end);

            if (distance <= 14 && (!best || distance < best.distance)) {
                best = { id: path.id, distance };
            }
        }
    });

    return best?.id ?? null;
}

function boxCorners(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] {
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);

    return [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    ];
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));

    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function savedCountTool(): CountTool {
    return readDrawingTools().tool;
}

const drawingToolsKey = 'gateway.takeoff-drawing-tools';

type SavedSheetScroll = {
    x: number;
    y: number;
};

type SavedDocumentView = {
    page: number;
    rotation: number;
    zoom?: number;
    scroll?: Record<string, SavedSheetScroll>;
};

type SavedDrawingTools = {
    zoom: number;
    tool: CountTool;
    byDocument: Record<string, SavedDocumentView>;
};

function readDrawingTools(): SavedDrawingTools {
    const empty: SavedDrawingTools = { zoom: 1, tool: 'door', byDocument: {} };

    try {
        const parsed = JSON.parse(localStorage.getItem(drawingToolsKey) ?? '') as Partial<SavedDrawingTools>;
        const zoom = Number(parsed?.zoom);
        const tool = parsed?.tool;

        const byDocument: Record<string, SavedDocumentView> = {};

        if (parsed?.byDocument && typeof parsed.byDocument === 'object') {
            Object.entries(parsed.byDocument).forEach(([id, view]) => {
                if (!view || typeof view !== 'object') {
                    return;
                }

                const savedZoom = Number(view.zoom);
                const scroll: Record<string, SavedSheetScroll> = {};

                if (view.scroll && typeof view.scroll === 'object') {
                    Object.entries(view.scroll).forEach(([sheet, point]) => {
                        const x = Number(point?.x);
                        const y = Number(point?.y);

                        if (Number.isFinite(x) && Number.isFinite(y)) {
                            scroll[sheet] = {
                                x: Math.min(1, Math.max(0, x)),
                                y: Math.min(1, Math.max(0, y)),
                            };
                        }
                    });
                }

                byDocument[id] = {
                    page: Number(view.page) >= 1 ? Number(view.page) : 1,
                    rotation: [0, 90, 180, 270].includes(Number(view.rotation)) ? Number(view.rotation) : 0,
                    zoom: Number.isFinite(savedZoom) && savedZoom >= 0.05 && savedZoom <= 8 ? savedZoom : undefined,
                    scroll,
                };
            });
        }

        return {
            zoom: Number.isFinite(zoom) && zoom >= 0.05 && zoom <= 8 ? zoom : 1,
            tool: tool === 'window' || tool === 'select' || tool === 'hand' || tool === 'remove' || tool === 'pen' || tool === 'box' || tool === 'copy' || tool === 'openings' || tool === 'door' ? tool : 'door',
            byDocument,
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

function sheetScrollRatio(scroller: HTMLElement): SavedSheetScroll {
    const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

    return {
        x: maxX > 0 ? Math.min(1, Math.max(0, scroller.scrollLeft / maxX)) : 0,
        y: maxY > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / maxY)) : 0,
    };
}

function applySheetScroll(scroller: HTMLElement, scroll: SavedSheetScroll | undefined) {
    if (!scroll) {
        return;
    }

    const maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const maxY = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollLeft = scroll.x * maxX;
    scroller.scrollTop = scroll.y * maxY;
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
    onCount: (point: Point, tool: 'door' | 'window', box?: CountBox) => void;
    onPlace: (markerId: number, placement: Placement) => void;
    onRename: (openingId: number, callout: string | null) => void;
    onRemove: (markerId: number) => void;
    onDelete: (openingId: number) => void;
    onUpload?: (file: File) => void;
    onScan?: () => void;
    uploading?: boolean;
    uploadError?: string | null;
    tool: CountTool;
    onToolChange: (tool: CountTool) => void;
    onSaveDetails?: (openingId: number, details: { opening_type: string; width: string; height: string; notes: string; callout: string | null }) => void;
    onUndo?: () => void;
    canUndo?: boolean;
    onSaveRotation?: (documentId: number, rotation: number) => void;
    markups?: SheetMarkup[];
    review?: { tag: string; page: number; x: number; y: number } | null;
    onMarkup?: (markup: { documentId: number; page: number; kind: 'pen' | 'box'; color: string; points: { x: number; y: number }[] }) => void;
    onDeleteMarkup?: (markupId: number) => void;
    onRemoveOpeningMark?: (markupId: number) => void;
    sections?: TakeoffSheetSection[];
    focusedSection?: { id: number; page: number; documentId: number } | null;
    onCopyRegion?: (region: { documentId: number; page: number; x: number; y: number; x2: number; y2: number }) => void;
    onOpeningsRegion?: (region: { documentId: number; page: number; x: number; y: number; x2: number; y2: number }) => void;
    openingsBox?: { documentId: number; page: number; x: number; y: number; x2: number; y2: number; openingType: string } | null;
    onDeleteSection?: (sectionId: number) => void;
    inspector?: ReactNode;
    paletteView?: 'drawing' | 'inspector';
    onPaletteView?: (view: 'drawing' | 'inspector') => void;
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
    tool,
    onToolChange,
    onSaveDetails,
    onUndo,
    canUndo = false,
    onSaveRotation,
    markups = [],
    review = null,
    onMarkup,
    onDeleteMarkup,
    onRemoveOpeningMark,
    sections = [],
    focusedSection = null,
    onCopyRegion,
    onOpeningsRegion,
    openingsBox = null,
    onDeleteSection,
    inspector = null,
    paletteView = 'drawing',
    onPaletteView,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peekRef = useRef<HTMLCanvasElement>(null);
    const mapRef = useRef<HTMLCanvasElement>(null);
    const loupeRef = useRef<HTMLCanvasElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const zoomRef = useRef(1);
    const fitSheetRef = useRef<(mode: 'page' | 'width' | 'actual', lock?: boolean) => boolean>(() => false);
    const zoomLocked = useRef(false);
    const fittedFullscreenKey = useRef('');
    const fittedStageKey = useRef('');
    const straightenRef = useRef(0);
    const zoomAnchor = useRef<{ contentX: number; contentY: number; viewX: number; viewY: number; scale: number } | null>(null);
    const rotateRef = useRef<() => void>(() => {});
    const viewportRef = useRef<PageViewport | null>(null);
    const pageSizeRef = useRef({ width: 1, height: 1 });
    const savedTools = useRef(readDrawingTools());
    const skipToolWrite = useRef(true);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [zoom, setZoom] = useState(() => {
        const id = selectedDocumentId ?? documents[0]?.id;
        const view = id != null ? savedTools.current.byDocument[String(id)] : undefined;

        if (view?.zoom !== undefined) {
            zoomLocked.current = true;
            zoomRef.current = view.zoom;

            return view.zoom;
        }

        zoomRef.current = savedTools.current.zoom;

        return savedTools.current.zoom;
    });
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [positions, setPositions] = useState<Record<number, PinPosition>>({});
    const positionsRef = useRef(positions);
    const draggingRef = useRef(false);
    const rememberScrollRef = useRef<() => void>(() => {});
    const scrollSaveTimer = useRef<number | null>(null);
    const skipRename = useRef(false);
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [focus, setFocus] = useState(false);
    const [chrome, setChrome] = useState({ top: 72, left: 0 });
    const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
    const [sheetPixels, setSheetPixels] = useState({ width: 0, height: 0 });
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [straighten, setStraighten] = useState(0);
    const [brightness, setBrightness] = useState(1);
    const [contrast, setContrast] = useState(1);
    const [dim, setDim] = useState(0);
    const [split, setSplit] = useState(false);
    const [minimap, setMinimap] = useState(true);
    const [pointer, setPointer] = useState<{ x: number; y: number; localX: number; localY: number } | null>(null);
    const [markDraft, setMarkDraft] = useState<MarkDraft | null>(null);
    const [ink, setInk] = useState('#F97316');
    const [boxKind, setBoxKind] = useState<'door' | 'window'>('door');
    const [pendingBoxes, setPendingBoxes] = useState<PendingBox[]>([]);
    const [boxNudge, setBoxNudge] = useState<{ id: number; dx: number; dy: number } | null>(null);
    const [localMarkups, setLocalMarkups] = useState<SheetMarkup[]>([]);
    const [markupPaths, setMarkupPaths] = useState<{ id: number; kind: 'pen' | 'box'; color: string; points: { x: number; y: number }[] }[]>([]);
    const [trace, setTrace] = useState<{ kind: TraceKind; color: string; points: { x: number; y: number }[]; pixels: { x: number; y: number }[] } | null>(null);
    const traceRef = useRef(trace);
    const [sheetVersion, setSheetVersion] = useState(0);
    const document = documents.find((item) => item.id === selectedDocumentId) ?? documents[0] ?? null;
    const panning = tool === 'hand' || spaceHeld;

    useEffect(() => {
        traceRef.current = trace;
    }, [trace]);

    useEffect(() => {
        if (tool === 'door' || tool === 'window') {
            setBoxKind(tool);
        }
    }, [tool]);

    useEffect(() => {
        if (!review || review.page < 1) {
            return;
        }

        setPage(review.page);
    }, [review?.tag, review?.page, document?.id]);

    useEffect(() => {
        setPendingBoxes((current) => current.filter((box) => !openings.some((opening) => opening.markers.some((marker) => (
            marker.document_id === box.documentId
            && marker.page === box.page
            && isCountBox(marker)
            && Math.abs(Number(marker.x) - box.x) < 0.01
            && Math.abs(Number(marker.y) - box.y) < 0.01
        )))));
    }, [openings]);

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => () => {
        if (scrollSaveTimer.current !== null) {
            window.clearTimeout(scrollSaveTimer.current);
        }
    }, []);

    useEffect(() => {
        const keys = new Set(markups.map(markupKey));
        setLocalMarkups((current) => current.filter((markup) => !keys.has(markupKey(markup))));
    }, [markups]);

    useEffect(() => {
        const viewport = viewportRef.current;
        const size = pageSizeRef.current;

        if (!viewport || !document) {
            setMarkupPaths([]);

            return;
        }

        const visible = [...markups, ...localMarkups].filter((markup) => markup.kind !== 'openings' && markup.document_id === document.id && markup.page === page);
        setMarkupPaths(visible.map((markup) => ({
            id: markup.id,
            kind: markup.kind,
            color: markup.color,
            points: markup.points.map((point) => {
                const [x, y] = viewport.convertToViewportPoint(point.x * size.width, (1 - point.y) * size.height);

                return { x, y };
            }),
        })));
    }, [markups, localMarkups, document?.id, page, sheetVersion]);

    useEffect(() => {
        straightenRef.current = straighten;
    }, [straighten]);

    useEffect(() => {
        if (!document?.id) {
            return;
        }

        const saved = readDrawingTools().byDocument[String(document.id)];
        const nextPage = saved?.page && saved.page >= 1 ? saved.page : 1;
        const storedRotation = Number(document.rotation);
        const nextRotation = [0, 90, 180, 270].includes(storedRotation) ? storedRotation : 0;
        const nextZoom = saved?.zoom;
        skipToolWrite.current = true;
        zoomLocked.current = nextZoom !== undefined;
        setPage(nextPage);
        setRotation(nextRotation);

        if (nextZoom !== undefined) {
            zoomRef.current = nextZoom;
            setZoom(nextZoom);
        }
    }, [document?.id]);

    useEffect(() => {
        if (!focusedSection || focusedSection.documentId !== document?.id || focusedSection.page < 1) {
            return;
        }

        setPage(focusedSection.page);
    }, [focusedSection?.id, focusedSection?.page, focusedSection?.documentId, document?.id]);

    useEffect(() => {
        if (skipToolWrite.current) {
            skipToolWrite.current = false;

            return;
        }

        const current = readDrawingTools();
        const byDocument = { ...current.byDocument };

        if (document?.id) {
            const savedView = byDocument[String(document.id)];
            byDocument[String(document.id)] = {
                page,
                rotation,
                zoom: zoomLocked.current ? zoom : savedView?.zoom,
                scroll: savedView?.scroll,
            };
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
                const pixels = { width: Math.round(viewport.width), height: Math.round(viewport.height) };
                setSheetPixels((current) => (current.width === pixels.width && current.height === pixels.height ? current : pixels));
                task = pdfPage.render({ canvas, viewport });
                await task.promise;

                if (cancelled) {
                    return;
                }

                const anchor = zoomAnchor.current;
                const scroller = scrollerRef.current;

                if (anchor && scroller) {
                    zoomAnchor.current = null;
                    scroller.scrollLeft = anchor.contentX * anchor.scale - anchor.viewX;
                    scroller.scrollTop = anchor.contentY * anchor.scale - anchor.viewY;
                } else if (scroller) {
                    const savedScroll = readDrawingTools().byDocument[String(document.id)]?.scroll?.[String(page)];

                    if (savedScroll) {
                        window.requestAnimationFrame(() => {
                            applySheetScroll(scroller, savedScroll);
                            rememberScrollRef.current();
                        });
                    }
                }

                const anchors: PinAnchor[] = [];
                const savedLabels = new Map<number, { left: number; top: number }>();
                const lineByOpening = new Map(openings.map((opening, index) => [opening.id, index + 1]));

                openings.forEach((opening) => {
                    opening.markers.filter((marker) => marker.document_id === document.id && marker.page === page).forEach((marker) => {
                        const boxed = isCountBox(marker);
                        const markX = boxed ? (Number(marker.x) + Number(marker.x2)) / 2 : Number(marker.x);
                        const markY = boxed ? (Number(marker.y) + Number(marker.y2)) / 2 : Number(marker.y);
                        const [left, top] = viewport.convertToViewportPoint(markX * unrotated.width, (1 - markY) * unrotated.height);
                        const line = lineByOpening.get(opening.id) ?? 1;
                        const box = calloutBox(countMark(opening.callout, line));
                        anchors.push({
                            id: marker.id,
                            left,
                            top,
                            width: box.width,
                            height: box.height,
                        });

                        if (boxed) {
                            savedLabels.set(marker.id, { left, top });
                        } else if (marker.label_x != null && marker.label_x !== '' && marker.label_y != null && marker.label_y !== '') {
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

                setSheetVersion((value) => value + 1);
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
    }, [document?.id, document?.download_url, page, zoom, rotation, openings, focus]);

    const canvasPoint = (event: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return null;
        }

        const rect = canvas.getBoundingClientRect();
        const angle = straightenRef.current;

        if (angle === 0) {
            return {
                x: ((event.clientX - rect.left) / rect.width) * canvas.width,
                y: ((event.clientY - rect.top) / rect.height) * canvas.height,
            };
        }

        const theta = (angle * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const sx = event.clientX - (rect.left + rect.width / 2);
        const sy = event.clientY - (rect.top + rect.height / 2);
        const localX = sx * cos + sy * sin;
        const localY = -sx * sin + sy * cos;
        const layoutWidth = canvas.offsetWidth || rect.width;
        const layoutHeight = canvas.offsetHeight || rect.height;

        return {
            x: ((localX + layoutWidth / 2) / layoutWidth) * canvas.width,
            y: ((localY + layoutHeight / 2) / layoutHeight) * canvas.height,
        };
    };

    const pointFromEvent = (event: { clientX: number; clientY: number }): Point | null => {
        const canvas = canvasRef.current;
        const viewport = viewportRef.current;
        const point = canvasPoint(event);

        if (!canvas || !viewport || !document || !point) {
            return null;
        }

        const { x, y } = point;
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
        if (!canEdit || tool === 'remove' || tool === 'hand' || spaceHeld || !document) {
            return;
        }

        event.stopPropagation();
        const target = event.currentTarget;
        delete target.dataset.moved;
        draggingRef.current = true;
        const marker = openings.flatMap((opening) => opening.markers).find((item) => item.id === markerId);
        const boxed = marker ? isCountBox(marker) : false;
        const start = positionsRef.current[markerId];
        const originX = event.clientX;
        const originY = event.clientY;

        const move = (moveEvent: PointerEvent) => {
            const canvas = canvasRef.current;

            if (!canvas || !positionsRef.current[markerId] || Math.hypot(moveEvent.clientX - originX, moveEvent.clientY - originY) < 4) {
                return;
            }

            if (!target.hasPointerCapture(moveEvent.pointerId)) {
                target.setPointerCapture(moveEvent.pointerId);
            }

            target.dataset.moved = '1';
            const point = canvasPoint(moveEvent);

            if (!point) {
                return;
            }

            const { x: left, y: top } = point;
            const current = positionsRef.current[markerId];
            positionsRef.current = {
                ...positionsRef.current,
                [markerId]: boxed
                    ? { ...current, left, top, anchorLeft: left, anchorTop: top }
                    : part === 'label'
                        ? { ...current, left, top }
                        : { ...current, anchorLeft: left, anchorTop: top },
            };
            setPositions(positionsRef.current);

            if (boxed && start) {
                setBoxNudge({ id: markerId, dx: left - start.anchorLeft, dy: top - start.anchorTop });
            }
        };
        const up = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            draggingRef.current = false;
            setBoxNudge(null);
            const current = positionsRef.current[markerId];

            if (target.dataset.moved !== '1' || !current || !document) {
                return;
            }

            const tip = normalizedFromViewport(current.anchorLeft, current.anchorTop);
            const label = normalizedFromViewport(current.left, current.top);

            if (!tip || !label) {
                return;
            }

            if (marker && isCountBox(marker) && start) {
                const dx = tip.x - ((Number(marker.x) + Number(marker.x2)) / 2);
                const dy = tip.y - ((Number(marker.y) + Number(marker.y2)) / 2);
                const clamp = (value: number) => Math.min(1, Math.max(0, value));
                onPlace(markerId, {
                    documentId: document.id,
                    page,
                    x: clamp(Number(marker.x) + dx),
                    y: clamp(Number(marker.y) + dy),
                    x2: clamp(Number(marker.x2) + dx),
                    y2: clamp(Number(marker.y2) + dy),
                    labelX: null,
                    labelY: null,
                });

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

    const changeZoom = (next: number, clientX?: number, clientY?: number, lock = true) => {
        const current = zoomRef.current;
        const clamped = Math.min(8, Math.max(0.05, Number(next.toFixed(3))));

        if (lock) {
            zoomLocked.current = true;
            const currentTools = readDrawingTools();
            const byDocument = { ...currentTools.byDocument };

            if (document?.id) {
                const savedView = byDocument[String(document.id)];
                byDocument[String(document.id)] = {
                    page: savedView?.page ?? page,
                    rotation: savedView?.rotation ?? rotation,
                    zoom: clamped,
                    scroll: savedView?.scroll,
                };
                writeDrawingTools({ zoom: clamped, tool, byDocument });
            }
        }

        if (clamped === current) {
            return;
        }

        const scroller = scrollerRef.current;

        if (scroller && clientX !== undefined && clientY !== undefined) {
            const rect = scroller.getBoundingClientRect();
            zoomAnchor.current = {
                contentX: scroller.scrollLeft + clientX - rect.left,
                contentY: scroller.scrollTop + clientY - rect.top,
                viewX: clientX - rect.left,
                viewY: clientY - rect.top,
                scale: clamped / current,
            };
        }

        zoomRef.current = clamped;
        setZoom(clamped);
    };

    const fitSheet = (mode: 'page' | 'width' | 'actual', lock = true) => {
        if (!lock && zoomLocked.current) {
            return true;
        }

        if (mode === 'actual') {
            changeZoom(1, undefined, undefined, lock);

            return true;
        }

        const scroller = scrollerRef.current;
        const base = pageSizeRef.current;

        const stage = stageRef.current;
        const columnWidth = stage?.clientWidth ?? 0;
        const measuredWidth = columnWidth >= 80 ? columnWidth : (scroller && scroller.clientWidth >= 80 ? scroller.clientWidth : 0);
        const measuredHeight = focus
            ? (scroller && scroller.clientHeight >= 80 ? scroller.clientHeight : (stage?.clientHeight ?? 0))
            : Math.max(320, window.innerHeight - 180);

        if (!scroller || base.width <= 1 || base.height <= 1 || measuredWidth < 80 || measuredHeight < 80) {
            return false;
        }

        const swapped = rotation % 180 !== 0;
        const width = swapped ? base.height : base.width;
        const height = swapped ? base.width : base.height;
        const pad = focus ? 16 : 32;
        const availableWidth = Math.max(1, measuredWidth - pad);
        const availableHeight = Math.max(1, measuredHeight - pad);
        const next = mode === 'width' ? availableWidth / width : Math.min(availableWidth / width, availableHeight / height);
        changeZoom(next, undefined, undefined, lock);
        const savedScroll = lock ? undefined : readDrawingTools().byDocument[String(document?.id)]?.scroll?.[String(page)];

        if (savedScroll) {
            window.requestAnimationFrame(() => applySheetScroll(scroller, savedScroll));
        } else {
            scroller.scrollLeft = 0;
            scroller.scrollTop = 0;
        }

        if (lock && document?.id) {
            const current = readDrawingTools();
            const savedView = current.byDocument[String(document.id)];

            if (savedView?.scroll) {
                const scroll = { ...savedView.scroll };
                delete scroll[String(page)];
                current.byDocument[String(document.id)] = { ...savedView, scroll };
                writeDrawingTools(current);
            }
        }

        return true;
    };
    fitSheetRef.current = fitSheet;

    useEffect(() => {
        if (!focus) {
            return;
        }

        const measure = () => {
            const navBottom = window.document.querySelector('[data-app-nav]')?.getBoundingClientRect().bottom ?? 0;
            const titleBottom = window.document.querySelector('[data-sticky-page-title]')?.getBoundingClientRect().bottom ?? 0;
            const top = Math.max(navBottom, titleBottom, 56);
            let left = 0;
            window.document.querySelectorAll('[data-app-sidebar]').forEach((sidebar) => {
                const box = sidebar.getBoundingClientRect();

                if (window.getComputedStyle(sidebar).position === 'fixed' && box.width > 0) {
                    left = Math.max(left, box.right);
                }
            });
            setChrome({ top, left });
        };

        measure();
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';
        window.addEventListener('resize', measure);

        return () => {
            window.document.body.style.overflow = previousOverflow;
            window.removeEventListener('resize', measure);
        };
    }, [focus]);

    useEffect(() => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const target = scrollerRef.current ?? stage;
            const box = target.getBoundingClientRect();
            const width = Math.round(box.width);
            const height = Math.round(box.height);
            setStageBox((current) => (current.width === width && current.height === height ? current : { width, height }));
        });
        observer.observe(stage);
        if (scrollerRef.current) {
            observer.observe(scrollerRef.current);
        }

        return () => observer.disconnect();
    }, [focus, document?.id]);

    useEffect(() => {
        if (!focus) {
            fittedFullscreenKey.current = '';

            return;
        }

        const key = `${document?.id ?? 0}:${page}:${rotation}:${chrome.top}:${chrome.left}:${stageBox.width}x${stageBox.height}`;

        if (zoomLocked.current || fittedFullscreenKey.current === key) {
            fittedFullscreenKey.current = key;

            return;
        }

        let tries = 0;
        let frame = 0;
        const attempt = () => {
            tries += 1;

            if (fitSheetRef.current('page', false)) {
                fittedFullscreenKey.current = key;

                return;
            }

            if (tries < 12) {
                frame = window.requestAnimationFrame(attempt);
            }
        };
        frame = window.requestAnimationFrame(attempt);

        return () => window.cancelAnimationFrame(frame);
    }, [focus, document?.id, page, rotation, chrome.top, chrome.left, stageBox.width, stageBox.height, sheetVersion]);

    useEffect(() => {
        if (focus || stageBox.width < 80 || stageBox.height < 80) {
            return;
        }

        const key = `${document?.id ?? 0}:${page}:${rotation}:${stageBox.width}x${stageBox.height}`;

        if (zoomLocked.current || fittedStageKey.current === key) {
            fittedStageKey.current = key;

            return;
        }

        let tries = 0;
        let frame = 0;
        const attempt = () => {
            tries += 1;

            if (fitSheetRef.current('page', false)) {
                fittedStageKey.current = key;

                return;
            }

            if (tries < 12) {
                frame = window.requestAnimationFrame(attempt);
            }
        };
        frame = window.requestAnimationFrame(attempt);

        return () => window.cancelAnimationFrame(frame);
    }, [focus, document?.id, page, rotation, stageBox.width, stageBox.height, sheetVersion]);

    useEffect(() => {
        const scroller = scrollerRef.current;

        if (!scroller) {
            return;
        }

        const onWheel = (event: WheelEvent) => {
            const zooming = focus || event.ctrlKey || event.metaKey;

            if (!zooming) {
                return;
            }

            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.1 : 0.9;
            changeZoom(zoomRef.current * factor, event.clientX, event.clientY);
        };

        scroller.addEventListener('wheel', onWheel, { passive: false });

        return () => scroller.removeEventListener('wheel', onWheel);
    }, [focus, document?.id]);

    useEffect(() => {
        const typing = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space' && !typing(event.target)) {
                event.preventDefault();
                setSpaceHeld(true);

                return;
            }

            if (typing(event.target) || event.altKey) {
                return;
            }

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                onUndo?.();

                return;
            }

            if (event.metaKey || event.ctrlKey) {
                return;
            }

            const key = event.key.toLowerCase();

            const tools: Record<string, CountTool> = { d: 'door', w: 'window', v: 'select', h: 'hand', x: 'remove', p: 'pen', b: 'box', c: 'copy', o: 'openings' };

            if (canEdit && tools[key]) {
                onToolChange(tools[key]);

                return;
            }

            if (key === 'f') {
                setFocus((current) => !current);

                return;
            }

            if (key === 'escape') {
                setFocus(false);

                return;
            }

            if (key === 'r') {
                rotateRef.current();

                return;
            }

            if (key === '[' || key === ']') {
                setPage((current) => Math.min(pageCount, Math.max(1, current + (key === ']' ? 1 : -1))));

                return;
            }

            if (key === '+' || key === '=' || key === '-') {
                const stage = stageRef.current?.getBoundingClientRect();
                changeZoom(zoomRef.current * (key === '-' ? 1 / 1.15 : 1.15), stage ? stage.left + stage.width / 2 : undefined, stage ? stage.top + stage.height / 2 : undefined);
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                setSpaceHeld(false);
            }
        };
        const clearSpace = () => setSpaceHeld(false);

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', clearSpace);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', clearSpace);
        };
    }, [canEdit, onToolChange, onUndo, pageCount]);

    useEffect(() => {
        let cancelled = false;

        const paintCopy = async (canvas: HTMLCanvasElement | null, pageNumber: number, scale: number) => {
            if (!canvas || !document?.download_url || pageNumber < 1) {
                return;
            }

            const response = await fetch(document.download_url, { credentials: 'same-origin' });

            if (!response.ok || cancelled) {
                return;
            }

            const data = new Uint8Array(await response.arrayBuffer());
            const pdf = await getDocument({ data }).promise;

            try {
                if (cancelled || pageNumber > pdf.numPages) {
                    return;
                }

                const pdfPage = await pdf.getPage(pageNumber);
                const viewport = pdfPage.getViewport({ scale, rotation });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await pdfPage.render({ canvas, viewport }).promise;
            } finally {
                await pdf.destroy();
            }
        };

        if (split && page < pageCount) {
            void paintCopy(peekRef.current, page + 1, zoom).catch(() => undefined);
        }

        if (minimap) {
            const base = pageSizeRef.current;
            const swapped = rotation % 180 !== 0;
            const width = swapped ? base.height : base.width;
            const scale = width > 1 ? 148 / width : 0.12;
            void paintCopy(mapRef.current, page, scale).catch(() => undefined);
        }

        return () => {
            cancelled = true;
        };
    }, [split, minimap, document?.id, document?.download_url, page, pageCount, zoom, rotation, sheetVersion]);

    useEffect(() => {
        const loupe = loupeRef.current;
        const canvas = canvasRef.current;

        if (!loupe || !canvas || !pointer || (tool !== 'door' && tool !== 'window') || panning) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const sourceX = ((pointer.x - rect.left) / rect.width) * canvas.width;
        const sourceY = ((pointer.y - rect.top) / rect.height) * canvas.height;
        const context = loupe.getContext('2d');

        if (!context) {
            return;
        }

        const size = 56;
        context.clearRect(0, 0, loupe.width, loupe.height);
        context.drawImage(canvas, sourceX - size / 2, sourceY - size / 2, size, size, 0, 0, loupe.width, loupe.height);
    }, [pointer, tool, panning, zoom, page]);

    const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId) ?? null;

    useEffect(() => {
        if (!selectedOpening) {
            setMarkDraft(null);

            return;
        }

        const line = openings.findIndex((opening) => opening.id === selectedOpening.id) + 1;
        setMarkDraft({
            number: countMark(selectedOpening.callout, Math.max(line, 1)),
            type: selectedOpening.opening_type || 'door',
            width: selectedOpening.width ?? '',
            height: selectedOpening.height ?? '',
            notes: selectedOpening.notes ?? '',
        });
    }, [selectedOpening, openings]);

    const saveMark = () => {
        if (!selectedOpening || !markDraft) {
            return;
        }

        const line = openings.findIndex((opening) => opening.id === selectedOpening.id) + 1;
        const stored = markDraft.number.trim() === '' || markDraft.number.trim() === String(line) ? null : markDraft.number.trim();
        const currentCallout = selectedOpening.callout?.trim() || null;
        const sameDetails = markDraft.type === selectedOpening.opening_type
            && markDraft.width === (selectedOpening.width ?? '')
            && markDraft.height === (selectedOpening.height ?? '')
            && markDraft.notes === (selectedOpening.notes ?? '');

        if (stored === currentCallout && sameDetails) {
            return;
        }

        if (sameDetails) {
            onRename(selectedOpening.id, stored);

            return;
        }

        onSaveDetails?.(selectedOpening.id, {
            opening_type: markDraft.type,
            width: markDraft.width,
            height: markDraft.height,
            notes: markDraft.notes,
            callout: stored,
        });
    };

    const rememberSheetScroll = () => {
        const scroller = scrollerRef.current;

        if (!scroller || !document?.id) {
            return;
        }

        const current = readDrawingTools();
        const savedView = current.byDocument[String(document.id)] ?? {
            page,
            rotation,
        };
        const scroll = { ...(savedView.scroll ?? {}) };
        scroll[String(page)] = sheetScrollRatio(scroller);
        current.byDocument[String(document.id)] = {
            ...savedView,
            page,
            rotation,
            scroll,
        };
        writeDrawingTools(current);
    };
    rememberScrollRef.current = rememberSheetScroll;

    const queueSheetScroll = () => {
        if (scrollSaveTimer.current !== null) {
            window.clearTimeout(scrollSaveTimer.current);
        }

        scrollSaveTimer.current = window.setTimeout(() => {
            scrollSaveTimer.current = null;
            rememberSheetScroll();
        }, 180);
    };

    const beginPan = (event: ReactPointerEvent<HTMLElement>) => {
        if (!panning) {
            return;
        }

        const scroller = scrollerRef.current;

        if (!scroller) {
            return;
        }

        event.preventDefault();
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        const originX = event.clientX;
        const originY = event.clientY;
        const left = scroller.scrollLeft;
        const top = scroller.scrollTop;
        const move = (moveEvent: PointerEvent) => {
            scroller.scrollLeft = left - (moveEvent.clientX - originX);
            scroller.scrollTop = top - (moveEvent.clientY - originY);
        };
        const up = () => {
            target.removeEventListener('pointermove', move);
            target.removeEventListener('pointerup', up);
            rememberSheetScroll();
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
    };

    const jumpFromMap = (event: ReactPointerEvent<HTMLButtonElement>) => {
        const scroller = scrollerRef.current;
        const canvas = canvasRef.current;
        const map = event.currentTarget.getBoundingClientRect();

        if (!scroller || !canvas) {
            return;
        }

        const ratioX = (event.clientX - map.left) / map.width;
        const ratioY = (event.clientY - map.top) / map.height;
        scroller.scrollLeft = ratioX * canvas.offsetWidth - scroller.clientWidth / 2;
        scroller.scrollTop = ratioY * canvas.offsetHeight - scroller.clientHeight / 2;
        rememberSheetScroll();
    };

    const doorCount = openings.filter((opening) => opening.opening_type !== 'window').length;
    const windowCount = openings.filter((opening) => opening.opening_type === 'window').length;
    const nextMark = tool === 'door' || tool === 'window' || tool === 'box' ? String(openings.length + 1) : '';

    const lineByOpening = new Map(openings.map((opening, index) => [opening.id, index + 1]));
    const markers = openings.flatMap((opening) => opening.markers
        .filter((marker) => document && marker.document_id === document.id && marker.page === page)
        .map((marker) => ({ marker, opening })));
    const sheetPoint = (x: number, y: number) => {
        const viewport = viewportRef.current;
        const size = pageSizeRef.current;

        if (!viewport) {
            return null;
        }

        const [px, py] = viewport.convertToViewportPoint(x * size.width, (1 - y) * size.height);

        return { x: px, y: py };
    };
    const countedBoxes = markers.flatMap(({ marker, opening }) => {
        if (!isCountBox(marker)) {
            return [];
        }

        const a = sheetPoint(Number(marker.x), Number(marker.y));
        const b = sheetPoint(Number(marker.x2), Number(marker.y2));

        if (!a || !b) {
            return [];
        }

        const nudge = boxNudge?.id === marker.id ? boxNudge : null;

        return [{
            id: marker.id,
            openingId: opening.id,
            kind: opening.opening_type === 'window' ? 'window' as const : 'door' as const,
            a: { x: a.x + (nudge?.dx ?? 0), y: a.y + (nudge?.dy ?? 0) },
            b: { x: b.x + (nudge?.dx ?? 0), y: b.y + (nudge?.dy ?? 0) },
        }];
    });
    const previewBoxes = pendingBoxes.flatMap((box) => {
        if (!document || box.documentId !== document.id || box.page !== page) {
            return [];
        }

        const a = sheetPoint(box.x, box.y);
        const b = sheetPoint(box.x2, box.y2);

        if (!a || !b) {
            return [];
        }

        return [{ ...box, a, b }];
    });
    const reviewPoint = review && document && review.page === page ? sheetPoint(review.x, review.y) : null;
    void sheetVersion;

    const choosePdf = () => fileRef.current?.click();
    const placing = tool === 'door' || tool === 'window';
    const tracing = tool === 'pen' || tool === 'box' || tool === 'copy' || tool === 'openings';
    const savedSections = sections.flatMap((section) => {
        if (!document || section.document_id !== document.id || section.page !== page) {
            return [];
        }

        const a = sheetPoint(section.x, section.y);
        const b = sheetPoint(section.x2, section.y2);

        if (!a || !b) {
            return [];
        }

        return [{ ...section, a, b }];
    });
    const savedOpeningMarks = markups.flatMap((markup) => {
        if (markup.kind !== 'openings' || !document || markup.document_id !== document.id || markup.page !== page || markup.points.length < 2) {
            return [];
        }

        const start = markup.points[0];
        const end = markup.points[markup.points.length - 1];
        const a = sheetPoint(start.x, start.y);
        const b = sheetPoint(end.x, end.y);

        if (!a || !b) {
            return [];
        }

        return [{ ...markup, a, b }];
    });
    const openingsOutline = (() => {
        if (!openingsBox || !document || openingsBox.documentId !== document.id || openingsBox.page !== page) {
            return null;
        }

        const a = sheetPoint(openingsBox.x, openingsBox.y);
        const b = sheetPoint(openingsBox.x2, openingsBox.y2);

        if (!a || !b) {
            return null;
        }

        return { a, b, openingType: openingsBox.openingType };
    })();
    const selectedOnDrawing = (() => {
        if (selectedOpeningId == null) {
            return null;
        }

        const match = markers.find(({ opening }) => opening.id === selectedOpeningId);

        if (!match) {
            return null;
        }

        const marker = match.marker;

        if (isCountBox(marker)) {
            const a = sheetPoint(Number(marker.x), Number(marker.y));
            const b = sheetPoint(Number(marker.x2), Number(marker.y2));

            if (!a || !b) {
                return null;
            }

            const x = Math.min(a.x, b.x);
            const y = Math.min(a.y, b.y);

            return {
                row: { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) },
                column: null as { x: number; y: number; width: number; height: number } | null,
            };
        }

        const anchor = sheetPoint(Number(marker.x), Number(marker.y));

        if (!anchor) {
            return null;
        }

        const box = savedOpeningMarks.find((markup) => (markup.opening_ids ?? []).includes(selectedOpeningId));
        const left = box ? Math.min(box.a.x, box.b.x) : Math.max(0, anchor.x - 72);
        const right = box ? Math.max(box.a.x, box.b.x) : anchor.x + 240;
        const top = box ? Math.min(box.a.y, box.b.y) : Math.max(0, anchor.y - 16);
        const bottom = box ? Math.max(box.a.y, box.b.y) : anchor.y + 16;
        const peers = (box ? markers.filter(({ opening }) => (box.opening_ids ?? []).includes(opening.id)) : [match])
            .map(({ marker: peer }) => sheetPoint(Number(peer.x), Number(peer.y)))
            .filter((point): point is { x: number; y: number } => point !== null)
            .sort((first, second) => first.y - second.y);
        const index = peers.findIndex((point) => Math.abs(point.y - anchor.y) < 1.5);
        const before = index > 0 ? peers[index - 1].y : undefined;
        const after = index >= 0 && index < peers.length - 1 ? peers[index + 1].y : undefined;
        const fallback = Math.max(14, Math.min(34, (bottom - top) / Math.max(peers.length, 1)));
        const rowTop = Math.max(top, anchor.y - (before == null ? fallback / 2 : Math.abs(anchor.y - before) / 2));
        const rowBottom = Math.min(bottom, anchor.y + (after == null ? fallback / 2 : Math.abs(after - anchor.y) / 2));
        const columnWidth = Math.max(28, Math.min(84, (right - left) * 0.16));
        const columnLeft = Math.max(left, Math.min(anchor.x - columnWidth / 2, right - columnWidth));

        return {
            row: {
                x: left,
                y: rowTop,
                width: Math.max(0, right - left),
                height: Math.max(10, rowBottom - rowTop),
            },
            column: {
                x: columnLeft,
                y: top,
                width: columnWidth,
                height: Math.max(0, bottom - top),
            },
        };
    })();

    const rememberMarkup = (kind: 'pen' | 'box', points: { x: number; y: number }[]) => {
        if (!document || points.length < 2) {
            return;
        }

        const round = (point: { x: number; y: number }) => ({
            x: Math.round(point.x * 100000) / 100000,
            y: Math.round(point.y * 100000) / 100000,
        });
        const kept = (kind === 'box' ? [points[0], points[points.length - 1]] : points).map(round);
        const markup: SheetMarkup = {
            id: -Date.now(),
            document_id: document.id,
            page,
            kind,
            color: ink,
            points: kept,
        };
        setLocalMarkups((current) => [...current, markup]);
        onMarkup?.({
            documentId: document.id,
            page,
            kind,
            color: ink,
            points: kept,
        });
    };

    const finishTrace = () => {
        const current = traceRef.current;
        traceRef.current = null;
        setTrace(null);

        if (!current) {
            return;
        }

        if (isAreaTrace(current.kind)) {
            const start = current.points[0];
            const end = current.points[current.points.length - 1];

            if (!start || !end || !document || (Math.abs(start.x - end.x) < 0.004 && Math.abs(start.y - end.y) < 0.004)) {
                return;
            }

            const round = (value: number) => Math.round(value * 100000) / 100000;
            const box = {
                x: round(Math.min(start.x, end.x)),
                y: round(Math.min(start.y, end.y)),
                x2: round(Math.max(start.x, end.x)),
                y2: round(Math.max(start.y, end.y)),
            };
            if (current.kind === 'copy') {
                onCopyRegion?.({
                    documentId: document.id,
                    page,
                    ...box,
                });

                return;
            }

            if (current.kind === 'openings') {
                onOpeningsRegion?.({
                    documentId: document.id,
                    page,
                    ...box,
                });

                return;
            }

            setPendingBoxes((items) => [...items, {
                ...box,
                id: -Date.now(),
                documentId: document.id,
                page,
                kind: boxKind,
                number: String(openings.length + 1),
            }]);
            onCount({
                documentId: document.id,
                page,
                x: round((box.x + box.x2) / 2),
                y: round((box.y + box.y2) / 2),
            }, boxKind, box);

            return;
        }

        if (current.kind === 'pen' && current.points.length < 2) {
            return;
        }

        rememberMarkup(current.kind, current.points);
    };

    const beginTrace = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!canEdit || !tracing || panning) {
            return;
        }

        const pixel = canvasPoint(event);
        const point = pointFromEvent(event);

        if (!pixel || !point) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const next = {
            kind: tool as TraceKind,
            color: tool === 'copy' ? '#059669' : tool === 'openings' ? '#4f46e5' : ink,
            points: [{ x: point.x, y: point.y }],
            pixels: [pixel],
        };
        traceRef.current = next;
        setTrace(next);
    };

    const extendTrace = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const current = traceRef.current;

        if (!current) {
            return;
        }

        const pixel = canvasPoint(event);
        const point = pointFromEvent(event);

        if (!pixel || !point) {
            return;
        }

        if (isAreaTrace(current.kind)) {
            const next = {
                ...current,
                points: [current.points[0], { x: point.x, y: point.y }],
                pixels: [current.pixels[0], pixel],
            };
            traceRef.current = next;
            setTrace(next);

            return;
        }

        const last = current.pixels[current.pixels.length - 1];

        if (last && Math.hypot(pixel.x - last.x, pixel.y - last.y) < 2.5) {
            return;
        }

        const next = {
            ...current,
            points: [...current.points, { x: point.x, y: point.y }].slice(-480),
            pixels: [...current.pixels, pixel].slice(-480),
        };
        traceRef.current = next;
        setTrace(next);
    };

    const removeMarkupAt = (event: { clientX: number; clientY: number }) => {
        const pixel = canvasPoint(event);
        const counted = pixel
            ? countedBoxes.find((box) => boxCorners(box.a, box.b).some((start, index, corners) => distanceToSegment(pixel, start, corners[(index + 1) % corners.length]) <= 14))
            : undefined;

        if (counted) {
            onDelete(counted.openingId);

            return;
        }

        const id = pixel ? nearestMarkup(pixel, markupPaths) : null;

        if (id === null) {
            return;
        }

        if (id < 0) {
            setLocalMarkups((current) => current.filter((markup) => markup.id !== id));

            return;
        }

        onDeleteMarkup?.(id);
    };
    const rotateSheet = () => {
        const next = (rotation + 90) % 360;
        setRotation(next);

        if (canEdit && document) {
            onSaveRotation?.(document.id, next);
        }
    };
    rotateRef.current = rotateSheet;

    const stage = (
        <div
            ref={stageRef}
            className={focus
                ? 'fixed z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#1b2128]'
                : 'relative z-0 flex w-full min-w-0 flex-col overflow-hidden'}
            style={focus ? {
                top: chrome.top,
                left: chrome.left,
                width: `calc(100vw - ${chrome.left}px)`,
                height: `calc(100dvh - ${chrome.top}px)`,
                zIndex: 10,
            } : {
                height: sheetPixels.height > 0 ? sheetPixels.height + 24 : '32rem',
                maxHeight: 'calc(100dvh - var(--app-sticky-top, 4.75rem) - 4.5rem)',
                minHeight: '12rem',
            }}
        >
            <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';

                    if (file) {
                        onUpload?.(file);
                    }
                }}
            />
            {error ? <p className="px-3 pt-3 text-sm text-destructive">{error}</p> : null}
            {uploadError ? <p className="px-3 pt-3 text-sm text-destructive">{uploadError}</p> : null}
            {!document ? (
                <div className="m-3 flex min-w-0 flex-1 flex-col items-start gap-3 rounded-md border border-dashed bg-white p-6">
                    <p className="text-sm text-muted-foreground">Upload the drawing, then click each door or window on the sheet to build the scope.</p>
                    {canEdit && onUpload ? (
                        <Button type="button" disabled={uploading} onClick={choosePdf}>
                            {uploading ? 'Uploading…' : 'Upload PDF'}
                        </Button>
                    ) : null}
                </div>
            ) : (
            <div className="relative min-h-0 min-w-0 flex-1">
                <div
                    ref={scrollerRef}
                    className={`absolute inset-0 overflow-x-auto overflow-y-auto bg-[#d7dee6] ${panning ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onPointerDown={beginPan}
                    onScroll={queueSheetScroll}
                    onPointerMove={(event) => {
                        const rect = scrollerRef.current?.getBoundingClientRect();

                        if (!rect) {
                            return;
                        }

                        setPointer({
                            x: event.clientX,
                            y: event.clientY,
                            localX: event.clientX - rect.left,
                            localY: event.clientY - rect.top,
                        });
                    }}
                    onPointerLeave={() => setPointer(null)}
                >
                <div className={split ? 'flex items-start gap-6 p-4' : 'flex min-h-full w-max min-w-full items-start py-3'}>
                {split ? null : <div className="w-[26rem] shrink-0" aria-hidden />}
                <div className="relative w-max max-w-none" style={straighten === 0 ? undefined : { transform: `rotate(${straighten}deg)` }}>
                    <canvas
                        ref={canvasRef}
                        style={{
                            filter: `brightness(${brightness}) contrast(${contrast})`,
                            width: sheetPixels.width > 0 ? sheetPixels.width : undefined,
                            height: sheetPixels.height > 0 ? sheetPixels.height : undefined,
                            maxWidth: 'none',
                        }}
                        className={`max-w-none ${(placing || tracing) && !panning ? 'cursor-crosshair' : ''}`}
                        onPointerDown={beginTrace}
                        onPointerMove={extendTrace}
                        onPointerUp={finishTrace}
                        onPointerCancel={() => {
                            traceRef.current = null;
                            setTrace(null);
                        }}
                        onClick={(event) => {
                            if (tool === 'remove' && canEdit) {
                                removeMarkupAt(event);

                                return;
                            }

                            if (!canEdit || !placing || panning) {
                                return;
                            }

                            const point = pointFromEvent(event);

                            if (point) {
                                onCount(point, tool);
                            }
                        }}
                    />
                    <div className="pointer-events-none absolute inset-0 z-[1] bg-black" style={{ opacity: dim }} />
                    <svg
                        className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
                        viewBox={sheetPixels.width > 0 && sheetPixels.height > 0 ? `0 0 ${sheetPixels.width} ${sheetPixels.height}` : undefined}
                        preserveAspectRatio="none"
                    >
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
                                    <line x1={startX} y1={startY} x2={baseX} y2={baseY} stroke="rgba(255,255,255,0.72)" strokeWidth="3" strokeLinecap="round" />
                                    <line x1={startX} y1={startY} x2={position.anchorLeft} y2={position.anchorTop} stroke="rgba(17,24,39,0.45)" strokeWidth="1.25" markerEnd="url(#takeoff-count-arrow)" />
                                </g>
                            );
                        })}
                        {[...countedBoxes, ...previewBoxes].map((box) => (
                            <g key={`count-box-${box.id}`}>
                                <path d={tracePath([box.a, box.b], 'box')} fill="none" stroke="white" strokeWidth="5" strokeLinejoin="round" />
                                <path
                                    d={tracePath([box.a, box.b], 'box')}
                                    fill="none"
                                    stroke={box.kind === 'window' ? '#0369a1' : '#047857'}
                                    strokeWidth="2.5"
                                    strokeDasharray="7 5"
                                    strokeLinejoin="round"
                                />
                            </g>
                        ))}
                        {markupPaths.map((markup) => (
                            <path
                                key={`markup-${markup.id}`}
                                d={tracePath(markup.points, markup.kind)}
                                fill="none"
                                stroke="white"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}
                        {markupPaths.map((markup) => (
                            <path
                                key={`markup-ink-${markup.id}`}
                                d={tracePath(markup.points, markup.kind)}
                                fill="none"
                                stroke={markup.color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray={markup.kind === 'box' ? '7 5' : undefined}
                            />
                        ))}
                        {openingsOutline ? (
                            <g>
                                <path
                                    d={tracePath([openingsOutline.a, openingsOutline.b], 'box')}
                                    fill="rgba(5,150,105,0.08)"
                                    stroke="#059669"
                                    strokeWidth="2"
                                    strokeDasharray="6 4"
                                    strokeLinejoin="round"
                                />
                                {openingsOutline.openingType ? (
                                    <text
                                        x={Math.min(openingsOutline.a.x, openingsOutline.b.x) + 6}
                                        y={Math.min(openingsOutline.a.y, openingsOutline.b.y) + 16}
                                        fill="#047857"
                                        fontSize="13"
                                        fontWeight="700"
                                    >
                                        {openingTypeLabel(openingsOutline.openingType)}
                                    </text>
                                ) : null}
                            </g>
                        ) : null}
                        {savedOpeningMarks.map((markup) => (
                            <g key={`opening-mark-${markup.id}`}>
                                <path
                                    d={tracePath([markup.a, markup.b], 'box')}
                                    fill="rgba(79,70,229,0.12)"
                                    stroke="#4f46e5"
                                    strokeWidth="2.5"
                                    strokeDasharray="6 4"
                                    strokeLinejoin="round"
                                />
                                <text
                                    x={Math.min(markup.a.x, markup.b.x) + 6}
                                    y={Math.min(markup.a.y, markup.b.y) + 16}
                                    fill="#3730a3"
                                    fontSize="13"
                                    fontWeight="700"
                                >
                                    {markup.label || 'Selection'}
                                </text>
                            </g>
                        ))}
                        {savedSections.map((section) => {
                            const chosen = section.id === focusedSection?.id;

                            return (
                            <g key={`section-${section.id}`}>
                                <path
                                    d={tracePath([section.a, section.b], 'box')}
                                    fill={chosen ? 'rgba(217,119,6,0.18)' : 'rgba(5,150,105,0.08)'}
                                    stroke={chosen ? '#b45309' : '#059669'}
                                    strokeWidth={chosen ? 3.5 : 2}
                                    strokeDasharray="6 4"
                                    strokeLinejoin="round"
                                />
                                <text
                                    x={Math.min(section.a.x, section.b.x) + 6}
                                    y={Math.min(section.a.y, section.b.y) + 16}
                                    fill={chosen ? '#92400e' : '#047857'}
                                    fontSize="13"
                                    fontWeight="700"
                                >
                                    {section.title}
                                </text>
                            </g>
                            );
                        })}
                        {selectedOnDrawing ? (
                            <g data-opening-highlight="true">
                                {selectedOnDrawing.column ? (
                                    <rect
                                        x={selectedOnDrawing.column.x}
                                        y={selectedOnDrawing.column.y}
                                        width={selectedOnDrawing.column.width}
                                        height={selectedOnDrawing.column.height}
                                        fill="rgba(217,119,6,0.18)"
                                    />
                                ) : null}
                                <rect
                                    x={selectedOnDrawing.row.x}
                                    y={selectedOnDrawing.row.y}
                                    width={selectedOnDrawing.row.width}
                                    height={selectedOnDrawing.row.height}
                                    fill="rgba(217,119,6,0.34)"
                                    stroke="#b45309"
                                    strokeWidth="1.5"
                                />
                            </g>
                        ) : null}
                        {trace ? (
                            <path
                                d={tracePath(trace.pixels, trace.kind)}
                                fill="none"
                                stroke={trace.color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray={isAreaTrace(trace.kind) ? '7 5' : undefined}
                            />
                        ) : null}
                    </svg>
                    {canEdit && (onRemoveOpeningMark || onDeleteMarkup) ? savedOpeningMarks.map((markup) => (
                        <button
                            key={`opening-mark-remove-${markup.id}`}
                            type="button"
                            className="absolute z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-semibold text-red-700 shadow ring-1 ring-red-200 hover:bg-red-50"
                            style={{ left: Math.max(markup.a.x, markup.b.x), top: Math.min(markup.a.y, markup.b.y) }}
                            aria-label={`Remove ${markup.label || 'selection'} mark`}
                            onClick={(event) => {
                                event.stopPropagation();
                                (onRemoveOpeningMark ?? onDeleteMarkup)?.(markup.id);
                            }}
                        >
                            ×
                        </button>
                    )) : null}
                    {canEdit && onDeleteSection ? savedSections.map((section) => (
                        <button
                            key={`section-remove-${section.id}`}
                            type="button"
                            className="absolute z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-semibold text-red-700 shadow ring-1 ring-red-200 hover:bg-red-50"
                            style={{ left: Math.max(section.a.x, section.b.x), top: Math.min(section.a.y, section.b.y) }}
                            aria-label={`Remove ${section.title}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDeleteSection(section.id);
                            }}
                        >
                            ×
                        </button>
                    )) : null}
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

                                    if (tool !== 'remove') {
                                        onSelectOpening(opening.id);
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
                    {reviewPoint && review ? (
                        <div
                            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)]"
                            style={{ left: reviewPoint.x, top: reviewPoint.y }}
                        >
                            <div className="rounded-full border-2 border-amber-500 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 shadow">
                                Confirm {review.tag}
                            </div>
                            <div className="mx-auto mt-1 size-3 rounded-full border-2 border-white bg-amber-500 shadow" />
                        </div>
                    ) : null}
                    {previewBoxes.map((box) => (
                        <div
                            key={`pending-${box.id}`}
                            className={`pointer-events-none absolute z-10 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ${box.kind === 'window' ? 'bg-sky-700 text-white' : 'bg-emerald-700 text-white'}`}
                            style={{ left: (box.a.x + box.b.x) / 2, top: (box.a.y + box.b.y) / 2 }}
                        >
                            {box.number}
                        </div>
                    ))}
                    {markers.map(({ marker }) => {
                        const position = positions[marker.id];

                        if (!position || isCountBox(marker)) {
                            return null;
                        }

                        return (
                            <div
                                key={`point-${marker.id}`}
                                title="Arrow point. Drag to set where this count lands."
                                className={`absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#111827]/80 shadow ${canEdit && tool !== 'remove' && tool !== 'hand' ? 'cursor-move' : 'pointer-events-none'}`}
                                style={{ left: position.anchorLeft, top: position.anchorTop }}
                                onPointerDown={(event) => beginDrag(event, marker.id, 'point')}
                            />
                        );
                    })}
                </div>
                {split ? null : <div className="w-[26rem] shrink-0" aria-hidden />}
                {split && page < pageCount ? (
                    <button type="button" className="shrink-0 rounded-md border border-white/70 bg-white/80 p-2 text-left shadow" onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
                        <canvas ref={peekRef} className="max-w-[42vw] bg-white" />
                        <span className="mt-1 block text-xs font-semibold text-[#16324F]">Page {page + 1}. Click to open it.</span>
                    </button>
                ) : null}
                </div>
                </div>
                <DrawingPalette
                    canEdit={canEdit}
                    tool={tool}
                    onToolChange={onToolChange}
                    page={page}
                    pageCount={pageCount}
                    onPage={setPage}
                    zoom={zoom}
                    onZoomBy={(factor) => {
                        const frame = scrollerRef.current?.getBoundingClientRect();
                        changeZoom(zoomRef.current * factor, frame ? frame.left + frame.width / 2 : undefined, frame ? frame.top + frame.height / 2 : undefined);
                    }}
                    onFit={fitSheet}
                    onRotate={rotateSheet}
                    straighten={straighten}
                    onStraighten={setStraighten}
                    brightness={brightness}
                    contrast={contrast}
                    dim={dim}
                    onBrightness={setBrightness}
                    onContrast={setContrast}
                    onDim={setDim}
                    focus={focus}
                    onToggleFocus={() => setFocus((current) => !current)}
                    doorCount={doorCount}
                    windowCount={windowCount}
                    nextMark={nextMark}
                    documents={documents.map((item) => ({
                        id: item.id,
                        label: `${item.sheet_number ? `${item.sheet_number} — ` : ''}${item.original_filename}${item.revision_label ? ` (${item.revision_label})` : ''}`,
                    }))}
                    documentId={document.id}
                    onDocument={onSelectDocument}
                    onUpload={canEdit && onUpload ? choosePdf : undefined}
                    onScan={canEdit && onScan ? onScan : undefined}
                    uploading={uploading}
                    onUndo={onUndo}
                    canUndo={canUndo}
                    split={split}
                    onToggleSplit={() => setSplit((current) => !current)}
                    minimap={minimap}
                    onToggleMinimap={() => setMinimap((current) => !current)}
                    ink={ink}
                    onInk={(color) => setInk(color)}
                    boxKind={boxKind}
                    onBoxKind={setBoxKind}
                    mark={tool === 'select' ? markDraft : null}
                    onMarkChange={(patch) => setMarkDraft((current) => current ? { ...current, ...patch } : current)}
                    onMarkSave={saveMark}
                    view={paletteView}
                    onView={(next) => onPaletteView?.(next)}
                    inspector={inspector}
                />
                {minimap ? (
                    <button
                        type="button"
                        aria-label="Drawing map"
                        className="absolute bottom-3 left-3 z-30 overflow-hidden rounded-lg border border-white/80 bg-white shadow-lg"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={jumpFromMap}
                    >
                        <canvas ref={mapRef} className="block h-auto w-[148px] bg-[#eef2f6]" />
                    </button>
                ) : null}
                {pointer && placing && !panning ? (
                    <canvas
                        ref={loupeRef}
                        width={140}
                        height={140}
                        aria-hidden="true"
                        className="pointer-events-none absolute z-20 size-[140px] rounded-full border-2 border-white shadow-lg"
                        style={{ left: pointer.localX + 20, top: Math.max(8, pointer.localY - 156) }}
                    />
                ) : null}
            </div>
            )}
        </div>
    );

    if (focus) {
        return createPortal(stage, window.document.body);
    }

    return stage;
}

export type { Point as PdfPoint };
