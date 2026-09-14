export type ProductKind = 'door' | 'window' | 'part';

export type ManufacturerOption = {
    id: number;
    name: string;
};

export type ProductModelOption = {
    id: number;
    name: string;
    in_use?: boolean;
};

export type ProductTypeOption = {
    id: number;
    name: string;
    allows_parts?: boolean;
    kind?: ProductKind;
};

export type DoorConstructionOption = {
    id: number;
    name: string;
};

export type DoorConfigurationOption = {
    id: number;
    name: string;
};

export type DoorHandingOption = {
    id: number;
    name: string;
};

export type WindowCatalogOption = {
    id: number;
    name: string;
};

export type ProductPartOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    description?: string | null;
    kind?: ProductKind;
};

export type TaxStateOption = {
    id: number;
    name: string;
    rate?: number | null;
};

export type ProductStatePricePayload = {
    id?: number;
    tax_state_id?: number | null;
    tax_state?: TaxStateOption | null;
    tax_rate?: number | null;
    price?: string | number | null;
    markup_percent?: string | number | null;
    min_markup_percent?: string | number | null;
};

export type ProductCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
};

export type ProductOptions = {
    types?: ProductTypeOption[];
    manufacturers?: ManufacturerOption[];
    models?: ProductModelOption[];
    constructions?: DoorConstructionOption[];
    configurations?: DoorConfigurationOption[];
    handings?: DoorHandingOption[];
    glassTypes?: WindowCatalogOption[];
    glazingTypes?: WindowCatalogOption[];
    seals?: WindowCatalogOption[];
    parts: ProductPartOption[];
    taxStates?: TaxStateOption[];
    can: ProductCapabilities;
};

export type ProductPayload = {
    id: number;
    uuid: string;
    manufacturer_id?: number | null;
    manufacturer?: ManufacturerOption | null;
    product_type_id?: number | null;
    type?: ProductTypeOption | null;
    product_model_id?: number | null;
    model?: ProductModelOption | null;
    name: string;
    abbreviation?: string | null;
    configurations?: DoorConfigurationOption[];
    handings?: DoorHandingOption[];
    kind: ProductKind;
    description?: string | null;
    notes?: string | null;
    rf_shielding?: string | null;
    stc_rating?: string | null;
    ada?: boolean | null;
    fire_label?: string | null;
    thickness?: string | null;
    area_tested?: string | null;
    weight?: string | null;
    window_glass_type_id?: number | null;
    window_glazing_type_id?: number | null;
    window_seal_id?: number | null;
    glass_type?: WindowCatalogOption | null;
    glazing_type?: WindowCatalogOption | null;
    seal?: WindowCatalogOption | null;
    spec_pdf_url?: string | null;
    spec_pdf_name?: string | null;
    price?: string | number | null;
    markup_percent?: string | number | null;
    min_markup_percent?: string | number | null;
    tax_state_id?: number | null;
    tax_state?: TaxStateOption | null;
    tax_rate?: number | null;
    state_prices?: ProductStatePricePayload[];
    part_count?: number;
    door_count?: number;
    constructions?: DoorConstructionOption[];
    parts: ProductPartOption[];
    doors: Array<{
        id: number;
        name: string;
        abbreviation?: string | null;
    }>;
};

export type ProductFormData = {
    product_type_id: string;
    manufacturer_id: string;
    name: string;
    abbreviation: string;
    description: string;
    notes: string;
    rf_shielding: string;
    stc_rating: string;
    ada: string;
    fire_label: string;
    thickness: string;
    area_tested: string;
    weight: string;
    window_glass_type_id: string;
    window_glazing_type_id: string;
    window_seal_id: string;
    spec_pdf: File | null;
    remove_spec_pdf: boolean;
    price: string;
    markup_percent: string;
    min_markup_percent: string;
    tax_state_id: string;
    tax_rate: string;
    state_prices: Array<{
        tax_state_id: string;
        tax_rate: string;
        price: string;
        markup_percent: string;
        min_markup_percent: string;
    }>;
    configurations: Array<{
        configuration_id: string;
    }>;
    handings: Array<{
        handing_id: string;
    }>;
    constructions: Array<{
        construction_id: string;
    }>;
    parts: Array<{
        part_id: string;
    }>;
};

export type ProductsPaginator = {
    data: ProductPayload[];
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

export const kindLabel = (kind: string) =>
    kind === 'door'
        ? 'Door'
        : kind === 'window'
          ? 'Window'
          : kind === 'part'
            ? 'Part'
            : kind;

export const isWindowProduct = (
    product?: Pick<ProductPayload, 'kind' | 'type'> | null,
) => product?.kind === 'window' || product?.type?.kind === 'window';

export const isAssemblyProduct = (
    product?: Pick<ProductPayload, 'kind' | 'type'> | null,
) =>
    Boolean(product?.type?.allows_parts) ||
    product?.kind === 'door' ||
    product?.kind === 'window';

export const blankPart = () => ({
    part_id: '',
});

export const blankConstruction = () => ({
    construction_id: '',
});

export const blankConfiguration = () => ({
    configuration_id: '',
});

export const blankHanding = () => ({
    handing_id: '',
});

export const blankStatePrice = () => ({
    tax_state_id: '',
    tax_rate: '',
    price: '',
    markup_percent: '',
    min_markup_percent: '',
});

export const decimalToFormValue = (value?: string | number | null) =>
    value === null || value === undefined ? '' : String(value);

export const existingModel = (
    name: string,
    models?: ProductModelOption[],
    currentModelId?: number | null,
) => {
    const normalized = name.trim().toLowerCase();

    if (!normalized) {
        return undefined;
    }

    return models?.find(
        (model) =>
            model.name.toLowerCase() === normalized &&
            (currentModelId == null || model.id !== currentModelId),
    );
};

export const defaultDoorTypeId = (types?: ProductTypeOption[]) => {
    const doorType =
        types?.find((type) => type.kind === 'door') ??
        types?.find((type) => type.allows_parts);

    return doorType ? String(doorType.id) : '';
};

export const adaToFormValue = (ada?: boolean | null) => {
    if (ada === true) {
        return '1';
    }

    if (ada === false) {
        return '0';
    }

    return '';
};

export const productToFormData = (
    product?: ProductPayload,
    types?: ProductTypeOption[],
): ProductFormData => ({
    product_type_id: product?.product_type_id
        ? String(product.product_type_id)
        : product?.type?.id
          ? String(product.type.id)
          : defaultDoorTypeId(types),
    manufacturer_id: product?.manufacturer_id
        ? String(product.manufacturer_id)
        : product?.manufacturer?.id
          ? String(product.manufacturer.id)
          : '',
    name: product?.model?.name ?? product?.name ?? '',
    abbreviation: product?.abbreviation ?? '',
    description: product?.description ?? '',
    notes: product?.notes ?? '',
    rf_shielding: product?.rf_shielding ?? '',
    stc_rating: product?.stc_rating ?? '',
    ada: adaToFormValue(product?.ada),
    fire_label: product?.fire_label ?? '',
    thickness: product?.thickness ?? '',
    area_tested: product?.area_tested ?? '',
    weight: product?.weight ?? '',
    window_glass_type_id: product?.window_glass_type_id
        ? String(product.window_glass_type_id)
        : product?.glass_type?.id
          ? String(product.glass_type.id)
          : '',
    window_glazing_type_id: product?.window_glazing_type_id
        ? String(product.window_glazing_type_id)
        : product?.glazing_type?.id
          ? String(product.glazing_type.id)
          : '',
    window_seal_id: product?.window_seal_id
        ? String(product.window_seal_id)
        : product?.seal?.id
          ? String(product.seal.id)
          : '',
    spec_pdf: null,
    remove_spec_pdf: false,
    price: product?.price === null || product?.price === undefined
        ? ''
        : String(product.price),
    markup_percent:
        product?.markup_percent === null || product?.markup_percent === undefined
            ? ''
            : String(product.markup_percent),
    min_markup_percent:
        product?.min_markup_percent === null ||
        product?.min_markup_percent === undefined
            ? ''
            : String(product.min_markup_percent),
    tax_state_id: product?.tax_state_id
        ? String(product.tax_state_id)
        : product?.tax_state?.id
          ? String(product.tax_state.id)
          : '',
    tax_rate:
        product?.tax_rate === null || product?.tax_rate === undefined
            ? product?.tax_state?.rate === null ||
              product?.tax_state?.rate === undefined
                ? ''
                : String(product.tax_state.rate)
            : String(product.tax_rate),
    state_prices:
        product?.state_prices?.length
            ? product.state_prices.map((statePrice) => ({
                  tax_state_id: statePrice.tax_state_id
                      ? String(statePrice.tax_state_id)
                      : statePrice.tax_state?.id
                        ? String(statePrice.tax_state.id)
                        : '',
                  tax_rate: decimalToFormValue(
                      statePrice.tax_rate ?? statePrice.tax_state?.rate,
                  ),
                  price: decimalToFormValue(statePrice.price),
                  markup_percent: decimalToFormValue(statePrice.markup_percent),
                  min_markup_percent: decimalToFormValue(
                      statePrice.min_markup_percent,
                  ),
              }))
            : !product || isAssemblyProduct(product)
              ? product?.price || product?.tax_state_id || product?.tax_state?.id
                  ? [
                        {
                            tax_state_id: product?.tax_state_id
                                ? String(product.tax_state_id)
                                : product?.tax_state?.id
                                  ? String(product.tax_state.id)
                                  : '',
                            tax_rate: decimalToFormValue(
                                product?.tax_rate ?? product?.tax_state?.rate,
                            ),
                            price: decimalToFormValue(product?.price),
                            markup_percent: decimalToFormValue(
                                product?.markup_percent,
                            ),
                            min_markup_percent: decimalToFormValue(
                                product?.min_markup_percent,
                            ),
                        },
                    ]
                  : [blankStatePrice()]
              : [],
    configurations:
        product?.configurations?.length
            ? product.configurations.map((configuration) => ({
                  configuration_id: String(configuration.id),
              }))
            : [],
    handings:
        product?.handings?.length
            ? product.handings.map((handing) => ({
                  handing_id: String(handing.id),
              }))
            : [],
    constructions:
        product?.constructions?.length
            ? product.constructions.map((construction) => ({
                  construction_id: String(construction.id),
              }))
            : [blankConstruction()],
    parts:
        product?.parts?.length
            ? product.parts.map((part) => ({
                  part_id: String(part.id),
              }))
            : [blankPart()],
});
