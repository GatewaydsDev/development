const allowedKeys = new Set([
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '.',
    ',',
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
]);

export function isMaskedNumericKey(event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
}): boolean {
    if (event.ctrlKey || event.metaKey) {
        return ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());
    }

    return allowedKeys.has(event.key);
}

export function sanitizeDecimal(value: string, maxDecimals = 2): string {
    const raw = value.replace(/[^0-9.,]/g, '');
    const hasDot = raw.includes('.');
    let normalized = raw;

    if (hasDot) {
        normalized = raw.replace(/,/g, '');
    } else {
        const parts = raw.split(',');

        if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= maxDecimals) {
            normalized = `${parts[0]}.${parts[1]}`;
        } else {
            normalized = raw.replace(/,/g, '');
        }
    }

    const [whole = '', ...rest] = normalized.split('.');
    const integer = whole.replace(/[^0-9]/g, '');
    const fraction = rest.join('').replace(/[^0-9]/g, '').slice(0, maxDecimals);

    if (normalized.includes('.')) {
        return `${integer}.${fraction}`;
    }

    return integer;
}

export function formatMoneyMask(value: string): string {
    const sanitized = sanitizeDecimal(value);

    if (sanitized === '') {
        return '';
    }

    const [whole, fraction] = sanitized.split('.');
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return fraction !== undefined ? `${withCommas}.${fraction}` : withCommas;
}

export function parseDecimal(value: string): number | null {
    const sanitized = sanitizeDecimal(value);

    if (sanitized === '' || sanitized === '.') {
        return null;
    }

    const amount = Number(sanitized);

    return Number.isFinite(amount) ? amount : null;
}

export function decimalToInput(value?: string | number | null): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    return formatMoneyMask(String(value));
}

export function inputToDecimal(value: string): string {
    return sanitizeDecimal(value);
}

export function formatCurrency(value?: string | number | null): string {
    const amount = parseDecimal(String(value ?? '')) ?? Number(value ?? 0);

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number.isFinite(amount) ? amount : 0);
}

export function applyMarkup(
    price: string | number | null | undefined,
    percent: string | number | null | undefined,
): number | null {
    const base = parseDecimal(String(price ?? ''));
    const markup = parseDecimal(String(percent ?? ''));

    if (base === null || markup === null) {
        return null;
    }

    return Math.round(base * (1 + markup / 100) * 100) / 100;
}

export function applyTax(
    amount: number | null,
    rate?: number | null,
): number | null {
    if (amount === null || rate === null || rate === undefined) {
        return null;
    }

    return Math.round(amount * (rate / 100) * 100) / 100;
}

export function applyTaxTotal(
    amount: number | null,
    rate?: number | null,
): number | null {
    if (amount === null || rate === null || rate === undefined) {
        return null;
    }

    return Math.round(amount * (1 + rate / 100) * 100) / 100;
}
