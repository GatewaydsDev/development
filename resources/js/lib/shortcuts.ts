export const openSnapDrawerEventName = 'gateway:open-snap-drawer';

export function openSnapDrawer() {
    window.dispatchEvent(new Event(openSnapDrawerEventName));
}
