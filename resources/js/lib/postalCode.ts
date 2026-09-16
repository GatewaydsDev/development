import { z } from 'zod';

export const POSTAL_CODE_MESSAGE =
    'Use numbers and hyphens only, up to 15 characters.';

export function normalizePostalCode(value: string): string {
    return value.replace(/[^0-9-]/g, '').slice(0, 15);
}

export const optionalPostalCodeSchema = z
    .string()
    .trim()
    .transform((value) => normalizePostalCode(value))
    .refine(
        (value) => value === '' || /^[0-9-]{1,15}$/.test(value),
        POSTAL_CODE_MESSAGE,
    );
