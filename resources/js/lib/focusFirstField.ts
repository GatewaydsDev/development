const FOCUSABLE = [
    'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([disabled]):not([readonly])',
    'select:not([disabled])',
    'textarea:not([disabled]):not([readonly])',
].join(', ');

export function focusFirstField(root: ParentNode | null | undefined) {
    const field = root?.querySelector<HTMLElement>(FOCUSABLE);

    field?.focus();
}

export function queueFocusAddedRow(
    scope: Element | null,
    placement: 'start' | 'end' = 'end',
) {
    if (!scope) {
        return;
    }

    window.setTimeout(() => {
        const list = scope.matches('[data-add-list]')
            ? scope
            : scope.querySelector('[data-add-list]');
        const rows = list?.querySelectorAll<HTMLElement>(':scope > [data-add-row]');

        if (!rows?.length) {
            return;
        }

        focusFirstField(placement === 'start' ? rows[0] : rows[rows.length - 1]);
    }, 0);
}
