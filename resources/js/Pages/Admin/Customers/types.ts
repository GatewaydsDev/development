export type CustomerProject = {
    id: number;
    name: string;
    project_number: string | null;
    status: string;
};

export type CustomerPayload = {
    id: number;
    uuid: string;
    name: string;
    company_name: string | null;
    email: string | null;
    phone_number: string | null;
    contacts: CustomerContact[];
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    project: CustomerProject | null;
    projects_count?: number;
    created_at: string | null;
    updated_at: string | null;
};

export type CustomerContact = {
    id?: number;
    uuid?: string;
    name: string;
    customer_contact_role_id?: number | null;
    title: string | null;
    email: string | null;
    phone_number: string | null;
    notes: string | null;
    is_primary: boolean;
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type CustomersPaginator = {
    data: CustomerPayload[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

export type CustomerFormData = {
    company_name: string;
    email: string;
    phone_number: string;
    contacts: CustomerContactFormData[];
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
};

export type CustomerContactFormData = {
    name: string;
    title: string;
    email: string;
    phone_number: string;
    notes: string;
    is_primary: boolean;
    customer_contact_role_id: string;
};

export type CustomerContactRole = {
    id: number;
    name: string;
};

export function blankContact(isPrimary = false): CustomerContactFormData {
    return {
        name: '',
        title: '',
        email: '',
        phone_number: '',
        notes: '',
        is_primary: isPrimary,
        customer_contact_role_id: '',
    };
}

export function customerToFormData(customer?: CustomerPayload): CustomerFormData {
    return {
        company_name: customer?.company_name || customer?.name || '',
        email: customer?.email ?? '',
        phone_number: customer?.phone_number ?? '',
        contacts:
            customer?.contacts && customer.contacts.length > 0
                ? customer.contacts.map((contact, index) => ({
                      name: contact.name ?? '',
                      customer_contact_role_id: contact.customer_contact_role_id
                          ? String(contact.customer_contact_role_id)
                          : '',
                      title: contact.title ?? '',
                      email: contact.email ?? '',
                      phone_number: contact.phone_number ?? '',
                      notes: contact.notes ?? '',
                      is_primary: contact.is_primary || index === 0,
                  }))
                : [
                      {
                          ...blankContact(true),
                          name: customer?.name ?? '',
                          email: customer?.email ?? '',
                          phone_number: customer?.phone_number ?? '',
                      },
                  ],
        address_line_1: customer?.address_line_1 ?? '',
        address_line_2: customer?.address_line_2 ?? '',
        city: customer?.city ?? '',
        state: customer?.state ?? '',
        postal_code: customer?.postal_code ?? '',
        country: customer?.country ?? '',
    };
}

