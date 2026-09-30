import { schedulePendingValidationScroll } from '@/lib/scrollToValidationError';
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
            className={'scroll-mt-24 text-sm text-red-600 ' + className}
        >
            {message}
        </p>
    ) : null;
}
