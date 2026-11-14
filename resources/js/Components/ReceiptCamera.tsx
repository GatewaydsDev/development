import { Button } from '@/Components/ui/button';
import { cornersMatch, findReceiptPaper, warpReceipt, type Point } from '@/lib/receiptPaper';
import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    stream: MediaStream;
    onClose: () => void;
    onCapture: (file: File) => void;
};

const messageFor = (seen: boolean, framed: boolean) => {
    if (framed) {
        return 'Receipt found. Hold steady.';
    }

    if (seen) {
        return 'Fit the whole receipt inside the frame.';
    }

    return 'Point the camera at the receipt and fill the frame.';
};

export default function ReceiptCamera({ stream, onClose, onCapture }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const quadRef = useRef<Point[] | null>(null);
    const stableRef = useRef<Point[] | null>(null);
    const stableCount = useRef(0);
    const capturing = useRef(false);
    const captureRef = useRef<() => void>(() => undefined);
    const onCloseRef = useRef(onClose);
    const onCaptureRef = useRef(onCapture);
    const [message, setMessage] = useState(messageFor(false, false));
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);

    onCloseRef.current = onClose;
    onCaptureRef.current = onCapture;

    useEffect(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        video.srcObject = stream;
        void video.play().catch(() => undefined);

        let timer = 0;
        let stopped = false;
        const detectCanvas = document.createElement('canvas');
        const detectContext = detectCanvas.getContext('2d', { willReadFrequently: true });

        const drawGuide = (
            context: CanvasRenderingContext2D,
            width: number,
            height: number,
            guide: { x: number; y: number; width: number; height: number },
            framed: boolean,
        ) => {
            context.clearRect(0, 0, width, height);
            context.fillStyle = 'rgba(0, 0, 0, 0.45)';
            context.beginPath();
            context.rect(0, 0, width, height);
            context.rect(guide.x, guide.y, guide.width, guide.height);
            context.fill('evenodd');
            context.strokeStyle = framed ? '#4ade80' : '#ffffff';
            context.lineWidth = Math.max(4, width * 0.008);
            const mark = Math.min(guide.width, guide.height) * 0.08;
            const corners = [
                [guide.x, guide.y, 1, 1],
                [guide.x + guide.width, guide.y, -1, 1],
                [guide.x + guide.width, guide.y + guide.height, -1, -1],
                [guide.x, guide.y + guide.height, 1, -1],
            ];

            for (const [x, y, dx, dy] of corners) {
                context.beginPath();
                context.moveTo(x, y + dy * mark);
                context.lineTo(x, y);
                context.lineTo(x + dx * mark, y);
                context.stroke();
            }

            const quad = quadRef.current;

            if (!quad) {
                return;
            }

            context.strokeStyle = framed ? '#4ade80' : '#facc15';
            context.lineWidth = Math.max(3, width * 0.005);
            context.beginPath();
            context.moveTo(quad[0].x, quad[0].y);
            quad.slice(1).forEach((point) => context.lineTo(point.x, point.y));
            context.closePath();
            context.stroke();
        };

        const look = () => {
            if (stopped || capturing.current || !detectContext || video.videoWidth === 0) {
                return;
            }

            const scale = Math.min(1, 360 / video.videoWidth);
            const width = Math.max(1, Math.round(video.videoWidth * scale));
            const height = Math.max(1, Math.round(video.videoHeight * scale));
            detectCanvas.width = width;
            detectCanvas.height = height;
            detectContext.drawImage(video, 0, 0, width, height);
            const marginX = width * 0.1;
            const marginY = height * 0.14;
            const guide = {
                x: marginX,
                y: marginY,
                width: width - marginX * 2,
                height: height - marginY * 2,
            };
            const pixels = detectContext.getImageData(0, 0, width, height);
            const found = findReceiptPaper(pixels, guide);
            const fullGuide = {
                x: guide.x / scale,
                y: guide.y / scale,
                width: guide.width / scale,
                height: guide.height / scale,
            };

            quadRef.current = found
                ? found.corners.map((point) => ({ x: point.x / scale, y: point.y / scale }))
                : null;

            const overlay = overlayRef.current;
            const context = overlay?.getContext('2d');

            if (overlay && context) {
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;
                drawGuide(context, video.videoWidth, video.videoHeight, fullGuide, Boolean(found?.framed));
            }

            if (found?.framed && quadRef.current) {
                const tolerance = Math.max(video.videoWidth, video.videoHeight) * 0.015;
                const steady = stableRef.current !== null && cornersMatch(quadRef.current, stableRef.current, tolerance);
                stableRef.current = quadRef.current;
                stableCount.current = steady ? stableCount.current + 1 : 1;
            } else {
                stableRef.current = null;
                stableCount.current = 0;
            }

            setMessage(messageFor(Boolean(found), Boolean(found?.framed)));
            setReady(Boolean(found?.framed));

            if (stableCount.current >= 8) {
                void takePhoto();
            }
        };

        const takePhoto = async () => {
            if (capturing.current || video.videoWidth === 0) {
                return;
            }

            capturing.current = true;
            setBusy(true);
            window.clearInterval(timer);
            const full = document.createElement('canvas');
            full.width = video.videoWidth;
            full.height = video.videoHeight;
            const context = full.getContext('2d', { willReadFrequently: true });

            if (!context) {
                capturing.current = false;
                setBusy(false);
                onCloseRef.current();

                return;
            }

            context.drawImage(video, 0, 0);
            const marginX = full.width * 0.1;
            const marginY = full.height * 0.14;
            const fallback: [Point, Point, Point, Point] = [
                { x: marginX, y: marginY },
                { x: full.width - marginX, y: marginY },
                { x: full.width - marginX, y: full.height - marginY },
                { x: marginX, y: full.height - marginY },
            ];
            const corners = (quadRef.current ?? fallback) as [Point, Point, Point, Point];
            const warped = warpReceipt({
                data: context.getImageData(0, 0, full.width, full.height).data,
                width: full.width,
                height: full.height,
            }, corners);
            const page = document.createElement('canvas');

            if (warped) {
                page.width = warped.width;
                page.height = warped.height;
                page.getContext('2d')?.putImageData(new ImageData(warped.data, warped.width, warped.height), 0, 0);
            } else {
                page.width = full.width;
                page.height = full.height;
                page.getContext('2d')?.drawImage(full, 0, 0);
            }

            const blob = await new Promise<Blob | null>((resolve) => page.toBlob(resolve, 'image/jpeg', 0.9));

            if (!blob || stopped) {
                capturing.current = false;
                setBusy(false);

                return;
            }

            onCaptureRef.current(new File([blob], 'receipt.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
            onCloseRef.current();
        };

        captureRef.current = () => {
            void takePhoto();
        };
        timer = window.setInterval(look, 160);

        return () => {
            stopped = true;
            window.clearInterval(timer);
            captureRef.current = () => undefined;
        };
    }, [stream]);

    const shutter = () => {
        captureRef.current();
    };

    return createPortal(
        <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Scan receipt">
            <div className="relative min-h-0 flex-1">
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
                <p className={`absolute inset-x-4 top-4 rounded-md px-3 py-2 text-center text-sm font-semibold ${ready ? 'bg-emerald-600' : 'bg-black/70'}`}>
                    {busy ? 'Keeping only the receipt…' : message}
                </p>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
                <Button type="button" variant="outline" className="min-h-11 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>
                    <XIcon data-icon="inline-start" />
                    Close
                </Button>
                <button
                    type="button"
                    aria-label="Take receipt photo"
                    disabled={busy}
                    className="h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-50"
                    onClick={shutter}
                />
                <span className="w-24 text-right text-xs text-white/80">Hold the paper flat</span>
            </div>
        </div>,
        document.body,
    );
}
