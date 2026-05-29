import type { TFunction } from 'i18next';

export function humanizeProjectType(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (char) => char.toUpperCase());
}

export function formatProjectType(
    value: string | null | undefined,
    t: TFunction,
): string {
    if (!value) {
        return '';
    }

    return t(`contact.projectTypes.${value}`, {
        defaultValue: humanizeProjectType(value),
    });
}
