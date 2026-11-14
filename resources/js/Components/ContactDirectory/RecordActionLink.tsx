import ActionHint from '@/Components/ActionHint';
import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import { EditIcon, EyeIcon } from 'lucide-react';

// Match Project Control's existing row actions, including dark-mode states.
export const recordActionClasses = {
    view: 'border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-800/60 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
    edit: 'border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800/60 dark:text-amber-400 dark:hover:bg-amber-950/40',
};

export default function RecordActionLink({ href, label, action, compact = true }: {
    href: string;
    label: string;
    action: keyof typeof recordActionClasses;
    compact?: boolean;
}) {
    const Icon = action === 'edit' ? EditIcon : EyeIcon;
    return (
        <ActionHint hint={label}>
            <Button asChild variant="outline" size={compact ? 'icon-sm' : 'default'} className={recordActionClasses[action]}>
                <Link href={href} aria-label={label}>
                    <Icon className="size-4" aria-hidden="true" />
                    {!compact && label}
                </Link>
            </Button>
        </ActionHint>
    );
}
