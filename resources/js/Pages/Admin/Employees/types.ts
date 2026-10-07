export type NamedOption = {
    id: number;
    name: string;
};

export type ProjectOption = NamedOption & {
    project_number: string | null;
};

export type ForemanOption = {
    id: number;
    name: string;
    email: string;
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
    foreman: ForemanOption | null;
    user: {
        id: number;
        name: string;
        email: string;
        level: NamedOption | null;
    } | null;
    professions: EmployeeProfessionPayload[];
    certifications: EmployeeCertificationPayload[];
    skills: EmployeeSkillPayload[];
    project_assignments: EmployeeProjectAssignmentPayload[];
    skill_shifts: EmployeeSkillShiftPayload[];
    pay_rates: EmployeePayRatePayload[];
    created_at: string | null;
    updated_at: string | null;
};

export type ProfessionOption = NamedOption;

export type EmployeeProfessionRatePayload = {
    id: number;
    profession_id: number;
    rate_type: string;
    custom_rate_type: string | null;
    amount: string;
    notes: string | null;
};

export type EmployeeProfessionPayload = NamedOption & {
    rates: EmployeeProfessionRatePayload[];
};

export type EmployeePayRatePayload = {
    id: number;
    skill_id?: number | null;
    profession_id: number | null;
    profession: ProfessionOption | null;
    skill?: NamedOption | null;
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
    account_level_id: string;
    account_password: string;
    account_password_confirmation: string;
    employment_status: string;
    hire_date: string;
    date_of_birth: string;
    language_id: string;
    notes: string;
    skills: EmployeeSkillFormData[];
    certifications: EmployeeCertificationFormData[];
};

export type EmployeeStatusOptions = Record<string, string>;

export type EmployeeRateTypeOptions = Record<string, string>;

export type EmployeeOptionMap = Record<string, string>;

export type EmployeeProfessionRateFormData = {
    rate_type: string;
    custom_rate_type: string;
    amount: string;
    notes: string;
};

export type EmployeeProfessionFormData = {
    profession_id: string;
    rates: EmployeeProfessionRateFormData[];
};

export type EmployeeSkillPayload = NamedOption & {
    rates: EmployeePayRatePayload[];
};

export type EmployeeSkillRateFormData = {
    rate_type: string;
    amount: string;
};

export type CertificationOption = NamedOption & {
    is_competent_person?: boolean;
};

export type EmployeeCertificationPayload = {
    id: number;
    uuid: string;
    certification_id: number;
    name: string | null;
    is_competent_person: boolean;
    issued_on: string | null;
    expires_on: string | null;
};

export type EmployeeCertificationFormData = {
    certification_id: string;
    issued_on: string;
    expires_on: string;
};

export type EmployeeSkillFormData = {
    skill_id: string;
    rates: EmployeeSkillRateFormData[];
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

export function emptyProfessionRate(): EmployeeProfessionRateFormData {
    return {
        rate_type: 'hourly',
        custom_rate_type: '',
        amount: '',
        notes: '',
    };
}

export function emptySkillRate(): EmployeeSkillRateFormData {
    return {
        rate_type: 'hourly',
        amount: '',
    };
}

export function employeeToFormData(
    employee?: EmployeePayload,
): EmployeeFormData {
    const skillIds = employee?.skills?.length
        ? employee.skills.map((skill) => String(skill.id))
        : [];

    for (const payRate of employee?.pay_rates ?? []) {
        if (!payRate.skill_id) {
            continue;
        }

        const skillId = String(payRate.skill_id);

        if (!skillIds.includes(skillId)) {
            skillIds.push(skillId);
        }
    }

    const ratesBySkill = new Map<string, EmployeeSkillRateFormData[]>();

    for (const payRate of employee?.pay_rates ?? []) {
        if (!payRate.skill_id) {
            continue;
        }

        const skillId = String(payRate.skill_id);
        const rates = ratesBySkill.get(skillId) ?? [];

        rates.push({
            rate_type: payRate.rate_type,
            amount: payRate.amount,
        });
        ratesBySkill.set(skillId, rates);
    }

    return {
        first_name: employee?.first_name ?? '',
        last_name: employee?.last_name ?? '',
        email: employee?.email ?? '',
        phone_number: employee?.phone_number ?? '',
        job_title: employee?.job_title ?? '',
        department: employee?.department ?? '',
        account_level_id: employee?.user?.level
            ? String(employee.user.level.id)
            : '',
        account_password: '',
        account_password_confirmation: '',
        employment_status: employee?.employment_status ?? 'active',
        hire_date: employee?.hire_date ?? '',
        date_of_birth: employee?.date_of_birth ?? '',
        language_id: employee?.language ? String(employee.language.id) : '',
        notes: employee?.notes ?? '',
        certifications: (employee?.certifications ?? []).map((certification) => ({
            certification_id: certification.certification_id
                ? String(certification.certification_id)
                : '',
            issued_on: certification.issued_on ?? '',
            expires_on: certification.expires_on ?? '',
        })),
        skills: skillIds.map((skillId) => ({
            skill_id: skillId,
            rates: ratesBySkill.get(skillId) ?? [],
        })),
    };
}

export function formatDisplayDate(value?: string | null): string {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return value ?? '';
    }

    return `${match[2]}/${match[3]}/${match[1]}`;
}
