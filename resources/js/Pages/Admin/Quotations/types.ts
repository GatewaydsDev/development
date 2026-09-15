export type QuotationLineItemFormData = {
    description: string;
    quantity: string;
    unit_price: string;
};

export type QuotationFormData = {
    contractor_id: string;
    project_id: string;
    title: string;
    status: string;
    quoted_at: string;
    valid_until: string;
    notes: string;
    line_items: QuotationLineItemFormData[];
};

export type QuotationContractorOption = {
    id: number;
    name: string;
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
    statuses: QuotationStatusOption[];
    contractors: QuotationContractorOption[];
    projects: QuotationProjectOption[];
};

export type QuotationLineItemPayload = {
    id?: number;
    description: string;
    quantity: string | number | null;
    unit_price: string | number | null;
    extended: string | number | null;
};

export type QuotationPayload = {
    id: number;
    uuid: string;
    quotation_number: string;
    title: string;
    status: string;
    status_label: string;
    quoted_at: string | null;
    valid_until: string | null;
    notes: string | null;
    total: number;
    contractor_id?: number;
    project_id?: number | null;
    contractor: {
        id: number;
        name: string | null;
        contact_name?: string | null;
        email: string | null;
        phone_number: string | null;
    } | null;
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
    unit_price: '',
});

export const quotationToFormData = (
    quotation?: QuotationPayload,
): QuotationFormData => ({
    contractor_id: quotation?.contractor_id
        ? String(quotation.contractor_id)
        : quotation?.contractor?.id
          ? String(quotation.contractor.id)
          : '',
    project_id: quotation?.project_id ? String(quotation.project_id) : '',
    title: quotation?.title ?? '',
    status: quotation?.status ?? 'draft',
    quoted_at: quotation?.quoted_at ?? '',
    valid_until: quotation?.valid_until ?? '',
    notes: quotation?.notes ?? '',
    line_items:
        quotation?.line_items && quotation.line_items.length > 0
            ? quotation.line_items.map((item) => ({
                  description: item.description,
                  quantity:
                      item.quantity === null || item.quantity === undefined
                          ? ''
                          : String(item.quantity),
                  unit_price:
                      item.unit_price === null || item.unit_price === undefined
                          ? ''
                          : String(item.unit_price),
              }))
            : [emptyLineItem()],
});
