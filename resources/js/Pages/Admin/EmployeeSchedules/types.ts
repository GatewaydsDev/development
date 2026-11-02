export type ScheduleProject = {
    id: number;
    uuid: string;
    name: string;
    project_number: string | null;
    address?: string | null;
};

export type SchedulePerson = {
    id: number;
    uuid?: string | null;
    name?: string;
    full_name?: string;
    email: string;
    job_title?: string | null;
    certifications?: ScheduleCertification[];
};

export type ScheduleStatusOption = {
    value: string;
    label: string;
};

export type SchedulePayload = {
    id: number;
    uuid: string;
    starts_on: string;
    ends_on: string;
    work_date: string;
    date_label: string | null;
    status: string;
    status_label: string;
    notes: string | null;
    requires_competent_person: boolean;
    competent_person: SchedulePerson | null;
    quality_control?: SchedulePerson | null;
    project: ScheduleProject | null;
    foreman: SchedulePerson | null;
    employees: SchedulePerson[];
    daily_task_uuids?: string[];
};

export type ScheduleDailyTask = {
    id: string;
    name: string;
    requires_photo?: boolean;
    requires_quality_control?: boolean;
    performed_by?: string;
    performed_by_label?: string | null;
    uuid: string;
    title: string;
    description: string | null;
};

export type ScheduleSkill = {
    id: number;
    name: string;
};

export type ScheduleCertification = {
    id: number;
    name: string;
    is_competent_person: boolean;
};

export type ScheduleOption = {
    id: number;
    uuid?: string | null;
    name?: string;
    full_name?: string;
    email: string;
    job_title?: string | null;
    employee_uuid?: string | null;
    foreman_user_id?: number | null;
    project_number?: string | null;
    skills?: ScheduleSkill[];
    certifications?: ScheduleCertification[];
    competent_person?: boolean;
    quality_control?: boolean;
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
