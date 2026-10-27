export type TakeoffEstimate = {
    cost: string;
    selling: string;
    profit: string;
    margin: string | null;
};

export type TakeoffSummary = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    revision_number: number;
    opening_count: number;
    project: { id: number; name: string; project_number: string | null } | null;
    estimate: TakeoffEstimate | null;
    updated_at: string | null;
};

export type TakeoffDocument = {
    id: number;
    uuid: string;
    original_filename: string;
    document_type: string;
    revision_label: string | null;
    sheet_number: string | null;
    sheet_title: string | null;
    page_count: number | null;
    uploaded_at: string | null;
    uploader: string | null;
    download_url: string | null;
};

export type TakeoffMarker = {
    id: number;
    document_id: number;
    page: number;
    x: string;
    y: string;
    label_x?: string | null;
    label_y?: string | null;
};

export type TakeoffReference = {
    id: number;
    document_id: number | null;
    page: number | null;
    section: string | null;
    note: string | null;
};

export type TakeoffCost = {
    id: number;
    kind: string;
    basis: string;
    description: string | null;
    amount: string | null;
    labor_hours: string | null;
    hourly_rate: string | null;
    from_template: boolean;
};

export type ReviewFlag = {
    code: string;
    message: string;
    opening_id: number | null;
};

export type TakeoffOpening = {
    id: number;
    uuid: string;
    tag: string | null;
    callout: string | null;
    label: string;
    is_bulk: boolean;
    opening_type: 'door' | 'window';
    location: string | null;
    quantity: string;
    product_category: string | null;
    width: string | null;
    height: string | null;
    depth: string | null;
    dimension_unit: string;
    frame_type: string | null;
    handing: string | null;
    hardware_set: string | null;
    glazing: string | null;
    finish: string | null;
    manufacturer: string | null;
    product_model: string | null;
    product_id: number | null;
    product_name: string | null;
    scope: 'supply' | 'installation' | 'both';
    notes: string | null;
    exclusions: string | null;
    assumptions: string | null;
    disposition: 'active' | 'excluded' | 'not_applicable';
    disposition_reason: string | null;
    waived_checks: Record<string, string>;
    acoustic_requirement: string | null;
    rf_requirement: string | null;
    fire_requirement: string | null;
    ballistic_requirement: string | null;
    other_requirements: string | null;
    verified_acoustic: string | null;
    verified_rf: string | null;
    verified_fire: string | null;
    verified_ballistic: string | null;
    verification_status: 'recorded' | 'proposed' | 'pending' | 'completed';
    verified_by: string | null;
    verified_at: string | null;
    requirement_document_id: number | null;
    requirement_page: number | null;
    requirement_section: string | null;
    needs_review: boolean;
    group_id: number | null;
    updated_at: string | null;
    markers: TakeoffMarker[];
    references: TakeoffReference[];
    costs: TakeoffCost[];
    estimate: TakeoffEstimate | null;
    flags: ReviewFlag[];
};

export type TakeoffGroup = {
    id: number;
    name: string;
    manual: boolean;
    mismatch: boolean;
    opening_ids: number[];
    costs: TakeoffCost[];
    estimate: (TakeoffEstimate & { quantity: string }) | null;
};

export type SupplierQuote = {
    id: number;
    supplier_name: string;
    quote_number: string | null;
    revision_label: string | null;
    quote_date: string | null;
    expires_at: string | null;
    expired: boolean;
    opening_id: number | null;
    group_id: number | null;
    included_scope: string | null;
    exclusions: string | null;
    pricing_notes: string | null;
    accepted_at: string | null;
    has_attachment: boolean;
    original_filename: string | null;
};

export type TakeoffDetail = {
    id: number;
    uuid: string;
    title: string;
    status: string;
    revision_number: number;
    notes: string | null;
    pricing_method: 'markup' | 'margin';
    markup_percent: string | null;
    margin_percent: string | null;
    updated_at: string | null;
    project: { id: number; uuid: string; name: string; project_number: string | null } | null;
    estimate: TakeoffEstimate | null;
    documents: TakeoffDocument[];
    openings: TakeoffOpening[];
    groups: TakeoffGroup[];
    supplier_quotes: SupplierQuote[];
    flags: ReviewFlag[];
    previous: {
        uuid: string;
        revision_number: number;
        title: string;
        diff: {
            added: { id: number; label: string }[];
            removed: { id: number; label: string }[];
            changed: { id: number; label: string }[];
        };
        documents: TakeoffDocument[];
    } | null;
    audits: { id: number; action: string; summary: string; user: string | null; created_at: string | null }[];
    show_pricing: boolean;
};

export type TakeoffAbilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
    approve: boolean;
    pricing: boolean;
    export: boolean;
    convert: boolean;
};

export type AssemblyTemplate = {
    id: number;
    name: string;
    opening_type: string;
    product_category: string | null;
    frame_type: string | null;
    hardware_set: string | null;
    glazing: string | null;
    finish: string | null;
    manufacturer: string | null;
    product_model: string | null;
    default_costs: { kind?: string; basis?: string; amount?: string; description?: string }[];
};

export type ConversionLine = {
    key: string;
    label: string;
    quantity: string;
    description: string;
    size: string | null;
    scope: string;
    unit_price: string;
    extended: string;
    flags: ReviewFlag[];
    already_transferred: boolean;
};

export const statusLabel: Record<string, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    approved: 'Approved',
    archived: 'Archived',
};

export function money(value?: string | null): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return value;
    }

    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
}

export function marginLabel(value?: string | null): string {
    if (!value) {
        return '—';
    }

    return `${(Number(value) * 100).toFixed(2)}%`;
}
