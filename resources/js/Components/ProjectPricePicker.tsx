import { formatCurrency } from '@/lib/money';

export type ProjectPriceOption = {
    id: number;
    label: string;
    amount: string | number;
};

type ProjectPricePickerProps = {
    prices: ProjectPriceOption[];
    value: string[];
    onChange: (ids: string[]) => void;
};

export default function ProjectPricePicker({
    prices,
    value,
    onChange,
}: ProjectPricePickerProps) {
    if (prices.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                This project has no prices yet. Add them on the project, for
                example one price for 2 windows and another for 3 windows.
            </p>
        );
    }

    const selected = prices.filter((price) => value.includes(String(price.id)));
    const total = selected.reduce(
        (sum, price) => sum + (Number(price.amount) || 0),
        0,
    );

    const toggle = (priceId: string) => {
        onChange(
            value.includes(priceId)
                ? value.filter((id) => id !== priceId)
                : [...value, priceId],
        );
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
                {prices.map((price) => {
                    const priceId = String(price.id);
                    const checked = value.includes(priceId);

                    return (
                        <label
                            key={price.id}
                            className={
                                checked
                                    ? 'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-700 dark:bg-emerald-950/40'
                                    : 'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm'
                            }
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(priceId)}
                                />
                                <span className="truncate font-medium">
                                    {price.label}
                                </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                                {formatCurrency(price.amount)}
                            </span>
                        </label>
                    );
                })}
            </div>
            {selected.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                    Selected total {formatCurrency(total)}
                </p>
            ) : null}
        </div>
    );
}
