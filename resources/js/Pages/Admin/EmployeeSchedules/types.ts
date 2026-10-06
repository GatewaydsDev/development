export type ScheduleProject = {
    id: number;
    name: string;
    project_number: string | null;
    address?: string | null;
};

export type SchedulePerson = {
    id: number;
    name?: string;
    full_name?: string;
    email: string;
};

export type SchedulePayload = {
    id: number;
    work_date: string;
    notes: string | null;
    project: ScheduleProject | null;
    foreman: SchedulePerson | null;
    employees: SchedulePerson[];
};

export type ScheduleOption = {
    id: number;
    name?: string;
    full_name?: string;
    email: string;
    project_number?: string | null;
};

export type SchedulePaginator = {
    data: SchedulePayload[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
};
