import { CSSProperties, useMemo } from 'react';

function buildGearPath(teeth: number, rOuter: number, rInner: number) {
    const cx = 50;
    const cy = 50;
    const step = (Math.PI * 2) / teeth;
    const points: string[] = [];

    for (let i = 0; i < teeth; i += 1) {
        const base = i * step;
        const corners: Array<[number, number]> = [
            [base + step * 0.08, rInner],
            [base + step * 0.2, rOuter],
            [base + step * 0.42, rOuter],
            [base + step * 0.54, rInner],
        ];

        corners.forEach(([angle, radius]) => {
            points.push(
                `${(cx + Math.cos(angle) * radius).toFixed(3)} ${(cy + Math.sin(angle) * radius).toFixed(3)}`,
            );
        });
    }

    return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
}

type FloatingSiteGearProps = {
    delayMs?: number;
};

export default function FloatingSiteGear({
    delayMs = 0,
}: FloatingSiteGearProps) {
    const path = useMemo(() => buildGearPath(12, 46, 34), []);

    return (
        <div
            className="floating-site-gear"
            style={
                {
                    '--floating-gear-delay': `${delayMs}ms`,
                } as CSSProperties
            }
            aria-hidden="true"
        >
            <svg
                viewBox="0 0 100 100"
                className="floating-site-gear__mark"
            >
                <path d={path} />
                <circle cx="50" cy="50" r="18" />
                <circle cx="50" cy="50" r="7.5" />
            </svg>
        </div>
    );
}
