export const BID_TEXT_PLACEHOLDERS = [
    { key: 'project_name', label: 'Project name' },
    { key: 'project_number', label: 'Project number' },
    { key: 'customer_name', label: 'Contractor contact' },
    { key: 'customer_company', label: 'Contractor company' },
    { key: 'project_address', label: 'Project address' },
    { key: 'scope_of_work', label: 'Scope of work' },
    { key: 'estimated_start_date', label: 'Estimated start date' },
    { key: 'estimated_end_date', label: 'Estimated end date' },
    { key: 'company_name', label: 'Company name' },
    { key: 'company_legal_name', label: 'Company legal name' },
    { key: 'company_phone', label: 'Company phone' },
    { key: 'company_email', label: 'Company email' },
    { key: 'company_address', label: 'Company address' },
    { key: 'today', label: "Today's date" },
] as const;

export type BidTextPlaceholderKey =
    (typeof BID_TEXT_PLACEHOLDERS)[number]['key'];

export type BidTextPlaceholder = {
    key: string;
    label: string;
};

export const placeholderToken = (key: BidTextPlaceholderKey | string) =>
    `{{${key}}}`;

export const slugifyPlaceholderKey = (label: string): string =>
    label
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);

export const reservedPlaceholderKeys = new Set(
    BID_TEXT_PLACEHOLDERS.map((field) => field.key),
);

export const mergeBidTextPlaceholders = (
    custom: Array<{ key: string; name?: string; label?: string }> = [],
): BidTextPlaceholder[] => {
    const builtIn: BidTextPlaceholder[] = BID_TEXT_PLACEHOLDERS.map(
        (field) => ({
            key: field.key,
            label: field.label,
        }),
    );
    const seen = new Set(builtIn.map((field) => field.key));
    const extras = custom
        .filter((field) => field.key !== '' && !seen.has(field.key))
        .map((field) => ({
            key: field.key,
            label: field.label || field.name || field.key,
        }));

    return [...builtIn, ...extras];
};

export const DEFAULT_SCOPE_TEXT_BODY =
    '<p>This proposal covers the scope of work for <strong>{{project_name}}</strong> at {{project_address}}.</p><p>{{scope_of_work}}</p>';

export const DEFAULT_SHIPPING_TEXT_BODY =
    '<p>Shipping, handling, exclusions, and adjustments for <strong>{{project_name}}</strong> are as follows:</p><ul><li>Freight and handling are as quoted unless noted otherwise.</li><li>Taxes, bonds, permits, and fees are excluded unless listed in this bid.</li></ul>';

export const isEmptyHtml = (html?: string | null) => {
    if (!html) {
        return true;
    }

    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

export const fillBidTextPlaceholders = (
    html: string,
    values: Record<string, string>,
) =>
    html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
        const value = values[key.toLowerCase()];

        if (!value || value.trim() === '') {
            return match;
        }

        return escapeHtml(value).replace(/\n/g, '<br>');
    });

export const htmlHasPlaceholders = (html?: string | null) =>
    Boolean(html && /\{\{\s*[a-z0-9_]+\s*\}\}/i.test(html));
