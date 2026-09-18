export const BID_TEXT_PLACEHOLDERS = [
    {
        key: 'materials',
        label: 'Materials',
        group: 'Totals on this bid',
    },
    {
        key: 'allocation_install',
        label: 'Allocation/install',
        group: 'Totals on this bid',
    },
    {
        key: 'installation',
        label: 'Installation',
        group: 'Totals on this bid',
    },
    {
        key: 'grand_total',
        label: 'Grand total',
        group: 'Totals on this bid',
    },
    {
        key: 'building_total',
        label: 'Building total',
        group: 'Totals on this bid',
    },
    {
        key: 'combined_price',
        label: 'Combined installed unit price',
        group: 'Totals on this bid',
    },
    {
        key: 'latest_revision_total',
        label: 'Latest revision total',
        group: 'Totals on this bid',
    },
    {
        key: 'material_unit_price',
        label: 'Material unit price',
        group: 'Totals on this bid',
    },
    {
        key: 'allocated_handling',
        label: 'Allocated install / freight / handling',
        group: 'Totals on this bid',
    },
    {
        key: 'item_quantity',
        label: 'Item quantity',
        group: 'Totals on this bid',
    },
    {
        key: 'item_count',
        label: 'Item count',
        group: 'Totals on this bid',
    },
    { key: 'project_name', label: 'Project name', group: 'Project' },
    { key: 'project_number', label: 'Project number', group: 'Project' },
    { key: 'customer_name', label: 'Contractor contact', group: 'Project' },
    { key: 'customer_company', label: 'Contractor company', group: 'Project' },
    { key: 'project_address', label: 'Project address', group: 'Project' },
    { key: 'scope_of_work', label: 'Scope of work', group: 'Project' },
    {
        key: 'estimated_start_date',
        label: 'Estimated start date',
        group: 'Project',
    },
    {
        key: 'estimated_end_date',
        label: 'Estimated end date',
        group: 'Project',
    },
    { key: 'company_name', label: 'Company name', group: 'Company' },
    {
        key: 'company_legal_name',
        label: 'Company legal name',
        group: 'Company',
    },
    { key: 'company_phone', label: 'Company phone', group: 'Company' },
    { key: 'company_email', label: 'Company email', group: 'Company' },
    { key: 'company_address', label: 'Company address', group: 'Company' },
    { key: 'today', label: "Today's date", group: 'Bid' },
    {
        key: 'authorized_representative',
        label: 'Authorized representative',
        group: 'Bid',
    },
    { key: 'quotation_number', label: 'Source quotation', group: 'Bid' },
] as const;

export type BidTextPlaceholderKey =
    (typeof BID_TEXT_PLACEHOLDERS)[number]['key'];

export type BidTextPlaceholder = {
    key: string;
    label: string;
    group?: string;
    source?: string;
    sourceLabel?: string;
};

export const BID_TEXT_FIELD_GROUP_ORDER = [
    'Totals on this bid',
    'Project',
    'Company',
    'Bid',
    'Your fields',
] as const;

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

export const fieldSourceLabel = (source?: string | null) =>
    BID_TEXT_PLACEHOLDERS.find((field) => field.key === source)?.label ??
    source ??
    '';

export const suggestedFieldSource = (name: string): string => {
    const trimmed = name.trim().toLowerCase();
    const slug = slugifyPlaceholderKey(name);

    if (trimmed === '' || slug === '') {
        return '';
    }

    const exact = BID_TEXT_PLACEHOLDERS.find(
        (field) =>
            field.key === slug || field.label.toLowerCase() === trimmed,
    );

    if (exact) {
        return exact.key;
    }

    const partial = BID_TEXT_PLACEHOLDERS.find((field) => {
        const label = field.label.toLowerCase();

        return (
            trimmed.includes(label) ||
            label.includes(trimmed) ||
            slug.includes(field.key) ||
            field.key.includes(slug)
        );
    });

    return partial?.key ?? '';
};

export const mergeBidTextPlaceholders = (
    custom: Array<{
        key: string;
        name?: string;
        label?: string;
        source?: string | null;
    }> = [],
): BidTextPlaceholder[] => {
    const builtIn: BidTextPlaceholder[] = BID_TEXT_PLACEHOLDERS.map(
        (field) => ({
            key: field.key,
            label: field.label,
            group: field.group,
            source: field.key,
            sourceLabel: field.label,
        }),
    );
    const seen = new Set(builtIn.map((field) => field.key));
    const extras = custom
        .filter((field) => field.key !== '' && !seen.has(field.key))
        .map((field) => ({
            key: field.key,
            label: field.label || field.name || field.key,
            group: 'Your fields',
            source: field.source || undefined,
            sourceLabel: fieldSourceLabel(field.source),
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
