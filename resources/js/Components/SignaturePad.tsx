import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

type SignaturePadProps = {
    value?: string | null;
    className?: string;
    onChange: (dataUrl: string | null) => void;
};

export default function SignaturePad({
    value,
    className,
    onChange,
}: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);

    const resizeCanvas = () => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ratio = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const current = canvas.toDataURL('image/png');

        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.scale(ratio, ratio);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2.25;
        context.strokeStyle = '#111827';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);

        if (current && current !== 'data:,') {
            const image = new Image();
            image.onload = () => {
                context.drawImage(image, 0, 0, width, height);
            };
            image.src = current;
        }
    };

    useEffect(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context || !value) {
            return;
        }

        const image = new Image();
        image.onload = () => {
            context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
        };
        image.src = value;
    }, [value]);

    const pointFromEvent = (
        event: React.PointerEvent<HTMLCanvasElement>,
    ) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return null;
        }

        const bounds = canvas.getBoundingClientRect();

        return {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        };
    };

    const emitChange = () => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        onChange(canvas.toDataURL('image/png'));
    };

    return (
        <canvas
            ref={canvasRef}
            className={cn(
                'h-44 w-full touch-none rounded-md border border-border bg-white',
                className,
            )}
            onPointerDown={(event) => {
                const point = pointFromEvent(event);

                if (!point) {
                    return;
                }

                drawing.current = true;
                lastPoint.current = point;
                event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                if (!drawing.current) {
                    return;
                }

                const canvas = canvasRef.current;
                const context = canvas?.getContext('2d');
                const point = pointFromEvent(event);

                if (!canvas || !context || !point || !lastPoint.current) {
                    return;
                }

                context.beginPath();
                context.moveTo(lastPoint.current.x, lastPoint.current.y);
                context.lineTo(point.x, point.y);
                context.stroke();
                lastPoint.current = point;
            }}
            onPointerUp={(event) => {
                drawing.current = false;
                lastPoint.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
                emitChange();
            }}
            onPointerLeave={() => {
                if (drawing.current) {
                    drawing.current = false;
                    lastPoint.current = null;
                    emitChange();
                }
            }}
        />
    );
}
