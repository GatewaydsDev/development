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

const driveTeeth = 12;

const gears = [
    {
        key: 'drive',
        teeth: driveTeeth,
        className: 'floating-site-gear--drive',
        direction: 1,
        offset: 0,
    },
    {
        key: 'middle',
        teeth: 8,
        className: 'floating-site-gear--middle',
        direction: -1,
        offset: 22.5,
    },
    {
        key: 'end',
        teeth: 10,
        className: 'floating-site-gear--end',
        direction: 1,
        offset: 0,
    },
] as const;

export default function FloatingSiteGear({
    delayMs = 0,
}: FloatingSiteGearProps) {
    const paths = useMemo(
        () =>
            Object.fromEntries(
                gears.map((gear) => [
                    gear.key,
                    buildGearPath(gear.teeth, 46, 34),
                ]),
            ),
        [],
    );

    return (
        <div
            className="floating-site-gears"
            style={
                {
                    '--floating-gear-delay': `${delayMs}ms`,
                } as CSSProperties
            }
            aria-hidden="true"
        >
            {gears.map((gear) => {
                const turns = 3 * (driveTeeth / gear.teeth) * gear.direction;

                return (
                    <div
                        key={gear.key}
                        className={`floating-site-gear ${gear.className}`}
                        style={
                            {
                                '--gear-turns': `${turns * 360}deg`,
                                '--gear-offset': `${gear.offset}deg`,
                            } as CSSProperties
                        }
                    >
                        <svg
                            viewBox="0 0 100 100"
                            className="floating-site-gear__mark"
                        >
                            <path d={paths[gear.key]} />
                            <circle cx="50" cy="50" r="18" />
                            <circle cx="50" cy="50" r="7.5" />
                        </svg>
                    </div>
                );
            })}
        </div>
    );
}
