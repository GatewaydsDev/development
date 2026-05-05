export type ProjectCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
    viewSensitiveFields: boolean;
    viewCustomerContactFields: boolean;
};

export type ProjectOptions = {
    statuses: string[];
    priorities: string[];
    serviceTypes: string[];
    assignees: Array<{
        id: number;
        name: string;
    }>;
    customers: ProjectCustomerOption[];
    can: ProjectCapabilities;
};

export type ProjectCustomerOption = {
    id: number;
    name: string;
    company_name: string | null;
    email: string | null;
    phone_number: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    contacts: Array<{
        id: number;
        name: string;
        title: string | null;
        email: string | null;
        phone_number: string | null;
        is_primary: boolean;
    }>;
};

export type ProjectCustomer = {
    id?: number | null;
    name: string | null;
    company_name: string | null;
    email?: string | null;
    phone_number?: string | null;
    contacts?: Array<{
        id: number;
        name: string;
        title: string | null;
        email: string | null;
        phone_number: string | null;
        is_primary: boolean;
    }>;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
};

export type ProjectPayload = {
    id: number;
    uuid: string;
    project_number: string | null;
    name: string;
    service_type: string | null;
    status: string;
    priority: string;
    estimated_start_date: string | null;
    estimated_end_date: string | null;
    completed_at: string | null;
    public_notes: string | null;
    site_address_line_1?: string | null;
    site_address_line_2?: string | null;
    site_city?: string | null;
    site_state?: string | null;
    site_postal_code?: string | null;
    site_country?: string | null;
    budget_amount?: string | null;
    internal_notes?: string | null;
    customer: ProjectCustomer;
    assignee: {
        id: number;
        name: string;
    } | null;
    creator?: {
        id: number;
        name: string;
    } | null;
    created_at: string | null;
    updated_at: string | null;
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type ProjectsPaginator = {
    data: ProjectPayload[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

export type ProjectFormData = {
    name: string;
    project_number: string;
    customer_id: string;
    assigned_to: string;
    service_type: string;
    status: string;
    priority: string;
    site_address_line_1: string;
    site_address_line_2: string;
    site_city: string;
    site_state: string;
    site_postal_code: string;
    site_country: string;
    estimated_start_date: string;
    estimated_end_date: string;
    completed_at: string;
    budget_amount: string;
    public_notes: string;
    internal_notes: string;
};

export function optionLabel(value?: string | null) {
    if (!value) {
        return 'Not set';
    }

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function projectToFormData(project?: ProjectPayload): ProjectFormData {
    return {
        name: project?.name ?? '',
        project_number: project?.project_number ?? '',
        customer_id: project?.customer.id ? String(project.customer.id) : '',
        assigned_to: project?.assignee ? String(project.assignee.id) : '',
        service_type: project?.service_type ?? '',
        status: project?.status ?? 'lead',
        priority: project?.priority ?? 'normal',
        site_address_line_1: project?.site_address_line_1 ?? '',
        site_address_line_2: project?.site_address_line_2 ?? '',
        site_city: project?.site_city ?? '',
        site_state: project?.site_state ?? '',
        site_postal_code: project?.site_postal_code ?? '',
        site_country: project?.site_country ?? '',
        estimated_start_date: project?.estimated_start_date ?? '',
        estimated_end_date: project?.estimated_end_date ?? '',
        completed_at: project?.completed_at ?? '',
        budget_amount: project?.budget_amount ?? '',
        public_notes: project?.public_notes ?? '',
        internal_notes: project?.internal_notes ?? '',
    };
}

