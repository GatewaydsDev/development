import { useEffect, useMemo, useRef, useState } from 'react';

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

function Gear({
    className,
    teeth = 12,
}: {
    className?: string;
    teeth?: number;
}) {
    const path = useMemo(() => buildGearPath(teeth, 46, 34), [teeth]);

    return (
        <svg
            viewBox="0 0 100 100"
            className={className}
            aria-hidden="true"
        >
            <path d={path} />
            <circle cx="50" cy="50" r="18" />
            <circle cx="50" cy="50" r="7.5" />
        </svg>
    );
}

function DoorLeaf({ side }: { side: 'left' | 'right' }) {
    return (
        <div className={`hero-gear-door__leaf hero-gear-door__leaf--${side}`}>
            <div className="hero-gear-door__leaf-metal" />
            <div className="hero-gear-door__leaf-grid" />
            <div className="hero-gear-door__rivets" aria-hidden="true">
                {Array.from({ length: 8 }, (_, index) => (
                    <span key={index} />
                ))}
            </div>
            <div className="hero-gear-door__handle" />
            <Gear
                teeth={side === 'left' ? 10 : 8}
                className={`hero-gear-door__leaf-gear hero-gear-door__leaf-gear--${side}`}
            />
        </div>
    );
}

const TOP_ENTER = 90;
const TOP_LEAVE = 220;

export default function HeroGearDoor() {
    const rootRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);
    const [playId, setPlayId] = useState(0);

    useEffect(() => {
        const section = rootRef.current?.closest('section');
        let hasLeftTop = false;

        const play = () => {
            setPlayId((current) => current + 1);
            setIsInView(true);
        };

        const reset = () => {
            setIsInView(false);
        };

        const heroHasLeft = () => {
            if (!section) {
                return window.scrollY > TOP_LEAVE;
            }

            return section.getBoundingClientRect().bottom < 140;
        };

        const pageIsAtTop = () => window.scrollY <= TOP_ENTER;

        const sync = () => {
            if (!hasLeftTop && heroHasLeft()) {
                hasLeftTop = true;
                reset();
                return;
            }

            if (hasLeftTop && pageIsAtTop()) {
                hasLeftTop = false;
                play();
            }
        };

        play();
        window.addEventListener('scroll', sync, { passive: true });
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) {
                return;
            }

            hasLeftTop = false;
            play();
        };
        window.addEventListener('pageshow', onPageShow);

        return () => {
            window.removeEventListener('scroll', sync);
            window.removeEventListener('pageshow', onPageShow);
        };
    }, []);

    return (
        <div
            ref={rootRef}
            className="hero-gear-door"
            aria-hidden="true"
        >
            <div
                key={isInView ? playId : 'closed'}
                className={
                    'hero-gear-door__stage' +
                    (isInView ? ' is-active' : '')
                }
            >
                <div className="hero-gear-door__glow" />
                <div className="hero-gear-door__frame" />

                <DoorLeaf side="left" />
                <DoorLeaf side="right" />

                <div className="hero-gear-door__seam" />
                <div className="hero-gear-door__bolt" />

                <div className="hero-gear-door__cluster">
                    <Gear
                        teeth={14}
                        className="hero-gear-door__gear hero-gear-door__gear--lg"
                    />
                    <Gear
                        teeth={10}
                        className="hero-gear-door__gear hero-gear-door__gear--md"
                    />
                    <Gear
                        teeth={8}
                        className="hero-gear-door__gear hero-gear-door__gear--sm"
                    />
                </div>

                <Gear
                    teeth={9}
                    className="hero-gear-door__gear hero-gear-door__gear--tl"
                />
                <Gear
                    teeth={8}
                    className="hero-gear-door__gear hero-gear-door__gear--br"
                />
            </div>
        </div>
    );
}
