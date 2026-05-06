export const openHelpCenterEventName = 'gateway:open-help-center';

export function openHelpCenter() {
    window.dispatchEvent(new Event(openHelpCenterEventName));
}
