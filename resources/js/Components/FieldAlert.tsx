import { schedulePendingValidationScroll } from '@/lib/scrollToValidationError';
import { AlertCircleIcon } from 'lucide-react';
import { useLayoutEffect } from 'react';

export default function FieldAlert({
    title,
    message,
}: {
    title: string;
    message?: string;
}) {
    useLayoutEffect(() => {
        if (message) {
            schedulePendingValidationScroll();
        }
    }, [message]);

    if (!message) {
        return null;
    }

    return (
        <div
            role="alert"
            data-validation-error=""
            className="scroll-mt-24 flex items-start gap-3 rounded-lg border border-red-300/60 bg-red-50 p-3 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
        >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">
                <AlertCircleIcon className="size-4" />
            </span>
            <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs opacity-90">{message}</p>
            </div>
        </div>
    );
}
