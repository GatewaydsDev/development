import CrewRatePicker, { type RateGroup } from '@/Components/CrewRatePicker';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { useState } from 'react';

export type AttendanceMemberData = {
    uuid: string;
    name: string;
    is_foreman: boolean;
    present: boolean;
    hours: string | null;
    hourly: boolean;
    locked: boolean;
    skill: string | null;
    skill_id: number | null;
    pay_rate_id: number | null;
    rate_label: string | null;
    options: RateGroup[];
};

type Props = {
    member: AttendanceMemberData;
    scheduleUuid: string;
    date: string;
    editable: boolean;
};

export default function AttendanceMember({ member, scheduleUuid, date, editable }: Props) {
    const [open, setOpen] = useState(false);
    const [present, setPresent] = useState(member.present);
    const [hours, setHours] = useState(member.hours ?? '8');
    const [skillId, setSkillId] = useState<number | null>(member.skill_id);
    const [rateId, setRateId] = useState<number | null>(member.pay_rate_id);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const status = member.present
        ? member.hours
            ? `${member.hours} h`
            : 'Present'
        : member.locked
          ? 'Other job'
          : 'Absent';

    const save = () => {
        setBusy(true);
        setErrors({});
        const options = {
            preserveScroll: true,
            onError: (e: Record<string, string>) => setErrors(e),
            onFinish: () => setBusy(false),
        };

        const rateChanged = skillId !== member.skill_id || rateId !== member.pay_rate_id;
        const sendAttendance = () =>
            router.post(
                route('admin.job-progress.attendance', scheduleUuid),
                { date, employee_uuid: member.uuid, present, hours: present ? hours : null },
                {
                    ...options,
                    onSuccess: () => setOpen(false),
                },
            );

        if (rateChanged) {
            router.post(
                route('admin.job-progress.crew.update', [scheduleUuid, member.uuid]),
                { skill_id: skillId, employee_pay_rate_id: rateId, date },
                { ...options, onSuccess: sendAttendance, onFinish: () => undefined },
            );
        } else {
            sendAttendance();
        }
    };

    return (
        <li className="flex flex-col gap-2">
            <button
                type="button"
                disabled={!editable || member.locked}
                onClick={() => setOpen(!open)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left enabled:hover:bg-muted"
            >
                <span className="flex flex-col">
                    <span>
                        {member.name}
                        {member.is_foreman && ' (foreman)'}
                    </span>
                    {member.rate_label && (
                        <span className="text-xs text-muted-foreground">
                            {member.skill ? `${member.skill} · ` : ''}
                            {member.rate_label}
                        </span>
                    )}
                </span>
                <span className={member.present ? 'text-emerald-700' : 'text-muted-foreground'}>{status}</span>
            </button>
            {open && (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={present} onChange={(e) => setPresent(e.target.checked)} className="size-5" />
                        Worked this day
                    </label>
                    {present && (
                        <label className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">Time worked (hours)</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={0.25}
                                max={24}
                                step={0.25}
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                className="h-11 rounded-md border border-border bg-background px-3"
                            />
                            {!member.hourly && (
                                <span className="text-xs text-muted-foreground">Paid per day or half day, hours are for reference.</span>
                            )}
                        </label>
                    )}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Skill and pay rate</span>
                        <CrewRatePicker
                            groups={member.options}
                            skillId={skillId}
                            rateId={rateId}
                            onChange={(s, r) => {
                                setSkillId(s);
                                setRateId(r);
                            }}
                        />
                    </div>
                    {Object.values(errors).map((message, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {message}
                        </p>
                    ))}
                    <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={busy} onClick={save}>
                            Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
}
