export type ProductKind = 'door' | 'part';

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
    door_configuration_id?: number | null;
    configuration?: DoorConfigurationOption | null;
    door_handing_id?: number | null;
    handing?: DoorHandingOption | null;
    kind: ProductKind;
    description?: string | null;
    notes?: string | null;
    rf_shielding?: string | null;
    stc_rating?: string | null;
    ada?: boolean | null;
    fire_label?: string | null;
    thickness?: string | null;
    spec_pdf_url?: string | null;
    spec_pdf_name?: string | null;
    price?: string | number | null;
    markup_percent?: string | number | null;
    min_markup_percent?: string | number | null;
    tax_state_id?: number | null;
    tax_state?: TaxStateOption | null;
    tax_rate?: number | null;
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
    product_model_id: string;
    abbreviation: string;
    door_configuration_id: string;
    door_handing_id: string;
    description: string;
    notes: string;
    rf_shielding: string;
    stc_rating: string;
    ada: string;
    fire_label: string;
    thickness: string;
    spec_pdf: File | null;
    remove_spec_pdf: boolean;
    price: string;
    markup_percent: string;
    min_markup_percent: string;
    tax_state_id: string;
    tax_rate: string;
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
    kind === 'door' ? 'Door' : kind === 'part' ? 'Part' : kind;

export const blankPart = () => ({
    part_id: '',
});

export const blankConstruction = () => ({
    construction_id: '',
});

export const defaultDoorTypeId = (types?: ProductTypeOption[]) => {
    const doorType = types?.find((type) => type.allows_parts);

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
    product_model_id: product?.product_model_id
        ? String(product.product_model_id)
        : product?.model?.id
          ? String(product.model.id)
          : '',
    abbreviation: product?.abbreviation ?? '',
    door_configuration_id: product?.door_configuration_id
        ? String(product.door_configuration_id)
        : product?.configuration?.id
          ? String(product.configuration.id)
          : '',
    door_handing_id: product?.door_handing_id
        ? String(product.door_handing_id)
        : product?.handing?.id
          ? String(product.handing.id)
          : '',
    description: product?.description ?? '',
    notes: product?.notes ?? '',
    rf_shielding: product?.rf_shielding ?? '',
    stc_rating: product?.stc_rating ?? '',
    ada: adaToFormValue(product?.ada),
    fire_label: product?.fire_label ?? '',
    thickness: product?.thickness ?? '',
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
