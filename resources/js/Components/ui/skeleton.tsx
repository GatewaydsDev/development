import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-foreground/20', className)}
            {...props}
        />
    );
}

export { Skeleton };
