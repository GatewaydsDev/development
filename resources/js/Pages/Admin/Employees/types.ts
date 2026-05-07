export type EmployeePayload = {
    id: number;
    uuid: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone_number: string | null;
    job_title: string | null;
    department: string | null;
    employment_status: string;
    hire_date: string | null;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
};

export type EmployeesPaginator = {
    data: EmployeePayload[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: PaginationLink[];
};

export type EmployeeFormData = {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    job_title: string;
    department: string;
    employment_status: string;
    hire_date: string;
    notes: string;
};

export type EmployeeStatusOptions = Record<string, string>;

export function employeeToFormData(
    employee?: EmployeePayload,
): EmployeeFormData {
    return {
        first_name: employee?.first_name ?? '',
        last_name: employee?.last_name ?? '',
        email: employee?.email ?? '',
        phone_number: employee?.phone_number ?? '',
        job_title: employee?.job_title ?? '',
        department: employee?.department ?? '',
        employment_status: employee?.employment_status ?? 'active',
        hire_date: employee?.hire_date ?? '',
        notes: employee?.notes ?? '',
    };
}
