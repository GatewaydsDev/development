let pending = false;
let frame = 0;
let expireTimer = 0;

function isComfortablyVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const topMargin = 96;
    const bottomMargin = 96;

    return (
        rect.top >= topMargin &&
        rect.bottom <= window.innerHeight - bottomMargin &&
        rect.height > 0
    );
}

function scrollTarget(error: HTMLElement) {
    const parent = error.parentElement;

    if (
        !parent ||
        parent.tagName === 'FORM' ||
        parent.tagName === 'BODY' ||
        parent.tagName === 'MAIN'
    ) {
        return error;
    }

    return parent;
}

function fieldFor(error: HTMLElement) {
    const container = scrollTarget(error);

    return container.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]',
    );
}

function scrollToValidationError() {
    frame = 0;

    if (!pending) {
        return;
    }

    const errors = [
        ...document.querySelectorAll<HTMLElement>('[data-validation-error]'),
    ].filter((error) => error.getClientRects().length > 0);

    if (errors.length === 0) {
        return;
    }

    errors.sort(
        (left, right) =>
            left.getBoundingClientRect().top - right.getBoundingClientRect().top,
    );

    const target = errors.find((error) => !isComfortablyVisible(scrollTarget(error)));

    if (!target) {
        pending = false;

        return;
    }

    const destination = scrollTarget(target);

    destination.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
    });

    const field = fieldFor(target);

    if (field && document.activeElement !== field) {
        field.focus({ preventScroll: true });
    }

    pending = false;
}

function scheduleScroll() {
    if (frame !== 0) {
        return;
    }

    frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(scrollToValidationError);
    });
}

export function requestValidationScroll() {
    pending = true;
    window.clearTimeout(expireTimer);
    expireTimer = window.setTimeout(() => {
        pending = false;
    }, 4000);
    window.setTimeout(scheduleScroll, 0);
    window.setTimeout(scheduleScroll, 60);
    window.setTimeout(scheduleScroll, 300);
}

export function schedulePendingValidationScroll() {
    if (!pending) {
        return;
    }

    scheduleScroll();
}
