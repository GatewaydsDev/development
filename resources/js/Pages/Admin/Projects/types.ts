export type ProjectCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
    viewSensitiveFields: boolean;
    viewCustomerContactFields: boolean;
};

export type ContractorOption = {
    id: number;
    name: string;
    contact_name?: string | null;
    email?: string | null;
    phone_number?: string | null;
};

export type ProjectStatusOption = {
    id: number;
    name: string;
    slug: string;
};

export type ProjectScopeTypeOption = {
    id: number;
    name: string;
    slug: string;
};

export type ProjectCatalogOption = {
    id: number;
    name: string;
    abbreviation?: string | null;
    kind?: string | null;
};

export type ProjectOptions = {
    statuses: ProjectStatusOption[];
    priorities: string[];
    serviceTypes: string[];
    scopeTypes: ProjectScopeTypeOption[];
    products: ProjectCatalogOption[];
    services: ProjectCatalogOption[];
    assignees: Array<{
        id: number;
        name: string;
    }>;
    customers: ProjectCustomerOption[];
    contractors: ContractorOption[];
    can: ProjectCapabilities;
    nextProjectNumber?: string;
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

export type ProjectContractor = {
    id: number;
    name: string;
    contact_name: string | null;
    email?: string | null;
    phone_number?: string | null;
    contacts?: Array<{
        id: number;
        name: string;
        title?: string | null;
        email?: string | null;
        phone_number?: string | null;
        phone_type?: string | null;
        is_primary: boolean;
    }>;
};

export type ProjectScope = {
    id?: number;
    type: string;
    product_id?: number | null;
    product_name?: string | null;
    product_abbreviation?: string | null;
    service_id?: number | null;
    service_name?: string | null;
    notes?: string | null;
};

export type ProjectRevision = {
    id?: number;
    number: string;
    revision_date: string | null;
    notes: string | null;
    user_id?: number | null;
    user?: {
        id: number;
        name: string;
    } | null;
};

export type ProjectPayload = {
    id: number;
    uuid: string;
    project_number: string | null;
    name: string;
    service_type: string | null;
    status_id: number | null;
    status: string | null;
    status_slug?: string | null;
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
    contractors: ProjectContractor[];
    scopes: ProjectScope[];
    revisions: ProjectRevision[];
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
    bids_count?: number;
    latest_bid_id?: number | null;
    bid_scopes?: Array<{
        id: number;
        name: string;
    }>;
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

export type ProjectContractorFormData = {
    contractor_id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone_number: string;
};

export type ProjectScopeFormData = {
    type: string;
    notes: string;
};

export type ProjectRevisionFormData = {
    id: string;
    number: string;
    revision_date: string;
    notes: string;
    user_id: string;
    user_name: string;
};

export type ProjectFormData = {
    name: string;
    project_number: string;
    customer_id: string;
    customer_company_name: string;
    customer_email: string;
    customer_phone_number: string;
    assigned_to: string;
    status_id: string;
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
    contractors: ProjectContractorFormData[];
    scopes: ProjectScopeFormData[];
    revisions: ProjectRevisionFormData[];
};

export function scopeTypeLabel(
    type?: string | null,
    scopeTypes?: ProjectScopeTypeOption[],
) {
    if (!type) {
        return 'Not set';
    }

    return (
        scopeTypes?.find((item) => item.slug === type)?.name ??
        optionLabel(type)
    );
}

export function optionLabel(value?: string | null) {
    if (!value) {
        return 'Not set';
    }

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function blankScope(): ProjectScopeFormData {
    return {
        type: '',
        notes: '',
    };
}

export function blankRevision(userId = '', userName = ''): ProjectRevisionFormData {
    return {
        id: '',
        number: '',
        revision_date: '',
        notes: '',
        user_id: userId,
        user_name: userName,
    };
}

export function blankContractor(): ProjectContractorFormData {
    return {
        contractor_id: '',
        company_name: '',
        contact_name: '',
        email: '',
        phone_number: '',
    };
}

export function defaultStatusId(options?: ProjectOptions): string {
    const statuses = options?.statuses ?? [];
    const lead = statuses.find((status) => status.slug === 'lead');

    return String(lead?.id ?? statuses[0]?.id ?? '');
}

export function projectToFormData(
    project?: ProjectPayload,
    options?: ProjectOptions,
): ProjectFormData {
    const scopes =
        project?.scopes && project.scopes.length > 0
            ? project.scopes.map((scope) => ({
                  type: scope.type ?? '',
                  notes: scope.notes ?? '',
              }))
            : project?.service_type
              ? [
                    {
                        type: project.service_type,
                        notes: '',
                    },
                ]
              : [blankScope()];

    return {
        name: project?.name ?? '',
        project_number:
            project?.project_number ?? options?.nextProjectNumber ?? '',
        customer_id: project?.customer?.id ? String(project.customer.id) : '',
        customer_company_name:
            project?.customer?.company_name ?? project?.customer?.name ?? '',
        customer_email: project?.customer?.email ?? '',
        customer_phone_number: project?.customer?.phone_number ?? '',
        assigned_to: project?.assignee ? String(project.assignee.id) : '',
        status_id: project?.status_id
            ? String(project.status_id)
            : defaultStatusId(options),
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
        contractors:
            project?.contractors && project.contractors.length > 0
                ? project.contractors.map((contractor) => ({
                      contractor_id: String(contractor.id),
                      company_name: contractor.name ?? '',
                      contact_name: contractor.contact_name ?? '',
                      email: contractor.email ?? '',
                      phone_number: contractor.phone_number ?? '',
                  }))
                : [blankContractor()],
        scopes,
        revisions:
            project?.revisions && project.revisions.length > 0
                ? project.revisions.map((revision) => ({
                      id: revision.id ? String(revision.id) : '',
                      number: revision.number ?? '',
                      revision_date: revision.revision_date ?? '',
                      notes: revision.notes ?? '',
                      user_id: revision.user_id
                          ? String(revision.user_id)
                          : revision.user
                            ? String(revision.user.id)
                            : '',
                      user_name: revision.user?.name ?? '',
                  }))
                : [],
    };
}
