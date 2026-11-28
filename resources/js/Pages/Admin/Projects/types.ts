import { coerceStateInitials } from '@/lib/stateInitials';

export type ProjectCapabilities = {
    create: boolean;
    update: boolean;
    delete: boolean;
    viewSensitiveFields: boolean;
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
    priorityOptions: ProjectStatusOption[];
    serviceTypes: string[];
    scopeTypes: ProjectScopeTypeOption[];
    products: ProjectCatalogOption[];
    services: ProjectCatalogOption[];
    assignees: Array<{
        id: number;
        name: string;
    }>;
    contractors: ContractorOption[];
    companies: Array<{ uuid: string; name: string }>;
    can: ProjectCapabilities;
    nextProjectNumber?: string;
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

export type ProjectBidDate = {
    id?: number;
    bid_date: string | null;
    bid_time?: string | null;
    notes: string | null;
    user_id?: number | null;
    user?: {
        id: number;
        name: string;
    } | null;
};

export function formatBidTime(value: string | null | undefined): string {
    const match = (value ?? '').match(/^(\d{2}):(\d{2})/);

    if (!match) {
        return '';
    }

    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minute} ${suffix}`;
}

export function bidDaysLeftLabel(
    isoDate: string | null | undefined,
    time?: string | null,
): string | null {
    const match = (isoDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) {
        return null;
    }

    const bid = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((bid.getTime() - today.getTime()) / 86400000);
    const opens = formatBidTime(time);

    if (days > 1) {
        return opens ? `${days} days left · Opens ${opens}` : `${days} days left`;
    }

    if (days === 1) {
        return opens ? `1 day left · Opens ${opens}` : '1 day left';
    }

    if (days === 0) {
        const timeMatch = (time ?? '').match(/^(\d{2}):(\d{2})/);

        if (timeMatch) {
            const now = new Date();
            const open = new Date();
            open.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);

            return now.getTime() > open.getTime()
                ? `Opened today at ${opens}`
                : `Opens today at ${opens}`;
        }

        return 'Bid is today';
    }

    if (days === -1) {
        return opens ? `1 day ago · ${opens}` : '1 day ago';
    }

    return opens
        ? `${Math.abs(days)} days ago · ${opens}`
        : `${Math.abs(days)} days ago`;
}

export type ProjectAddendum = {
    id?: number;
    number: string;
    issued_on: string | null;
    notes: string | null;
    document?: {
        name: string | null;
        url: string;
    } | null;
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
    prices?: Array<{
        id: number;
        label: string;
        amount: string | number;
    }>;
    internal_notes?: string | null;
    contractors: ProjectContractor[];
    companies?: Array<{ uuid: string; name: string; main_office: string | null }>;
    scopes: ProjectScope[];
    revisions: ProjectRevision[];
    bid_date?: string | null;
    addendums_count?: number;
    bid_dates?: ProjectBidDate[];
    addendums?: ProjectAddendum[];
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
    quotation?: {
        uuid: string;
        number: string | null;
        title: string | null;
        status: string;
        status_label: string;
    } | null;
    bid?: {
        uuid: string;
        status: string;
    } | null;
    takeoff?: {
        uuid: string;
        title: string;
        status: string;
        status_label: string;
    } | null;
    work_schedule?: {
        uuid: string;
        starts_on: string | null;
        ends_on: string | null;
        status: string;
        status_label: string;
        employees_count: number;
        schedules_count: number;
    } | null;
    bids_count?: number;
    latest_bid_uuid?: string | null;
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

export type ProjectBidDateFormData = {
    id: string;
    bid_date: string;
    bid_time: string;
    notes: string;
    user_id: string;
    user_name: string;
};

export type ProjectAddendumFormData = {
    id: string;
    number: string;
    issued_on: string;
    notes: string;
    document_name: string;
    document_url: string;
    document: File | null;
    remove_document: boolean;
    user_id: string;
    user_name: string;
};

export type ProjectPriceFormData = {
    id: string;
    label: string;
    amount: string;
};

export type ProjectFormData = {
    name: string;
    project_number: string;
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
    prices: ProjectPriceFormData[];
    public_notes: string;
    internal_notes: string;
    contractors: ProjectContractorFormData[];
    company_uuids: string[];
    scopes: ProjectScopeFormData[];
    revisions: ProjectRevisionFormData[];
    bid_dates: ProjectBidDateFormData[];
    addendums: ProjectAddendumFormData[];
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

export function blankPrice(): ProjectPriceFormData {
    return {
        id: '',
        label: '',
        amount: '',
    };
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

export function blankBidDate(userId = '', userName = ''): ProjectBidDateFormData {
    return {
        id: '',
        bid_date: '',
        bid_time: '',
        notes: '',
        user_id: userId,
        user_name: userName,
    };
}

export function blankAddendum(userId = '', userName = ''): ProjectAddendumFormData {
    return {
        id: '',
        number: '',
        issued_on: '',
        notes: '',
        document_name: '',
        document_url: '',
        document: null,
        remove_document: false,
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
              : [];

    return {
        name: project?.name ?? '',
        project_number:
            project?.project_number ?? options?.nextProjectNumber ?? '',
        assigned_to: project?.assignee ? String(project.assignee.id) : '',
        status_id: project?.status_id
            ? String(project.status_id)
            : defaultStatusId(options),
        priority: project?.priority ?? 'normal',
        site_address_line_1: project?.site_address_line_1 ?? '',
        site_address_line_2: project?.site_address_line_2 ?? '',
        site_city: project?.site_city ?? '',
        site_state: coerceStateInitials(project?.site_state),
        site_postal_code: project?.site_postal_code ?? '',
        site_country: project?.site_country ?? '',
        estimated_start_date: project?.estimated_start_date ?? '',
        estimated_end_date: project?.estimated_end_date ?? '',
        completed_at: project?.completed_at ?? '',
        budget_amount: project?.budget_amount ?? '',
        prices:
            project?.prices && project.prices.length > 0
                ? project.prices.map((price) => ({
                      id: String(price.id),
                      label: price.label ?? '',
                      amount:
                          price.amount === null || price.amount === undefined
                              ? ''
                              : String(price.amount),
                  }))
                : project?.budget_amount
                  ? [
                        {
                            id: '',
                            label: 'Budget',
                            amount: String(project.budget_amount),
                        },
                    ]
                  : [],
        public_notes: project?.public_notes ?? '',
        internal_notes: project?.internal_notes ?? '',
        company_uuids: project?.companies?.map((company) => company.uuid) ?? [],
        contractors:
            project?.contractors && project.contractors.length > 0
                ? project.contractors.map((contractor) => ({
                      contractor_id: String(contractor.id),
                      company_name: contractor.name ?? '',
                      contact_name: contractor.contact_name ?? '',
                      email: contractor.email ?? '',
                      phone_number: contractor.phone_number ?? '',
                  }))
                : [],
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
        bid_dates:
            project?.bid_dates && project.bid_dates.length > 0
                ? project.bid_dates.map((bidDate) => ({
                      id: bidDate.id ? String(bidDate.id) : '',
                      bid_date: bidDate.bid_date ?? '',
                      bid_time: (bidDate.bid_time ?? '').slice(0, 5),
                      notes: bidDate.notes ?? '',
                      user_id: bidDate.user_id
                          ? String(bidDate.user_id)
                          : bidDate.user
                            ? String(bidDate.user.id)
                            : '',
                      user_name: bidDate.user?.name ?? '',
                  }))
                : [],
        addendums:
            project?.addendums && project.addendums.length > 0
                ? project.addendums.map((addendum) => ({
                      id: addendum.id ? String(addendum.id) : '',
                      number: addendum.number ?? '',
                      issued_on: addendum.issued_on ?? '',
                      notes: addendum.notes ?? '',
                      document_name: addendum.document?.name ?? '',
                      document_url: addendum.document?.url ?? '',
                      document: null,
                      remove_document: false,
                      user_id: addendum.user_id
                          ? String(addendum.user_id)
                          : addendum.user
                            ? String(addendum.user.id)
                            : '',
                      user_name: addendum.user?.name ?? '',
                  }))
                : [],
    };
}
