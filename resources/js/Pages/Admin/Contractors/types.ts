import type { CustomerSelectOption } from '@/Components/CustomerSelect';

export type ContractorContact = {
    id?: number;
    uuid?: string;
    customer_id?: number | null;
    customer_contact_id?: number | null;
    name: string;
    title: string | null;
    email: string | null;
    phone_number: string | null;
    phone_type: string | null;
    notes: string | null;
    is_primary: boolean;
};

export type ContractorPayload = {
    id: number;
    uuid: string;
    name: string;
    website: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    notes: string | null;
    customer_id?: number | null;
    customer?: {
        id: number;
        name: string;
        company_name: string | null;
    } | null;
    email: string | null;
    phone_number: string | null;
    contact_name: string | null;
    projects_count: number;
    contacts: ContractorContact[];
    created_at: string | null;
    updated_at: string | null;
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type ContractorsPaginator = {
    data: ContractorPayload[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

export type ContractorContactFormData = {
    customer_id: string;
    customer_contact_id: string;
    name: string;
    title: string;
    email: string;
    phone_number: string;
    phone_type: string;
    notes: string;
    is_primary: boolean;
};

export type ContractorFormData = {
    name: string;
    website: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    notes: string;
    customer_id: string;
    customer_company_name: string;
    contacts: ContractorContactFormData[];
};

export type ContractorCustomerContactOption = {
    id: number;
    customer_id: number;
    name: string;
    title?: string | null;
    email?: string | null;
    phone_number?: string | null;
};

export type ContractorOptions = {
    phoneTypes: string[];
    customers: CustomerSelectOption[];
    customerContacts: ContractorCustomerContactOption[];
};

export function phoneTypeLabel(value?: string | null) {
    if (!value) {
        return 'Not set';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function contactFromCustomerContact(
    contact: ContractorCustomerContactOption,
    isPrimary = false,
): ContractorContactFormData {
    return {
        customer_id: contact.customer_id ? String(contact.customer_id) : '',
        customer_contact_id: String(contact.id),
        name: contact.name?.trim() || '',
        title: contact.title ?? '',
        email: contact.email?.trim() || '',
        phone_number: contact.phone_number?.trim() || '',
        phone_type: contact.phone_number ? 'office' : '',
        notes: '',
        is_primary: isPrimary,
    };
}

export function blankContact(isPrimary = false): ContractorContactFormData {
    return {
        customer_id: '',
        customer_contact_id: '',
        name: '',
        title: '',
        email: '',
        phone_number: '',
        phone_type: '',
        notes: '',
        is_primary: isPrimary,
    };
}

export function contractorToFormData(
    contractor?: ContractorPayload,
): ContractorFormData {
    return {
        name: contractor?.name ?? '',
        website: contractor?.website ?? '',
        address_line_1: contractor?.address_line_1 ?? '',
        address_line_2: contractor?.address_line_2 ?? '',
        city: contractor?.city ?? '',
        state: contractor?.state ?? '',
        postal_code: contractor?.postal_code ?? '',
        country: contractor?.country ?? '',
        notes: contractor?.notes ?? '',
        customer_id: contractor?.customer_id
            ? String(contractor.customer_id)
            : contractor?.customer?.id
              ? String(contractor.customer.id)
              : '',
        customer_company_name:
            contractor?.customer?.name ??
            contractor?.customer?.company_name ??
            '',
        contacts:
            contractor?.contacts && contractor.contacts.length > 0
                ? contractor.contacts.map((contact, index) => ({
                      customer_id: contact.customer_id
                          ? String(contact.customer_id)
                          : contact.is_primary && contractor.customer_id
                            ? String(contractor.customer_id)
                            : '',
                      customer_contact_id: contact.customer_contact_id
                          ? String(contact.customer_contact_id)
                          : '',
                      name: contact.name ?? '',
                      title: contact.title ?? '',
                      email: contact.email ?? '',
                      phone_number: contact.phone_number ?? '',
                      phone_type: contact.phone_type ?? '',
                      notes: contact.notes ?? '',
                      is_primary: contact.is_primary || index === 0,
                  }))
                : [blankContact(true)],
    };
}
