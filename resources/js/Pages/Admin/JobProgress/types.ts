export type JobSchedule = {
    uuid: string;
    status: string;
    status_label: string;
    starts_on: string | null;
    ends_on: string | null;
    project: {
        uuid: string;
        name: string | null;
        project_number: string | null;
    } | null;
    foreman: string | null;
};

export type JobSummary = {
    progress: number;
    tasks_total: number;
    tasks_done: number;
    tasks_blocked: number;
    photos: number;
    photos_missing: number;
    qc_required: number;
    qc_passed: number;
    qc_open: number;
    days_worked: number;
    hours: number;
};

export type ReportSummary = {
    uuid: string;
    inspected_on: string;
    result: string;
    result_label: string;
    inspector: string | null;
    failed_checks: number;
};

export const statusClasses: Record<string, string> = {
    pending: 'bg-slate-200 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-800',
    completed: 'bg-emerald-100 text-emerald-800',
    blocked: 'bg-red-100 text-red-800',
};

export const resultClasses: Record<string, string> = {
    passed: 'bg-emerald-100 text-emerald-800',
    rework: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
};
