export const PIN_LABEL_HEIGHT = 28;
export const PIN_MAX_NUDGE = 28;

const NUDGE_DISTANCES = [14, PIN_MAX_NUDGE];
const DIRECTIONS = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
] as const;

export type PinAnchor = {
    id: number;
    left: number;
    top: number;
    width: number;
    height: number;
};

export type PinPlacement = {
    id: number;
    left: number;
    top: number;
};

export function pinLabelWidth(text: string): number {
    const label = text.trim();

    return Math.max(PIN_LABEL_HEIGHT, Math.round(label.length * 7.2 + 8));
}

function overlaps(candidate: PinAnchor, placed: PinAnchor): boolean {
    return Math.abs(candidate.left - placed.left) < (candidate.width + placed.width) / 2
        && Math.abs(candidate.top - placed.top) < (candidate.height + placed.height) / 2;
}

function overlapsAny(candidate: PinAnchor, placed: PinAnchor[]): boolean {
    return placed.some((pin) => overlaps(candidate, pin));
}

export function arrangePinLabels(anchors: PinAnchor[]): PinPlacement[] {
    const placed: PinAnchor[] = [];

    return [...anchors]
        .sort((left, right) => left.id - right.id)
        .map((anchor) => {
            let spot = { left: anchor.left, top: anchor.top };

            if (overlapsAny({ ...anchor, ...spot }, placed)) {
                const opened = nearestOpenSpot(anchor, placed);

                if (opened) {
                    spot = opened;
                }
            }

            placed.push({ ...anchor, ...spot });

            return { id: anchor.id, ...spot };
        });
}

function nearestOpenSpot(anchor: PinAnchor, placed: PinAnchor[]): { left: number; top: number } | null {
    for (const distance of NUDGE_DISTANCES) {
        for (const [directionX, directionY] of DIRECTIONS) {
            const length = Math.hypot(directionX, directionY);
            const spot = {
                left: anchor.left + (directionX / length) * distance,
                top: anchor.top + (directionY / length) * distance,
            };

            if (!overlapsAny({ ...anchor, ...spot }, placed)) {
                return spot;
            }
        }
    }

    return null;
}
