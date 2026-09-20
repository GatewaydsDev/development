export type QuotationLineItemFormData = {
    description: string;
    quantity: string;
    size: string;
    unit_price: string;
};

export type QuotationContactOption = {
    id: number;
    name: string | null;
    title?: string | null;
    email?: string | null;
    phone_number?: string | null;
    is_primary?: boolean;
};

export type QuotationTitleOption = {
    id: number;
    name: string;
};

export type QuotationFieldOption = {
    id: number;
    name: string;
};

export type QuotationProductOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    kind?: string | null;
    fields?: Record<string, string>;
};

export type QuotationProductFieldFormData = {
    product_id: string;
    field_id: string;
    field: string;
    value: string;
};

export type QuotationFieldTableFormData = {
    title: string;
    fields: QuotationProductFieldFormData[];
};

export type QuotationTextTemplateOption = {
    id: number;
    name: string;
    body: string;
};

export type QuotationRevisionFormData = {
    id: string;
    number: string;
    revision_date: string;
    notes: string;
    user_id: string;
    user_name: string;
};

export type QuotationFormData = {
    quotation_number: string;
    project_id: string;
    contractor_id: string;
    contact_ids: string[];
    title_id: string;
    title: string;
    status: string;
    quoted_at: string;
    valid_until: string;
    notes: string;
    pricing_conditions: string;
    pricing_basis: string;
    line_items: QuotationLineItemFormData[];
    revisions: QuotationRevisionFormData[];
    field_tables: QuotationFieldTableFormData[];
};

export type QuotationContractorOption = {
    id: number;
    name: string;
    contacts?: QuotationContactOption[];
};

export type QuotationProjectOption = {
    id: number;
    name: string;
    project_number: string | null;
    contractor_ids?: number[];
    label: string;
};

export type QuotationStatusOption = {
    id: string;
    name: string;
};

export type QuotationOptions = {
    can: {
        create: boolean;
        update: boolean;
        delete: boolean;
        convert_to_bid: boolean;
    };
    nextQuotationNumber?: string;
    titles: QuotationTitleOption[];
    fields: QuotationFieldOption[];
    products: QuotationProductOption[];
    proposalTextTemplates: QuotationTextTemplateOption[];
    pricingTextTemplates: QuotationTextTemplateOption[];
    pricingBasisTextTemplates: QuotationTextTemplateOption[];
    company?: {
        name: string;
        legal_name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
    };
    statuses: QuotationStatusOption[];
    contractors: QuotationContractorOption[];
    projects: QuotationProjectOption[];
};

export type QuotationLineItemPayload = {
    id?: number;
    description: string;
    quantity: string | number | null;
    size?: string | null;
    unit_price: string | number | null;
    extended?: string | number | null;
};

export type QuotationRevisionPayload = {
    id?: number;
    number: string;
    revision_date?: string | null;
    notes?: string | null;
    user_id?: number | null;
    user?: {
        id?: number | null;
        name?: string | null;
    } | null;
};

export type QuotationProductFieldPayload = {
    id?: number;
    product_id?: number | null;
    product_name?: string | null;
    field_id?: number | null;
    field?: string | null;
    value?: string | null;
};

export type QuotationFieldTablePayload = {
    id?: number;
    title: string;
    fields: QuotationProductFieldPayload[];
};

export type QuotationPayload = {
    id: number;
    uuid: string;
    quotation_number: string;
    title: string;
    title_id?: number | null;
    status: string;
    status_label: string;
    quoted_at: string | null;
    valid_until: string | null;
    notes: string | null;
    pricing_conditions?: string | null;
    pricing_basis?: string | null;
    created_by_name?: string | null;
    signature_url?: string | null;
    total: number;
    contractor_id?: number;
    project_id?: number | null;
    contractor: {
        id: number;
        name: string | null;
        contact_name?: string | null;
        email: string | null;
        phone_number: string | null;
        contacts?: QuotationContactOption[];
    } | null;
    contacts?: QuotationContactOption[];
    contact_ids?: string[] | number[];
    project: {
        id: number;
        name: string;
        project_number: string | null;
        site_address: string | null;
    } | null;
    converted_bid?: {
        id: number;
    } | null;
    line_item_count?: number;
    line_items?: QuotationLineItemPayload[];
    revisions?: QuotationRevisionPayload[];
    field_tables?: QuotationFieldTablePayload[];
    product_fields?: QuotationProductFieldPayload[];
};

export type QuotationsPaginator = {
    data: QuotationPayload[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
};

export const formatMoney = (value?: string | number | null) => {
    const amount = Number(value ?? 0);

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Number.isFinite(amount) ? amount : 0);
};

export const emptyLineItem = (): QuotationLineItemFormData => ({
    description: '',
    quantity: '1',
    size: '',
    unit_price: '',
});

export const blankRevision = (
    userId = '',
    userName = '',
): QuotationRevisionFormData => ({
    id: '',
    number: '',
    revision_date: '',
    notes: '',
    user_id: userId,
    user_name: userName,
});

export const emptyProductField = (): QuotationProductFieldFormData => ({
    product_id: '',
    field_id: '',
    field: '',
    value: '',
});

export const emptyFieldTable = (): QuotationFieldTableFormData => ({
    title: '',
    fields: [],
});

export const valueFromProduct = (
    product: QuotationProductOption | undefined,
    fieldName: string,
): string => {
    if (!product || fieldName.trim() === '') {
        return '';
    }

    return product.fields?.[fieldName] ?? '';
};

export type SelectableQuoteField = {
    name: string;
    value: string;
};

export const selectableFieldsForProduct = (
    product: QuotationProductOption | undefined,
    catalog: QuotationFieldOption[] = [],
): SelectableQuoteField[] => {
    const seen = new Set<string>();
    const rows: SelectableQuoteField[] = [];

    const add = (name: string, value = '') => {
        const key = name.trim().toLowerCase();

        if (key === '' || seen.has(key)) {
            return;
        }

        seen.add(key);
        rows.push({ name, value });
    };

    Object.entries(product?.fields ?? {}).forEach(([name, value]) => {
        if (value.trim() !== '') {
            add(name, value);
        }
    });

    catalog.forEach((field) => {
        add(field.name, valueFromProduct(product, field.name));
    });

    return rows;
};

const mapFieldPayload = (
    item: QuotationProductFieldPayload,
): QuotationProductFieldFormData => ({
    product_id: item.product_id ? String(item.product_id) : '',
    field_id: item.field_id ? String(item.field_id) : '',
    field: item.field ?? '',
    value: item.value ?? '',
});

export const quotationToFormData = (
    quotation?: QuotationPayload,
    options?: QuotationOptions,
): QuotationFormData => ({
    quotation_number:
        quotation?.quotation_number ?? options?.nextQuotationNumber ?? '',
    project_id: quotation?.project_id ? String(quotation.project_id) : '',
    contractor_id: quotation?.contractor_id
        ? String(quotation.contractor_id)
        : quotation?.contractor?.id
          ? String(quotation.contractor.id)
          : '',
    contact_ids: (quotation?.contact_ids ?? []).map((id) => String(id)),
    title_id: quotation?.title_id ? String(quotation.title_id) : '',
    title: quotation?.title ?? '',
    status: quotation?.status ?? 'draft',
    quoted_at: quotation?.quoted_at ?? '',
    valid_until: quotation?.valid_until ?? '',
    notes: quotation?.notes ?? '',
    pricing_conditions: quotation?.pricing_conditions ?? '',
    pricing_basis: quotation?.pricing_basis ?? '',
    line_items:
        quotation?.line_items && quotation.line_items.length > 0
            ? quotation.line_items.map((item) => ({
                  description: item.description,
                  quantity:
                      item.quantity === null || item.quantity === undefined
                          ? ''
                          : String(item.quantity),
                  size: item.size ?? '',
                  unit_price:
                      item.unit_price === null || item.unit_price === undefined
                          ? ''
                          : String(item.unit_price),
              }))
            : [emptyLineItem()],
    revisions:
        quotation?.revisions?.map((revision) => ({
            id: revision.id ? String(revision.id) : '',
            number: revision.number ?? '',
            revision_date: revision.revision_date ?? '',
            notes: revision.notes ?? '',
            user_id: revision.user_id ? String(revision.user_id) : '',
            user_name: revision.user?.name ?? '',
        })) ?? [],
    field_tables:
        quotation?.field_tables && quotation.field_tables.length > 0
            ? quotation.field_tables.map((table) => ({
                  title: table.title ?? '',
                  fields: (table.fields ?? []).map(mapFieldPayload),
              }))
            : quotation?.product_fields && quotation.product_fields.length > 0
              ? [
                    {
                        title: '',
                        fields: quotation.product_fields.map(mapFieldPayload),
                    },
                ]
              : [],
});

export const QUOTATION_INSERT_FIELDS = [
    { key: 'quotation_number', label: 'Quotation number' },
    { key: 'quotation_title', label: 'Quotation title' },
    { key: 'quoted_on', label: 'Quoted on' },
    { key: 'valid_until', label: 'Valid until' },
    { key: 'base_bid_total', label: 'Base Bid total' },
    { key: 'item_count', label: 'Item count' },
    { key: 'item_quantity', label: 'Item quantity' },
    { key: 'project_name', label: 'Project name' },
    { key: 'project_number', label: 'Project number' },
    { key: 'project_address', label: 'Project address' },
    { key: 'customer_company', label: 'Contractor company' },
    { key: 'customer_name', label: 'Contractor contact' },
    { key: 'contractor_email', label: 'Contractor email' },
    { key: 'contractor_phone', label: 'Contractor phone' },
    { key: 'latest_revision', label: 'Latest revision' },
    { key: 'company_name', label: 'Company name' },
    { key: 'company_phone', label: 'Company phone' },
    { key: 'company_email', label: 'Company email' },
    { key: 'today', label: "Today's date" },
] as const;

export const fillQuotationPlaceholders = (
    html: string,
    values: Record<string, string>,
) =>
    html.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
        const value = values[key.toLowerCase()] ?? '';

        return value.trim() === '' ? match : value;
    });

export const quotationInsertValues = (
    data: Pick<
        QuotationFormData,
        | 'quotation_number'
        | 'title'
        | 'quoted_at'
        | 'valid_until'
        | 'project_id'
        | 'contractor_id'
        | 'contact_ids'
        | 'line_items'
        | 'revisions'
    >,
    options?: QuotationOptions,
    quotation?: QuotationPayload,
): Record<string, string> => {
    const project = options?.projects.find(
        (item) => String(item.id) === data.project_id,
    );
    const contractor = options?.contractors.find(
        (item) => String(item.id) === data.contractor_id,
    );
    const contact =
        contractor?.contacts?.find((item) =>
            data.contact_ids.includes(String(item.id)),
        ) ?? contractor?.contacts?.[0];
    const quantity = (data.line_items ?? []).reduce((sum, item) => {
        const amount = Number(item.quantity);

        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const total = (data.line_items ?? []).reduce((sum, item) => {
        const unitPrice = Number(item.unit_price);

        return sum + (Number.isFinite(unitPrice) ? unitPrice : 0);
    }, 0);
    const latestRevision = [...(data.revisions ?? [])]
        .reverse()
        .find((revision) => revision.number.trim() !== '');

    return {
        quotation_number:
            data.quotation_number || quotation?.quotation_number || '',
        quotation_title: data.title || quotation?.title || '',
        quoted_on: data.quoted_at || quotation?.quoted_at || '',
        valid_until: data.valid_until || quotation?.valid_until || '',
        base_bid_total: formatMoney(quotation?.total ?? total),
        item_count:
            (data.line_items ?? []).length > 0
                ? String((data.line_items ?? []).length)
                : '',
        item_quantity: quantity > 0 ? String(quantity) : '',
        project_name: project?.name || quotation?.project?.name || '',
        project_number:
            project?.project_number ||
            quotation?.project?.project_number ||
            '',
        project_address: quotation?.project?.site_address || '',
        site_address: quotation?.project?.site_address || '',
        customer_company: contractor?.name || quotation?.contractor?.name || '',
        customer_name:
            contact?.name || quotation?.contacts?.[0]?.name || '',
        contractor_email:
            contact?.email || quotation?.contacts?.[0]?.email || '',
        contractor_phone:
            contact?.phone_number ||
            quotation?.contacts?.[0]?.phone_number ||
            '',
        latest_revision: latestRevision?.number || '',
        company_name: options?.company?.name || '',
        company_legal_name: options?.company?.legal_name || '',
        company_phone: options?.company?.phone || '',
        company_email: options?.company?.email || '',
        company_address: options?.company?.address || '',
        today: new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date()),
    };
};
