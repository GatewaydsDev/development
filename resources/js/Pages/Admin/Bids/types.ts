import { applyMarkup, parseDecimal } from '@/lib/money';

export type BidProjectScopeOption = {
    type: string;
    name: string;
    notes?: string | null;
    product_id?: number | null;
    service_id?: number | null;
};

export type BidProjectOption = {
    id: number;
    name: string;
    project_number?: string | null;
    contractor_name?: string | null;
    contractor_contact_name?: string | null;
    site_address?: string | null;
    estimated_start_date?: string | null;
    estimated_end_date?: string | null;
    site_state?: string | null;
    scopes?: BidProjectScopeOption[];
};

export type BidTextTemplateOption = {
    id: number;
    name: string;
    body: string;
};

export type BidCompanyOption = {
    name: string;
    legal_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
};

export type BidCatalogStatePrice = {
    tax_state_id: number;
    tax_state?: {
        id: number;
        name: string;
        rate?: number | null;
    } | null;
    price?: string | number | null;
    markup_percent?: string | number | null;
    sell_price?: string | number | null;
};

export type BidCatalogOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    description?: string | null;
    kind?: string | null;
    price?: string | number | null;
    markup_percent?: string | number | null;
    sell_price?: string | number | null;
    state_prices?: BidCatalogStatePrice[];
};

export type BidCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
};

export type BidQuotationLineOption = {
    description: string;
    quantity?: string | number | null;
    unit_price?: string | number | null;
    extended?: string | number | null;
};

export type BidQuotationOption = {
    id: number;
    name: string;
    quotation_number: string;
    title: string;
    project_id?: number | null;
    notes?: string | null;
    line_items: BidQuotationLineOption[];
};

export type BidOptions = {
    projects: BidProjectOption[];
    stageTypes: BidCatalogOption[];
    scopeTitles: BidCatalogOption[];
    products: BidCatalogOption[];
    services: BidCatalogOption[];
    pricingStatuses: BidCatalogOption[];
    scopeTextTemplates: BidTextTemplateOption[];
    shippingTextTemplates: BidTextTemplateOption[];
    company?: BidCompanyOption;
    can: BidCapabilities;
    quotations?: BidQuotationOption[];
    assignees?: Array<{
        id: number;
        name: string;
    }>;
};

export type BidRevisionPayload = {
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
    service_id?: number | null;
    service_name?: string | null;
    location?: string | null;
    description?: string | null;
    quantity?: string | number | null;
    unit_bid?: string | number | null;
    extended?: string | number | null;
    allocated_handling?: string | number | null;
};

export type BidScopePayload = {
    id: number;
    title_id: number;
    name?: string | null;
    notations?: string | null;
    quantity?: string | number | null;
    unit_bid?: string | number | null;
    extended?: string | number | null;
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
    bid_shipping_text_template_id?: number | null;
    bid_scope_text_template_id?: number | null;
    scope_of_work_text?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    project: {
        id?: number | null;
        name?: string | null;
        project_number?: string | null;
        site_address?: string | null;
        contractors?: Array<{
            id: number;
            name: string;
            contact_name?: string | null;
            email?: string | null;
            phone_number?: string | null;
        }>;
    };
    quotation?: {
        id: number;
        quotation_number: string;
        title: string;
    } | null;
    creator?: {
        id?: number | null;
        name?: string | null;
    } | null;
    assigned_to?: number | null;
    assignee?: {
        id?: number | null;
        name?: string | null;
    } | null;
    current_stage?: string | null;
    latest_total?: string | null;
    revisions?: BidRevisionPayload[];
    stages: BidStagePayload[];
    scopes: BidScopePayload[];
    pricings: BidPricingPayload[];
};

export type BidRevisionFormData = {
    id: string;
    number: string;
    revision_date: string;
    notes: string;
    user_id: string;
    user_name: string;
};

export type BidStageFormData = {
    stage_type_id: string;
    stage_date: string;
    notes: string;
};

export type BidScopeProductFormData = {
    product_id: string;
    service_id: string;
    location: string;
    quantity: string;
    unit_bid: string;
    extended: string;
    allocated_handling: string;
};

export type BidScopeFormData = {
    title_id: string;
    scope_type: string;
    title_name: string;
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
    assigned_to: string;
    quotation_id: string;
    notes: string;
    bid_shipping_text_template_id: string;
    bid_scope_text_template_id: string;
    scope_of_work_text: string;
    revisions: BidRevisionFormData[];
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

export const blankRevision = (userId = '', userName = ''): BidRevisionFormData => ({
    id: '',
    number: '',
    revision_date: '',
    notes: '',
    user_id: userId,
    user_name: userName,
});

export const blankStage = (): BidStageFormData => ({
    stage_type_id: '',
    stage_date: '',
    notes: '',
});

export const blankScopeProduct = (): BidScopeProductFormData => ({
    product_id: '',
    service_id: '',
    location: '',
    quantity: '',
    unit_bid: '',
    extended: '',
    allocated_handling: '',
});

export const blankScope = (): BidScopeFormData => ({
    title_id: '',
    scope_type: '',
    title_name: '',
    notations: '',
    products: [blankScopeProduct()],
});

export const combinedPriceAmount = (
    unitBid: string,
    allocatedHandling: string = '',
) => {
    const hasUnit = unitBid.trim() !== '';
    const hasAllocated = allocatedHandling.trim() !== '';
    const unit = hasUnit ? Number(unitBid) : 0;
    const allocated = hasAllocated ? Number(allocatedHandling) : 0;

    if (!hasUnit && !hasAllocated) {
        return '';
    }

    if ((hasUnit && !Number.isFinite(unit)) || (hasAllocated && !Number.isFinite(allocated))) {
        return '';
    }

    return (
        Math.round(
            ((hasUnit ? unit : 0) + (hasAllocated ? allocated : 0)) * 100,
        ) / 100
    ).toFixed(2);
};

export const scopeExtendedAmount = (
    quantity: string,
    unitBid: string,
    allocatedHandling: string = '',
) => {
    const hasQty = quantity.trim() !== '';
    const hasUnit = unitBid.trim() !== '';
    const hasAllocated = allocatedHandling.trim() !== '';
    const qty = hasQty ? Number(quantity) : 0;
    const unit = hasUnit ? Number(unitBid) : 0;
    const allocated = hasAllocated ? Number(allocatedHandling) : 0;

    if (hasQty && !Number.isFinite(qty)) {
        return '';
    }

    if (hasUnit && !Number.isFinite(unit)) {
        return '';
    }

    if (hasAllocated && !Number.isFinite(allocated)) {
        return '';
    }

    if (hasQty && hasUnit) {
        return (
            Math.round((qty * unit + (hasAllocated ? allocated : 0)) * 100) /
            100
        ).toFixed(2);
    }

    if (hasAllocated) {
        return (Math.round(allocated * 100) / 100).toFixed(2);
    }

    return '';
};

export const lineExtendedAmount = (line: {
    quantity?: string | number | null;
    unit_bid?: string | number | null;
    allocated_handling?: string | number | null;
    extended?: string | number | null;
}) =>
    scopeExtendedAmount(
        String(line.quantity ?? ''),
        String(line.unit_bid ?? ''),
        String(line.allocated_handling ?? ''),
    ) ||
    (line.extended === null || line.extended === undefined
        ? ''
        : String(line.extended));

export const lineCombinedPrice = (line: {
    unit_bid?: string | number | null;
    allocated_handling?: string | number | null;
}) =>
    combinedPriceAmount(
        String(line.unit_bid ?? ''),
        String(line.allocated_handling ?? ''),
    );

export const scopesTotalAmount = (scopes: BidScopeFormData[] = []) =>
    scopes.reduce((sum, scope) => {
        return (
            sum +
            (scope.products ?? []).reduce((lineSum, line) => {
                if (line.product_id.trim() === '' && line.service_id.trim() === '') {
                    return lineSum;
                }

                const extended = Number(
                    scopeExtendedAmount(
                        line.quantity,
                        line.unit_bid,
                        line.allocated_handling,
                    ) ||
                        line.extended ||
                        0,
                );

                return lineSum + (Number.isFinite(extended) ? extended : 0);
            }, 0)
        );
    }, 0);

export const scopesCombinedPriceAmount = (
    scopes: BidScopeFormData[] = [],
) => {
    const prices = new Set<string>();

    scopes.forEach((scope) => {
        (scope.products ?? []).forEach((line) => {
            if (line.product_id.trim() === '' && line.service_id.trim() === '') {
                return;
            }

            const price = combinedPriceAmount(
                line.unit_bid,
                line.allocated_handling,
            );

            if (price !== '') {
                prices.add(price);
            }
        });
    });

    return prices.size === 1 ? [...prices][0] : '';
};

export const combinedPriceAmountFromBid = (bid?: BidPayload | null) => {
    const prices = new Set<string>();

    (bid?.scopes ?? []).forEach((scope) => {
        (scope.products ?? []).forEach((product) => {
            const price = lineCombinedPrice(product);

            if (price !== '') {
                prices.add(price);
            }
        });
    });

    return prices.size === 1 ? [...prices][0] : '';
};

const moneyAmount = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

const decimalString = (value?: string | number | null) =>
    value === null || value === undefined ? '' : String(value);

const STATE_NAMES: Record<string, string> = {
    nj: 'new jersey',
    ny: 'new york',
    pa: 'pennsylvania',
    'new jersey': 'new jersey',
    'new york': 'new york',
    pennsylvania: 'pennsylvania',
};

const taxStateAbbreviation = (name: string) =>
    name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0))
        .join('');

const normalizedStateName = (value?: string | null) => {
    const trimmed = (value ?? '').trim().toLowerCase();

    if (trimmed === '') {
        return '';
    }

    return STATE_NAMES[trimmed] ?? trimmed;
};

export const taxStateMatches = (
    taxStateName: string,
    projectState?: string | null,
) => {
    const project = normalizedStateName(projectState);
    const tax = normalizedStateName(taxStateName);

    if (!project || !tax) {
        return false;
    }

    if (tax === project) {
        return true;
    }

    return (
        taxStateAbbreviation(taxStateName).toLowerCase() ===
        (projectState ?? '').trim().toLowerCase()
    );
};

const rowSellPrice = (row?: {
    price?: string | number | null;
    markup_percent?: string | number | null;
    sell_price?: string | number | null;
} | null): number | null => {
    if (!row) {
        return null;
    }

    const precomputed = parseDecimal(String(row.sell_price ?? ''));

    if (precomputed !== null) {
        return precomputed;
    }

    return (
        applyMarkup(row.price, row.markup_percent) ??
        parseDecimal(String(row.price ?? ''))
    );
};

export const catalogSellPrice = (
    product?: BidCatalogOption,
    projectState?: string | null,
): number | null => {
    if (!product) {
        return null;
    }

    const rows = product.state_prices ?? [];
    const matched = rows.find((row) =>
        taxStateMatches(row.tax_state?.name ?? '', projectState),
    );
    const fromMatched = rowSellPrice(matched);

    if (fromMatched !== null) {
        return fromMatched;
    }

    const fromDefault =
        applyMarkup(product.price, product.markup_percent) ??
        parseDecimal(String(product.price ?? ''));

    if (fromDefault !== null) {
        return fromDefault;
    }

    const fromFallbackSell = parseDecimal(String(product.sell_price ?? ''));

    if (fromFallbackSell !== null) {
        return fromFallbackSell;
    }

    for (const row of rows) {
        const price = rowSellPrice(row);

        if (price !== null) {
            return price;
        }
    }

    return null;
};

export const lineAmountsForProduct = (
    productId: string,
    products: BidCatalogOption[] = [],
    projectState?: string | null,
    current?: Partial<BidScopeProductFormData>,
): Pick<BidScopeProductFormData, 'quantity' | 'unit_bid' | 'extended'> => {
    if (productId.trim() === '') {
        return {
            quantity: '',
            unit_bid: '',
            extended: '',
        };
    }

    const price = catalogSellPrice(
        products.find((item) => String(item.id) === productId),
        projectState,
    );
    const quantity =
        (current?.quantity ?? '').trim() !== '' ? (current?.quantity ?? '') : '1';
    const unitBid =
        price === null ? (current?.unit_bid ?? '') : moneyAmount(price);

    return {
        quantity,
        unit_bid: unitBid,
        extended: scopeExtendedAmount(
            quantity,
            unitBid,
            current?.allocated_handling ?? '',
        ),
    };
};

export const scopeTypeLabel = (value?: string | null) => {
    if (!value) {
        return '';
    }

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export const scopesFromProject = (
    project?: BidProjectOption,
    titles: BidCatalogOption[] = [],
    products: BidCatalogOption[] = [],
): BidScopeFormData[] => {
    const projectScopes = project?.scopes ?? [];

    if (projectScopes.length === 0) {
        return [blankScope()];
    }

    return projectScopes.map((scope) => {
        const titleName = scope.name || scopeTypeLabel(scope.type);
        const matchedTitle = titles.find(
            (title) => title.name.toLowerCase() === titleName.toLowerCase(),
        );
        const lines =
            scope.product_id || scope.service_id
                ? [
                      {
                          product_id: scope.product_id
                              ? String(scope.product_id)
                              : '',
                          service_id: scope.service_id
                              ? String(scope.service_id)
                              : '',
                          location: '',
                          allocated_handling: '',
                          ...lineAmountsForProduct(
                              scope.product_id ? String(scope.product_id) : '',
                              products,
                              project?.site_state,
                          ),
                      },
                  ]
                : [blankScopeProduct()];

        return {
            title_id: matchedTitle ? String(matchedTitle.id) : '',
            scope_type: scope.type,
            title_name: titleName,
            notations: '',
            products: lines,
        };
    });
};

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
    assigned_to: bid?.assigned_to
        ? String(bid.assigned_to)
        : bid?.assignee?.id
          ? String(bid.assignee.id)
          : '',
    quotation_id: bid?.quotation?.id ? String(bid.quotation.id) : '',
    notes: bid?.notes ?? '',
    bid_shipping_text_template_id: bid?.bid_shipping_text_template_id
        ? String(bid.bid_shipping_text_template_id)
        : '',
    bid_scope_text_template_id: bid?.bid_scope_text_template_id
        ? String(bid.bid_scope_text_template_id)
        : '',
    scope_of_work_text: bid?.scope_of_work_text ?? '',
    revisions:
        bid?.revisions?.map((revision) => ({
            id: revision.id ? String(revision.id) : '',
            number: revision.number ?? '',
            revision_date: revision.revision_date ?? '',
            notes: revision.notes ?? '',
            user_id: revision.user_id ? String(revision.user_id) : '',
            user_name: revision.user?.name ?? '',
        })) ?? [],
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
                  scope_type: '',
                  title_name: scope.name ?? '',
                  notations: scope.notations ?? '',
                  products:
                      scope.products?.length
                          ? scope.products.map((product) => {
                                const fallback =
                                    (scope.products?.length ?? 0) === 1
                                        ? {
                                              quantity: decimalString(
                                                  scope.quantity,
                                              ),
                                              unit_bid: decimalString(
                                                  scope.unit_bid,
                                              ),
                                              extended: decimalString(
                                                  scope.extended,
                                              ),
                                          }
                                        : {
                                              quantity: '',
                                              unit_bid: '',
                                              extended: '',
                                          };

                                return {
                                    product_id: product.product_id
                                        ? String(product.product_id)
                                        : '',
                                    service_id: product.service_id
                                        ? String(product.service_id)
                                        : '',
                                    location: product.location ?? '',
                                    quantity:
                                        decimalString(product.quantity) ||
                                        fallback.quantity,
                                    unit_bid:
                                        decimalString(product.unit_bid) ||
                                        fallback.unit_bid,
                                    extended:
                                        decimalString(product.extended) ||
                                        fallback.extended,
                                    allocated_handling: decimalString(
                                        product.allocated_handling,
                                    ),
                                };
                            })
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

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const quotationLineAmount = (item: BidQuotationLineOption) => {
    if (item.extended !== null && item.extended !== undefined && item.extended !== '') {
        return String(item.extended);
    }

    const quantity = Number(item.quantity);
    const unit = Number(item.unit_price);

    if (!Number.isFinite(quantity) || !Number.isFinite(unit)) {
        return '';
    }

    return (Math.round(quantity * unit * 100) / 100).toFixed(2);
};

export const quotationImportHtml = (quotation: BidQuotationOption): string => {
    const items = quotation.line_items
        .map((item) => {
            const parts = [escapeHtml(item.description)];
            const amount = quotationLineAmount(item);

            if (item.quantity !== null && item.quantity !== undefined && item.quantity !== '') {
                parts.push(`Qty ${escapeHtml(String(item.quantity))}`);
            }

            if (amount !== '') {
                parts.push(escapeHtml(formatMoney(amount)));
            }

            return `<li>${parts.join(' — ')}</li>`;
        })
        .join('');

    return `<p>Imported from quotation ${escapeHtml(quotation.quotation_number)} — ${escapeHtml(quotation.title)}.</p>${items ? `<ul>${items}</ul>` : ''}`;
};

export const pricingFromQuotation = (
    quotation: BidQuotationOption,
): BidPricingFormData => ({
    name: `Imported from ${quotation.quotation_number}`,
    revision_date: '',
    notes: quotation.title,
    items: quotation.line_items.length
        ? quotation.line_items.map((item) => ({
              description: item.description,
              pricing_basis: [
                  item.quantity !== null && item.quantity !== undefined && item.quantity !== ''
                      ? `Qty ${item.quantity}`
                      : null,
                  item.unit_price !== null &&
                  item.unit_price !== undefined &&
                  item.unit_price !== ''
                      ? formatMoney(item.unit_price)
                      : null,
              ]
                  .filter(Boolean)
                  .join(' × '),
              status_id: '',
              amount: quotationLineAmount(item),
          }))
        : [blankPricingItem()],
});
