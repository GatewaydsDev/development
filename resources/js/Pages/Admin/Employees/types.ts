export type NamedOption = {
    id: number;
    name: string;
};

export type ProjectOption = NamedOption & {
    project_number: string | null;
};

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
    date_of_birth: string | null;
    language: NamedOption | null;
    notes: string | null;
    professions: NamedOption[];
    skills: NamedOption[];
    project_assignments: EmployeeProjectAssignmentPayload[];
    skill_shifts: EmployeeSkillShiftPayload[];
    pay_rates: EmployeePayRatePayload[];
    created_at: string | null;
    updated_at: string | null;
};

export type ProfessionOption = NamedOption;

export type EmployeePayRatePayload = {
    id: number;
    profession_id: number;
    profession: ProfessionOption | null;
    rate_type: string;
    custom_rate_type: string | null;
    amount: string;
    notes: string | null;
};

export type EmployeeProjectAssignmentPayload = {
    id: number;
    project_id: number;
    work_date: string | null;
    notes: string | null;
    project: ProjectOption | null;
};

export type EmployeeSkillShiftPayload = {
    id: number;
    skill_id: number;
    skill: NamedOption | null;
    shift_type: string;
    pay_basis: string;
    amount: string;
    is_union_member: boolean;
    union_rate: string | null;
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
    date_of_birth: string;
    language_id: string;
    notes: string;
    professions: EmployeeProfessionFormData[];
    skills: EmployeeSkillFormData[];
    project_assignments: EmployeeProjectAssignmentFormData[];
    skill_shifts: EmployeeSkillShiftFormData[];
    pay_rates: EmployeePayRateFormData[];
};

export type EmployeeStatusOptions = Record<string, string>;

export type EmployeeRateTypeOptions = Record<string, string>;

export type EmployeeOptionMap = Record<string, string>;

export type EmployeePayRateFormData = {
    profession_id: string;
    rate_type: string;
    custom_rate_type: string;
    amount: string;
    notes: string;
};

export type EmployeeProfessionFormData = {
    profession_id: string;
};

export type EmployeeSkillFormData = {
    skill_id: string;
};

export type EmployeeProjectAssignmentFormData = {
    project_id: string;
    work_date: string;
    notes: string;
};

export type EmployeeSkillShiftFormData = {
    skill_id: string;
    shift_type: string;
    pay_basis: string;
    amount: string;
    is_union_member: boolean;
    union_rate: string;
    notes: string;
};

export function employeeToFormData(
    employee?: EmployeePayload,
): EmployeeFormData {
    const professionIds = employee?.professions?.length
        ? employee.professions.map((profession) => String(profession.id))
        : [
              ...new Set(
                  employee?.pay_rates.map((payRate) =>
                      String(payRate.profession_id),
                  ) ?? [],
              ),
          ];

    return {
        first_name: employee?.first_name ?? '',
        last_name: employee?.last_name ?? '',
        email: employee?.email ?? '',
        phone_number: employee?.phone_number ?? '',
        job_title: employee?.job_title ?? '',
        department: employee?.department ?? '',
        employment_status: employee?.employment_status ?? 'active',
        hire_date: employee?.hire_date ?? '',
        date_of_birth: employee?.date_of_birth ?? '',
        language_id: employee?.language ? String(employee.language.id) : '',
        notes: employee?.notes ?? '',
        professions: professionIds.map((professionId) => ({ profession_id: professionId })),
        skills:
            employee?.skills.map((skill) => ({
                skill_id: String(skill.id),
            })) ?? [],
        project_assignments:
            employee?.project_assignments.map((assignment) => ({
                project_id: String(assignment.project_id),
                work_date: assignment.work_date ?? '',
                notes: assignment.notes ?? '',
            })) ?? [],
        skill_shifts:
            employee?.skill_shifts.map((shift) => ({
                skill_id: String(shift.skill_id),
                shift_type: shift.shift_type,
                pay_basis: shift.pay_basis,
                amount: shift.amount,
                is_union_member: shift.is_union_member,
                union_rate: shift.union_rate ?? '',
                notes: shift.notes ?? '',
            })) ?? [],
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

export function formatDisplayDate(value?: string | null): string {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return value ?? '';
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
}
