import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { CheckIcon, MenuIcon, PrinterIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type FormActionFabProps = {
    cancelHref: string;
    saveLabel?: string;
    cancelLabel?: string;
    disabled?: boolean;
    form?: string;
    printHref?: string;
    onPrint?: () => void;
    printLabel?: string;
    showPrint?: boolean;
};

export default function FormActionFab({
    cancelHref,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    disabled = false,
    form,
    printHref,
    onPrint,
    printLabel = 'Print',
    showPrint = false,
}: FormActionFabProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const hasPrint = showPrint || Boolean(printHref) || Boolean(onPrint);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeIfOutside = (event: Event) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', closeIfOutside);

        return () => {
            document.removeEventListener('pointerdown', closeIfOutside);
        };
    }, [isOpen]);

    return (
        <div
            ref={rootRef}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 flex flex-col items-center gap-1.5 sm:bottom-8 sm:right-5 sm:gap-2 landscape:bottom-3 landscape:right-3 landscape:gap-1"
        >
            <div
                className={cn(
                    'absolute bottom-full flex flex-col items-center gap-1.5 pb-2 sm:gap-2 sm:pb-3 landscape:gap-1 landscape:pb-1.5 transition-all duration-300 ease-out',
                    isOpen
                        ? 'translate-y-0 opacity-100'
                        : 'pointer-events-none translate-y-2 opacity-0',
                )}
            >
                <Button
                    type="submit"
                    form={form}
                    disabled={disabled}
                    className={cn(
                        'size-10 sm:size-12 landscape:size-9 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/20 transition-all duration-300 ease-out hover:bg-emerald-700',
                        isOpen
                            ? hasPrint
                                ? 'scale-100 opacity-100 delay-150'
                                : 'scale-100 opacity-100 delay-75'
                            : 'scale-90 opacity-0 delay-0',
                    )}
                    aria-label={saveLabel}
                    title={saveLabel}
                >
                    <CheckIcon className="size-4 sm:size-5 landscape:size-4" />
                </Button>
                {hasPrint &&
                    (printHref ? (
                        <Button
                            type="button"
                            variant="outline"
                            asChild
                            className={cn(
                                'size-10 sm:size-12 landscape:size-9 rounded-full border-sky-200 bg-background text-sky-700 shadow-lg transition-all duration-300 ease-out hover:bg-sky-50 dark:border-sky-900/70 dark:text-sky-300 dark:hover:bg-sky-950/30',
                                isOpen
                                    ? 'scale-100 opacity-100 delay-75'
                                    : 'scale-90 opacity-0 delay-75',
                            )}
                        >
                            <a
                                href={printHref}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={printLabel}
                                title={printLabel}
                            >
                                <PrinterIcon className="size-4 sm:size-5 landscape:size-4" />
                            </a>
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                if (onPrint) {
                                    onPrint();
                                } else {
                                    window.print();
                                }
                            }}
                            className={cn(
                                'size-10 sm:size-12 landscape:size-9 rounded-full border-sky-200 bg-background text-sky-700 shadow-lg transition-all duration-300 ease-out hover:bg-sky-50 dark:border-sky-900/70 dark:text-sky-300 dark:hover:bg-sky-950/30',
                                isOpen
                                    ? 'scale-100 opacity-100 delay-75'
                                    : 'scale-90 opacity-0 delay-75',
                            )}
                            aria-label={printLabel}
                            title={printLabel}
                            >
                                <PrinterIcon className="size-4 sm:size-5 landscape:size-4" />
                            </Button>
                    ))}
                <Button
                    type="button"
                    variant="outline"
                    asChild
                    className={cn(
                        'size-10 sm:size-12 landscape:size-9 rounded-full border-rose-200 bg-background text-rose-700 shadow-lg transition-all duration-300 ease-out hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30',
                        isOpen
                            ? 'scale-100 opacity-100 delay-0'
                            : hasPrint
                              ? 'scale-90 opacity-0 delay-150'
                              : 'scale-90 opacity-0 delay-75',
                    )}
                >
                    <Link
                        href={cancelHref}
                        aria-label={cancelLabel}
                        title={cancelLabel}
                    >
                        <XIcon className="size-4 sm:size-5 landscape:size-4" />
                    </Link>
                </Button>
            </div>

            <Button
                type="button"
                className="size-12 sm:size-14 landscape:size-11 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition hover:scale-105 hover:bg-primary/90"
                aria-expanded={isOpen}
                aria-label="Toggle form actions"
                onClick={() => setIsOpen((current) => !current)}
            >
                <MenuIcon
                    className={cn(
                        'size-5 sm:size-6 landscape:size-5 transition duration-200',
                        isOpen && 'rotate-45',
                    )}
                />
            </Button>
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">
                Actions
            </span>
        </div>
    );
}
