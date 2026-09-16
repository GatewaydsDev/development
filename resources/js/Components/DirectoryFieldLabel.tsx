import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export default function DirectoryFieldLabel({
    children,
    hideFrom = 'lg',
}: {
    children: ReactNode;
    hideFrom?: 'md' | 'lg' | 'xl';
}) {
    return (
        <p
            className={cn(
                'mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                hideFrom === 'md' && 'md:hidden',
                hideFrom === 'lg' && 'lg:hidden',
                hideFrom === 'xl' && 'xl:hidden',
            )}
        >
            {children}
        </p>
    );
}
