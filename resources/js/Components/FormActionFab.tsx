import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, MenuIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

type FormActionFabProps = {
    cancelHref: string;
    saveLabel?: string;
    cancelLabel?: string;
    disabled?: boolean;
};

export default function FormActionFab({
    cancelHref,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    disabled = false,
}: FormActionFabProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-3 z-40 flex flex-col items-center gap-2 sm:bottom-8 sm:right-5">
            <div
                className={cn(
                    'flex flex-col items-center gap-2 transition duration-200',
                    isOpen
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-3 opacity-0',
                )}
            >
                <Button
                    type="submit"
                    disabled={disabled}
                    className="size-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-700"
                    aria-label={saveLabel}
                    title={saveLabel}
                >
                    <CheckIcon className="size-5" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="size-12 rounded-full border-rose-200 bg-background text-rose-700 shadow-lg hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    aria-label={cancelLabel}
                    title={cancelLabel}
                    onClick={() => {
                        window.location.href = cancelHref;
                    }}
                >
                    <XIcon className="size-5" />
                </Button>
            </div>

            <Button
                type="button"
                className="size-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90"
                aria-expanded={isOpen}
                aria-label="Toggle form actions"
                onClick={() => setIsOpen((current) => !current)}
            >
                <MenuIcon
                    className={cn(
                        'size-6 transition duration-200',
                        isOpen && 'rotate-45',
                    )}
                />
            </Button>
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
                Actions
            </span>
        </div>
    );
}
