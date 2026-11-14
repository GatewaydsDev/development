import { Badge } from '@/Components/ui/badge';
import { cn } from '@/lib/utils';
import { RadioIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const activeWindow = 10 * 60 * 1_000;
const clockRefresh = 30_000;

function changedRecently(changedAt: string | null): boolean {
    if (!changedAt) {
        return false;
    }

    const timestamp = Date.parse(changedAt);

    return Number.isFinite(timestamp) && Date.now() - timestamp < activeWindow;
}

export default function TaskActivityIndicator({
    changedAt,
}: {
    changedAt: string | null;
}) {
    const [active, setActive] = useState(() => changedRecently(changedAt));

    useEffect(() => {
        const update = () => setActive(changedRecently(changedAt));

        update();
        const interval = window.setInterval(update, clockRefresh);

        return () => window.clearInterval(interval);
    }, [changedAt]);

    return (
        <Badge
            variant="outline"
            className={cn(
                'gap-1.5',
                active
                    ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                    : 'text-muted-foreground',
            )}
            title={
                active
                    ? 'This task changed within the last 10 minutes.'
                    : 'No changes to this task in the last 10 minutes.'
            }
        >
            <RadioIcon
                className={cn(
                    'size-3',
                    active && 'animate-pulse text-emerald-500',
                )}
            />
            {active ? 'Active' : 'Idle'}
        </Badge>
    );
}
