import { Button } from '@/Components/ui/button';
import { queueFocusAddedRow } from '@/lib/focusFirstField';
import { cn } from '@/lib/utils';
import { PlusIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';

// These are the same section surfaces used by the Project Control form.
export const formRemoveButtonClassName =
    'h-9 shrink-0 border-rose-200 px-3 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800/60 dark:text-rose-300 dark:hover:bg-rose-950/40';

export const formSectionColors = {
    emerald: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
    sky: 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30',
    amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
    violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
};

export default function FormSection({ title, description, icon: Icon, tone = 'emerald', addScope = false, children }: {
    title: string;
    description?: string;
    icon: LucideIcon;
    tone?: keyof typeof formSectionColors;
    addScope?: boolean;
    children: ReactNode;
}) {
    return (
        <section aria-label={title} data-add-scope={addScope ? '' : undefined} className={`min-w-0 rounded-lg border p-4 sm:p-6 ${formSectionColors[tone]}`}>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Icon className="size-5 shrink-0" aria-hidden="true" />{title}
            </h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            <div className="mt-4 min-w-0">{children}</div>
        </section>
    );
}

export function FormSectionHeading({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
}) {
    return (
        <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {title}
            </h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
    );
}

export function FormAddButton({
    className,
    children,
    type = 'button',
    focusPlacement = 'end',
    onClick,
    ...props
}: ComponentProps<typeof Button> & { focusPlacement?: 'start' | 'end' }) {
    return (
        <div className="flex justify-end">
            <Button
                {...props}
                type={type}
                variant="create"
                className={cn('h-8 w-auto px-3 text-xs', className)}
                onClick={(event) => {
                    const scope = event.currentTarget.closest('[data-add-scope]');
                    onClick?.(event);
                    queueFocusAddedRow(scope, focusPlacement);
                }}
            >
                <PlusIcon className="size-3.5" />
                {children}
            </Button>
        </div>
    );
}

export function FormRemoveButton({
    label,
    className,
    ...props
}: ComponentProps<typeof Button> & { label: string }) {
    return (
        <Button
            {...props}
            type="button"
            variant="outline"
            aria-label={label}
            title={label}
            className={cn(formRemoveButtonClassName, className)}
        >
            <Trash2Icon className="size-4" />
        </Button>
    );
}
