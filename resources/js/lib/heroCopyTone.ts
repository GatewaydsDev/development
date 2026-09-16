import { type RefObject, useEffect, useRef, useState } from 'react';

export type HeroCopyTone = 'light' | 'dark';

const SAMPLE_WIDTH = 200;
const LIGHT_BACKGROUND = 0.58;
const DARK_BACKGROUND = 0.45;

function coverDraw(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
) {
    const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight,
    );
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
    );
}

function sampleImageLuminance(
    image: HTMLImageElement,
    frame: DOMRect,
    region: DOMRect,
): number | null {
    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        return null;
    }

    if (frame.width < 8 || frame.height < 8 || region.width < 8 || region.height < 8) {
        return null;
    }

    const scale = Math.min(1, SAMPLE_WIDTH / frame.width);
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        return null;
    }

    try {
        coverDraw(context, image, width, height);

        const x = Math.max(0, Math.floor((region.left - frame.left) * scale));
        const y = Math.max(0, Math.floor((region.top - frame.top) * scale));
        const sampleWidth = Math.max(
            1,
            Math.min(width - x, Math.ceil(region.width * scale)),
        );
        const sampleHeight = Math.max(
            1,
            Math.min(height - y, Math.ceil(region.height * scale)),
        );
        const { data } = context.getImageData(x, y, sampleWidth, sampleHeight);
        let total = 0;

        for (let index = 0; index < data.length; index += 4) {
            total +=
                (0.299 * data[index] +
                    0.587 * data[index + 1] +
                    0.114 * data[index + 2]) /
                255;
        }

        return total / (data.length / 4);
    } catch {
        return null;
    }
}

function toneFromLuminance(
    luminance: number,
    current: HeroCopyTone,
): HeroCopyTone {
    if (current === 'dark') {
        return luminance < DARK_BACKGROUND ? 'light' : 'dark';
    }

    return luminance > LIGHT_BACKGROUND ? 'dark' : 'light';
}

export function useHeroCopyTone(
    sectionRef: RefObject<HTMLElement | null>,
    copyRef: RefObject<HTMLElement | null>,
    slideIndex: number,
) {
    const [tone, setTone] = useState<HeroCopyTone>('light');
    const toneRef = useRef(tone);
    toneRef.current = tone;

    useEffect(() => {
        const section = sectionRef.current;
        const copy = copyRef.current;

        if (!section || !copy) {
            return;
        }

        const image = section.querySelector<HTMLImageElement>(
            `img[data-hero-slide="${slideIndex}"]`,
        );

        if (!image) {
            return;
        }

        let frame = 0;
        let cancelled = false;
        const retries: number[] = [];

        const measure = () => {
            cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                if (cancelled) {
                    return;
                }

                const luminance = sampleImageLuminance(
                    image,
                    section.getBoundingClientRect(),
                    copy.getBoundingClientRect(),
                );

                if (luminance === null) {
                    return;
                }

                const nextTone = toneFromLuminance(luminance, toneRef.current);

                if (nextTone !== toneRef.current) {
                    setTone(nextTone);
                }
            });
        };

        const start = () => {
            if (cancelled) {
                return;
            }

            measure();
            retries.push(window.setTimeout(measure, 120));
            retries.push(window.setTimeout(measure, 400));
        };

        if (image.complete && image.naturalWidth > 0) {
            start();
        } else {
            image.addEventListener('load', start);
            void image.decode?.().then(start).catch(() => undefined);
        }

        const observer = new ResizeObserver(measure);
        observer.observe(section);
        observer.observe(copy);
        window.addEventListener('resize', measure);

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            retries.forEach((retry) => window.clearTimeout(retry));
            image.removeEventListener('load', start);
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [copyRef, sectionRef, slideIndex]);

    return tone;
}
