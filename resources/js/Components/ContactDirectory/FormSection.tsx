import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';

// These are the same section surfaces used by the Project Control form.
export const formSectionColors = {
    emerald: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    sky: 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
};

export default function FormSection({ title, description, icon: Icon, tone = 'emerald', children }: {
    title: string;
    description?: string;
    icon: LucideIcon;
    tone?: keyof typeof formSectionColors;
    children: ReactNode;
}) {
    return (
        <section aria-label={title} className={`min-w-0 rounded-lg border p-4 sm:p-6 ${formSectionColors[tone]}`}>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Icon className="size-5 shrink-0" aria-hidden="true" />{title}
            </h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-4 min-w-0">{children}</div>
        </section>
    );
}
