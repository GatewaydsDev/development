export const PIN_LABEL_HEIGHT = 28;
export const PIN_MAX_NUDGE = 88;

const CALLOUT_DISTANCES = [46, 68, 88];
const DIRECTIONS = [
    [1, -1],
    [1, -0.25],
    [-1, -1],
    [0, -1],
    [1, 0.15],
    [-1, 0.15],
    [1, 1],
    [-1, 1],
    [0, 1],
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

export type PinBounds = {
    width: number;
    height: number;
};

export function countMark(callout: string | null | undefined, line: number): string {
    const custom = callout?.trim();

    return custom ? custom : String(line);
}

export function calloutBox(label: string): { width: number; height: number } {
    const height = 28;

    return {
        width: Math.max(height, Math.round(label.trim().length * 8 + 14)),
        height,
    };
}

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

export function arrangePinLabels(anchors: PinAnchor[], occupied: PinAnchor[] = [], bounds?: PinBounds): PinPlacement[] {
    const placed: PinAnchor[] = occupied.map((pin) => ({ ...pin, ...clampCallout(pin, bounds) }));

    return [...anchors]
        .sort((left, right) => left.top - right.top || left.left - right.left)
        .map((anchor) => {
            const spot = nearestOpenSpot(anchor, placed, bounds);

            placed.push({ ...anchor, ...spot });

            return { id: anchor.id, ...spot };
        });
}

export function clampCallout(pin: { left: number; top: number; width: number; height: number }, bounds?: PinBounds): { left: number; top: number } {
    if (!bounds) {
        return { left: pin.left, top: pin.top };
    }

    return {
        left: Math.min(bounds.width - pin.width / 2, Math.max(pin.width / 2, pin.left)),
        top: Math.min(bounds.height - pin.height / 2, Math.max(pin.height / 2, pin.top)),
    };
}

function calloutSpot(anchor: PinAnchor, directionX: number, directionY: number, distance: number) {
    const length = Math.hypot(directionX, directionY);

    return {
        left: anchor.left + (directionX / length) * distance,
        top: anchor.top + (directionY / length) * distance,
    };
}

function insidePage(anchor: PinAnchor, spot: { left: number; top: number }, bounds?: PinBounds): boolean {
    if (!bounds) {
        return true;
    }

    return spot.left - anchor.width / 2 >= 0
        && spot.top - anchor.height / 2 >= 0
        && spot.left + anchor.width / 2 <= bounds.width
        && spot.top + anchor.height / 2 <= bounds.height;
}

function nearestOpenSpot(anchor: PinAnchor, placed: PinAnchor[], bounds?: PinBounds): { left: number; top: number } {
    for (const distance of CALLOUT_DISTANCES) {
        for (const [directionX, directionY] of DIRECTIONS) {
            const spot = calloutSpot(anchor, directionX, directionY, distance);

            if (insidePage(anchor, spot, bounds) && !overlapsAny({ ...anchor, ...spot }, placed)) {
                return spot;
            }
        }
    }

    return clampCallout({
        ...anchor,
        ...calloutSpot(anchor, -1, -1, CALLOUT_DISTANCES[0] + placed.length * 10),
    }, bounds);
}
