export const openContactFormEventName = 'gateway:open-contact-form';

export function openContactForm() {
    window.dispatchEvent(new Event(openContactFormEventName));
}

