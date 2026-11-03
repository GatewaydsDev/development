import TextInput from '@/Components/TextInput';

type SplitDateTimeInputProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    max?: string;
    className?: string;
    defaultTime?: string;
};

/**
 * Separate date and time inputs that read and write a "YYYY-MM-DDTHH:mm" value,
 * so the date picker does not close on a half-finished datetime selection.
 */
export default function SplitDateTimeInput({
    id,
    value,
    onChange,
    required,
    max,
    className,
    defaultTime = '09:00',
}: SplitDateTimeInputProps) {
    const [date = '', time = ''] = value ? value.split('T') : [];

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
            <TextInput
                id={id}
                type="date"
                required={required}
                max={max ? max.split('T')[0] : undefined}
                className={className}
                value={date}
                onChange={(event) =>
                    onChange(
                        event.target.value
                            ? `${event.target.value}T${time || defaultTime}`
                            : '',
                    )
                }
            />
            <TextInput
                id={`${id}-time`}
                type="time"
                aria-label="Time"
                required={required}
                disabled={!date}
                className={className}
                value={time}
                onChange={(event) =>
                    date && onChange(`${date}T${event.target.value || defaultTime}`)
                }
            />
        </div>
    );
}
