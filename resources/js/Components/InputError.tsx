import { schedulePendingValidationScroll } from '@/lib/scrollToValidationError';
import { cn } from '@/lib/utils';
import { HTMLAttributes, useLayoutEffect } from 'react';

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    useLayoutEffect(() => {
        if (!message) {
            return;
        }

        schedulePendingValidationScroll();
    }, [message]);

    return message ? (
        <p
            {...props}
            data-validation-error=""
            className={cn('scroll-mt-24 text-sm text-destructive', className)}
        >
            {message}
        </p>
    ) : null;
}
