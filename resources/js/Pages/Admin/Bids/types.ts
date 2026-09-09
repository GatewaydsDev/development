export type BidProjectOption = {
    id: number;
    name: string;
    project_number?: string | null;
};

export type BidCatalogOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    description?: string | null;
    kind?: string | null;
};

export type BidCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
};

export type BidOptions = {
    projects: BidProjectOption[];
    stageTypes: BidCatalogOption[];
    scopeTitles: BidCatalogOption[];
    products: BidCatalogOption[];
    pricingStatuses: BidCatalogOption[];
    can: BidCapabilities;
};

export type BidStagePayload = {
    id?: number;
    stage_type_id: number;
    name?: string | null;
    stage_date?: string | null;
    notes?: string | null;
};

export type BidScopeProductPayload = {
    id?: number;
    product_id?: number | null;
    name?: string | null;
    abbreviation?: string | null;
    kind?: string | null;
    description?: string | null;
};

export type BidScopePayload = {
    id: number;
    title_id: number;
    name?: string | null;
    notations?: string | null;
    products: BidScopeProductPayload[];
};

export type BidPricingItemPayload = {
    id?: number;
    description: string;
    pricing_basis?: string | null;
    status_id?: number | null;
    status_name?: string | null;
    amount?: string | number | null;
};

export type BidPricingPayload = {
    id?: number;
    name: string;
    revision_date?: string | null;
    notes?: string | null;
    total?: string | null;
    items: BidPricingItemPayload[];
};

export type BidPayload = {
    id: number;
    uuid: string;
    notes?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    project: {
        id?: number | null;
        name?: string | null;
        project_number?: string | null;
    };
    creator?: {
        id?: number | null;
        name?: string | null;
    } | null;
    current_stage?: string | null;
    latest_total?: string | null;
    stages: BidStagePayload[];
    scopes: BidScopePayload[];
    pricings: BidPricingPayload[];
};

export type BidStageFormData = {
    stage_type_id: string;
    stage_date: string;
    notes: string;
};

export type BidScopeProductFormData = {
    product_id: string;
};

export type BidScopeFormData = {
    title_id: string;
    notations: string;
    products: BidScopeProductFormData[];
};

export type BidPricingItemFormData = {
    description: string;
    pricing_basis: string;
    status_id: string;
    amount: string;
};

export type BidPricingFormData = {
    name: string;
    revision_date: string;
    notes: string;
    items: BidPricingItemFormData[];
};

export type BidFormData = {
    project_id: string;
    notes: string;
    stages: BidStageFormData[];
    scopes: BidScopeFormData[];
    pricings: BidPricingFormData[];
};

export type BidsPaginator = {
    data: BidPayload[];
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

export const blankStage = (): BidStageFormData => ({
    stage_type_id: '',
    stage_date: '',
    notes: '',
});

export const blankScopeProduct = (): BidScopeProductFormData => ({
    product_id: '',
});

export const blankScope = (): BidScopeFormData => ({
    title_id: '',
    notations: '',
    products: [blankScopeProduct()],
});

export const blankPricingItem = (): BidPricingItemFormData => ({
    description: '',
    pricing_basis: '',
    status_id: '',
    amount: '',
});

export const blankPricing = (name = 'Preliminary pricing'): BidPricingFormData => ({
    name,
    revision_date: '',
    notes: '',
    items: [blankPricingItem()],
});

export const bidToFormData = (bid?: BidPayload): BidFormData => ({
    project_id: bid?.project?.id ? String(bid.project.id) : '',
    notes: bid?.notes ?? '',
    stages:
        bid?.stages?.length
            ? bid.stages.map((stage) => ({
                  stage_type_id: stage.stage_type_id
                      ? String(stage.stage_type_id)
                      : '',
                  stage_date: stage.stage_date ?? '',
                  notes: stage.notes ?? '',
              }))
            : [blankStage()],
    scopes:
        bid?.scopes?.length
            ? bid.scopes.map((scope) => ({
                  title_id: scope.title_id ? String(scope.title_id) : '',
                  notations: scope.notations ?? '',
                  products:
                      scope.products?.length
                          ? scope.products.map((product) => ({
                                product_id: product.product_id
                                    ? String(product.product_id)
                                    : '',
                            }))
                          : [blankScopeProduct()],
              }))
            : [blankScope()],
    pricings:
        bid?.pricings?.length
            ? bid.pricings.map((pricing) => ({
                  name: pricing.name,
                  revision_date: pricing.revision_date ?? '',
                  notes: pricing.notes ?? '',
                  items:
                      pricing.items?.length
                          ? pricing.items.map((item) => ({
                                description: item.description,
                                pricing_basis: item.pricing_basis ?? '',
                                status_id: item.status_id
                                    ? String(item.status_id)
                                    : '',
                                amount:
                                    item.amount === null ||
                                    item.amount === undefined
                                        ? ''
                                        : String(item.amount),
                            }))
                          : [blankPricingItem()],
              }))
            : [blankPricing()],
});
