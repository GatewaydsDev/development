export default function ProgressBar({
    value,
    className = '',
}: {
    value: number;
    className?: string;
}) {
    const percent = Math.max(0, Math.min(100, value));

    return (
        <div
            className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}
