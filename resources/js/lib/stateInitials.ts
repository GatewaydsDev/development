import { z } from 'zod';

export const STATE_INITIALS_MESSAGE =
    'Enter a 2-letter state code, for example PA.';

export const stateInitialsInputClassName =
    'h-11 w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] px-1.5 text-center uppercase tracking-wide';

export function normalizeStateInitials(value: string): string {
    return value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
}

export function coerceStateInitials(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();

    if (trimmed === '' || /^[A-Za-z]{2}$/.test(trimmed)) {
        return trimmed.toUpperCase();
    }

    return trimmed;
}

export const optionalStateInitialsSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
        (value) => value === '' || /^[A-Z]{2}$/.test(value),
        STATE_INITIALS_MESSAGE,
    );

export const requiredStateInitialsSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value), STATE_INITIALS_MESSAGE);
