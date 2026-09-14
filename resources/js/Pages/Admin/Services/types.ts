export type ServicePayload = {
    id: number;
    uuid: string;
    name: string;
    description?: string | null;
    bid_count?: number;
};

export type ServiceFormData = {
    name: string;
    description: string;
};

export type ServicesPaginator = {
    data: ServicePayload[];
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

export const serviceToFormData = (
    service?: ServicePayload,
): ServiceFormData => ({
    name: service?.name ?? '',
    description: service?.description ?? '',
});
