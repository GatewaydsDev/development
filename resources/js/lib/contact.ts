export const openContactFormEventName = 'gateway:open-contact-form';

export function openContactForm(projectType?: string) {
    window.dispatchEvent(
        new CustomEvent(openContactFormEventName, {
            detail: { projectType: projectType ?? '' },
        }),
    );
}

