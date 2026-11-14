export type RateGroup = {
    id: number;
    name: string;
    rates: { id: number; label: string; amount: string }[];
};

type Props = {
    groups: RateGroup[];
    skillId: number | null;
    rateId: number | null;
    onChange: (skillId: number | null, rateId: number | null) => void;
};

const selectClass =
    'h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground';

export default function CrewRatePicker({ groups, skillId, rateId, onChange }: Props) {
    const group = groups.find((item) => item.id === skillId);

    return (
        <div className="grid gap-2 sm:grid-cols-2">
            <select
                aria-label="Skill"
                value={skillId ?? ''}
                onChange={(event) => {
                    const next = event.target.value ? Number(event.target.value) : null;
                    onChange(next, null);
                }}
                className={selectClass}
            >
                <option value="">Skill (default)</option>
                {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                        {item.name}
                    </option>
                ))}
            </select>
            <select
                aria-label="Pay rate"
                value={rateId ?? ''}
                disabled={!group || group.rates.length === 0}
                onChange={(event) =>
                    onChange(skillId, event.target.value ? Number(event.target.value) : null)
                }
                className={selectClass}
            >
                <option value="">{group && group.rates.length === 0 ? 'No rates for skill' : 'Rate (default)'}</option>
                {group?.rates.map((rate) => (
                    <option key={rate.id} value={rate.id}>
                        {rate.label} · ${Number(rate.amount).toFixed(2)}
                    </option>
                ))}
            </select>
        </div>
    );
}
