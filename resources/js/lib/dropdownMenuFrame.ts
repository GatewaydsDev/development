export function dropdownOpensUp(anchor: DOMRect): boolean {
    const below = window.innerHeight - anchor.bottom;
    const above = anchor.top;

    return below < 240 && above > below;
}

export function dropdownMaxHeight(anchor: DOMRect, openUp: boolean, cap = 512): number {
    const margin = 12;
    const room = openUp
        ? anchor.top - margin
        : window.innerHeight - anchor.bottom - margin;
    const limit = Math.min(cap, Math.floor(window.innerHeight * 0.7));

    return Math.max(0, Math.min(limit, Math.floor(room)));
}
