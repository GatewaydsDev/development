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
    pay_rates: EmployeePayRatePayload[];
    created_at: string | null;
    updated_at: string | null;
};

export type ProfessionOption = {
    id: number;
    name: string;
};

export type EmployeePayRatePayload = {
    id: number;
    profession_id: number;
    profession: ProfessionOption | null;
    rate_type: string;
    custom_rate_type: string | null;
    amount: string;
    notes: string | null;
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
    pay_rates: EmployeePayRateFormData[];
};

export type EmployeeStatusOptions = Record<string, string>;

export type EmployeeRateTypeOptions = Record<string, string>;

export type EmployeePayRateFormData = {
    profession_id: string;
    rate_type: string;
    custom_rate_type: string;
    amount: string;
    notes: string;
};

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
        pay_rates:
            employee?.pay_rates.map((payRate) => ({
                profession_id: String(payRate.profession_id),
                rate_type: payRate.rate_type,
                custom_rate_type: payRate.custom_rate_type ?? '',
                amount: payRate.amount,
                notes: payRate.notes ?? '',
            })) ?? [],
    };
}
