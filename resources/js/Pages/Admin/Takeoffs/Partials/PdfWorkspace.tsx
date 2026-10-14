import { Button } from '@/Components/ui/button';
import { getDocument, GlobalWorkerOptions, type PageViewport, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import type { TakeoffDocument, TakeoffOpening } from '../types';

GlobalWorkerOptions.workerSrc = worker;

type Point = { documentId: number; page: number; x: number; y: number };

type Props = {
    documents: TakeoffDocument[];
    openings: TakeoffOpening[];
    selectedDocumentId: number | null;
    selectedOpeningId: number | null;
    selectedMarkerId: number | null;
    canEdit: boolean;
    onSelectDocument: (id: number) => void;
    onSelectOpening: (id: number) => void;
    onPlace: (point: Point) => void;
    onMove: (markerId: number, point: Point) => void;
    onRemove: (markerId: number) => void;
    onUpload?: (file: File) => void;
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
    onPlace,
    onMove,
    onRemove,
    onUpload,
    uploading = false,
    uploadError = null,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const viewportRef = useRef<PageViewport | null>(null);
    const pageSizeRef = useRef({ width: 1, height: 1 });
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [positions, setPositions] = useState<Record<number, { left: number; top: number }>>({});
    const document = documents.find((item) => item.id === selectedDocumentId) ?? documents[0] ?? null;

    useEffect(() => {
        setPage(1);
        setRotation(0);
    }, [document?.id]);

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

                const next: Record<number, { left: number; top: number }> = {};

                openings.forEach((opening) => {
                    opening.markers.filter((marker) => marker.document_id === document.id && marker.page === page).forEach((marker) => {
                        const [left, top] = viewport.convertToViewportPoint(Number(marker.x) * unrotated.width, (1 - Number(marker.y)) * unrotated.height);
                        next[marker.id] = { left, top };
                    });
                });

                setPositions(next);
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

    const markers = openings.flatMap((opening) => opening.markers
        .filter((marker) => document && marker.document_id === document.id && marker.page === page)
        .map((marker) => ({ marker, opening })));

    const choosePdf = () => fileRef.current?.click();

    return (
        <div className="flex h-full min-h-[28rem] flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {canEdit && onUpload ? (
                    <>
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
                        <Button type="button" size="sm" disabled={uploading} onClick={choosePdf}>
                            {uploading ? 'Uploading…' : 'Upload PDF'}
                        </Button>
                    </>
                ) : null}
                <select className="max-w-xs rounded-md border-gray-300 text-sm shadow-sm" value={document?.id ?? ''} onChange={(event) => onSelectDocument(Number(event.target.value))}>
                    {documents.length === 0 ? <option value="">No drawings</option> : null}
                    {documents.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.sheet_number ? `${item.sheet_number} — ` : ''}{item.original_filename}{item.revision_label ? ` (${item.revision_label})` : ''}
                        </option>
                    ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</Button>
                <span className="text-sm">Page {page} / {pageCount}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))}>−</Button>
                <span className="text-sm">{Math.round(zoom * 100)}%</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}>+</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setRotation((current) => (current + 90) % 360)}>Rotate</Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Click the drawing to place a marker{selectedOpeningId ? ' on the selected opening' : ''}. Markers stay tied to this file and page. Extra markers do not change quantity.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
            {!document ? (
                <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
                    <p className="text-sm text-muted-foreground">Upload a PDF drawing to start marking openings.</p>
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
                        className="max-w-none"
                        onClick={(event) => {
                            if (!canEdit) {
                                return;
                            }

                            const point = pointFromEvent(event);

                            if (point) {
                                onPlace(point);
                            }
                        }}
                    />
                    {markers.map(({ marker, opening }) => {
                        const position = positions[marker.id];

                        if (!position) {
                            return null;
                        }

                        const selected = marker.id === selectedMarkerId || opening.id === selectedOpeningId;

                        return (
                            <button
                                key={marker.id}
                                type="button"
                                className={`absolute z-10 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1 text-xs font-semibold ${selected ? 'bg-[#3FCF8E] text-[#111827] ring-2 ring-[#111827]' : 'bg-[#111827] text-white'}`}
                                style={{ left: position.left, top: position.top }}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectOpening(opening.id);
                                }}
                                onPointerDown={(event) => {
                                    if (!canEdit) {
                                        return;
                                    }

                                    const target = event.currentTarget;
                                    target.setPointerCapture(event.pointerId);
                                    const move = (moveEvent: PointerEvent) => {
                                        const point = pointFromEvent(moveEvent);

                                        if (!point) {
                                            return;
                                        }

                                        const canvas = canvasRef.current;
                                        const viewport = viewportRef.current;

                                        if (!canvas || !viewport) {
                                            return;
                                        }

                                        const [left, top] = viewport.convertToViewportPoint(point.x * pageSizeRef.current.width, (1 - point.y) * pageSizeRef.current.height);
                                        target.style.left = `${left}px`;
                                        target.style.top = `${top}px`;
                                        target.dataset.x = String(point.x);
                                        target.dataset.y = String(point.y);
                                    };
                                    const up = () => {
                                        target.removeEventListener('pointermove', move);
                                        target.removeEventListener('pointerup', up);
                                        const x = Number(target.dataset.x);
                                        const y = Number(target.dataset.y);

                                        if (!Number.isNaN(x) && !Number.isNaN(y)) {
                                            onMove(marker.id, { documentId: document.id, page, x, y });
                                        }
                                    };
                                    target.addEventListener('pointermove', move);
                                    target.addEventListener('pointerup', up);
                                }}
                            >
                                {opening.tag || opening.label}
                                {canEdit && selected ? (
                                    <span
                                        className="ml-1"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onRemove(marker.id);
                                        }}
                                    >
                                        ×
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export type { Point as PdfPoint };
