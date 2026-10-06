export type AttendanceRateOption = {
    id: number;
    rate_type: string;
    custom_rate_type: string | null;
    amount: string;
    label: string;
};

export type AttendanceProfessionOption = {
    id: number;
    name: string;
    rates: AttendanceRateOption[];
};

export type AttendanceEmployeeOption = {
    id: number;
    full_name: string;
    email: string;
    professions: AttendanceProfessionOption[];
    skills: AttendanceProfessionOption[];
};

export type AttendanceDayPayload = {
    id: number;
    work_date: string;
    weekday: string | null;
    weekday_label: string | null;
    weekday_short: string | null;
    skill_id: number | null;
    skill: { id: number; name: string } | null;
    profession_id: number;
    profession: { id: number; name: string } | null;
    pay_rate_id: number | null;
    rate_type: string;
    custom_rate_type: string | null;
    amount: string;
    rate_label: string;
    scheduled: boolean;
    worked: boolean;
    notes: string | null;
};

export type AttendanceWeekPayload = {
    id: number;
    employee_id: number;
    employee: {
        id: number;
        full_name: string;
        email: string;
    } | null;
    week_start: string;
    week_end: string;
    week_label: string;
    notes: string | null;
    scheduled_count: number;
    worked_count: number;
    days: AttendanceDayPayload[];
};

export type AttendancePaginator = {
    data: AttendanceWeekPayload[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
    first_page_url?: string | null;
    last_page_url?: string | null;
    next_page_url?: string | null;
    prev_page_url?: string | null;
};

export type AttendanceDayForm = {
    scheduled: boolean;
    worked: boolean;
        skill_id: string;
        pay_rate_id: string;
    notes: string;
};

export type AttendanceFormData = {
    employee_id: string;
    week_start: string;
    notes: string;
    days: AttendanceDayForm[];
};

export const WORK_WEEK = [
    { offset: 0, label: 'Monday', short: 'Mon' },
    { offset: 1, label: 'Tuesday', short: 'Tue' },
    { offset: 2, label: 'Wednesday', short: 'Wed' },
    { offset: 3, label: 'Thursday', short: 'Thu' },
    { offset: 4, label: 'Friday', short: 'Fri' },
    { offset: 5, label: 'Saturday', short: 'Sat' },
] as const;

export function parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, (month || 1) - 1, day || 1);
}

export function formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function addDays(value: string, days: number): string {
    const date = parseIsoDate(value);
    date.setDate(date.getDate() + days);

    return formatIsoDate(date);
}

export function weekdayName(value: string): string {
    if (!value) {
        return '';
    }

    const weekday = parseIsoDate(value).getDay();

    if (weekday === 0) {
        return 'Sunday';
    }

    return WORK_WEEK[weekday - 1]?.label ?? '';
}

export function mondayOf(value: string): string {
    const date = parseIsoDate(value);
    const weekday = date.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    date.setDate(date.getDate() + diff);

    return formatIsoDate(date);
}

export function weekRangeLabel(weekStart: string): string {
    if (!weekStart) {
        return '';
    }

    const monday = parseIsoDate(weekStart);
    const saturday = parseIsoDate(addDays(weekStart, 5));
    const formatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    return `${formatter.format(monday)} – ${formatter.format(saturday)}, ${saturday.getFullYear()}`;
}

function emptyDay(): AttendanceDayForm {
    return {
        scheduled: false,
        worked: false,
        skill_id: '',
        pay_rate_id: '',
        notes: '',
    };
}

export function attendanceToFormData(
    attendance: AttendanceWeekPayload | undefined,
    employees: AttendanceEmployeeOption[],
    defaultWeekStart: string,
): AttendanceFormData {
    const weekStart = attendance?.week_start || defaultWeekStart;
    const employee = employees.find(
        (option) => option.id === attendance?.employee_id,
    );

    return {
        employee_id: attendance ? String(attendance.employee_id) : '',
        week_start: weekStart,
        notes: attendance?.notes ?? '',
        days: WORK_WEEK.map((weekday) => {
            const workDate = weekStart ? addDays(weekStart, weekday.offset) : '';
            const saved = attendance?.days.find(
                (day) => day.work_date === workDate,
            );

            if (!saved) {
                return emptyDay();
            }

            return {
                scheduled: saved.scheduled,
                worked: saved.worked,
                skill_id: saved.skill_id ? String(saved.skill_id) : '',
                pay_rate_id: matchingRateId(employee, saved),
                notes: saved.notes ?? '',
            };
        }),
    };
}

function matchingRateId(
    employee: AttendanceEmployeeOption | undefined,
    day: AttendanceDayPayload,
): string {
    const rates =
        employee?.skills.find((skill) => skill.id === day.skill_id)?.rates ??
        [];

    if (day.pay_rate_id && rates.some((rate) => rate.id === day.pay_rate_id)) {
        return String(day.pay_rate_id);
    }

    const match = rates.find(
        (rate) =>
            rate.rate_type === day.rate_type &&
            (rate.custom_rate_type ?? '') === (day.custom_rate_type ?? '') &&
            rate.amount === day.amount,
    );

    return match ? String(match.id) : '';
}
